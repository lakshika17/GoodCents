ALTER TABLE public.expenses ADD COLUMN workflow_state text NOT NULL DEFAULT 'awaiting_manager' CHECK(workflow_state IN ('draft','awaiting_manager','returned','approved_awaiting_payment','rejected'));
UPDATE public.expenses SET workflow_state=CASE approval_status WHEN 'approved' THEN 'approved_awaiting_payment' WHEN 'changes_requested' THEN 'returned' WHEN 'rejected' THEN 'rejected' ELSE 'awaiting_manager' END;
CREATE TABLE public.expense_revisions(expense_id text REFERENCES public.expenses(id) NOT NULL,revision integer NOT NULL,snapshot jsonb NOT NULL,amount_cents bigint NOT NULL,submitted_by uuid NOT NULL,submitted_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(expense_id,revision));
GRANT SELECT ON public.expense_revisions TO authenticated; GRANT ALL ON public.expense_revisions TO service_role;
ALTER TABLE public.expense_revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY revisions_read ON public.expense_revisions FOR SELECT TO authenticated USING(public.can_expense(expense_id));
INSERT INTO public.expense_revisions SELECT id,document_version,data,amount_cents,submission_actor,now() FROM public.expenses WHERE amount_cents IS NOT NULL AND submission_actor IS NOT NULL;
ALTER FUNCTION public.internal_action(text,jsonb) RENAME TO internal_action_v1;
REVOKE ALL ON FUNCTION public.internal_action_v1(text,jsonb) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.internal_action(action text,payload jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE emp text:=public.current_employee(); x record; k uuid; d text:=payload->>'decision'; aid text; next_data jsonb; expected integer:=(payload->>'version')::integer;
BEGIN
 IF emp IS NULL THEN RAISE EXCEPTION 'Active verified business account required'; END IF;
 IF action='expense' THEN
 IF NOT(public.has_role(auth.uid(),'employee') OR public.has_role(auth.uid(),'manager')) THEN RAISE EXCEPTION 'Employee submission permission required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.departments dep JOIN public.profiles p ON p.employee_id=dep.manager_id JOIN public.employees m ON m.id=p.employee_id JOIN public.user_roles r ON r.user_id=p.id AND r.role='manager' JOIN auth.users u ON u.id=p.id WHERE dep.id=payload->>'departmentId' AND m.active AND m.id<>emp AND u.email_confirmed_at IS NOT NULL AND lower(u.email)=lower(m.email)) THEN RAISE EXCEPTION 'Assigned active manager required'; END IF;
 PERFORM public.internal_action_v1(action,payload); k:=(payload->>'submissionKey')::uuid;
 SELECT * INTO x FROM public.expenses WHERE submission_actor=auth.uid() AND submission_key=k FOR UPDATE;
 INSERT INTO public.expense_revisions VALUES(x.id,x.document_version,x.data,x.amount_cents,auth.uid(),now()) ON CONFLICT DO NOTHING;
 ELSIF action='decision' THEN
 SELECT * INTO x FROM public.expenses WHERE id=payload->>'id' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Expense not found'; END IF;
 IF NOT public.has_role(auth.uid(),'manager') OR x.employee_id=emp OR NOT EXISTS(SELECT 1 FROM public.departments WHERE id=x.department_id AND manager_id=emp) THEN RAISE EXCEPTION 'Assigned manager required; self approval prohibited'; END IF;
 IF expected IS DISTINCT FROM x.document_version THEN RAISE EXCEPTION 'Expense version changed'; END IF;
 IF d NOT IN ('approved','changes_requested','rejected') OR d IS NULL OR length(coalesce(payload->>'comment',''))>1000 OR (d='changes_requested' AND length(trim(coalesce(payload->>'comment','')))=0) THEN RAISE EXCEPTION 'Valid decision and return reason required'; END IF;
 IF EXISTS(SELECT 1 FROM public.approvals WHERE expense_id=x.id AND data->>'version'=expected::text AND data->>'decision'=d AND data->>'actorId'=auth.uid()::text AND data->>'comment'=coalesce(payload->>'comment','')) THEN RETURN; END IF;
 IF x.workflow_state<>'awaiting_manager' THEN RAISE EXCEPTION 'Current submitted revision required'; END IF;
 PERFORM public.validate_expense_document(x.data);
 IF NOT EXISTS(SELECT 1 FROM public.expense_revisions WHERE expense_id=x.id AND revision=expected) THEN RAISE EXCEPTION 'Submitted snapshot required'; END IF;
 UPDATE public.expenses SET approval_status=d,workflow_state=CASE d WHEN 'approved' THEN 'approved_awaiting_payment' WHEN 'changes_requested' THEN 'returned' ELSE 'rejected' END,data=data||jsonb_build_object('approvalStatus',d) WHERE id=x.id;
 aid:=gen_random_uuid()::text;
 INSERT INTO public.approvals VALUES(aid,x.id,jsonb_build_object('id',aid,'expenseId',x.id,'managerId',emp,'actorId',auth.uid(),'version',expected,'decision',d,'comment',coalesce(payload->>'comment',''),'date',now()));
 IF d='approved' THEN
 INSERT INTO public.reimbursements(id,expense_id,employee_id,data) VALUES('rb-'||x.id,x.id,x.employee_id,jsonb_build_object('id','rb-'||x.id,'expenseId',x.id,'employeeId',x.employee_id,'amount',x.amount_cents::numeric/100,'amountCents',x.amount_cents,'currency',x.data->>'currency','sourceRevision',expected,'status','awaiting_authorization','paypalReference',NULL,'authorizedBy',NULL,'history',jsonb_build_array(jsonb_build_object('date',now(),'status','awaiting_authorization','note','Approved; payment disabled')))) ON CONFLICT(expense_id) DO NOTHING;
 END IF;
 INSERT INTO public.audit_log(actor_id,action,target_id,detail) VALUES(auth.uid(),'decision',x.id,jsonb_build_object('revision',expected,'decision',d));
 ELSIF action='respond' THEN
 SELECT * INTO x FROM public.expenses WHERE id=payload->>'id' AND employee_id=emp FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Own returned expense required'; END IF;
 IF x.workflow_state='awaiting_manager' AND x.document_version=expected+1 AND x.data->>'resubmissionResponse'=payload->>'response' AND x.data->'amount'=payload->'amount' AND x.data->>'vendor'=coalesce(payload->>'vendor',x.data->>'vendor') AND x.data->>'date'=coalesce(payload->>'date',x.data->>'date') AND x.data->>'description'=coalesce(payload->>'description',x.data->>'description') AND x.data->'documentNumber'=coalesce(payload->'documentNumber',x.data->'documentNumber') THEN RETURN; END IF;
 IF NOT(public.has_role(auth.uid(),'employee') OR public.has_role(auth.uid(),'manager')) OR x.workflow_state<>'returned' OR expected IS DISTINCT FROM x.document_version OR payload->'verified' IS DISTINCT FROM 'true'::jsonb OR length(trim(coalesce(payload->>'response',''))) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Returned version and renewed confirmation required'; END IF;
 next_data:=x.data||jsonb_build_object('amount',payload->'amount','vendor',coalesce(payload->'vendor',x.data->'vendor'),'date',coalesce(payload->'date',x.data->'date'),'documentNumber',coalesce(payload->'documentNumber',x.data->'documentNumber'),'description',coalesce(payload->'description',x.data->'description'),'verified',true,'confirmedBy',auth.uid(),'confirmedAt',now(),'version',expected+1,'approvalStatus','pending','source',CASE WHEN x.data->>'source'='manual' THEN 'manual' ELSE 'ai_corrected' END,'resubmissionResponse',payload->>'response');
 PERFORM public.validate_expense_document(next_data);
 UPDATE public.expenses SET data=next_data,approval_status='pending',workflow_state='awaiting_manager',document_version=expected+1,amount_cents=((next_data->>'amount')::numeric*100)::bigint WHERE id=x.id;
 INSERT INTO public.expense_revisions VALUES(x.id,expected+1,next_data,((next_data->>'amount')::numeric*100)::bigint,auth.uid(),now());
 INSERT INTO public.audit_log(actor_id,action,target_id,detail) VALUES(auth.uid(),'resubmit',x.id,jsonb_build_object('revision',expected+1));
 ELSIF action='reimbursement' THEN RAISE EXCEPTION 'Payments and authorization transitions are disabled';
 ELSE PERFORM public.internal_action_v1(action,payload);
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.internal_action(text,jsonb) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.internal_action(text,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.can_expense(_expense text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.current_employee() IS NOT NULL AND EXISTS(SELECT 1 FROM public.expenses x WHERE x.id=_expense AND x.organization_id='quantera' AND (x.employee_id=public.current_employee() OR (public.has_role(auth.uid(),'manager') AND EXISTS(SELECT 1 FROM public.departments WHERE id=x.department_id AND manager_id=public.current_employee())) OR (public.has_role(auth.uid(),'finance') AND x.workflow_state='approved_awaiting_payment') OR public.has_role(auth.uid(),'founder'))) $$;