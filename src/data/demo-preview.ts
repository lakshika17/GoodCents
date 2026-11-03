import type { Role } from './types';

export const DEMO_PREVIEWS = {
  developer: { label: 'Developer / Admin', role: 'admin', employeeId: 'e-priya', canAuthorize: true },
  employee: { label: 'Employee', role: 'employee', employeeId: 'e-sam', canAuthorize: false },
  manager: { label: 'Manager', role: 'manager', employeeId: 'e-maya', canAuthorize: false },
  finance: { label: 'Finance', role: 'admin', employeeId: 'e-priya', canAuthorize: true },
  terry: { label: 'Terry', role: 'admin', employeeId: 'e-priya', canAuthorize: false },
} satisfies Record<string, { label: string; role: Role; employeeId: string; canAuthorize: boolean }>;

export type DemoPreview = keyof typeof DEMO_PREVIEWS;
export function isDemoPreview(value: unknown): value is DemoPreview {
  return typeof value === 'string' && Object.hasOwn(DEMO_PREVIEWS, value);
}