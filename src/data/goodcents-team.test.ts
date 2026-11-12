import { describe, expect, it } from 'vitest';
import { goodcentsEmployees, goodcentsDepartments } from './goodcents-team';
import { employees, budgets, expenses, approvals, reimbursements, projectDepartments } from './seed';
import { summarize } from '@/lib/calc';

describe('GoodCents sample team consistency', () => {
  const expected = [
    ['EMP-001', 'Lakshika', 'Founder', 'DEP-001', null],
    ['EMP-002', 'Kulvardhan', 'Employee', 'DEP-002', 'EMP-001'],
    ['EMP-003', 'Zichen', 'Employee', 'DEP-003', 'EMP-001'],
    ['EMP-004', 'Lokesh', 'Employee', 'DEP-004', 'EMP-001'],
  ];
  it.each(expected)('uses requested sample identity %s', (id, name, title, departmentId, managerId) => {
    expect(goodcentsEmployees.find(e => e.id === id)).toMatchObject({ name, title, departmentId, managerId });
  });
  it('uses exactly four sample employees and preserves departments', () => {
    expect(employees).toEqual(goodcentsEmployees);
    expect(employees).toHaveLength(4);
    expect(goodcentsDepartments.map(d => [d.id, d.name])).toEqual([
      ['DEP-001', 'Executive Leadership'], ['DEP-002', 'Quality & Compliance'],
      ['DEP-003', 'Operations'], ['DEP-004', 'Science & Research'], ['DEP-005', 'Product & Technology'],
    ]);
  });
  it('keeps Lakshika as sample founder without granting employee sample records administrative roles', () => {
    expect(employees.find(e => e.name === 'Lakshika')?.role).toBe('admin');
    expect(employees.filter(e => e.name !== 'Lakshika').map(e => e.role)).toEqual(['employee', 'employee', 'employee']);
  });
  it('uses only the supplied emails and leaves Zichen email unspecified', () => {
    expect(employees.map(e => e.email)).toEqual(['lakshika17sarupria@gmail.com', 'kulsr6802@gmail.com', '', 'lokeshmonani112@gmail.com']);
  });
  it('all financial references resolve to workbook identities', () => {
    const employeeIds = new Set(employees.map(e => e.id));
    const departmentIds = new Set(goodcentsDepartments.map(d => d.id));
    for (const b of budgets) { expect(employeeIds.has(b.ownerId)).toBe(true); expect(departmentIds.has(b.departmentId)).toBe(true); }
    for (const e of expenses) { expect(employeeIds.has(e.employeeId)).toBe(true); expect(departmentIds.has(e.departmentId)).toBe(true); }
    for (const a of approvals) expect(employeeIds.has(a.managerId)).toBe(true);
    for (const r of reimbursements) { expect(employeeIds.has(r.employeeId)).toBe(true); if (r.authorizedBy) expect(employeeIds.has(r.authorizedBy)).toBe(true); }
    for (const pd of projectDepartments) expect(departmentIds.has(pd.departmentId)).toBe(true);
    for (const d of goodcentsDepartments) if (d.managerId) expect(employeeIds.has(d.managerId)).toBe(true);
  });
  it('preserves existing aggregate sample financial values', () => {
    const values = summarize(budgets, expenses, reimbursements);
    expect(values.allocated).toBe(76000);
    expect(Math.round(values.actual)).toBe(29117);
    expect(values.pendingCount).toBe(13);
    expect(Math.round(values.approvedUnpaid)).toBe(7640);
  });
});