
export interface Transformer {
  id: string;
  name: string;
  chassisNumber: string;
}

export interface LightingRecord {
  id: string;
  transformerId: string;
  transformerName: string;
  chassisNumber: string;
  previousReading: number;
  currentReading: number;
  difference: number;
  notes: string;
  date: string;
  timestamp: number;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'alert';
  timestamp: number;
  isRead: boolean;
}

export type UserRole = 'admin' | 'user';

export interface UserPermissions {
  canAddRecord: boolean;
  canEditRecord: boolean;
  canManageTransformers: boolean;
  canViewReports: boolean;
  canManageUsers: boolean;
}

export interface User {
  id: string;
  username: string;
  password: string; // الحقل الجديد
  role: UserRole;
  permissions: UserPermissions;
}

export interface UserActivity {
  id: string;
  userId: string;
  username: string;
  action: string;
  details: string;
  timestamp: number;
}

export type ActiveSection = 'dashboard' | 'records' | 'settings' | 'reports' | 'users' | null;
