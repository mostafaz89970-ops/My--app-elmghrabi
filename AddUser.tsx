
import React, { useState } from 'react';

interface AddUserProps {
  onAdd: (username: string, role: 'admin' | 'user', password: string) => void;
}

const AddUser: React.FC<AddUserProps> = ({ onAdd }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'user'>('user');
  const [success, setSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    onAdd(username, role, password);
    setUsername('');
    setPassword('');
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  return (
    <div className="max-w-xl mx-auto animate-slideUp">
      <div className="bg-white p-10 rounded-3xl shadow-xl border border-gray-100">
        <h3 className="text-2xl font-black text-gray-800 mb-8 flex items-center">
          <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center ml-4">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          إضافة مستخدم جديد للنظام
        </h3>

        {success && (
          <div className="mb-6 p-4 bg-green-50 text-green-700 border border-green-100 rounded-2xl flex items-center gap-3 animate-fadeIn">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
            <span className="font-bold">تمت إضافة المستخدم بنجاح!</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700">الاسم الكامل للموظف</label>
            <input 
              type="text" 
              required
              placeholder="أدخل الاسم الرباعي..."
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none font-bold"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700">كلمة المرور</label>
            <input 
              type="password" 
              required
              placeholder="أدخل كلمة مرور الحساب..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none font-bold"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700">نوع الحساب</label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setRole('user')}
                className={`p-4 rounded-2xl border-2 transition-all font-bold ${role === 'user' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-gray-50 border-gray-100 text-gray-500'}`}
              >
                مستخدم عادي
              </button>
              <button
                type="button"
                onClick={() => setRole('admin')}
                className={`p-4 rounded-2xl border-2 transition-all font-bold ${role === 'admin' ? 'bg-red-50 border-red-500 text-red-700' : 'bg-gray-50 border-gray-100 text-gray-500'}`}
              >
                مدير نظام
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-lg transition-all active:scale-95"
          >
            تأكيد الإضافة
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddUser;
