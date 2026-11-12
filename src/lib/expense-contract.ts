import { z } from 'zod';
import { DOCUMENT_TYPES } from './documents';

export const calendarDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};
export const moneyInCents = (value: number) => Number.isFinite(value) && value > 0 && value <= 1e9 && Math.abs(value * 100 - Math.round(value * 100)) < 0.00001;
export const expenseAmount = z.number().refine(moneyInCents, 'Enter a positive amount with no more than two decimal places');
export const expenseDate = z.string().refine(calendarDate, 'Enter a valid calendar date');
const id = z.string().trim().min(1).max(100);
export const persistedExpense = z.object({
  submissionKey: z.string().uuid(),
  vendor: z.string().trim().min(1).max(200), amount: expenseAmount,
  currency: z.literal('USD'), date: expenseDate,
  documentType: z.enum(DOCUMENT_TYPES).refine(t => t === 'Paid Receipt' || t === 'Supplier Invoice', 'Only spending evidence is eligible'),
  documentNumber: z.string().trim().max(200).nullable(),
  source: z.enum(['manual', 'ai', 'ai_corrected']), verified: z.literal(true),
  paymentResponsibility: z.literal('employee_paid'), paymentEvidenceConfirmed: z.literal(true),
  category: z.enum(['Lab Supplies','Software','Travel','Meals','Equipment','Office','Training','Services']),
  departmentId: id, projectId: id.nullable(), description: z.string().max(2000),
  receipt: z.object({ fileName: z.string().min(1).max(255), fileType: z.enum(['image/jpeg','image/png','application/pdf']), storagePath: z.string().min(1).max(500) }),
  extractionRequestId: z.string().uuid().nullish(),
});
export type PersistedExpenseInput = z.infer<typeof persistedExpense>;