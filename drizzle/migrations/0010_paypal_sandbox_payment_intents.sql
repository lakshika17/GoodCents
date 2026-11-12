-- PayPal Sandbox payout module: durable payment intents, server-controlled recipient mapping,
-- finance-only authorization, dispatch claim, and atomic result recording.

-- 1. Widen reimbursement business states (approval already counts the expense; payment states never re-charge it).
ALTER TABLE public.reimbursements DROP CONSTRAINT reimbursements_status_check;
ALTER TABLE public.reimbursements ADD CONSTRAINT reimbursements_status_check CHECK(status IN ('awaiting_authorization','queued','processing','paid','failed','needs_reconciliation','unclaimed'));

-- 2. Server-controlled mapping from employee to PayPal Sandbox recipient. Never derived from PDFs, login email, or browser input.
CREATE TABLE public.payout_recipients(
  employee_id text PRIMARY KEY REFERENCES public.employees(id),
  receiver_email text NOT NULL,
  note text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payout_recipients TO authenticated;
GRANT ALL ON public.payout_recipients TO service_role;
ALTER TABLE public.payout_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY payout_recipients_read ON public.payout_recipients FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'finance'));

-- 3. Durable payment intent: one per reimbursement, permanent application-side duplicate protection.
CREATE TABLE public.payment_intents(
  id text PRIMARY KEY,
  reimbursement_id text NOT NULL UNIQUE REFERENCES public.reimbursements(id),
  expense_id text NOT NULL REFERENCES public.expenses(id),
  employee_id text NOT NULL REFERENCES public.employees(id),
  amount_cents bigint NOT NULL CHECK(amount_cents > 0),
  currency text NOT NULL,
  source_revision integer NOT NULL,
  recipient_email text NOT NULL,
  sender_batch_id text NOT NULL UNIQUE,
  sender_item_id text NOT NULL,
  paypal_request_id text NOT NULL,
  payload jsonb NOT NULL,
  payload_digest text NOT NULL,
  status text NOT NULL DEFAULT 'authorized' CHECK(status IN ('authorized','dispatching','processing','paid','failed','needs_reconciliation','unclaimed')),
  authorized_by uuid NOT NULL,
  authorized_at timestamptz NOT NULL DEFAULT now(),
  dispatch_claimed_at timestamptz,
  dispatched_at timestamptz,
  paypal_batch_id text,
  payout_item_id text,
  transaction_id text,
  provider_status text,
  provider_error jsonb,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payment_intents TO authenticated;
GRANT ALL ON public.payment_intents TO service_role;
ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;
CREATE POLICY payment_intents_read ON public.payment_intents FOR SELECT TO authenticated
  USING(public.has_role(auth.uid(),'finance') OR public.has_role(auth.uid(),'founder') OR employee_id = public.current_employee());

-- 4. Finance authorization: atomic recheck of role, approved revision, amount, currency, recipient; idempotent reuse.
CREATE FUNCTION public.authorize_reimbursement_payment(_reimbursement text, _expected_revision integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  r public.reimbursements; x public.expenses; v_recipient text; v_existing public.payment_intents;
  v_amount bigint; v_currency text; v_batch text; v_item text; v_payload jsonb; v_value text;
BEGIN
  IF public.current_employee() IS NULL THEN RAISE EXCEPTION 'Active verified business account required'; END IF;
  IF NOT public.has_role(auth.uid(),'finance') THEN RAISE EXCEPTION 'Finance authorization required'; END IF;
  SELECT * INTO r FROM public.reimbursements WHERE id=_reimbursement AND organization_id='quantera' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reimbursement not found'; END IF;
  SELECT * INTO x FROM public.expenses WHERE id=r.expense_id;
  IF x.workflow_state<>'approved_awaiting_payment' OR x.approval_status<>'approved' THEN RAISE EXCEPTION 'Current approved revision required'; END IF;
  IF x.document_version IS DISTINCT FROM _expected_revision OR (r.data->>'sourceRevision')::integer IS DISTINCT FROM _expected_revision THEN RAISE EXCEPTION 'Approved revision changed; fresh review required'; END IF;
  v_amount := (r.data->>'amountCents')::bigint;
  IF v_amount IS NULL OR v_amount <= 0 OR v_amount IS DISTINCT FROM x.amount_cents THEN RAISE EXCEPTION 'Approved amount mismatch'; END IF;
  v_currency := coalesce(r.data->>'currency', x.data->>'currency');
  IF v_currency IS DISTINCT FROM 'USD' THEN RAISE EXCEPTION 'Only USD sandbox payouts are supported in this milestone'; END IF;
  SELECT receiver_email INTO v_recipient FROM public.payout_recipients WHERE employee_id=r.employee_id AND active;
  IF v_recipient IS NULL THEN RAISE EXCEPTION 'No active sandbox recipient mapping for this employee'; END IF;

  SELECT * INTO v_existing FROM public.payment_intents WHERE reimbursement_id=r.id;
  IF FOUND THEN
    IF v_existing.recipient_email <> v_recipient THEN
      IF v_existing.dispatch_claimed_at IS NOT NULL THEN RAISE EXCEPTION 'Recipient changed after dispatch; reconcile the existing payment'; END IF;
      -- Recipient changed before dispatch: prior authorization is invalidated, fresh confirmation re-snapshots.
      v_value := to_char(v_amount::numeric/100, 'FM9999999990.00');
      v_payload := jsonb_build_object('sender_batch_header', jsonb_build_object('sender_batch_id', v_existing.sender_batch_id, 'email_subject', 'Quantera sandbox reimbursement', 'email_message', 'Fictional sandbox payout from the Quantera isolated test draft.', 'note', 'Reimbursement '||r.id||' revision '||_expected_revision), 'items', jsonb_build_array(jsonb_build_object('recipient_type','EMAIL','amount',jsonb_build_object('value',v_value,'currency','USD'),'receiver',v_recipient,'sender_item_id',v_existing.sender_item_id,'note','Sandbox reimbursement '||r.id)));
      UPDATE public.payment_intents SET recipient_email=v_recipient, payload=v_payload, payload_digest=encode(extensions.digest(v_payload::text,'sha256'),'hex'), authorized_by=auth.uid(), authorized_at=now(), updated_at=now() WHERE id=v_existing.id;
    END IF;
    SELECT * INTO v_existing FROM public.payment_intents WHERE reimbursement_id=r.id;
    RETURN to_jsonb(v_existing);
  END IF;

  IF r.status NOT IN ('awaiting_authorization','queued') THEN RAISE EXCEPTION 'Reimbursement is not awaiting authorization'; END IF;
  v_batch := 'qb-' || r.id; v_item := v_batch || '-item';
  v_value := to_char(v_amount::numeric/100, 'FM9999999990.00');
  v_payload := jsonb_build_object('sender_batch_header', jsonb_build_object('sender_batch_id', v_batch, 'email_subject', 'Quantera sandbox reimbursement', 'email_message', 'Fictional sandbox payout from the Quantera isolated test draft.', 'note', 'Reimbursement '||r.id||' revision '||_expected_revision), 'items', jsonb_build_array(jsonb_build_object('recipient_type','EMAIL','amount',jsonb_build_object('value',v_value,'currency','USD'),'receiver',v_recipient,'sender_item_id',v_item,'note','Sandbox reimbursement '||r.id)));
  INSERT INTO public.payment_intents(id,reimbursement_id,expense_id,employee_id,amount_cents,currency,source_revision,recipient_email,sender_batch_id,sender_item_id,paypal_request_id,payload,payload_digest,authorized_by)
  VALUES('pi-'||r.id, r.id, r.expense_id, r.employee_id, v_amount, 'USD', _expected_revision, v_recipient, v_batch, v_item, gen_random_uuid()::text, v_payload, encode(extensions.digest(v_payload::text,'sha256'),'hex'), auth.uid());
  UPDATE public.reimbursements SET status='queued', data=data||jsonb_build_object('status','queued','authorizedBy',auth.uid(),'history',(data->'history')||jsonb_build_object('date',now(),'status','queued','note','Finance authorized sandbox payment')) WHERE id=r.id;
  INSERT INTO public.audit_log(actor_id,action,target_id,detail) VALUES(auth.uid(),'payment_authorized',r.id,jsonb_build_object('revision',_expected_revision,'amount_cents',v_amount,'recipient',v_recipient));
  INSERT INTO public.notifications(id,user_id,data)
    SELECT 'npay-'||r.id||'-queued-'||p.id, p.id, jsonb_build_object('id','npay-'||r.id||'-queued-'||p.id,'type','reimbursement_initiated','message','Your approved reimbursement of $'||v_value||' was authorized for sandbox payment.','date',now(),'read',false,'audience',jsonb_build_array('employee'),'employeeId',r.employee_id)
    FROM public.profiles p WHERE p.employee_id=r.employee_id
  ON CONFLICT(id) DO NOTHING;
  SELECT * INTO v_existing FROM public.payment_intents WHERE reimbursement_id=r.id;
  RETURN to_jsonb(v_existing);
END $$;
REVOKE ALL ON FUNCTION public.authorize_reimbursement_payment(text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.authorize_reimbursement_payment(text,integer) TO authenticated;

-- 5. Dispatch claim: exactly one caller may perform the first provider POST for an intent.
CREATE FUNCTION public.claim_payment_dispatch(_intent text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_claimed boolean;
BEGIN
  IF NOT public.has_role(auth.uid(),'finance') THEN RAISE EXCEPTION 'Finance authorization required'; END IF;
  UPDATE public.payment_intents SET dispatch_claimed_at=now(), status='dispatching', updated_at=now()
  WHERE id=_intent AND dispatch_claimed_at IS NULL AND status='authorized';
  GET DIAGNOSTICS v_claimed = ROW_COUNT;
  RETURN v_claimed;
END $$;
REVOKE ALL ON FUNCTION public.claim_payment_dispatch(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.claim_payment_dispatch(text) TO authenticated;

-- 6. Record the dispatch outcome (accepted / duplicate-recovered / rejected / uncertain) atomically with notifications.
CREATE FUNCTION public.record_payment_dispatch(_intent text, _outcome jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v public.payment_intents; v_kind text:=_outcome->>'kind'; v_batch text:=_outcome->>'paypalBatchId';
  v_status text; v_note text; v_value text; v_ntype text;
BEGIN
  IF NOT public.has_role(auth.uid(),'finance') THEN RAISE EXCEPTION 'Finance authorization required'; END IF;
  SELECT * INTO v FROM public.payment_intents WHERE id=_intent FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment intent not found'; END IF;
  IF v.status IN ('paid','failed') THEN RETURN; END IF;
  v_value := to_char(v.amount_cents::numeric/100, 'FM9999999990.00');
  IF v_kind='accepted' THEN
    v_status:='processing'; v_note:='Sandbox payout accepted by provider; awaiting individual item result'; v_ntype:='reimbursement_initiated';
    UPDATE public.payment_intents SET status='processing', paypal_batch_id=v_batch, provider_status=_outcome->>'batchStatus', dispatched_at=now(), updated_at=now() WHERE id=v.id;
  ELSIF v_kind='duplicate' THEN
    v_status:='processing'; v_note:='Duplicate batch response; recovered the original payout reference for the same identity'; v_ntype:='reimbursement_initiated';
    UPDATE public.payment_intents SET status='processing', paypal_batch_id=coalesce(v_batch, paypal_batch_id), provider_status=coalesce(_outcome->>'batchStatus', provider_status), dispatched_at=now(), updated_at=now() WHERE id=v.id;
  ELSIF v_kind='rejected' THEN
    v_status:='failed'; v_note:='Provider rejected the payout: '||coalesce(_outcome->>'errorName','unknown'); v_ntype:='payment_failed';
    UPDATE public.payment_intents SET status='failed', provider_status='REJECTED', provider_error=jsonb_build_object('name',_outcome->>'errorName','message',_outcome->>'errorMessage'), resolved_at=now(), updated_at=now() WHERE id=v.id;
  ELSIF v_kind='uncertain' THEN
    v_status:='needs_reconciliation'; v_note:='Payment outcome needs reconciliation: '||coalesce(_outcome->>'errorName','no response'); v_ntype:='payment_reconciliation';
    UPDATE public.payment_intents SET status='needs_reconciliation', provider_error=jsonb_build_object('name',_outcome->>'errorName','message',_outcome->>'errorMessage'), updated_at=now() WHERE id=v.id;
  ELSE RAISE EXCEPTION 'Unknown dispatch outcome'; END IF;
  UPDATE public.reimbursements SET status=v_status, data=data||jsonb_build_object('status',v_status,'history',(data->'history')||jsonb_build_object('date',now(),'status',v_status,'note',v_note)) WHERE id=v.reimbursement_id;
  INSERT INTO public.notifications(id,user_id,data)
    SELECT 'npay-'||v.reimbursement_id||'-'||v_status||'-'||p.id, p.id, jsonb_build_object('id','npay-'||v.reimbursement_id||'-'||v_status||'-'||p.id,'type',v_ntype,'message','Sandbox reimbursement of $'||v_value||': '||v_note,'date',now(),'read',false,'audience',jsonb_build_array('employee'),'employeeId',v.employee_id)
    FROM public.profiles p WHERE p.employee_id=v.employee_id
  ON CONFLICT(id) DO NOTHING;
  INSERT INTO public.notifications(id,user_id,data)
    SELECT 'npay-'||v.reimbursement_id||'-'||v_status||'-'||u.user_id, u.user_id, jsonb_build_object('id','npay-'||v.reimbursement_id||'-'||v_status||'-'||u.user_id,'type',v_ntype,'message','Sandbox reimbursement '||v.reimbursement_id||' ($'||v_value||'): '||v_note,'date',now(),'read',false,'audience',jsonb_build_array('finance'))
    FROM public.user_roles u WHERE u.role='finance'
  ON CONFLICT(id) DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.record_payment_dispatch(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_payment_dispatch(text,jsonb) TO authenticated;

-- 7. Record a reconciled individual item result. Paid requires validated association, amount, currency and recipient.
CREATE FUNCTION public.record_payment_status(_intent text, _result jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v public.payment_intents; v_tx text:=_result->>'transactionStatus'; v_status text; v_note text; v_ntype text;
  v_value text; v_mismatch text[] := ARRAY[]::text[];
BEGIN
  SELECT * INTO v FROM public.payment_intents WHERE id=_intent FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment intent not found'; END IF;
  IF NOT (public.has_role(auth.uid(),'finance') OR v.employee_id = public.current_employee()) THEN RAISE EXCEPTION 'Finance or the reimbursed employee required'; END IF;
  v_value := to_char(v.amount_cents::numeric/100, 'FM9999999990.00');

  -- Association validation: the item must belong to this exact intent.
  IF (_result->>'senderItemId') IS DISTINCT FROM v.sender_item_id THEN v_mismatch := v_mismatch || 'sender_item_id'; END IF;
  IF (_result->>'amountCents')::bigint IS DISTINCT FROM v.amount_cents THEN v_mismatch := v_mismatch || 'amount'; END IF;
  IF (_result->>'currency') IS DISTINCT FROM v.currency THEN v_mismatch := v_mismatch || 'currency'; END IF;
  IF lower(_result->>'receiver') IS DISTINCT FROM lower(v.recipient_email) THEN v_mismatch := v_mismatch || 'receiver'; END IF;

  IF array_length(v_mismatch,1) IS NOT NULL THEN
    UPDATE public.payment_intents SET status='needs_reconciliation', provider_status=v_tx, provider_error=jsonb_build_object('name','ASSOCIATION_MISMATCH','message',array_to_string(v_mismatch,',')), updated_at=now() WHERE id=v.id;
    UPDATE public.reimbursements SET status='needs_reconciliation', data=data||jsonb_build_object('status','needs_reconciliation','history',(data->'history')||jsonb_build_object('date',now(),'status','needs_reconciliation','note','Provider result did not match the authorized payment: '||array_to_string(v_mismatch,', '))) WHERE id=v.reimbursement_id AND status<>'needs_reconciliation';
    RETURN;
  END IF;

  -- Paid is final for dispatch purposes; later returned/refunded evidence is preserved without re-enabling payment.
  IF v.status='paid' THEN
    IF v_tx IN ('RETURNED','REFUNDED') THEN
      UPDATE public.payment_intents SET provider_status=v_tx, updated_at=now() WHERE id=v.id;
      UPDATE public.reimbursements SET data=data||jsonb_build_object('history',(data->'history')||jsonb_build_object('date',now(),'status','paid','note','Provider later reported '||v_tx||'; manual resolution required, no automatic repayment')) WHERE id=v.reimbursement_id;
    END IF;
    RETURN;
  END IF;
  -- Confirmed failure is terminal unless the provider later reports a fully validated SUCCESS.
  IF v.status='failed' AND v_tx<>'SUCCESS' THEN RETURN; END IF;

  v_status := CASE v_tx
    WHEN 'SUCCESS' THEN 'paid'
    WHEN 'PENDING' THEN 'processing'
    WHEN 'PROCESSING' THEN 'processing'
    WHEN 'UNCLAIMED' THEN 'unclaimed'
    WHEN 'ONHOLD' THEN 'unclaimed'
    WHEN 'RETURNED' THEN 'failed'
    WHEN 'REFUNDED' THEN 'failed'
    WHEN 'FAILED' THEN 'failed'
    WHEN 'DENIED' THEN 'failed'
    ELSE 'needs_reconciliation' END;
  v_note := CASE v_status
    WHEN 'paid' THEN 'Individual payout item confirmed SUCCESS with matching amount, currency and recipient'
    WHEN 'processing' THEN 'Provider reports the payout item is still processing'
    WHEN 'unclaimed' THEN 'Provider reports the payout is unclaimed or on hold'
    WHEN 'failed' THEN 'Provider confirmed the payout item ended as '||v_tx
    ELSE 'Provider reported an unrecognized status; reconciliation required' END;
  v_ntype := CASE v_status WHEN 'paid' THEN 'payment_completed' WHEN 'failed' THEN 'payment_failed' WHEN 'needs_reconciliation' THEN 'payment_reconciliation' ELSE 'reimbursement_initiated' END;

  UPDATE public.payment_intents SET status=v_status, provider_status=v_tx,
    payout_item_id=coalesce(_result->>'payoutItemId', payout_item_id), transaction_id=coalesce(_result->>'transactionId', transaction_id),
    paypal_batch_id=coalesce(_result->>'payoutBatchId', paypal_batch_id),
    provider_error=CASE WHEN v_status IN ('failed','needs_reconciliation') THEN jsonb_build_object('name',v_tx,'message',v_note) ELSE provider_error END,
    resolved_at=CASE WHEN v_status IN ('paid','failed') THEN now() ELSE resolved_at END, updated_at=now()
  WHERE id=v.id;
  UPDATE public.reimbursements SET status=v_status, data=data||jsonb_build_object('status',v_status,'paypalReference',coalesce(_result->>'transactionId',data->>'paypalReference'),'history',(data->'history')||jsonb_build_object('date',now(),'status',v_status,'note',v_note)) WHERE id=v.reimbursement_id AND status IS DISTINCT FROM v_status;
  INSERT INTO public.notifications(id,user_id,data)
    SELECT 'npay-'||v.reimbursement_id||'-'||v_status||'-'||p.id, p.id, jsonb_build_object('id','npay-'||v.reimbursement_id||'-'||v_status||'-'||p.id,'type',v_ntype,'message','Sandbox reimbursement of $'||v_value||': '||v_note,'date',now(),'read',false,'audience',jsonb_build_array('employee'),'employeeId',v.employee_id)
    FROM public.profiles p WHERE p.employee_id=v.employee_id
  ON CONFLICT(id) DO NOTHING;
  INSERT INTO public.notifications(id,user_id,data)
    SELECT 'npay-'||v.reimbursement_id||'-'||v_status||'-'||u.user_id, u.user_id, jsonb_build_object('id','npay-'||v.reimbursement_id||'-'||v_status||'-'||u.user_id,'type',v_ntype,'message','Sandbox reimbursement '||v.reimbursement_id||' ($'||v_value||'): '||v_note,'date',now(),'read',false,'audience',jsonb_build_array('finance'))
    FROM public.user_roles u WHERE u.role='finance'
  ON CONFLICT(id) DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.record_payment_status(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_payment_status(text,jsonb) TO authenticated;