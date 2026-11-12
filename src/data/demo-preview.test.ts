import { describe, expect, it } from 'vitest';
import { DEMO_PREVIEWS, isDemoPreview } from './demo-preview';

describe('Fictional preview permissions', () => {
  it('Developer/Admin has unrestricted fictional administrative access', () => {
    expect(DEMO_PREVIEWS.developer.role).toBe('admin');
    expect(DEMO_PREVIEWS.developer.canAuthorize).toBe(true);
    expect(DEMO_PREVIEWS.developer.employeeId).toBe('EMP-002');
  });
  it('Employee remains an employee preview', () => {
    expect(DEMO_PREVIEWS.employee.role).toBe('employee');
    expect(DEMO_PREVIEWS.employee.employeeId).toBe('EMP-002');
  });
  it('Manager remains a manager preview', () => {
    expect(DEMO_PREVIEWS.manager.role).toBe('manager');
    expect(DEMO_PREVIEWS.manager.employeeId).toBe('EMP-002');
  });
  it('Finance can authorize fictional reimbursements', () => {
    expect(DEMO_PREVIEWS.finance.canAuthorize).toBe(true);
    expect(DEMO_PREVIEWS.finance.employeeId).toBe('EMP-003');
  });
  it('Founder has company-wide preview visibility without implicit payment authority', () => {
    expect(DEMO_PREVIEWS.terry.role).toBe('admin');
    expect(DEMO_PREVIEWS.terry.canAuthorize).toBe(false);
    expect(DEMO_PREVIEWS.terry.employeeId).toBe('EMP-001');
  });
  it('Preview names never accept server authority or arbitrary keys', () => {
    expect(isDemoPreview('developer')).toBe(true);
    expect(isDemoPreview('founder')).toBe(false);
    expect(isDemoPreview('__proto__')).toBe(false);
  });
});