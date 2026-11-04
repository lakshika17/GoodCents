import { describe, expect, it } from 'vitest';
import { calendarDate, moneyInCents, persistedExpense } from './expense-contract';
import { canSubmitForApproval } from './documents';
const base = { submissionKey: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', vendor: 'Test Vendor', amount: 312.38, currency: 'USD', date: '2026-10-07', documentType: 'Paid Receipt', documentNumber: null, source: 'manual', verified: true, paymentResponsibility: 'employee_paid', paymentEvidenceConfirmed: true, category: 'Office', departmentId: 'TEST-A', projectId: null, description: '', receipt: { fileName: 'test.pdf', fileType: 'application/pdf', storagePath: 'actor/key' } };
describe('persistent document contract', () => {
  it('preserves an absent number as unknown', () => expect(persistedExpense.parse(base).documentNumber).toBeNull());
  it('never invents USD for missing currency', () => { expect(persistedExpense.safeParse({ ...base, currency: undefined }).success).toBe(false); expect(canSubmitForApproval({ ...base, documentType: 'Paid Receipt', currency: undefined })).toBe(false); });
  it('rejects impossible calendar dates', () => { expect(calendarDate('2026-02-30')).toBe(false); expect(calendarDate('2028-02-29')).toBe(true); });
  it('requires exact cent precision', () => { expect(moneyInCents(312.381)).toBe(false); expect(moneyInCents(312.38)).toBe(true); });
  it('requires employee personal payment', () => expect(persistedExpense.safeParse({ ...base, paymentResponsibility: 'company_paid' }).success).toBe(false));
  it('defers unpaid supplier payments', () => expect(persistedExpense.safeParse({ ...base, documentType: 'Supplier Invoice', paymentResponsibility: 'unpaid_supplier' }).success).toBe(false));
  it('requires payment evidence', () => expect(persistedExpense.safeParse({ ...base, paymentEvidenceConfirmed: false }).success).toBe(false));
  it('rejects unknown payment responsibility', () => expect(persistedExpense.safeParse({ ...base, paymentResponsibility: 'unknown' }).success).toBe(false));
  it('requires human confirmation', () => expect(persistedExpense.safeParse({ ...base, verified: false }).success).toBe(false));
  it('rejects quotation spending', () => expect(persistedExpense.safeParse({ ...base, documentType: 'Vendor Quote' }).success).toBe(false));
});