ALTER TABLE public.extraction_jobs ADD COLUMN dispatch_claimed_at timestamptz;
UPDATE public.extraction_jobs SET dispatch_claimed_at=created_at;
COMMENT ON COLUMN public.extraction_jobs.dispatch_claimed_at IS 'Durable dispatch claim; an uncertain outcome must use GET on the same UUID, never automatically POST again. Historical jobs are conservatively considered dispatched.';
CREATE FUNCTION public.claim_extraction_dispatch(p_owner uuid,p_request_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE claimed uuid; BEGIN
IF NOT EXISTS(SELECT 1 FROM public.profiles p JOIN public.employees e ON e.id=p.employee_id JOIN auth.users u ON u.id=p.id JOIN public.user_roles r ON r.user_id=p.id AND r.role IN ('employee','manager') WHERE p.id=p_owner AND e.active AND u.email_confirmed_at IS NOT NULL AND lower(u.email)=lower(e.email)) THEN RAISE EXCEPTION 'Active employee required'; END IF;
UPDATE public.extraction_jobs SET dispatch_claimed_at=now() WHERE request_id=p_request_id AND owner_id=p_owner AND dispatch_claimed_at IS NULL AND envelope IS NULL RETURNING request_id INTO claimed;
RETURN claimed IS NOT NULL;
END $$;
REVOKE ALL ON FUNCTION public.claim_extraction_dispatch(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_extraction_dispatch(uuid,uuid) TO service_role;