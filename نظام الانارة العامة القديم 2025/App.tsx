import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import DashboardLayout from './components/DashboardLayout';
import LightingRegistration from './pages/LightingRegistration';
import RegistrationList from './pages/RegistrationList';
import Settings from './pages/Settings';
import DashboardHome from './pages/DashboardHome';
import Reports from './pages/Reports';
import AddUser from './pages/AddUser';
import Permissions from './pages/Permissions';
import UserActivityPage from './pages/UserActivityPage';
import { Transformer, LightingRecord, User, UserActivity, UserRole } from './types';
import { INITIAL_USERS } from './constants';
import { ref, push, set, onValue, remove, update } from "firebase/database";
import { db } from "./firebase"; // تأكد أن ملف firebase.ts يحتوي على إعداداتك

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('app_active_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [users, setUsers] = useState<User[]>([]);
  const [transformers, setTransformers] = useState<Transformer[]>([]);
  const [records, setRecords] = useState<LightingRecord[]>([]);
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [currentPage, setCurrentPage] = useState<string>('home');
  
  // --- 1. جلب البيانات من السحابة (Firebase) لحظياً ---
  useEffect(() => {
    // جلب السجلات
    onValue(ref(db, 'records'), (snapshot) => {
      const data = snapshot.val();
      if (data) setRecords(sortRecords(Object.values(data)));
    });

    // جلب المحولات
    onValue(ref(db, 'transformers'), (snapshot) => {
      const data = snapshot.val();
      if (data) setTransformers(Object.values(data));
    });

    // جلب المستخدمين
    onValue(ref(db, 'users'), (snapshot) => {
      const data = snapshot.val();
      if (data) setUsers(Object.values(data));
      else setUsers(INITIAL_USERS);
    });

    // جلب سجل الأنشطة
    onValue(ref(db, 'activities'), (snapshot) => {
      const data = snapshot.val();
      if (data) setActivities(Object.values(data).reverse());
    });
  }, []);

  const sortRecords = (recs: LightingRecord[]) => {
    return [...recs].sort((a, b) => b.timestamp - a.timestamp);
  };

  // --- 2. وظائف الحفظ السحابي بدلاً من LocalStorage ---

  const logActivity = (action: string, details: string) => {
    if (!user) return;
    const activityRef = push(ref(db, 'activities'));
    const newActivity = {
      id: activityRef.key,
      userId: user.id,
      username: user.username,
      action,
      details,
      timestamp: Date.now()
    };
    set(activityRef, newActivity);
  };

  const handleAddTransformer = (name: string, chassisNumber: string) => {
    const transRef = push(ref(db, 'transformers'));
    const newTransformer = { id: transRef.key as string, name, chassisNumber };
    set(transRef, newTransformer);
    logActivity('إضافة محول', `إضافة محول جديد باسم: ${name}`);
  };

  const handleDeleteTransformer = (id: string) => {
    const t = transformers.find(x => x.id === id);
    remove(ref(db, `transformers/${id}`));
    logActivity('حذف محول', `حذف المحول: ${t?.name}`);
  };

  const handleAddRecord = (record: Omit<LightingRecord, 'id'>) => {
    const newRecordRef = push(ref(db, 'records'));
    const newRecord: LightingRecord = {
      ...record,
      id: newRecordRef.key as string,
    };
    set(newRecordRef, newRecord);
    logActivity('تسجيل إنارة', `تسجيل قراءة لمحول: ${record.transformerName}`);
    setCurrentPage('record-list');
  };

  const handleUpdateRecord = (id: string, updatedData: Partial<LightingRecord>) => {
    update(ref(db, `records/${id}`), updatedData);
  };

  const handleDeleteMonth = (month: number, year: number) => {
    records.forEach(r => {
      const d = new Date(r.timestamp);
      if (d.getMonth() === month && d.getFullYear() === year) {
        remove(ref(db, `records/${r.id}`));
      }
    });
    logActivity('حذف شهر', `تم حذف سجلات شهر ${month + 1} لعام ${year}`);
  };

  const handleAddUser = (username: string, role: UserRole, password: string) => {
    const userRef = push(ref(db, 'users'));
    const newUser: User = {
      id: userRef.key as string,
      username,
      password,
      role,
      permissions: {
        canAddRecord: true,
        canEditRecord: role === 'admin',
        canManageTransformers: role === 'admin',
        canViewReports: true,
        canManageUsers: role === 'admin'
      }
    };
    set(userRef, newUser);
    logActivity('إضافة مستخدم', `إضافة مستخدم جديد: ${username}`);
  };

  const handleUpdateUserPermissions = (userId: string, permissions: User['permissions']) => {
    update(ref(db, `users/${userId}`), { permissions });
    const u = users.find(x => x.id === userId);
    logActivity('تحديث صلاحيات', `تم تحديث صلاحيات المستخدم: ${u?.username}`);
  };

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    localStorage.setItem('app_active_user', JSON.stringify(loggedInUser));
    logActivity('تسجيل دخول', `المستخدم ${loggedInUser.username} قام بتسجيل الدخول.`);
    setCurrentPage('home');
  };

  const handleLogout = () => {
    if (user) {
      logActivity('تسجيل خروج', `المستخدم ${user.username} قام بتسجيل الخروج.`);
    }
    localStorage.removeItem('app_active_user');
    setUser(null);
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <DashboardHome records={records} transformers={transformers} />;
      case 'register-lighting':
        return <LightingRegistration transformers={transformers} onAddRecord={handleAddRecord} />;
      case 'record-list':
        return <RegistrationList records={records} onUpdateRecord={handleUpdateRecord} onDeleteMonth={handleDeleteMonth} user={user!} />;
      case 'settings-transformers':
        return <Settings transformers={transformers} onAdd={handleAddTransformer} onDelete={handleDeleteTransformer} />;
      case 'reports':
        return <Reports records={records} />;
      case 'add-user':
        return <AddUser onAddUser={handleAddUser} />;
      case 'permissions':
        return <Permissions users={users} onUpdatePermissions={handleUpdateUserPermissions} />;
      case 'user-activity':
        return <UserActivityPage activities={activities} />;
      default:
        return <DashboardHome records={records} transformers={transformers} />;
    }
  };

  if (!user) {
    return <Login onLogin={handleLogin} users={users} />;
  }

  // --- بقية منطق التنقل والواجهة (لم يتغير) ---
  return (
    <div dir="rtl" className="font-cairo">
      <DashboardLayout
        user={user}
        notifications={[]} // Placeholder for notifications
        onLogout={handleLogout}
        onNavigate={setCurrentPage}
        onMarkRead={() => {}} // Placeholder
        activePage={currentPage}
      >
        {renderPage()}
      </DashboardLayout>
    </div>
  );
};

export default App;
