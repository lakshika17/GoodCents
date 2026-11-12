// Run only against the isolated draft backend, after the browser creates the acceptance records.
const base=process.env['RECEIPT_BACKEND_URL'] ?? 'http://127.0.0.1:8001';
if(base!=='http://127.0.0.1:8001')throw Error('Isolated local backend required');
const key=process.env['SUPABASE_PUBLISHABLE_KEY'] ?? process.env['SUPABASE_SERVICE_ROLE_KEY'];
const passwords={employee:process.env['RECEIPT_TEST_PASSWORD'],manager:process.env['RECEIPT_TEST_PASSWORD'],other:process.env['RECEIPT_TEST_PASSWORD'],finance:process.env['RECEIPT_FINANCE_PASSWORD']};
const emails={employee:'employee-a',manager:'approver',other:'employee-b',finance:'finance'};
const tokens={};
for(const role of Object.keys(emails)){
 const r=await fetch(base+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({email:emails[role]+'@receipt-test.invalid',password:passwords[role]})});
 if(!r.ok)throw Error('Test sign-in failed: '+role);tokens[role]=(await r.json()).access_token;
}
let checks=0;const ok=(v,n)=>{if(!v)throw Error(n);console.log('PASS',n);checks++};
async function req(role,path,body,method=body?'POST':'GET'){
 const r=await fetch(base+'/rest/v1/'+path,{method,headers:{apikey:key,Authorization:'Bearer '+tokens[role],'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 const text=await r.text();const data=text?JSON.parse(text):null;return {ok:r.ok,data};
}
const reject=async(fn,n)=>ok(!(await fn()).ok,n);
const call=(role,action,payload)=>req(role,'rpc/internal_action',{action,payload});
const all=await req('employee','expenses?select=*');
const x=all.data.filter(e=>e.data.vendor.startsWith('Fictional Three Role')&&e.data.vendor.endsWith('corrected')).at(-1);if(!x)throw Error('Run browser acceptance first');
ok(x.document_version===2&&x.amount_cents===1987,'returned logical expense revision 2 stores 1987 cents');
const revs=await req('employee','expense_revisions?expense_id=eq.'+x.id+'&order=revision');
ok(revs.data.length===2&&revs.data[0].amount_cents===2123&&revs.data[1].amount_cents===1987,'both reviewed revisions preserved');
await Promise.all([call('employee','expense',x.submission_payload),call('employee','expense',x.submission_payload)]);
const repeated=await req('employee','expenses?submission_key=eq.'+x.submission_key);ok(repeated.data.length===1,'concurrent original submission retries preserve one logical expense');
const decision={id:x.id,version:2,decision:'approved',comment:''};
await Promise.all([call('manager','decision',decision),call('manager','decision',decision)]);
const approvals=await req('employee','approvals?expense_id=eq.'+x.id);ok(approvals.data.length===2,'duplicate decisions preserve one return and one approval');
const rb=await req('employee','reimbursements?expense_id=eq.'+x.id);ok(rb.data.length===1,'exactly one reimbursement');
await reject(()=>call('manager','decision',{...decision,version:1}),'stale revision rejected');
await reject(()=>call('manager','decision',{...decision,decision:'changes_requested',comment:'late'}),'conflicting terminal decision rejected');
await reject(()=>call('employee','respond',{id:x.id,version:2,amount:1,response:'edit approved',verified:true}),'approved revision cannot be edited');
await reject(()=>call('employee','decision',decision),'employee cannot self approve');
await reject(()=>call('finance','decision',decision),'finance cannot act as manager');
await reject(()=>call('finance','reimbursement',{id:'rb-'+x.id,status:'queued'}),'finance payment transition disabled');
await reject(()=>req('employee','rpc/begin_extraction',{p_request_id:crypto.randomUUID(),p_submission_key:crypto.randomUUID(),p_pdf_sha256:'a'.repeat(64),p_storage_path:'forged'}),'employee cannot forge initial extraction identity');
await reject(()=>req('employee','rpc/save_extraction_snapshot',{p_request_id:crypto.randomUUID(),p_status:'completed',p_envelope:{}}),'employee cannot forge extraction status or snapshot');
await reject(()=>req('employee','rpc/begin_extraction_trusted',{p_owner:x.submission_actor,p_request_id:crypto.randomUUID(),p_submission_key:crypto.randomUUID(),p_pdf_sha256:'a'.repeat(64)}),'trusted writer unavailable to employee');
const other=await req('other','expenses?id=eq.'+x.id);ok(other.data.length===0,'other employee cannot read expense');
const finance=await req('finance','expenses?id=eq.'+x.id);ok(finance.data.length===1,'finance reads approved expense');
const pending=await req('finance','expenses?approval_status=eq.pending');ok(pending.data.length===0,'finance cannot read pending expenses');
const paid=await req('finance','reimbursements?status=neq.awaiting_authorization');ok(paid.data.length===0,'all payment states remain awaiting authorization');
const bad=await fetch(base+'/rest/v1/expenses',{headers:{apikey:key,Authorization:'Bearer invalid'}});ok(!bad.ok,'invalid credentials rejected');
console.log('CHECKS',checks);

const serviceKey=process.env['SUPABASE_SERVICE_ROLE_KEY'];
const jobsResponse=await fetch(base+'/rest/v1/extraction_jobs?select=*&limit=1',{headers:{apikey:serviceKey,Authorization:'Bearer '+serviceKey}});
const jobs=await jobsResponse.json();if(!jobs[0])throw Error('Existing fictional persisted extraction request required');
const j=jobs[0];
const begin=async()=>{const r=await fetch(base+'/rest/v1/rpc/begin_extraction_trusted',{method:'POST',headers:{apikey:serviceKey,Authorization:'Bearer '+serviceKey,'Content-Type':'application/json'},body:JSON.stringify({p_owner:j.owner_id,p_request_id:crypto.randomUUID(),p_submission_key:j.submission_key,p_pdf_sha256:j.pdf_sha256})});if(!r.ok)throw Error('Trusted concurrent reuse failed');return r.json()};
const reused=await Promise.all([begin(),begin(),begin()]);ok(reused.every(v=>v.request_id===j.request_id),'controlled concurrent trusted starts reuse same persisted document request without extraction calls');
console.log('TOTAL CHECKS',checks);
