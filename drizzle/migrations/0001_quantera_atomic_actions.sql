CREATE POLICY receipt_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='private-receipts' AND public.current_employee() IS NOT NULL AND (storage.foldername(name))[1]=auth.uid()::text);
CREATE POLICY receipt_file_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='private-receipts' AND public.current_employee() IS NOT NULL AND ((storage.foldername(name))[1]=auth.uid()::text OR EXISTS(SELECT 1 FROM public.receipts r WHERE r.storage_path=name AND public.can_expense(r.expense_id))));
CREATE FUNCTION public.internal_action(action text,payload jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE emp text := public.current_employee(); target text := payload->>'id'; x public.expenses; r public.reimbursements; req public.access_requests; own public.employees; dept text; proj text; next_data jsonb; now_text text := to_char(current_date,'YYYY-MM-DD');
BEGIN
IF emp IS NULL THEN RAISE EXCEPTION 'Authorized employee required'; END IF;
SELECT * INTO own FROM public.employees WHERE id=emp;
IF action='expense' THEN
 dept:=payload->>'departmentId'; proj:=nullif(payload->>'projectId','');
 IF dept<>own.department_id THEN RAISE EXCEPTION 'Submit only to your department'; END IF;
 IF proj IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.project_departments WHERE project_id=proj AND department_id=dept) THEN RAISE EXCEPTION 'Project is not assigned to your department'; END IF;
 IF (payload->>'amount')::numeric<=0 OR length(trim(payload->>'vendor')) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Invalid expense'; END IF;
 target:=gen_random_uuid()::text;
 next_data:=(payload-'receipt'-'id'-'employeeId')||jsonb_build_object('id',target,'employeeId',emp,'approvalStatus','pending','submittedAt',now_text,'receiptId',NULL);
 INSERT INTO public.expenses(id,employee_id,department_id,project_id,data) VALUES(target,emp,dept,proj,next_data);
 IF payload->'receipt' IS NOT NULL AND payload->'receipt'<>'null'::jsonb THEN
 IF split_part(payload->'receipt'->>'storagePath','/',1)<>auth.uid()::text OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='private-receipts' AND name=payload->'receipt'->>'storagePath' AND owner_id=auth.uid()::text) THEN RAISE EXCEPTION 'Invalid receipt ownership'; END IF;
 INSERT INTO public.receipts(id,expense_id,storage_path,data) VALUES('r-'||target,target,payload->'receipt'->>'storagePath',(payload->'receipt'-'previewUrl'-'storagePath')||jsonb_build_object('id','r-'||target,'previewUrl',NULL,'extractionSimulated',false));
 UPDATE public.expenses SET data=data||jsonb_build_object('receiptId','r-'||target) WHERE id=target;
 END IF;
ELSIF action='decision' THEN
 SELECT * INTO x FROM public.expenses WHERE id=target AND organization_id='quantera' FOR UPDATE;
 IF x.id IS NULL OR x.approval_status<>'pending' OR NOT (public.has_role(auth.uid(),'founder') OR (public.has_role(auth.uid(),'manager') AND EXISTS(SELECT 1 FROM public.departments WHERE id=x.department_id AND manager_id=emp))) THEN RAISE EXCEPTION 'Approval not permitted'; END IF;
 IF payload->>'decision' NOT IN ('approved','rejected','changes_requested') THEN RAISE EXCEPTION 'Invalid decision'; END IF;
 IF payload->>'decision'='changes_requested' AND length(trim(payload->>'comment'))=0 THEN RAISE EXCEPTION 'Comment required'; END IF;
 UPDATE public.expenses SET approval_status=payload->>'decision',data=data||jsonb_build_object('approvalStatus',payload->>'decision') WHERE id=target;
 INSERT INTO public.approvals(id,expense_id,data) VALUES(gen_random_uuid()::text,target,jsonb_build_object('expenseId',target,'managerId',emp,'decision',payload->>'decision','comment',payload->>'comment','date',now_text));
 IF payload->>'decision'='approved' THEN INSERT INTO public.reimbursements(id,expense_id,employee_id,data) VALUES('rb-'||target,target,x.employee_id,jsonb_build_object('id','rb-'||target,'expenseId',target,'employeeId',x.employee_id,'amount',x.data->'amount','status','awaiting_authorization','paypalReference',NULL,'authorizedBy',NULL,'history',jsonb_build_array(jsonb_build_object('date',now_text,'status','awaiting_authorization','note','Created on approval; no payment sent')))) ON CONFLICT(expense_id) DO NOTHING; END IF;
