
import React, { useState, useEffect } from 'react';
import { User } from '../types';

interface LoginProps {
  onLogin: (user: User) => void;
  users: User[];
}

const Login: React.FC<LoginProps> = ({ onLogin, users }) => {
  const [selectedUsername, setSelectedUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (users.length > 0 && !selectedUsername) {
      setSelectedUsername(users[0].username);
    }
  }, [users, selectedUsername]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!selectedUsername) {
      setError('يرجى اختيار مستخدم');
      return;
    }

    const targetUser = users.find(u => u.username === selectedUsername);
    if (!targetUser) {
      setError('المستخدم غير موجود');
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      // التحقق من كلمة المرور الخاصة بالمستخدم المختار
      if (password === targetUser.password) {
        onLogin(targetUser);
      } else {
        setError('كلمة المرور غير صحيحة');
        setIsLoading(false);
      }
    }, 400);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 to-gray-900 p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-10 transform transition-all">
        <div className="flex flex-col items-center mb-10">
          <div className="w-24 h-24 bg-blue-50 rounded-3xl flex items-center justify-center mb-4 shadow-inner">
            <svg className={`w-14 h-14 text-blue-600 ${isLoading ? 'animate-pulse' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-3xl font-black text-gray-800">الإنارة العامة</h1>
          <p className="text-gray-400 text-sm mt-2 font-bold">بوابة تسجيل الدخول الموحدة</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-xs font-black text-gray-500 mr-2 uppercase tracking-wider">اختر الحساب</label>
            <div className="relative">
              <select
                disabled={isLoading}
                value={selectedUsername}
                onChange={(e) => setSelectedUsername(e.target.value)}
                className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-gray-700 appearance-none"
              >
                {users.length === 0 ? (
                  <option>جاري تحميل المستخدمين...</option>
                ) : (
                  users.map(u => (
                    <option key={u.id} value={u.username}>{u.username}</option>
                  ))
                )}
              </select>
              <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/></svg>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-black text-gray-500 mr-2 uppercase tracking-wider">كلمة المرور</label>
            <input
              disabled={isLoading}
              type="password"
              placeholder="••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-blue-500 focus:bg-white transition-all outline-none text-center tracking-[0.5em] font-black"
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-center text-sm font-bold border border-red-100 animate-shake">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || users.length === 0}
            className={`w-full py-5 ${isLoading ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'} text-white font-black rounded-2xl transition-all shadow-xl shadow-blue-500/20 active:scale-95 flex items-center justify-center gap-3`}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>جاري الدخول...</span>
              </>
            ) : (
              <span>دخول للنظام</span>
            )}
          </button>
        </form>

        <div className="mt-10 pt-8 border-t border-gray-50 text-center">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
            جميع حقوق النشر محفوظة Eng-MOSTAFA ELMGHRABI 2025
          </p>
        </div>
      </div>
      
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .animate-shake { animation: shake 0.2s ease-in-out 0s 2; }
      `}</style>
    </div>
  );
};

export default Login;
