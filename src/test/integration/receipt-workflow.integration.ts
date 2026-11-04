import postgres from 'postgres';
const sql=postgres({host:process.env['RECEIPT_TEST_SOCKET'] ?? '/tmp/receipt-pg',port:Number(process.env['RECEIPT_TEST_PORT'] ?? 55432),username:'nobody',database:'postgres',max:10});
const A='11111111-1111-4111-8111-111111111111',M='22222222-2222-4222-8222-222222222222',B='33333333-3333-4333-8333-333333333333';
const p={submissionKey:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',vendor:'Corrected Fictional Vendor',amount:312.38,currency:'USD',date:'2026-10-07',documentType:'Paid Receipt',documentNumber:'TEST-40796',source:'ai_corrected',verified:true,paymentResponsibility:'employee_paid',paymentEvidenceConfirmed:true,category:'Office',departmentId:'TEST-A',projectId:null,description:'Isolated test',receipt:{fileName:'test.pdf',fileType:'application/pdf',storagePath:`${A}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`}};
let checks=0;
function ok(v:any,n:string){if(!v)throw Error(n);checks++;console.log('PASS',n)}
async function as(id:string,fn:any){return sql.begin(async tx=>{await tx.unsafe('SET LOCAL ROLE authenticated');await tx`select set_config('request.jwt.claim.sub',${id},true)`;return fn(tx)})}
async function call(id:string,action:string,payload:any){return as(id,tx=>tx`select public.internal_action(${action},${tx.json(payload)})`)}
async function reject(fn:any,n:string){try{await fn()}catch{ok(true,n);return}throw Error('Expected rejection: '+n)}
try {
 for(const [patch,n] of [[{currency:null},'unknown currency'],[{date:'2026-02-30'},'calendar date'],[{amount:312.381},'precision'],[{verified:false},'confirmation'],[{documentType:'Vendor Quote'},'quote'],[{paymentResponsibility:'company_paid'},'company paid'],[{paymentResponsibility:'unpaid_supplier'},'unpaid invoice'],[{paymentResponsibility:'unknown'},'unknown payer'],[{amount:null},'missing amount']] as any)await reject(()=>call(A,'expense',{...p,...patch}),n);
 await Promise.all([call(A,'expense',p),call(A,'expense',p),call(A,'expense',p)]);
 const [x]=await sql`select * from expenses where submission_key=${p.submissionKey}`;
 ok((await sql`select * from expenses`).length===1,'concurrent identical submissions create one expense');
 ok(x.amount_cents==='31238'&&x.data.documentNumber==='TEST-40796'&&x.data.source==='ai_corrected'&&x.data.confirmedBy===A,'metadata, cents and actor persisted');
 ok((await sql`select * from receipts where expense_id=${x.id}`).length===1,'one receipt linkage');
 await reject(()=>call(A,'expense',{...p,amount:200}),'changed content key rejected');
 const [status]=await as(A,tx=>tx`select submission_status(${p.submissionKey}::uuid) as result`);ok(status.result.committed&&status.result.expenseId===x.id,'timeout after commit status readback');
 await reject(()=>call(B,'expense',p),'other employee cannot attach receipt');
 ok((await as(B,tx=>tx`select * from receipts`)).length===0,'private receipt inaccessible');
 await reject(()=>call(A,'decision',{id:x.id,version:1,decision:'approved',comment:''}),'employee cannot approve');
 await reject(()=>as(A,tx=>tx`update expenses set approval_status='approved' where id=${x.id}`),'direct financial state update denied');
 await reject(()=>as(A,tx=>tx`select internal_action_legacy('expense',${tx.json(p)})`),'legacy mutation bypass denied');
 const before=await sql`select coalesce(sum((data->>'amount')::numeric) filter(where approval_status='approved'),0) spent from expenses`;
 await Promise.all([call(M,'decision',{id:x.id,version:1,decision:'approved',comment:''}),call(M,'decision',{id:x.id,version:1,decision:'approved',comment:''})]);
 ok((await sql`select * from approvals where expense_id=${x.id}`).length===1,'concurrent approval creates one approval');
 const rb=await sql`select * from reimbursements where expense_id=${x.id}`;ok(rb.length===1&&rb[0].status==='awaiting_authorization','one awaiting authorization reimbursement');
 const [after]=await sql`select sum((data->>'amount')::numeric) spent from expenses where approval_status='approved'`;
 ok(Number(before[0].spent)===0&&Number(after.spent)===312.38&&Number(rb[0].data.amount)===312.38,'spending and approved unpaid increase once by 312.38');
 const cancelled=await as(A,tx=>tx`select cancel_expense_submission(${p.submissionKey}::uuid) result`);ok(cancelled[0].result===false,'committed attachment cannot be cancelled');
 const k='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 await sql`insert into storage.objects(bucket_id,name,owner_id,metadata) values('private-receipts',${A+'/'+k},${A},' {"mimetype":"application/pdf","size":100}'::jsonb)`;
 await reject(()=>call(A,'expense',{...p,submissionKey:k,departmentId:'TEST-B',receipt:{...p.receipt,storagePath:A+'/'+k}}),'upload then department failure rolls back expense');
 const result=await as(A,tx=>tx`select cancel_expense_submission(${k}::uuid) result`);ok(result[0].result===true,'failed uncommitted submission cancellation proven');
 await as(A,tx=>tx`delete from storage.objects where name=${A+'/'+k}`);ok((await sql`select * from storage.objects where name=${A+'/'+k}`).length===0,'cancelled orphan attachment cleanup');
 await sql`insert into storage.objects(bucket_id,name,owner_id,metadata) values('private-receipts',${A+'/'+k},${A},'{"mimetype":"application/pdf","size":100}'::jsonb)`;
 await reject(()=>call(A,'expense',{...p,submissionKey:k,receipt:{...p.receipt,storagePath:A+'/'+k}}),'delayed submission after cancellation rolls back');
 await sql`insert into expenses(id,employee_id,department_id,data) values('LEGACY','TEST-A','TEST-A','{"vendor":"Legacy","amount":10,"date":"2026-10-07"}'::jsonb)`;
 await reject(()=>call(M,'decision',{id:'LEGACY',version:1,decision:'approved',comment:''}),'legacy unknown metadata not verified');
 await reject(()=>call(M,'decision',{id:x.id,version:2,decision:'approved',comment:''}),'stale version approval rejected');
 const k2='cccccccc-cccc-4ccc-8ccc-cccccccccccc'; await sql`insert into storage.objects(bucket_id,name,owner_id,metadata) values('private-receipts',${A+'/'+k2},${A},'{"mimetype":"application/pdf","size":100}'::jsonb)`;
 await call(A,'expense',{...p,submissionKey:k2,receipt:{...p.receipt,storagePath:A+'/'+k2}});
 const [returned]=await sql`select id from expenses where submission_key=${k2}`;
 await call(M,'decision',{id:returned.id,version:1,decision:'changes_requested',comment:'Correct amount'});
 await reject(()=>call(A,'respond',{id:returned.id,version:1,amount:200,response:'Corrected',verified:false}),'changed amount needs new confirmation');
 await call(A,'respond',{id:returned.id,version:1,amount:200,response:'Corrected',verified:true});
 await reject(()=>call(M,'decision',{id:returned.id,version:1,decision:'approved',comment:''}),'old confirmation version cannot approve corrected amount');
 await call(M,'decision',{id:returned.id,version:2,decision:'approved',comment:''});
 ok((await sql`select data from reimbursements where expense_id=${returned.id}`)[0].data.amount===200,'resubmission reimbursement uses newly confirmed amount');
 console.log(JSON.stringify({expense:x.id,receipt:x.data.receiptId,reimbursement:rb[0].id,spentBefore:0,spentAfter:312.38,unpaidBefore:0,unpaidAfter:312.38,budget:1000,remaining:687.62}));
}finally{await sql.end()}
console.log('CHECKS',checks)