ELSIF action='respond' THEN
 SELECT * INTO x FROM public.expenses WHERE id=target AND employee_id=emp AND approval_status='changes_requested' FOR UPDATE;
 IF x.id IS NULL OR (payload->>'amount')::numeric<=0 THEN RAISE EXCEPTION 'Resubmission not permitted'; END IF;
 UPDATE public.expenses SET approval_status='pending',data=data||jsonb_build_object('amount',payload->'amount','approvalStatus','pending') WHERE id=target;
 UPDATE public.approvals SET data=data||jsonb_build_object('employeeResponse',payload->>'response') WHERE expense_id=target AND data->>'decision'='changes_requested';
ELSIF action='reimbursement' THEN
 IF NOT public.has_role(auth.uid(),'finance') OR payload->>'status'<>'queued' THEN RAISE EXCEPTION 'Finance authorization required; payments are disabled'; END IF;
 SELECT * INTO r FROM public.reimbursements WHERE id=target AND organization_id='quantera' FOR UPDATE;
 IF r.id IS NULL OR r.status<>'awaiting_authorization' THEN RAISE EXCEPTION 'Reimbursement not awaiting authorization'; END IF;
 UPDATE public.reimbursements SET status='queued',data=data||jsonb_build_object('status','queued','authorizedBy',emp,'history',(data->'history')||jsonb_build_array(jsonb_build_object('date',now_text,'status','queued','note','Sandbox authorization only; no payment sent'))) WHERE id=target;
ELSIF action IN ('budget','project','policy') THEN
 IF NOT public.has_role(auth.uid(),'founder') THEN RAISE EXCEPTION 'Founder permission required'; END IF;
 IF action='budget' THEN
 IF (payload->>'amount')::numeric<=0 OR NOT EXISTS(SELECT 1 FROM public.employees WHERE id=payload->>'ownerId' AND active AND organization_id='quantera') THEN RAISE EXCEPTION 'Invalid budget'; END IF;
 INSERT INTO public.budgets(id,department_id,project_id,data) VALUES(target,payload->>'departmentId',nullif(payload->>'projectId',''),payload) ON CONFLICT(id) DO UPDATE SET department_id=excluded.department_id,project_id=excluded.project_id,data=excluded.data;
 ELSIF action='project' THEN
 INSERT INTO public.projects(id,data) VALUES(target,payload->'project') ON CONFLICT(id) DO UPDATE SET data=excluded.data;
 DELETE FROM public.project_departments WHERE project_id=target;
 INSERT INTO public.project_departments(project_id,department_id) SELECT target,jsonb_array_elements_text(payload->'departmentIds');
 ELSE INSERT INTO public.approval_policies(organization_id,data) VALUES('quantera',payload) ON CONFLICT(organization_id) DO UPDATE SET data=excluded.data; END IF;
ELSIF action='access_decision' THEN
 IF NOT public.has_role(auth.uid(),'founder') THEN RAISE EXCEPTION 'Founder permission required'; END IF;
 SELECT * INTO req FROM public.access_requests WHERE id=target::uuid AND organization_id='quantera' FOR UPDATE;
 IF req.id IS NULL OR NOT ((req.status='pending' AND payload->>'decision' IN ('approved','rejected')) OR (req.status='approved' AND payload->>'decision'='revoked')) THEN RAISE EXCEPTION 'Invalid access transition'; END IF;
 UPDATE public.access_requests SET status=payload->>'decision',decision_note=payload->>'note',decided_by=auth.uid(),decided_at=now() WHERE id=req.id;
 IF payload->>'decision'='approved' THEN INSERT INTO public.access_grants(user_id,department_id,project_id,request_id,granted_by) VALUES(req.user_id,req.department_id,req.project_id,req.id,auth.uid()); END IF;
 IF payload->>'decision'='revoked' THEN UPDATE public.access_grants SET revoked_at=now() WHERE request_id=req.id; END IF;
ELSE RAISE EXCEPTION 'Unknown action'; END IF;
INSERT INTO public.audit_log(actor_id,action,target_id,detail) VALUES(auth.uid(),action,coalesce(target,'quantera'),CASE WHEN action='access_decision' THEN jsonb_build_object('decision',payload->>'decision','note',payload->>'note') ELSE '{}'::jsonb END);
END $$;
REVOKE ALL ON FUNCTION public.internal_action(text,jsonb) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.internal_action(text,jsonb) TO authenticated;
CREATE FUNCTION public.audit_access_request() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN INSERT INTO public.audit_log(actor_id,action,target_id) VALUES(new.user_id,'access_requested',new.id::text); RETURN new; END $$;
REVOKE ALL ON FUNCTION public.audit_access_request() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER access_request_audit AFTER INSERT ON public.access_requests FOR EACH ROW EXECUTE FUNCTION public.audit_access_request();