DO $$ DECLARE definition text; BEGIN SELECT pg_get_functiondef('public.internal_action(text,jsonb)'::regprocedure) INTO definition; definition:=replace(definition,'public.internal_action(', 'public.internal_action_legacy('); definition:=replace(definition,'CREATE OR REPLACE FUNCTION','CREATE FUNCTION'); definition:=replace(definition,'(payload->''receipt''-''previewUrl''-''storagePath'')','((payload->''receipt'')-''previewUrl''-''storagePath'')'); EXECUTE definition; END $$;
REVOKE ALL ON FUNCTION public.internal_action_legacy(text,jsonb) FROM PUBLIC,anon,authenticated;
ALTER TABLE public.expenses ADD COLUMN submission_actor uuid, ADD COLUMN submission_key uuid, ADD COLUMN submission_payload jsonb, ADD COLUMN amount_cents bigint, ADD COLUMN document_version integer NOT NULL DEFAULT 1;
CREATE UNIQUE INDEX expense_actor_submission ON public.expenses(submission_actor,submission_key);
COMMENT ON COLUMN public.expenses.amount_cents IS 'Authoritative exact cents for new confirmed submissions; NULL means legacy unreviewed metadata.';
CREATE FUNCTION public.validate_expense_document(p jsonb) RETURNS void LANGUAGE plpgsql SET search_path=public AS $$
DECLARE n numeric; dt date;
BEGIN
 IF jsonb_typeof(p->'amount') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Amount required'; END IF;
 n:=(p->>'amount')::numeric;
 IF n<=0 OR n>1000000000 OR n*100<>trunc(n*100) THEN RAISE EXCEPTION 'Invalid monetary precision'; END IF;
 IF p->>'date' IS NULL OR p->>'date' !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'Calendar date required'; END IF;
 dt:=(p->>'date')::date;
 IF to_char(dt,'YYYY-MM-DD')<>p->>'date' THEN RAISE EXCEPTION 'Invalid calendar date'; END IF;
 IF p->>'currency' IS DISTINCT FROM 'USD' OR coalesce(p->>'documentType','') NOT IN ('Paid Receipt','Supplier Invoice') OR p->'verified' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'Confirmed eligible USD document required'; END IF;
 IF p->>'paymentResponsibility' IS DISTINCT FROM 'employee_paid' OR p->'paymentEvidenceConfirmed' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'Personally paid evidence required; supplier payments deferred'; END IF;
 IF coalesce(p->>'source','') NOT IN ('manual','ai','ai_corrected') OR length(trim(coalesce(p->>'vendor',''))) NOT BETWEEN 1 AND 200 OR coalesce(p->>'category','') NOT IN ('Lab Supplies','Software','Travel','Meals','Equipment','Office','Training','Services') THEN RAISE EXCEPTION 'Invalid document information'; END IF;
 IF NOT(p ? 'documentNumber') OR jsonb_typeof(p->'documentNumber') NOT IN ('string','null') OR length(coalesce(p->>'documentNumber',''))>200 OR length(coalesce(p->>'description',''))>2000 THEN RAISE EXCEPTION 'Invalid document number or description'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.validate_expense_document(jsonb) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.internal_action(action text,payload jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE emp text:=public.current_employee(); target text:=payload->>'id'; x public.expenses; prior public.expenses; key uuid; canonical jsonb; path text; object_meta jsonb; decision text:=payload->>'decision';
BEGIN
 IF emp IS NULL THEN RAISE EXCEPTION 'Authorized employee required'; END IF;
 IF action='expense' THEN
  PERFORM public.validate_expense_document(payload);
  key:=(payload->>'submissionKey')::uuid;
  IF key IS NULL THEN RAISE EXCEPTION 'Submission key required'; END IF;
  canonical:=jsonb_build_object('vendor',payload->'vendor','amount',payload->'amount','currency',payload->'currency','date',payload->'date','documentType',payload->'documentType','documentNumber',payload->'documentNumber','source',payload->'source','verified',payload->'verified','paymentResponsibility',payload->'paymentResponsibility','paymentEvidenceConfirmed',payload->'paymentEvidenceConfirmed','category',payload->'category','departmentId',payload->'departmentId','projectId',payload->'projectId','description',payload->'description','receipt',payload->'receipt','submissionKey',payload->'submissionKey');
  PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text||key::text,0));
  SELECT * INTO prior FROM public.expenses WHERE submission_actor=auth.uid() AND submission_key=key;
  IF prior.id IS NOT NULL THEN
   IF prior.submission_payload IS DISTINCT FROM canonical THEN RAISE EXCEPTION 'Submission key reused with changed content'; END IF;
   RETURN;
  END IF;
  path:=payload->'receipt'->>'storagePath';
  IF path IS DISTINCT FROM auth.uid()::text||'/'||key::text THEN RAISE EXCEPTION 'Receipt must belong to this submission'; END IF;
  SELECT metadata INTO object_meta FROM storage.objects WHERE bucket_id='private-receipts' AND name=path AND owner_id=auth.uid()::text;
  IF NOT FOUND OR coalesce(payload->'receipt'->>'fileType','') NOT IN ('application/pdf','image/jpeg','image/png') OR object_meta->>'mimetype' IS DISTINCT FROM payload->'receipt'->>'fileType' OR coalesce((object_meta->>'size')::bigint,0) NOT BETWEEN 1 AND 10485760 OR length(coalesce(payload->'receipt'->>'fileName','')) NOT BETWEEN 1 AND 255 THEN RAISE EXCEPTION 'Invalid receipt file'; END IF;
  PERFORM public.internal_action_legacy(action,canonical||jsonb_build_object('confirmedBy',auth.uid(),'confirmedAt',now(),'version',1));
  UPDATE public.expenses SET submission_actor=auth.uid(),submission_key=key,submission_payload=canonical,amount_cents=((payload->>'amount')::numeric*100)::bigint WHERE id=(SELECT expense_id FROM public.receipts WHERE storage_path=path);
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
CREATE FUNCTION public.submission_status(submission_key uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE x public.expenses;
BEGIN
 IF public.current_employee() IS NULL THEN RAISE EXCEPTION 'Authorized employee required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text||submission_key::text,0));
 SELECT * INTO x FROM public.expenses WHERE submission_actor=auth.uid() AND expenses.submission_key=submission_status.submission_key;
 RETURN jsonb_build_object('committed',x.id IS NOT NULL,'expenseId',x.id,'receiptId',x.data->>'receiptId');
END $$;
REVOKE ALL ON FUNCTION public.submission_status(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submission_status(uuid) TO authenticated;
CREATE TABLE public.cancelled_submissions(actor_id uuid NOT NULL, submission_key uuid NOT NULL, PRIMARY KEY(actor_id,submission_key));
GRANT SELECT ON public.cancelled_submissions TO authenticated; GRANT ALL ON public.cancelled_submissions TO service_role;
ALTER TABLE public.cancelled_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY cancelled_own ON public.cancelled_submissions FOR SELECT TO authenticated USING(actor_id=auth.uid());
CREATE FUNCTION public.reject_cancelled_submission() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF EXISTS(SELECT 1 FROM public.cancelled_submissions WHERE actor_id=new.submission_actor AND submission_key=new.submission_key) THEN RAISE EXCEPTION 'Submission was cancelled'; END IF; RETURN new; END $$;
REVOKE ALL ON FUNCTION public.reject_cancelled_submission() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER reject_cancelled_submission BEFORE UPDATE OF submission_key ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.reject_cancelled_submission();
CREATE FUNCTION public.cancel_expense_submission(submission_key uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF public.current_employee() IS NULL THEN RAISE EXCEPTION 'Authorized employee required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text||submission_key::text,0));
 IF EXISTS(SELECT 1 FROM public.expenses WHERE submission_actor=auth.uid() AND expenses.submission_key=cancel_expense_submission.submission_key) THEN RETURN false; END IF;
 INSERT INTO public.cancelled_submissions VALUES(auth.uid(),submission_key) ON CONFLICT DO NOTHING;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.cancel_expense_submission(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.cancel_expense_submission(uuid) TO authenticated;
CREATE POLICY receipt_cancelled_delete ON storage.objects FOR DELETE TO authenticated USING(bucket_id='private-receipts' AND owner_id=auth.uid()::text AND EXISTS(SELECT 1 FROM public.cancelled_submissions c WHERE c.actor_id=auth.uid() AND name=c.actor_id::text||'/'||c.submission_key::text) AND NOT EXISTS(SELECT 1 FROM public.receipts r WHERE r.storage_path=name));