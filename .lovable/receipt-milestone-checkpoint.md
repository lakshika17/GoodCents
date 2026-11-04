# Receipt persistence checkpoint

Code checkpoint: `476ea269647c98caf0b422b413718e7af5317e93` (read-only Git identification; history remains managed by Lovable).

Prior schema: migrations 0000–0003. Additive changes only; no company-record mutation tests. Local isolated PostgreSQL is available for transactional integration verification. Database backup inventory has not been inspected and storage is not covered by database backups.

Milestone: preserve document fields and server-derived confirmation, employee-paid reimbursement evidence, recoverable actor-scoped idempotency, extraction selection isolation, atomic approval. Keep demo separate; no payments or external service replacement.