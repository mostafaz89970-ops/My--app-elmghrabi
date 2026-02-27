
import React, { useState, useMemo } from 'react';
import { LightingRecord, Transformer } from '../types';

interface ReportsProps {
  records: LightingRecord[];
  transformers: Transformer[];
}

const ARABIC_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

const Reports: React.FC<ReportsProps> = ({ records, transformers }) => {
  const currentYear = new Date().getFullYear();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [showReport, setShowReport] = useState(false);

  // تصفية السجلات حسب الشهر والسنة المختارة
  const reportRecords = useMemo(() => {
    if (!showReport) return [];
    return records.filter(record => {
      const date = new Date(record.timestamp);
      return date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
    });
  }, [records, selectedMonth, selectedYear, showReport]);

  // تقسيم السجلات حسب العدد المطلوب (35 ثم 24 ثم الباقي)
  const pages = useMemo(() => {
    if (reportRecords.length === 0) return [];
    
    const p1 = reportRecords.slice(0, 35);
    const p2 = reportRecords.slice(35, 35 + 24);
    const p3 = reportRecords.slice(35 + 24);
    
    // نرجع فقط الصفحات التي تحتوي على بيانات
    return [p1, p2, p3].filter(page => page.length > 0);
  }, [reportRecords]);

  // حساب الإجمالي العام لجميع السجلات في التقرير
  const grandTotal = useMemo(() => {
    return reportRecords.reduce((sum, r) => sum + r.difference, 0);
  }, [reportRecords]);

  const handlePrint = () => {
    window.print();
  };

  const handleSearch = () => {
    setShowReport(true);
  };

  return (
    <div className="space-y-8 print:space-y-0">
      {/* أدوات التحكم - مخفية عند الطباعة */}
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 print:hidden">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">اختر الشهر</label>
              <select 
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(parseInt(e.target.value));
                  setShowReport(false);
                }}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
              >
                {ARABIC_MONTHS.map((month, idx) => (
                  <option key={month} value={idx}>{month}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">اختر السنة الميلادية</label>
              <select 
                value={selectedYear}
                onChange={(e) => {
                  setSelectedYear(parseInt(e.target.value));
                  setShowReport(false);
                }}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Array.from({ length: 10 }, (_, i) => currentYear - 5 + i).map(year => (
                  <option key={year} value={year}>{year.toLocaleString('ar-EG', { useGrouping: false })}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button 
                onClick={handleSearch}
                className="w-full px-8 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center space-x-2 space-x-reverse"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span>عرض التقرير (معاينة)</span>
              </button>
            </div>
          </div>
          
          {showReport && reportRecords.length > 0 && (
            <button 
              onClick={handlePrint}
              className="px-8 py-3 bg-green-600 text-white font-bold rounded-xl shadow-lg hover:bg-green-700 transition-all flex items-center space-x-2 space-x-reverse"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              <span>طباعة الآن</span>
            </button>
          )}
        </div>
      </div>

      {/* عرض التقرير */}
      {showReport && reportRecords.length > 0 ? (
        <div className="space-y-12 print:space-y-0">
          {pages.map((pageRecords, pageIdx) => {
            const pageTotal = pageRecords.reduce((sum, r) => sum + r.difference, 0);
            const isLastPage = pageIdx === pages.length - 1;
            
            return (
              <div key={pageIdx} className="bg-white p-8 border rounded-2xl shadow-sm min-h-[1000px] flex flex-col print:border-none print:shadow-none print:rounded-none print:p-4 print:page-break-after-always">
                {/* رأس التقرير */}
                <div className="text-center border-b-2 border-gray-800 pb-4 mb-6">
                  <h1 className="text-xl font-bold">
                    قراءة عدادات الإنارة العامة التابعة لمجلس قروي بني صامت عن شهر {ARABIC_MONTHS[selectedMonth]} {selectedYear.toLocaleString('ar-EG', { useGrouping: false })}م
                  </h1>
                  <p className="text-sm text-gray-500 mt-1 print:hidden">الصفحة {(pageIdx + 1).toLocaleString('ar-EG')} من {pages.length.toLocaleString('ar-EG')}</p>
                </div>

                {/* الجدول */}
                <div className="flex-1">
                  <table className="w-full border-collapse border border-gray-800 text-[13px]">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-800 p-2 w-10">م</th>
                        <th className="border border-gray-800 p-2">اسم المحول</th>
                        <th className="border border-gray-800 p-2">رقم الشاسية</th>
                        <th className="border border-gray-800 p-2 text-center">القراءة السابقة</th>
                        <th className="border border-gray-800 p-2 text-center">القراءة الحالية</th>
                        <th className="border border-gray-800 p-2 text-center">الفرق</th>
                        <th className="border border-gray-800 p-2">ملاحظات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageRecords.map((rec, i) => {
                        // حساب الرقم المسلسل التراكمي عبر الصفحات
                        const sequentialNum = pages.slice(0, pageIdx).reduce((acc, p) => acc + p.length, 0) + i + 1;
                        return (
                          <tr key={rec.id}>
                            <td className="border border-gray-800 p-2 text-center">
                              {sequentialNum.toLocaleString('ar-EG')}
                            </td>
                            <td className="border border-gray-800 p-2 font-bold">{rec.transformerName}</td>
                            <td className="border border-gray-800 p-2 font-mono text-center">{rec.chassisNumber}</td>
                            <td className="border border-gray-800 p-2 text-center font-bold text-gray-600">{rec.previousReading.toLocaleString('ar-EG')}</td>
                            <td className="border border-gray-800 p-2 text-center font-bold">{rec.currentReading.toLocaleString('ar-EG')}</td>
                            <td className="border border-gray-800 p-2 text-center font-black bg-gray-50">{rec.difference.toLocaleString('ar-EG')}</td>
                            <td className="border border-gray-800 p-2 text-[11px] leading-tight">{rec.notes}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* قسم الإجماليات */}
                <div className="mt-6 space-y-2">
                  <div className="flex justify-between items-center border border-gray-800 p-3 bg-gray-50 font-bold">
                    <span>إجمالي فرق الاستهلاك لهذه الصفحة:</span>
                    <span className="text-lg">{pageTotal.toLocaleString('ar-EG')} ك.و.س</span>
                  </div>
                  
                  {isLastPage && (
                    <div className="flex justify-between items-center border-4 border-double border-blue-800 p-4 bg-blue-50 text-blue-900 font-black text-xl">
                      <span>الإجمالي العام لكافة السجلات ({reportRecords.length.toLocaleString('ar-EG')} محول):</span>
                      <span>{grandTotal.toLocaleString('ar-EG')} ك.و.س</span>
                    </div>
                  )}
                </div>

                {/* تذييل التوقيعات */}
                <div className="mt-auto pt-10 border-t border-gray-400">
                  <div className="grid grid-cols-3 gap-0 text-center text-sm font-bold">
                    <div className="border-l border-gray-300 px-2">
                      <p className="mb-8">{(1).toLocaleString('ar-EG')} لجنة الوحدة المحلية</p>
                      <p className="border-t border-gray-800 pt-2 inline-block px-4">..........................</p>
                    </div>
                    <div className="border-l border-gray-300 px-2">
                      <p className="mb-8">{(2).toLocaleString('ar-EG')} لجنة الكهرباء</p>
                      <p className="border-t border-gray-800 pt-2 inline-block px-4">..........................</p>
                    </div>
                    <div className="px-2">
                      <p className="mb-8">{(3).toLocaleString('ar-EG')} يعتمد رئيس المجلس</p>
                      <p className="border-t border-gray-800 pt-2 inline-block px-4">..........................</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        showReport && (
          <div className="bg-white p-20 rounded-2xl shadow-sm border border-dashed border-gray-300 text-center text-gray-400">
            <svg className="w-16 h-16 mx-auto mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-xl">لا توجد سجلات مسجلة لهذا الشهر والسنة</p>
            <p className="text-sm mt-2">يرجى التأكد من اختيار التاريخ الصحيح أو إضافة قراءات جديدة</p>
          </div>
        )
      )}

      {/* الحالة الافتراضية قبل المعاينة */}
      {!showReport && (
        <div className="bg-blue-50 p-20 rounded-2xl border-2 border-blue-100 border-dashed text-center text-blue-400">
          <svg className="w-20 h-20 mx-auto mb-6 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <h3 className="text-2xl font-bold text-blue-800">جاهز لمعاينة التقرير</h3>
          <p className="text-blue-600 mt-2 max-w-md mx-auto italic">
            اختر الشهر والسنة من الأعلى ثم اضغط على "عرض التقرير" لمعاينة البيانات قبل طباعتها. تم ضبط التقسيم (35 بالصفحة الأولى و 24 بالثانية).
          </p>
        </div>
      )}

      {/* تنسيقات الطباعة */}
      <style>{`
        @media print {
          body { background: white; margin: 0; padding: 0; }
          .print-page-break-after-always { page-break-after: always; }
          @page {
            size: A4;
            margin: 0.5cm;
          }
          table { width: 100%; table-layout: fixed; }
          th, td { word-wrap: break-word; }
        }
      `}</style>
    </div>
  );
};

export default Reports;
