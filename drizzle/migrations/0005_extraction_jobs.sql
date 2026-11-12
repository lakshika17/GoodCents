CREATE TABLE public.extraction_jobs(
  request_id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  submission_key uuid NOT NULL,
  storage_path text NOT NULL,
  pdf_sha256 text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  envelope jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id, submission_key)
);
GRANT SELECT ON public.extraction_jobs TO authenticated;
GRANT ALL ON public.extraction_jobs TO service_role;
ALTER TABLE public.extraction_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY extraction_jobs_own_select ON public.extraction_jobs FOR SELECT TO authenticated USING(owner_id=auth.uid());

CREATE FUNCTION public.begin_extraction(p_request_id uuid, p_submission_key uuid, p_pdf_sha256 text, p_storage_path text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE existing public.extraction_jobs; created public.extraction_jobs;
BEGIN
 IF public.current_employee() IS NULL THEN RAISE EXCEPTION 'Authorized employee required'; END IF;
 IF p_request_id IS NULL OR p_submission_key IS NULL OR p_pdf_sha256 !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Invalid extraction request'; END IF;
 IF p_storage_path IS DISTINCT FROM auth.uid()::text||'/'||p_submission_key::text THEN RAISE EXCEPTION 'Document must belong to this submission'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_submission_key::text,1));
 SELECT * INTO existing FROM public.extraction_jobs WHERE owner_id=auth.uid() AND submission_key=p_submission_key;
 IF existing.request_id IS NOT NULL THEN
  IF existing.pdf_sha256 IS DISTINCT FROM p_pdf_sha256 THEN RAISE EXCEPTION 'Document content changed for this submission'; END IF;
  RETURN to_jsonb(existing);
 END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='private-receipts' AND name=p_storage_path AND owner_id=auth.uid()::text) THEN RAISE EXCEPTION 'Upload the document before reading it'; END IF;
 INSERT INTO public.extraction_jobs(request_id,owner_id,submission_key,storage_path,pdf_sha256) VALUES(p_request_id,auth.uid(),p_submission_key,p_storage_path,p_pdf_sha256) RETURNING * INTO created;
 RETURN to_jsonb(created);
