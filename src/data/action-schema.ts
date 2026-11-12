import { z } from 'zod';
import { persistedExpense, expenseAmount } from '@/lib/expense-contract';
const id = z.string().trim().min(1).max(100);
const amount = z.number().finite().positive().max(1e9);
const expense = z.object({ vendor: z.string().trim().min(1).max(200), amount, date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), category: z.enum(['Lab Supplies','Software','Travel','Meals','Equipment','Office','Training','Services']), departmentId: id, projectId: id.nullable(), description: z.string().max(2000), receipt: z.object({ fileName: z.string().max(255), fileType: z.enum(['image/jpeg','image/png','application/pdf']), storagePath: z.string().max(500) }).optional() });
export const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('expense'), payload: persistedExpense }),
  z.object({ action: z.literal('decision'), payload: z.object({ id, version: z.number().int().positive(), decision: z.enum(['approved','rejected','changes_requested']), comment: z.string().max(1000) }) }),
  z.object({ action: z.literal('respond'), payload: z.object({ id, version: z.number().int().positive(), verified: z.literal(true), response: z.string().trim().min(1).max(1000), amount: expenseAmount, vendor: z.string().trim().min(1).max(200).optional(), date: z.string().optional(), documentNumber: z.string().max(200).nullable().optional(), description: z.string().max(2000).optional() }) }),
  z.object({ action: z.literal('reimbursement'), payload: z.object({ id, status: z.literal('queued') }) }),
  z.object({ action: z.literal('budget'), payload: z.object({ id, name: z.string().trim().min(1).max(200), departmentId: id, projectId: id.nullable(), ownerId: id, amount, period: z.string().max(100), history: z.array(z.object({ date: z.string().max(30), note: z.string().max(500), amount: z.number().finite() })).max(1000) }) }),
  z.object({ action: z.literal('project'), payload: z.object({ id, project: z.object({ id, name: z.string().trim().min(1).max(200), code: z.string().max(30), status: z.enum(['active','closed']) }), departmentIds: z.array(id).max(5) }) }),
  z.object({ action: z.literal('policy'), payload: z.object({ autoFlagAbove: z.number().nonnegative(), receiptRequiredAbove: z.number().nonnegative(), duplicateWindowDays: z.number().int().nonnegative().max(3650), restrictedCategories: z.array(expense.shape.category), budgetAlertPercent: z.number().min(0).max(100) }) }),
  z.object({ action: z.literal('access_decision'), payload: z.object({ id: z.string().uuid(), decision: z.enum(['approved','rejected','revoked']), note: z.string().max(1000) }) }),
]);

