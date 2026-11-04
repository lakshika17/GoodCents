import { describe, it, expect } from 'vitest';
import { actionSchema } from './action-schema';
describe('internal payment and access rules', () => {
  it('permits sandbox authorization but not a paid status', () => {
    expect(actionSchema.safeParse({ action: 'reimbursement', payload: { id: 'rb-1', status: 'queued' } }).success).toBe(true);
    expect(actionSchema.safeParse({ action: 'reimbursement', payload: { id: 'rb-1', status: 'paid' } }).success).toBe(false);
  });
  it('does not accept browser role changes', () => {
    expect(actionSchema.safeParse({ action: 'role', payload: { role: 'founder' } }).success).toBe(false);
  });
  it('keeps approval decisions independent of payment state', () => {
    expect(actionSchema.parse({ action: 'decision', payload: { id: 'x-1', version: 1, decision: 'approved', comment: '' , status: 'paid' } }).payload).not.toHaveProperty('status');
  });
  it('rejects fabricated negative expense amounts', () => {
    expect(actionSchema.safeParse({ action: 'expense', payload: { vendor: 'Test', amount: -1, date: '2026-11-03', category: 'Office', departmentId: 'DEP-005', projectId: null, description: '' } }).success).toBe(false);
  });
});