END $$;
REVOKE ALL ON FUNCTION public.begin_extraction(uuid,uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.begin_extraction(uuid,uuid,text,text) TO authenticated;

CREATE FUNCTION public.save_extraction_snapshot(p_request_id uuid, p_status text, p_envelope jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE job public.extraction_jobs;
BEGIN
 SELECT * INTO job FROM public.extraction_jobs WHERE request_id=p_request_id AND owner_id=auth.uid();
 IF job.request_id IS NULL THEN RAISE EXCEPTION 'Extraction request not found'; END IF;
 IF coalesce(p_status,'') NOT IN ('queued','processing','completed','needs_review','failed','unknown','checking') THEN RAISE EXCEPTION 'Invalid extraction status'; END IF;
 IF job.envelope IS NOT NULL THEN RETURN; END IF;
 UPDATE public.extraction_jobs SET status=p_status, envelope=CASE WHEN p_envelope IS NULL THEN envelope ELSE p_envelope END, updated_at=now() WHERE request_id=job.request_id;
END $$;
REVOKE ALL ON FUNCTION public.save_extraction_snapshot(uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_extraction_snapshot(uuid,text,jsonb) TO authenticated;

ALTER TABLE public.expenses ADD COLUMN extraction_request_id uuid;
COMMENT ON COLUMN public.expenses.extraction_request_id IS 'Source extraction request for AI-read submissions; NULL for manual entries.';

CREATE OR REPLACE FUNCTION public.internal_action(action text,payload jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE emp text:=public.current_employee(); target text:=payload->>'id'; x public.expenses; prior public.expenses; key uuid; canonical jsonb; path text; object_meta jsonb; decision text:=payload->>'decision';
BEGIN
 IF emp IS NULL THEN RAISE EXCEPTION 'Authorized employee required'; END IF;
 IF action='expense' THEN
  PERFORM public.validate_expense_document(payload);
  key:=(payload->>'submissionKey')::uuid;
  IF key IS NULL THEN RAISE EXCEPTION 'Submission key required'; END IF;
  canonical:=jsonb_build_object('vendor',payload->'vendor','amount',payload->'amount','currency',payload->'currency','date',payload->'date','documentType',payload->'documentType','documentNumber',payload->'documentNumber','source',payload->'source','verified',payload->'verified','paymentResponsibility',payload->'paymentResponsibility','paymentEvidenceConfirmed',payload->'paymentEvidenceConfirmed','category',payload->'category','departmentId',payload->'departmentId','projectId',payload->'projectId','description',payload->'description','receipt',payload->'receipt','submissionKey',payload->'submissionKey','extractionRequestId',payload->'extractionRequestId');
  PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text||key::text,0));
  SELECT * INTO prior FROM public.expenses WHERE submission_actor=auth.uid() AND submission_key=key;
  IF prior.id IS NOT NULL THEN
   IF prior.submission_payload IS DISTINCT FROM canonical THEN RAISE EXCEPTION 'Submission key reused with changed content'; END IF;
   RETURN;
  END IF;
  IF payload->>'extractionRequestId' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.extraction_jobs j WHERE j.request_id=(payload->>'extractionRequestId')::uuid AND j.owner_id=auth.uid() AND j.submission_key=key) THEN RAISE EXCEPTION 'Extraction reference does not belong to this submission'; END IF;
  path:=payload->'receipt'->>'storagePath';
  IF path IS DISTINCT FROM auth.uid()::text||'/'||key::text THEN RAISE EXCEPTION 'Receipt must belong to this submission'; END IF;
  SELECT metadata INTO object_meta FROM storage.objects WHERE bucket_id='private-receipts' AND name=path AND owner_id=auth.uid()::text;
  IF NOT FOUND OR coalesce(payload->'receipt'->>'fileType','') NOT IN ('application/pdf','image/jpeg','image/png') OR object_meta->>'mimetype' IS DISTINCT FROM payload->'receipt'->>'fileType' OR coalesce((object_meta->>'size')::bigint,0) NOT BETWEEN 1 AND 10485760 OR length(coalesce(payload->'receipt'->>'fileName','')) NOT BETWEEN 1 AND 255 THEN RAISE EXCEPTION 'Invalid receipt file'; END IF;
  PERFORM public.internal_action_legacy(action,canonical||jsonb_build_object('confirmedBy',auth.uid(),'confirmedAt',now(),'version',1));
  UPDATE public.expenses SET submission_actor=auth.uid(),submission_key=key,submission_payload=canonical,amount_cents=((payload->>'amount')::numeric*100)::bigint,extraction_request_id=NULLIF(payload->>'extractionRequestId','')::uuid WHERE id=(SELECT expense_id FROM public.receipts WHERE storage_path=path);
 ELSIF action='decision' THEN
  SELECT * INTO x FROM public.expenses WHERE id=target AND organization_id='quantera' FOR UPDATE;
  IF x.id IS NULL OR NOT(public.has_role(auth.uid(),'founder') OR (public.has_role(auth.uid(),'manager') AND EXISTS(SELECT 1 FROM public.departments WHERE id=x.department_id AND manager_id=emp))) OR x.employee_id=emp THEN RAISE EXCEPTION 'Approval not permitted'; END IF;
  IF (payload->>'version')::integer IS DISTINCT FROM x.document_version THEN RAISE EXCEPTION 'Expense version changed'; END IF;
  IF coalesce(decision,'') NOT IN ('approved','rejected','changes_requested') OR payload->>'comment' IS NULL OR length(payload->>'comment')>1000 THEN RAISE EXCEPTION 'Invalid decision'; END IF;
  IF x.approval_status=decision AND EXISTS(SELECT 1 FROM public.approvals a WHERE a.expense_id=x.id AND a.data->>'decision'=decision AND a.data->>'version'=x.document_version::text AND a.data->>'comment'=payload->>'comment' AND a.data->>'actorId'=auth.uid()::text) THEN RETURN; END IF;
  IF decision='approved' THEN
   IF x.amount_cents IS NULL OR x.data->>'confirmedBy' IS NULL OR x.data->>'confirmedAt' IS NULL OR x.data->>'receiptId' IS NULL THEN RAISE EXCEPTION 'Legacy or unconfirmed expense requires review'; END IF;
   PERFORM public.validate_expense_document(x.data);
  END IF;
  PERFORM public.internal_action_legacy(action,payload);
  UPDATE public.approvals SET data=data||jsonb_build_object('version',x.document_version,'actorId',auth.uid()) WHERE expense_id=x.id AND data->>'version' IS NULL AND data->>'decision'=decision;
 ELSIF action='respond' THEN
  SELECT * INTO x FROM public.expenses WHERE id=target AND employee_id=emp AND approval_status='changes_requested' FOR UPDATE;
  IF x.id IS NULL OR (payload->>'version')::integer IS DISTINCT FROM x.document_version OR payload->'verified' IS DISTINCT FROM 'true'::jsonb OR length(trim(coalesce(payload->>'response',''))) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Confirm corrected version before resubmission'; END IF;
  canonical:=x.data||jsonb_build_object('amount',payload->'amount','verified',true);
  PERFORM public.validate_expense_document(canonical);
  PERFORM public.internal_action_legacy(action,payload);
  UPDATE public.expenses SET document_version=document_version+1,amount_cents=((payload->>'amount')::numeric*100)::bigint,data=data||jsonb_build_object('version',document_version+1,'confirmedBy',auth.uid(),'confirmedAt',now()) WHERE id=target;
 ELSE
  PERFORM public.internal_action_legacy(action,payload);
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.internal_action(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.internal_action(text,jsonb) TO authenticated;