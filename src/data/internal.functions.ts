import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { ApprovalPolicy, Budget, Expense, Project } from './types';

const id = z.string().trim().min(1).max(100);
const amount = z.number().finite().positive().max(1e9);
const expense = z.object({ vendor: z.string().trim().min(1).max(200), amount, date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), category: z.enum(['Lab Supplies','Software','Travel','Meals','Equipment','Office','Training','Services']), departmentId: id, projectId: id.nullable(), description: z.string().max(2000), receipt: z.object({ fileName: z.string().max(255), fileType: z.enum(['image/jpeg','image/png','application/pdf']), storagePath: z.string().max(500) }).optional() });
export const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('expense'), payload: expense }),
  z.object({ action: z.literal('decision'), payload: z.object({ id, decision: z.enum(['approved','rejected','changes_requested']), comment: z.string().max(1000) }) }),
  z.object({ action: z.literal('respond'), payload: z.object({ id, response: z.string().trim().min(1).max(1000), amount }) }),
  z.object({ action: z.literal('reimbursement'), payload: z.object({ id, status: z.literal('queued') }) }),
  z.object({ action: z.literal('budget'), payload: z.object({ id, name: z.string().trim().min(1).max(200), departmentId: id, projectId: id.nullable(), ownerId: id, amount, period: z.string().max(100), history: z.array(z.object({ date: z.string().max(30), note: z.string().max(500), amount: z.number().finite() })).max(1000) }) }),
  z.object({ action: z.literal('project'), payload: z.object({ id, project: z.object({ id, name: z.string().trim().min(1).max(200), code: z.string().max(30), status: z.enum(['active','closed']) }), departmentIds: z.array(id).max(5) }) }),
  z.object({ action: z.literal('policy'), payload: z.object({ autoFlagAbove: z.number().nonnegative(), receiptRequiredAbove: z.number().nonnegative(), duplicateWindowDays: z.number().int().nonnegative().max(3650), restrictedCategories: z.array(expense.shape.category), budgetAlertPercent: z.number().min(0).max(100) }) }),
  z.object({ action: z.literal('access_decision'), payload: z.object({ id: z.string().uuid(), decision: z.enum(['approved','rejected','revoked']), note: z.string().max(1000) }) }),
]);

export const loadInternal = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const db = context.supabase;
  const { data: profile, error } = await db.from('profiles').select('*').eq('id', context.userId).single();
  const { data: employeeId } = await db.rpc('current_employee');
  if (error || !profile || !employeeId) throw new Error('Your account is not an active invited Quantera employee.');
  const tables = ['departments','employees','projects','project_departments','budgets','expenses','receipts','approvals','reimbursements','notifications','approval_policies','user_roles','access_requests','access_grants','audit_log'] as const;
  const results = await Promise.all(tables.map(async table => {
    const rows: unknown[] = [];
    for (let offset = 0; ; offset += 1000) {
      const result = await db.from(table).select('*').range(offset, offset + 999);
      if (result.error) throw new Error(result.error.message);
      rows.push(...(result.data ?? []));
      if ((result.data?.length ?? 0) < 1000) break;
    }
    return [table, rows] as const;
  }));
  const totals = await db.rpc('shared_project_totals');
  if (totals.error) throw new Error(totals.error.message);
  return { profile, tables: Object.fromEntries(results), sharedTotals: totals.data ?? [] };
});

export const performInternal = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(input => actionSchema.parse(input)).handler(async ({ data, context }) => {
  const result = await context.supabase.rpc('internal_action', { action: data.action, payload: data.payload });
  if (result.error) throw new Error(result.error.message);
  return { ok: true };
});

export const requestAccess = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(input => z.object({ type: z.enum(['department','project']), target: id, reason: z.string().trim().min(1).max(1000) }).parse(input)).handler(async ({ data, context }) => {
  const result = await context.supabase.from('access_requests').insert({ user_id: context.userId, reason: data.reason, department_id: data.type === 'department' ? data.target : null, project_id: data.type === 'project' ? data.target : null });
  if (result.error) throw new Error(result.error.message);
  return { ok: true };
});

export const inviteEmployee = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(input => z.object({ employeeId: id, origin: z.string().url() }).parse(input)).handler(async ({ data, context }) => {
  const { data: founder } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'founder' });
  if (!founder) throw new Error('Only Terry can invite employees.');
  const { data: employee } = await context.supabase.from('employees').select('email,active').eq('id', data.employeeId).single();
  if (!employee?.active) throw new Error('Active workbook employee required.');
  const { getRequest } = await import('@tanstack/react-start/server');
  const callerOrigin = getRequest().headers.get('origin');
  if (data.origin !== callerOrigin) throw new Error('Invalid invitation return address.');
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const result = await supabaseAdmin.auth.admin.inviteUserByEmail(employee.email, { redirectTo: `${data.origin}/reset-password` });
  if (result.error) throw new Error(result.error.message);
  await supabaseAdmin.from('audit_log').insert({ actor_id: context.userId, action: 'employee_invited', target_id: data.employeeId });
  return { ok: true };
});

export type InternalBudget = Budget;
export type InternalExpense = Expense;
export type InternalProject = Project;
export type InternalPolicy = ApprovalPolicy;