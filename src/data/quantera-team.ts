import type { Department, Employee } from './types';

export const quanteraDepartments: Department[] = [
  { id: 'DEP-001', name: 'Executive Leadership', managerId: 'EMP-001' },
  { id: 'DEP-002', name: 'Quality & Compliance', managerId: 'EMP-002' },
  { id: 'DEP-003', name: 'Operations', managerId: 'EMP-003' },
  { id: 'DEP-004', name: 'Science & Research', managerId: 'EMP-004' },
  { id: 'DEP-005', name: 'Product & Technology', managerId: 'EMP-005' },
];

// Workbook directory only. These display records never authenticate a user.
export const quanteraEmployees: Employee[] = [
  { id: 'EMP-001', name: 'Terry Bates, PhD', title: 'Founder and CEO', email: 'terry.bates@quantera.as', departmentId: 'DEP-001', role: 'admin', managerId: null },
  { id: 'EMP-002', name: 'Terry Bates, Sr.', title: 'Director of QMS and Compliance', email: 'terry.bates.sr@quantera.as', departmentId: 'DEP-002', role: 'manager', managerId: 'EMP-001' },
  { id: 'EMP-003', name: 'Alexis Grace', title: 'Operations Coordinator', email: 'alexis.grace@quantera.as', departmentId: 'DEP-003', role: 'manager', managerId: 'EMP-001' },
  { id: 'EMP-004', name: 'Matt Scimeca', title: 'CTO', email: 'matthew.scimeca@quantera.as', departmentId: 'DEP-004', role: 'manager', managerId: 'EMP-001' },
  { id: 'EMP-005', name: 'Lakshika Sarupria', title: 'AI Product Manager', email: 'lakshika.sarupria@quantera.as', departmentId: 'DEP-005', role: 'manager', managerId: 'EMP-001' },
];