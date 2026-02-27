
import React from 'react';
import { UserActivity } from '../types';

interface UserActivityPageProps {
  activities: UserActivity[];
  onReset: () => void;
  isAdmin: boolean;
}

const UserActivityPage: React.FC<UserActivityPageProps> = ({ activities, onReset, isAdmin }) => {
  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-black text-gray-800 flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          سجل النشاطات والنظام
        </h3>
        {isAdmin && (
          <button 
            onClick={() => {
              if (window.confirm('هل أنت متأكد من تصفير سجل النشاطات بالكامل؟ لا يمكن التراجع عن هذا الإجراء.')) {
                onReset();
              }
            }}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            تصفير سجل النشاط
          </button>
        )}
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-8 py-5 text-sm font-black text-gray-500">التاريخ والوقت</th>
                <th className="px-8 py-5 text-sm font-black text-gray-500">المستخدم</th>
                <th className="px-8 py-5 text-sm font-black text-gray-500">الإجراء</th>
                <th className="px-8 py-5 text-sm font-black text-gray-500">التفاصيل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {activities.length > 0 ? (
                activities.map(act => (
                  <tr key={act.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-8 py-4">
                      <div className="text-xs text-gray-400 font-bold">
                        {new Date(act.timestamp).toLocaleDateString('ar-EG')} - {new Date(act.timestamp).toLocaleTimeString('ar-EG')}
                      </div>
                    </td>
                    <td className="px-8 py-4">
                      <div className="font-black text-gray-700">{act.username}</div>
                    </td>
                    <td className="px-8 py-4">
                      <span className={`px-3 py-1 rounded-lg text-[10px] font-black ${
                        act.action.includes('حذف') ? 'bg-red-100 text-red-600' : 
                        act.action.includes('إضافة') ? 'bg-green-100 text-green-600' :
                        act.action.includes('تعديل') ? 'bg-orange-100 text-orange-600' :
                        'bg-blue-100 text-blue-600'
                      }`}>
                        {act.action}
                      </span>
                    </td>
                    <td className="px-8 py-4">
                      <div className="text-sm text-gray-500">{act.details}</div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="p-20 text-center text-gray-300 italic">
                    لا توجد نشاطات مسجلة حالياً
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default UserActivityPage;
