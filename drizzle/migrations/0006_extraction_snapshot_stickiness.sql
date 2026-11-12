CREATE OR REPLACE FUNCTION public.save_extraction_snapshot(p_request_id uuid, p_status text, p_envelope jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE job public.extraction_jobs;
BEGIN
 SELECT * INTO job FROM public.extraction_jobs WHERE request_id=p_request_id AND owner_id=auth.uid();
 IF job.request_id IS NULL THEN RAISE EXCEPTION 'Extraction request not found'; END IF;
 IF coalesce(p_status,'') NOT IN ('queued','processing','completed','needs_review','failed','unknown','checking') THEN RAISE EXCEPTION 'Invalid extraction status'; END IF;
 -- Terminal snapshots are immutable: once a completed/needs_review/failed/unknown envelope is stored, later writes are ignored.
 IF job.envelope IS NOT NULL AND job.status IN ('completed','needs_review','failed','unknown') THEN RETURN; END IF;
 UPDATE public.extraction_jobs SET status=p_status, envelope=coalesce(p_envelope, envelope), updated_at=now() WHERE request_id=job.request_id;
END $$;
REVOKE ALL ON FUNCTION public.save_extraction_snapshot(uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_extraction_snapshot(uuid,text,jsonb) TO authenticated;