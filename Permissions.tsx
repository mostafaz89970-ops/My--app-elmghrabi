
import React from 'react';
import { User, UserPermissions } from '../types';

interface PermissionsProps {
  users: User[];
  onUpdate: (userId: string, permissions: UserPermissions) => void;
}

const Permissions: React.FC<PermissionsProps> = ({ users, onUpdate }) => {
  const togglePermission = (user: User, key: keyof UserPermissions) => {
    const newPermissions = {
      ...user.permissions,
      [key]: !user.permissions[key]
    };
    onUpdate(user.id, newPermissions);
  };

  const PERMISSION_LABELS: { key: keyof UserPermissions; label: string }[] = [
    { key: 'canAddRecord', label: 'إضافة قراءات' },
    { key: 'canEditRecord', label: 'تعديل السجلات' },
    { key: 'canManageTransformers', label: 'إدارة المحولات' },
    { key: 'canViewReports', label: 'عرض التقارير' },
    { key: 'canManageUsers', label: 'إدارة المستخدمين' },
  ];

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-right">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="px-8 py-6 text-sm font-black text-gray-500">المستخدم</th>
              <th className="px-8 py-6 text-sm font-black text-gray-500">الرتبة</th>
              {PERMISSION_LABELS.map(p => (
                <th key={p.key} className="px-4 py-6 text-center text-xs font-black text-gray-500">{p.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-blue-50/20 transition-colors">
                <td className="px-8 py-5">
                  <div className="font-bold text-gray-800">{u.username}</div>
                </td>
                <td className="px-8 py-5">
                  <span className={`px-3 py-1 rounded-lg text-[10px] font-black ${u.role === 'admin' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
                    {u.role === 'admin' ? 'مدير' : 'مستخدم'}
                  </span>
                </td>
                {PERMISSION_LABELS.map(p => (
                  <td key={p.key} className="px-4 py-5 text-center">
                    <button
                      onClick={() => togglePermission(u, p.key)}
                      disabled={u.role === 'admin'} // Admin always has all perms
                      className={`w-12 h-6 rounded-full transition-all relative ${u.permissions[p.key] ? 'bg-blue-600' : 'bg-gray-200'} ${u.role === 'admin' ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${u.permissions[p.key] ? 'right-7' : 'right-1'}`}></div>
                    </button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400 bg-gray-50 p-4 rounded-2xl border border-dashed text-center">
        ملاحظة: مدراء النظام يمتلكون كافة الصلاحيات بشكل افتراضي ولا يمكن تعطيلها.
      </p>
    </div>
  );
};

export default Permissions;
