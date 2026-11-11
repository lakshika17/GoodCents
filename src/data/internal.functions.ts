import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { ApprovalPolicy, Budget, Expense, Project } from './types';
import { actionSchema } from './action-schema';
import type { Json } from '@/integrations/supabase/types';
const id = z.string().trim().min(1).max(100);

export const loadDeveloperAccess = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data: identity, error: authError } = await context.supabase.auth.getUser();
  if (authError || !identity.user?.email_confirmed_at || !identity.user.email) return { authorized: false };
  const { data, error } = await context.supabase.from('developer_roles').select('email,role').eq('email', identity.user.email.toLowerCase()).eq('active', true).maybeSingle();
  if (error) throw new Error(error.message);
  return { authorized: data?.role === 'admin' };
});

export const loadInternal = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const db = context.supabase;
  const { data: profile, error } = await db.from('profiles').select('*').eq('id', context.userId).single();
  const { data: employeeId } = await db.rpc('current_employee');
  if (error || !profile || !employeeId) throw new Error('Your account is not an active invited GoodCents user.');
  const tables = ['departments','employees','projects','project_departments','budgets','expenses','receipts','approvals','reimbursements','notifications','approval_policies','user_roles','access_requests','access_grants','audit_log'] as const;
  const results = await Promise.all(tables.map(async table => {
    const rows: Json[] = [];
    for (let offset = 0; ; offset += 1000) {
      const result = await db.from(table).select('*').range(offset, offset + 999);
      if (result.error) throw new Error(result.error.message);
      if (table === 'receipts') {
        for (const record of result.data ?? []) {
          const receipt = record as { id: string; storage_path: string; data: Json };
          const signed = await db.storage.from('private-receipts').createSignedUrl(receipt.storage_path, 300);
          const fields = receipt.data && typeof receipt.data === 'object' && !Array.isArray(receipt.data) ? receipt.data : {};
          rows.push({ ...receipt, data: { ...fields, previewUrl: signed.data?.signedUrl ?? null } });
        }
      } else rows.push(...(result.data ?? []) as Json[]);
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
  if (!founder) throw new Error('Only the founder can invite employees.');
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