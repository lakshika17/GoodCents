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
  { id: 'EMP-001', name: 'Avery Chen', title: 'Founder and CEO', email: 'avery.chen@goodcents.example', departmentId: 'DEP-001', role: 'admin', managerId: null },
  { id: 'EMP-002', name: 'Jordan Patel', title: 'Compliance Director', email: 'jordan.patel@goodcents.example', departmentId: 'DEP-002', role: 'manager', managerId: 'EMP-001' },
  { id: 'EMP-003', name: 'Sam Rivera', title: 'Operations Coordinator', email: 'sam.rivera@goodcents.example', departmentId: 'DEP-003', role: 'manager', managerId: 'EMP-001' },
  { id: 'EMP-004', name: 'Morgan Lee', title: 'CTO', email: 'morgan.lee@goodcents.example', departmentId: 'DEP-004', role: 'manager', managerId: 'EMP-001' },
  { id: 'EMP-005', name: 'Riley Kim', title: 'Product Manager', email: 'riley.kim@goodcents.example', departmentId: 'DEP-005', role: 'manager', managerId: 'EMP-001' },
];