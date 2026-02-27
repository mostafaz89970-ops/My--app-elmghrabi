
import React, { useState, useRef, useEffect } from 'react';
import { User, ActiveSection, Notification } from '../types';

interface DashboardLayoutProps {
  user: User;
  notifications: Notification[];
  onLogout: () => void;
  onNavigate: (page: string) => void;
  onMarkRead: (id: string) => void;
  activePage: string;
  children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ 
  user, 
  notifications, 
  onLogout, 
  onNavigate, 
  onMarkRead,
  activePage, 
  children 
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openSection, setOpenSection] = useState<ActiveSection>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  // Mobile view detection
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleSection = (section: ActiveSection) => {
    if (section === 'dashboard') {
      setOpenSection(null);
      onNavigate('home');
    } else {
      setOpenSection(openSection === section ? null : section);
    }
  };

  const getNotifIcon = (type: string) => {
    switch (type) {
      case 'warning': return <div className="p-2 bg-orange-100 text-orange-600 rounded-lg"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg></div>;
      case 'alert': return <div className="p-2 bg-red-100 text-red-600 rounded-lg"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div>;
      default: return <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div>;
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-100 overflow-hidden print:bg-white text-right" dir="rtl">
      {/* Mobile Menu Button */}
      {isMobile && (
        <button 
          onClick={toggleMobileMenu}
          className="fixed top-4 right-4 z-50 p-2 bg-blue-600 text-white rounded-lg shadow-lg md:hidden"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isMobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" />
            )}
          </svg>
        </button>
      )}

      {/* Mobile Overlay */}
      {isMobile && isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={closeMobileMenu}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`
          ${isSidebarOpen ? 'w-64' : 'w-20'} 
          bg-white shadow-xl transition-all duration-300 ease-in-out z-40 flex flex-col print:hidden
          fixed md:relative inset-0 md:inset-auto h-screen md:h-full
          ${isMobile ? (isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full') : ''}
          ${!isMobile && isSidebarOpen ? 'md:translate-x-0' : ''}
          ${!isMobile && !isSidebarOpen ? 'md:-translate-x-full' : ''}
        `}
      >
        <div className="p-4 flex items-center justify-between border-b bg-blue-600 text-white">
          <span className={`font-bold transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 w-0'}`}>
            الإنارة العامة
          </span>
          <button 
            onClick={() => isMobile ? closeMobileMenu() : setIsSidebarOpen(!isSidebarOpen)}
            className="p-1 hover:bg-blue-500 rounded transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto mt-4 px-2 space-y-1">
          <button 
            onClick={() => toggleSection('dashboard')}
            className={`w-full flex items-center p-3 rounded-lg transition-all ${activePage === 'home' ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50 text-gray-600'}`}
          >
            <svg className="w-5 h-5 ml-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className={`${isSidebarOpen ? 'block' : 'hidden'}`}>لوحة التحكم الرئيسي</span>
          </button>

          {/* قسم السجلات */}
          <div>
            <button 
              onClick={() => toggleSection('records')}
              className={`w-full flex items-center justify-between p-3 rounded-lg transition-all ${openSection === 'records' ? 'bg-gray-50 text-blue-600' : 'hover:bg-gray-50 text-gray-600'}`}
            >
              <div className="flex items-center">
                <svg className="w-5 h-5 ml-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className={`${isSidebarOpen ? 'block' : 'hidden'}`}>قسم السجلات</span>
              </div>
              <svg className={`w-4 h-4 transition-transform ${openSection === 'records' ? 'rotate-180' : ''} ${isSidebarOpen ? 'block' : 'hidden'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div className={`overflow-hidden transition-all duration-300 ${openSection === 'records' && isSidebarOpen ? 'max-h-40 mt-1 opacity-100' : 'max-h-0 opacity-0'}`}>
              <button onClick={() => onNavigate('register-lighting')} className={`w-full text-right py-2 pr-12 pl-4 rounded-lg text-sm ${activePage === 'register-lighting' ? 'text-blue-600 font-bold bg-blue-50' : 'text-gray-500 hover:text-blue-600'}`}>تسجيل الإنارة</button>
              <button onClick={() => onNavigate('record-list')} className={`w-full text-right py-2 pr-12 pl-4 rounded-lg text-sm ${activePage === 'record-list' ? 'text-blue-600 font-bold bg-blue-50' : 'text-gray-500 hover:text-blue-600'}`}>قائمة التسجيل</button>
            </div>
          </div>

          {/* قسم التقارير */}
          <div>
            <button 
              onClick={() => toggleSection('reports')}
              className={`w-full flex items-center justify-between p-3 rounded-lg transition-all ${openSection === 'reports' ? 'bg-gray-50 text-blue-600' : 'hover:bg-gray-50 text-gray-600'}`}
            >
              <div className="flex items-center">
                <svg className="w-5 h-5 ml-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                </svg>
                <span className={`${isSidebarOpen ? 'block' : 'hidden'}`}>قسم التقارير</span>
              </div>
              <svg className={`w-4 h-4 transition-transform ${openSection === 'reports' ? 'rotate-180' : ''} ${isSidebarOpen ? 'block' : 'hidden'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div className={`overflow-hidden transition-all duration-300 ${openSection === 'reports' && isSidebarOpen ? 'max-h-40 mt-1 opacity-100' : 'max-h-0 opacity-0'}`}>
              <button onClick={() => onNavigate('reports')} className={`w-full text-right py-2 pr-12 pl-4 rounded-lg text-sm ${activePage === 'reports' ? 'text-blue-600 font-bold bg-blue-50' : 'text-gray-500 hover:text-blue-600'}`}>تقارير شهرية</button>
            </div>
          </div>

          {/* قسم المستخدمين */}
          {user.role === 'admin' && (
            <div>
              <button 
                onClick={() => toggleSection('users')}
                className={`w-full flex items-center justify-between p-3 rounded-lg transition-all ${openSection === 'users' ? 'bg-gray-50 text-blue-600' : 'hover:bg-gray-50 text-gray-600'}`}
              >
                <div className="flex items-center">
                  <svg className="w-5 h-5 ml-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <span className={`${isSidebarOpen ? 'block' : 'hidden'}`}>إدارة المستخدمين</span>
                </div>
                <svg className={`w-4 h-4 transition-transform ${openSection === 'users' ? 'rotate-180' : ''} ${isSidebarOpen ? 'block' : 'hidden'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div className={`overflow-hidden transition-all duration-300 ${openSection === 'users' && isSidebarOpen ? 'max-h-60 mt-1 opacity-100' : 'max-h-0 opacity-0'}`}>
                <button onClick={() => onNavigate('add-user')} className={`w-full text-right py-2 pr-12 pl-4 rounded-lg text-sm ${activePage === 'add-user' ? 'text-blue-600 font-bold bg-blue-50' : 'text-gray-500 hover:text-blue-600'}`}>إضافة مستخدم</button>
                <button onClick={() => onNavigate('permissions')} className={`w-full text-right py-2 pr-12 pl-4 rounded-lg text-sm ${activePage === 'permissions' ? 'text-blue-600 font-bold bg-blue-50' : 'text-gray-500 hover:text-blue-600'}`}>صلاحيات المستخدمين</button>
                <button onClick={() => onNavigate('user-activity')} className={`w-full text-right py-2 pr-12 pl-4 rounded-lg text-sm ${activePage === 'user-activity' ? 'text-blue-600 font-bold bg-blue-50' : 'text-gray-500 hover:text-blue-600'}`}>نشاط المستخدمين</button>
              </div>
            </div>
          )}

          {/* قسم الإعدادات */}
          <div>
            <button 
              onClick={() => toggleSection('settings')}
              className={`w-full flex items-center justify-between p-3 rounded-lg transition-all ${openSection === 'settings' ? 'bg-gray-50 text-blue-600' : 'hover:bg-gray-50 text-gray-600'}`}
            >
              <div className="flex items-center">
                <svg className="w-5 h-5 ml-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                </svg>
                <span className={`${isSidebarOpen ? 'block' : 'hidden'}`}>الإعدادات</span>
              </div>
              <svg className={`w-4 h-4 transition-transform ${openSection === 'settings' ? 'rotate-180' : ''} ${isSidebarOpen ? 'block' : 'hidden'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <div className={`overflow-hidden transition-all duration-300 ${openSection === 'settings' && isSidebarOpen ? 'max-h-40 mt-1 opacity-100' : 'max-h-0 opacity-0'}`}>
              <button onClick={() => onNavigate('settings-transformers')} className={`w-full text-right py-2 pr-12 pl-4 rounded-lg text-sm ${activePage === 'settings-transformers' ? 'text-blue-600 font-bold bg-blue-50' : 'text-gray-500 hover:text-blue-600'}`}>إضافة أسماء المحولات</button>
            </div>
          </div>
        </nav>

        <div className="p-4 border-t border-gray-100">
          <button onClick={onLogout} className="w-full flex items-center p-3 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
            <svg className="w-5 h-5 ml-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className={`${isSidebarOpen ? 'block' : 'hidden'}`}>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-white">
        <header className="h-16 bg-white border-b flex items-center justify-between px-4 md:px-8 z-30 sticky top-0 print:hidden shadow-sm">
          <div className="flex items-center space-x-2 md:space-x-4 space-x-reverse">
            <h2 className="text-sm md:text-xl font-bold text-gray-800">
              {activePage === 'home' && 'الرئيسية'}
              {activePage === 'register-lighting' && 'تسجيل بيانات الإنارة'}
              {activePage === 'record-list' && 'قائمة السجلات المسجلة'}
              {activePage === 'settings-transformers' && 'إدارة المحولات والكشاك'}
              {activePage === 'reports' && 'تقارير الإنارة العامة'}
              {activePage === 'add-user' && 'إضافة مستخدم جديد'}
              {activePage === 'permissions' && 'إدارة صلاحيات المستخدمين'}
              {activePage === 'user-activity' && 'سجل نشاط المستخدمين'}
            </h2>
          </div>
          
          <div className="flex items-center gap-2 md:gap-6">
            {/* Notification Bell */}
            <div className="relative" ref={notificationRef}>
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 text-gray-400 hover:text-blue-600 transition-colors relative"
              >
                <svg className="w-6 md:w-7 h-6 md:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute top-0 md:top-1 right-0 md:right-1 bg-red-500 text-white text-[10px] font-black w-4 md:w-5 h-4 md:h-5 flex items-center justify-center rounded-full border-2 border-white animate-bounce">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              {showNotifications && (
                <div className="absolute left-0 mt-3 w-72 md:w-80 bg-white border border-gray-100 rounded-2xl shadow-2xl z-50 overflow-hidden transform animate-fadeIn">
                  <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                    <span className="font-black text-gray-800">مركز التنبيهات</span>
                  </div>
                  <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
                    {notifications.length > 0 ? (
                      notifications.map(notif => (
                        <div 
                          key={notif.id} 
                          className={`p-4 flex gap-3 hover:bg-gray-50 transition-colors cursor-pointer ${!notif.isRead ? 'bg-blue-50/30' : ''}`}
                          onClick={() => onMarkRead(notif.id)}
                        >
                          {getNotifIcon(notif.type)}
                          <div className="flex-1">
                            <h5 className={`text-sm font-bold ${!notif.isRead ? 'text-blue-900' : 'text-gray-700'}`}>{notif.title}</h5>
                            <p className="text-xs text-gray-500 mt-1 leading-relaxed">{notif.message}</p>
                            <span className="text-[10px] text-gray-400 mt-2 block italic">{new Date(notif.timestamp).toLocaleTimeString('ar-EG')}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-10 text-center text-gray-400">
                        لا توجد تنبيهات حالياً
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-2 md:space-x-3 space-x-reverse">
              <div className="text-left ml-2 md:ml-4">
                <p className="text-xs md:text-sm font-bold text-gray-700">{user.username}</p>
                <p className="text-[10px] md:text-xs text-gray-400 capitalize">{user.role === 'admin' ? 'مدير نظام' : 'مستخدم'}</p>
              </div>
              <div className="w-8 md:w-10 h-8 md:h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-sm md:text-base">
                {user.username.charAt(0)}
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-2 md:p-8 print:p-0">
          <div className="max-w-6xl mx-auto print:max-w-none pb-20">
            {children}
          </div>
          
          <footer className="mt-auto border-t py-6 text-center text-gray-400 text-xs font-bold print:hidden">
            جميع حقوق النشر محفوظة Eng-MOSTAFA ELMGHRABI 2025
          </footer>
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
