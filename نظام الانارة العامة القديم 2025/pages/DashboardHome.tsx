
import React, { useMemo } from 'react';
import { LightingRecord, Transformer } from '../types';

interface DashboardHomeProps {
  records: LightingRecord[];
  transformers: Transformer[];
  onNavigate: (page: string) => void;
}

const DashboardHome: React.FC<DashboardHomeProps> = ({ records, transformers, onNavigate }) => {
  const totalDifference = records.reduce((acc, curr) => acc + curr.difference, 0);

  // حساب إحصائيات الشهور والسنوات
  const timeStats = useMemo(() => {
    const uniqueMonths = new Set<string>();
    const uniqueYears = new Set<number>();

    records.forEach(record => {
      const date = new Date(record.timestamp);
      const monthYear = `${date.getFullYear()}-${date.getMonth()}`;
      uniqueMonths.add(monthYear);
      uniqueYears.add(date.getFullYear());
    });

    const yearsArray = Array.from(uniqueYears).sort((a, b) => a - b);
    let yearsRange = "";
    if (yearsArray.length === 1) {
      yearsRange = `عام ${yearsArray[0].toLocaleString('ar-EG', { useGrouping: false })}`;
    } else if (yearsArray.length > 1) {
      yearsRange = `من ${yearsArray[0].toLocaleString('ar-EG', { useGrouping: false })} إلى ${yearsArray[yearsArray.length - 1].toLocaleString('ar-EG', { useGrouping: false })}`;
    } else {
      yearsRange = "لا توجد بيانات";
    }

    return {
      monthCount: uniqueMonths.size,
      yearsRange: yearsRange
    };
  }, [records]);

  const shortcuts = [
    {
      title: 'تسجيل إنارة جديد',
      desc: 'إضافة قراءة عداد جديدة للمحولات',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      page: 'register-lighting',
      color: 'bg-blue-600',
    },
    {
      title: 'قائمة السجلات',
      desc: 'عرض وتعديل كافة القراءات المسجلة',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
      page: 'record-list',
      color: 'bg-indigo-600',
    },
    {
      title: 'إدارة المحولات',
      desc: 'إضافة وتعديل أسماء المحولات والكشاك',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        </svg>
      ),
      page: 'settings-transformers',
      color: 'bg-teal-600',
    },
    {
      title: 'التقارير الشهرية',
      desc: 'إصدار تقارير الطباعة والمراجعة النهائية',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
        </svg>
      ),
      page: 'reports',
      color: 'bg-emerald-600',
    },
  ];

  return (
    <div className="space-y-10 animate-fadeIn">
      {/* شبكة البطاقات الإحصائية */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <span className="text-xs font-bold text-blue-500 bg-blue-50 px-2 py-1 rounded">إجمالي</span>
          </div>
          <h3 className="text-gray-400 text-sm font-medium">إجمالي السجلات</h3>
          <p className="text-3xl font-black text-gray-800">{records.length.toLocaleString('ar-EG')}</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
          </div>
          <h3 className="text-gray-400 text-sm font-medium">عدد المحولات</h3>
          <p className="text-3xl font-black text-gray-800">{transformers.length.toLocaleString('ar-EG')}</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-orange-50 text-orange-600 rounded-xl">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
          <h3 className="text-gray-400 text-sm font-medium">إجمالي الاستهلاك</h3>
          <p className="text-3xl font-black text-gray-800">{totalDifference.toLocaleString('ar-EG')} <span className="text-xs font-normal">KWH</span></p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 border-r-4 border-r-emerald-500 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2h2a2 2 0 002-2" />
              </svg>
            </div>
          </div>
          <h3 className="text-gray-400 text-sm font-medium">الشهور المسجلة</h3>
          <p className="text-3xl font-black text-gray-800">{timeStats.monthCount.toLocaleString('ar-EG')} شهر</p>
          <p className="text-[10px] text-emerald-600 font-bold mt-1 truncate">{timeStats.yearsRange}</p>
        </div>
      </div>

      {/* اختصارات الوصول السريع */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-2 h-8 bg-blue-600 rounded-full"></div>
          <h3 className="text-xl font-black text-gray-800">اختصارات الوصول السريع</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {shortcuts.map((card, index) => (
            <button
              key={index}
              onClick={() => onNavigate(card.page)}
              className="group bg-white p-8 rounded-3xl shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-2 transition-all text-right flex flex-col items-start"
            >
              <div className={`w-16 h-16 ${card.color} text-white rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform`}>
                {card.icon}
              </div>
              <h4 className="text-lg font-black text-gray-800 mb-2">{card.title}</h4>
              <p className="text-sm text-gray-400 leading-relaxed">{card.desc}</p>
              
              <div className="mt-6 flex items-center text-blue-600 font-bold text-xs gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <span>انتقل الآن</span>
                <svg className="w-4 h-4 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* رسالة ترحيبية أو إرشادات */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-10 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-3xl font-black mb-4">مرحباً بك في نظام الإنارة العامة</h2>
          <p className="text-blue-100 max-w-2xl leading-relaxed">
            تم تصميم هذا النظام لتسهيل عملية مراقبة وتسجيل استهلاك الإنارة في المحولات الكهربائية. 
            يمكنك البدء مباشرة بتسجيل قراءات جديدة أو تصدير التقارير الشهرية للطباعة والاعتماد.
          </p>
        </div>
        <div className="absolute top-0 left-0 w-64 h-64 bg-white/5 rounded-full -translate-x-32 -translate-y-32"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-400/10 rounded-full translate-x-48 translate-y-48"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-5 pointer-events-none">
          <svg className="w-96 h-96" fill="currentColor" viewBox="0 0 24 24">
            <path d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
      </div>
    </div>
  );
};

export default DashboardHome;
