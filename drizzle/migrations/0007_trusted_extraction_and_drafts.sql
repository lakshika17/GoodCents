REVOKE ALL ON FUNCTION public.begin_extraction(uuid,uuid,text,text),public.save_extraction_snapshot(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.begin_extraction_trusted(p_owner uuid,p_request_id uuid,p_submission_key uuid,p_pdf_sha256 text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE j record; BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.profiles p JOIN public.employees e ON e.id=p.employee_id JOIN auth.users u ON u.id=p.id JOIN public.user_roles r ON r.user_id=p.id AND r.role IN ('employee','manager') WHERE p.id=p_owner AND e.active AND u.email_confirmed_at IS NOT NULL AND lower(u.email)=lower(e.email)) THEN RAISE EXCEPTION 'Active employee required'; END IF;
 IF p_pdf_sha256 !~ '^[0-9a-f]{64}$' OR p_request_id IS NULL OR p_submission_key IS NULL THEN RAISE EXCEPTION 'Invalid document identity'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_owner::text||p_submission_key::text,1));
 SELECT * INTO j FROM public.extraction_jobs WHERE owner_id=p_owner AND submission_key=p_submission_key;
 IF FOUND THEN IF j.pdf_sha256<>p_pdf_sha256 THEN RAISE EXCEPTION 'Document identity changed'; END IF; RETURN to_jsonb(j); END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='private-receipts' AND name=p_owner::text||'/'||p_submission_key::text AND owner_id=p_owner::text) THEN RAISE EXCEPTION 'Owned document required'; END IF;
 INSERT INTO public.extraction_jobs(request_id,owner_id,submission_key,storage_path,pdf_sha256) VALUES(p_request_id,p_owner,p_submission_key,p_owner::text||'/'||p_submission_key::text,p_pdf_sha256) RETURNING * INTO j; RETURN to_jsonb(j);
END $$;
REVOKE ALL ON FUNCTION public.begin_extraction_trusted(uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.begin_extraction_trusted(uuid,uuid,uuid,text) TO service_role;
CREATE FUNCTION public.save_extraction_snapshot_trusted(p_owner uuid,p_request_id uuid,p_status text,p_envelope jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE j record; BEGIN
 SELECT * INTO j FROM public.extraction_jobs WHERE request_id=p_request_id AND owner_id=p_owner FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Owned request required'; END IF;
 IF j.status IN ('completed','needs_review','failed','unknown') AND j.envelope IS NOT NULL THEN RETURN; END IF;
 IF p_status NOT IN ('queued','processing','completed','needs_review','failed','unknown') OR p_envelope IS NULL OR p_envelope->>'status' IS DISTINCT FROM p_status OR p_envelope->>'request_id' IS DISTINCT FROM p_request_id::text THEN RAISE EXCEPTION 'Invalid trusted envelope'; END IF;
 UPDATE public.extraction_jobs SET status=p_status,envelope=p_envelope,updated_at=now() WHERE request_id=p_request_id;
END $$;
REVOKE ALL ON FUNCTION public.save_extraction_snapshot_trusted(uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.save_extraction_snapshot_trusted(uuid,uuid,text,jsonb) TO service_role;
CREATE TABLE public.document_drafts(owner_id uuid NOT NULL,submission_key uuid NOT NULL,storage_path text NOT NULL,data jsonb NOT NULL,updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(owner_id,submission_key));
GRANT SELECT ON public.document_drafts TO authenticated; GRANT ALL ON public.document_drafts TO service_role;
ALTER TABLE public.document_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY drafts_read ON public.document_drafts FOR SELECT TO authenticated USING(owner_id=auth.uid() AND public.current_employee() IS NOT NULL);
CREATE FUNCTION public.save_document_draft(p_key uuid,p_data jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF public.current_employee() IS NULL OR NOT(public.has_role(auth.uid(),'employee') OR public.has_role(auth.uid(),'manager')) THEN RAISE EXCEPTION 'Employee access required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_key::text,0));
 IF EXISTS(SELECT 1 FROM public.expenses WHERE submission_actor=auth.uid() AND submission_key=p_key) OR EXISTS(SELECT 1 FROM public.cancelled_submissions WHERE actor_id=auth.uid() AND submission_key=p_key) THEN RAISE EXCEPTION 'Document already submitted or cancelled'; END IF;
 IF octet_length(p_data::text)>20000 OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='private-receipts' AND name=auth.uid()::text||'/'||p_key::text AND owner_id=auth.uid()::text) THEN RAISE EXCEPTION 'Owned uploaded document required'; END IF;
 INSERT INTO public.document_drafts VALUES(auth.uid(),p_key,auth.uid()::text||'/'||p_key::text,p_data-'verified'-'confirmedBy'-'confirmedAt',now()) ON CONFLICT(owner_id,submission_key) DO UPDATE SET data=excluded.data,updated_at=now(); END $$;
REVOKE ALL ON FUNCTION public.save_document_draft(uuid,jsonb) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.save_document_draft(uuid,jsonb) TO authenticated;