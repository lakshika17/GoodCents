import type { Role } from './types';

export const DEMO_PREVIEWS = {
  developer: { label: 'Developer / Admin', role: 'admin', employeeId: 'EMP-005', canAuthorize: true },
  employee: { label: 'Employee', role: 'employee', employeeId: 'EMP-005', canAuthorize: false },
  manager: { label: 'Manager', role: 'manager', employeeId: 'EMP-005', canAuthorize: false },
  finance: { label: 'Finance', role: 'admin', employeeId: 'EMP-003', canAuthorize: true },
  terry: { label: 'Terry', role: 'admin', employeeId: 'EMP-001', canAuthorize: false },
} satisfies Record<string, { label: string; role: Role; employeeId: string; canAuthorize: boolean }>;

export type DemoPreview = keyof typeof DEMO_PREVIEWS;
export function isDemoPreview(value: unknown): value is DemoPreview {
  return typeof value === 'string' && Object.hasOwn(DEMO_PREVIEWS, value);
}