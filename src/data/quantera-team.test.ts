import { describe, expect, it } from 'vitest';
import { quanteraEmployees, quanteraDepartments } from './quantera-team';
import { employees, budgets, expenses, approvals, reimbursements, projectDepartments } from './seed';
import { summarize } from '@/lib/calc';

describe('Workbook team consistency', () => {
  const expected = [
    ['EMP-001', 'Terry Bates, PhD', 'Founder and CEO', 'DEP-001', null],
    ['EMP-002', 'Terry Bates, Sr.', 'Director of QMS and Compliance', 'DEP-002', 'EMP-001'],
    ['EMP-003', 'Alexis Grace', 'Operations Coordinator', 'DEP-003', 'EMP-001'],
    ['EMP-004', 'Matt Scimeca', 'CTO', 'DEP-004', 'EMP-001'],
    ['EMP-005', 'Lakshika Sarupria', 'AI Product Manager', 'DEP-005', 'EMP-001'],
  ];
  it.each(expected)('preserves workbook employee %s', (id, name, title, departmentId, managerId) => {
    expect(quanteraEmployees.find(e => e.id === id)).toMatchObject({ name, title, departmentId, managerId });
  });
  it('uses exactly the five workbook employees and departments in sample data', () => {
    expect(employees).toEqual(quanteraEmployees);
    expect(employees).toHaveLength(5);
    expect(quanteraDepartments.map(d => [d.id, d.name])).toEqual([
      ['DEP-001', 'Executive Leadership'], ['DEP-002', 'Quality & Compliance'],
      ['DEP-003', 'Operations'], ['DEP-004', 'Science & Research'], ['DEP-005', 'Product & Technology'],
    ]);
  });
  it('all financial references resolve to workbook identities', () => {
    const employeeIds = new Set(employees.map(e => e.id));
    const departmentIds = new Set(quanteraDepartments.map(d => d.id));
    for (const b of budgets) { expect(employeeIds.has(b.ownerId)).toBe(true); expect(departmentIds.has(b.departmentId)).toBe(true); }
    for (const e of expenses) { expect(employeeIds.has(e.employeeId)).toBe(true); expect(departmentIds.has(e.departmentId)).toBe(true); }
    for (const a of approvals) expect(employeeIds.has(a.managerId)).toBe(true);
    for (const r of reimbursements) { expect(employeeIds.has(r.employeeId)).toBe(true); if (r.authorizedBy) expect(employeeIds.has(r.authorizedBy)).toBe(true); }
    for (const pd of projectDepartments) expect(departmentIds.has(pd.departmentId)).toBe(true);
  });
  it('preserves existing aggregate sample financial values', () => {
    const values = summarize(budgets, expenses, reimbursements);
    expect(values.allocated).toBe(76000);
    expect(Math.round(values.actual)).toBe(29117);
    expect(values.pendingCount).toBe(13);
    expect(Math.round(values.approvedUnpaid)).toBe(7640);
  });
});