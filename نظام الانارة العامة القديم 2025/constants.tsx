
import { User } from './types';

export const ADMIN_PASSWORD = '123450';

export const INITIAL_USERS: User[] = [
  { 
    id: 'admin_1',
    username: 'مدير النظام (Admin)', 
    password: ADMIN_PASSWORD,
    role: 'admin',
    permissions: {
      canAddRecord: true,
      canEditRecord: true,
      canManageTransformers: true,
      canViewReports: true,
      canManageUsers: true
    }
  },
  { 
    id: 'user_1',
    username: 'مهندس الموقع', 
    password: ADMIN_PASSWORD,
    role: 'user',
    permissions: {
      canAddRecord: true,
      canEditRecord: true,
      canManageTransformers: true,
      canViewReports: true,
      canManageUsers: false
    }
  },
  { 
    id: 'user_2',
    username: 'فني الصيانة', 
    password: ADMIN_PASSWORD,
    role: 'user',
    permissions: {
      canAddRecord: true,
      canEditRecord: false,
      canManageTransformers: false,
      canViewReports: false,
      canManageUsers: false
    }
  },
];
