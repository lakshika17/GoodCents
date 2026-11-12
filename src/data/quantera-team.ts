import type { Department, Employee } from './types';

export const quanteraDepartments: Department[] = [
  { id: 'DEP-001', name: 'Executive Leadership', managerId: 'EMP-001' },
  { id: 'DEP-002', name: 'Quality & Compliance', managerId: 'EMP-002' },
  { id: 'DEP-003', name: 'Operations', managerId: 'EMP-003' },
  { id: 'DEP-004', name: 'Science & Research', managerId: 'EMP-004' },
  { id: 'DEP-005', name: 'Product & Technology', managerId: 'EMP-002' },
];

// Sample directory only. These display records never authenticate a user.
export const quanteraEmployees: Employee[] = [
  { id: 'EMP-001', name: 'Lakshika', title: 'Founder', email: 'lakshika17sarupria@gmail.com', departmentId: 'DEP-001', role: 'admin', managerId: null },
  { id: 'EMP-002', name: 'Kulvardhan', title: 'Employee', email: 'kulsr6802@gmail.com', departmentId: 'DEP-002', role: 'employee', managerId: 'EMP-001' },
  { id: 'EMP-003', name: 'Zichen', title: 'Employee', email: '', departmentId: 'DEP-003', role: 'employee', managerId: 'EMP-001' },
  { id: 'EMP-004', name: 'Lokesh', title: 'Employee', email: 'lokeshmonani112@gmail.com', departmentId: 'DEP-004', role: 'employee', managerId: 'EMP-001' },
];