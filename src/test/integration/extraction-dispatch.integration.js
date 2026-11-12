// Existing-record, read-only claim acceptance against this isolated draft; never calls Render or creates a job.
const base='http://127.0.0.1:8001';
const key=process.env['SUPABASE_SERVICE_ROLE_KEY'];
if(!key)throw Error('Local draft service credential required');
const headers={apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'};
async function request(path,body){const r=await fetch(base+'/rest/v1/'+path,{headers,method:body?'POST':'GET',body:body?JSON.stringify(body):undefined});if(!r.ok)throw Error('Local draft request failed: '+r.status);const text=await r.text();return text?JSON.parse(text):null;}
const before=await request('extraction_jobs?select=*');
if(before.length!==3)throw Error('Expected three historical jobs before this bounded run');
const j=before[0];
const claims=await Promise.all(Array.from({length:3},()=>request('rpc/claim_extraction_dispatch',{p_owner:j.owner_id,p_request_id:j.request_id})));
if(!claims.every(x=>x===false))throw Error('Historical request must not be dispatched again');
console.log('PASS 3 concurrent historical claims denied; zero redispatch');
const after=await request('extraction_jobs?select=*');
if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Existing job changed');
console.log('PASS existing original snapshots and document identities unchanged; zero new jobs');
const pw=process.env['RECEIPT_TEST_PASSWORD'];
const login=await fetch(base+'/auth/v1/token?grant_type=password',{method:'POST',headers,body:JSON.stringify({email:'employee-a@receipt-test.invalid',password:pw})});
if(!login.ok)throw Error('Fictional employee sign-in failed');
const token=(await login.json()).access_token;
const denied=await fetch(base+'/rest/v1/rpc/claim_extraction_dispatch',{method:'POST',headers:{...headers,Authorization:'Bearer '+token},body:JSON.stringify({p_owner:j.owner_id,p_request_id:j.request_id})});
if(denied.ok)throw Error('Employee cannot claim privileged dispatch');
console.log('PASS employee cannot directly claim trusted dispatch');
