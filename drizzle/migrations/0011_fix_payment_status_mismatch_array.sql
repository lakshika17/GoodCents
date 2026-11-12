CREATE OR REPLACE FUNCTION public.record_payment_status(_intent text, _result jsonb) RETURNS void
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
  IF (_result->>'senderItemId') IS DISTINCT FROM v.sender_item_id THEN v_mismatch := array_append(v_mismatch, 'sender_item_id'); END IF;
  IF (_result->>'amountCents')::bigint IS DISTINCT FROM v.amount_cents THEN v_mismatch := array_append(v_mismatch, 'amount'); END IF;
  IF (_result->>'currency') IS DISTINCT FROM v.currency THEN v_mismatch := array_append(v_mismatch, 'currency'); END IF;
  IF lower(_result->>'receiver') IS DISTINCT FROM lower(v.recipient_email) THEN v_mismatch := array_append(v_mismatch, 'receiver'); END IF;

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