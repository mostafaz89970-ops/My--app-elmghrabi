
import React, { useState, useMemo } from 'react';
import { LightingRecord } from '../types';

interface RegistrationListProps {
  records: LightingRecord[];
  onUpdateRecord: (id: string, updatedData: Partial<LightingRecord>) => void;
  onDeleteMonth?: (month: number, year: number) => void;
  canDeleteMonth?: boolean;
}

const ARABIC_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

const RegistrationList: React.FC<RegistrationListProps> = ({ 
  records, 
  onUpdateRecord, 
  onDeleteMonth,
  canDeleteMonth = false
}) => {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [searchTerm, setSearchTerm] = useState('');

  // حالات التعديل
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState({
    transformerName: '',
    chassisNumber: '',
    notes: ''
  });

  const startEditing = (record: LightingRecord) => {
    setEditingId(record.id);
    setEditData({
      transformerName: record.transformerName,
      chassisNumber: record.chassisNumber,
      notes: record.notes
    });
  };

  const handleSave = () => {
    if (editingId) {
      onUpdateRecord(editingId, editData);
      setEditingId(null);
    }
  };

  const monthlyRecords = useMemo(() => {
    return records.filter(record => {
      const date = new Date(record.timestamp);
      return date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
    });
  }, [records, selectedMonth, selectedYear]);

  const filteredRecords = useMemo(() => {
    return monthlyRecords.filter(record => 
      record.transformerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.chassisNumber.includes(searchTerm)
    );
  }, [monthlyRecords, searchTerm]);

  const monthlyTotal = useMemo(() => {
    return filteredRecords.reduce((sum, rec) => sum + rec.difference, 0);
  }, [filteredRecords]);

  const handleDeleteMonthClick = () => {
    if (!onDeleteMonth) return;
    
    const confirmMessage = `هل أنت متأكد من حذف كافة سجلات شهر ${ARABIC_MONTHS[selectedMonth]} لعام ${selectedYear}؟\n\nسيتم حذف ${filteredRecords.length} سجل. لا يمكن التراجع عن هذا الإجراء.`;
    
    if (window.confirm(confirmMessage)) {
      if (window.confirm("تأكيد نهائي: هل تريد حقاً مسح بيانات هذا الشهر بالكامل؟")) {
        onDeleteMonth(selectedMonth, selectedYear);
      }
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1">عرض شهر</label>
              <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))} className="w-full px-4 py-2 bg-gray-50 border rounded-xl font-bold text-gray-700">
                {ARABIC_MONTHS.map((month, idx) => (<option key={month} value={idx}>{month}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 mb-1">السنة</label>
              <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} className="w-full px-4 py-2 bg-gray-50 border rounded-xl font-bold text-gray-700">
                {Array.from({ length: 10 }, (_, i) => currentYear - 5 + i).map(year => (<option key={year} value={year}>{year.toLocaleString('ar-EG', { useGrouping: false })}</option>))}
              </select>
            </div>
          </div>
          <div className="flex-1 relative pt-5">
            <input type="text" placeholder="ابحث بالاسم أو الشاسية..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pr-10 pl-4 py-2 bg-gray-50 border rounded-xl outline-none" />
            <span className="absolute right-3 top-8 text-gray-400"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg></span>
          </div>
        </div>
      </div>

      <div className="bg-blue-600 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row justify-between items-center">
        <div className="flex-1">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-bold">كشف شهر {ARABIC_MONTHS[selectedMonth]} {selectedYear.toLocaleString('ar-EG', { useGrouping: false })}</h3>
            {canDeleteMonth && filteredRecords.length > 0 && (
              <button 
                onClick={handleDeleteMonthClick}
                className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-2 transition-all shadow-md active:scale-95"
                title="حذف هذا الشهر بالكامل"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                حذف الشهر
              </button>
            )}
          </div>
          <p className="text-blue-100 text-xs opacity-80 mt-1">عدد السجلات: {filteredRecords.length.toLocaleString('ar-EG')}</p>
        </div>
        <div className="bg-white/10 px-6 py-3 rounded-2xl backdrop-blur-md border border-white/20 mt-4 md:mt-0">
          <span className="text-xs font-bold block opacity-70">إجمالي استهلاك الشهر</span>
          <div className="text-3xl font-black">{monthlyTotal.toLocaleString('ar-EG')} <span className="text-sm">ك.و.س</span></div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-black text-gray-500">م</th>
                <th className="px-6 py-4 text-xs font-black text-gray-500">اسم المحول</th>
                <th className="px-6 py-4 text-xs font-black text-gray-500">رقم الشاسية</th>
                <th className="px-6 py-4 text-xs font-black text-gray-500 text-center">السابقة</th>
                <th className="px-6 py-4 text-xs font-black text-gray-500 text-center">الحالية</th>
                <th className="px-6 py-4 text-xs font-black text-gray-500 text-center">الفرق</th>
                <th className="px-6 py-4 text-xs font-black text-gray-500">ملاحظات</th>
                <th className="px-6 py-4 text-xs font-black text-gray-500">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRecords.length > 0 ? filteredRecords.map((record, index) => (
                <tr key={record.id} className="hover:bg-blue-50/50 transition-colors group">
                  <td className="px-6 py-4 text-xs text-gray-400 font-bold">{(index + 1).toLocaleString('ar-EG')}</td>
                  <td className="px-6 py-4">
                    {editingId === record.id ? (
                      <input type="text" value={editData.transformerName} onChange={(e) => setEditData({...editData, transformerName: e.target.value})} className="border p-1 rounded w-full text-sm font-bold" />
                    ) : (
                      <div className="font-black text-gray-800">{record.transformerName}</div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {editingId === record.id ? (
                      <input type="text" value={editData.chassisNumber} onChange={(e) => setEditData({...editData, chassisNumber: e.target.value})} className="border p-1 rounded w-full text-sm font-mono" />
                    ) : (
                      <div className="text-sm text-gray-500 font-mono">{record.chassisNumber}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-center font-bold text-gray-400">{record.previousReading.toLocaleString('ar-EG')}</td>
                  <td className="px-6 py-4 text-sm text-center font-bold text-gray-800">{record.currentReading.toLocaleString('ar-EG')}</td>
                  <td className="px-6 py-4 text-center">
                    <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-lg text-xs font-black">{record.difference.toLocaleString('ar-EG')}</span>
                  </td>
                  <td className="px-6 py-4">
                    {editingId === record.id ? (
                      <textarea value={editData.notes} onChange={(e) => setEditData({...editData, notes: e.target.value})} className="border p-1 rounded w-full text-xs h-10" />
                    ) : (
                      <div className="text-sm text-gray-500 max-w-xs truncate">{record.notes || '--'}</div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {editingId === record.id ? (
                      <div className="flex gap-2">
                        <button onClick={handleSave} className="bg-green-600 text-white p-1.5 rounded-lg shadow-sm hover:bg-green-700 transition-colors">
                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg>
                        </button>
                        <button onClick={() => setEditingId(null)} className="bg-gray-400 text-white p-1.5 rounded-lg shadow-sm hover:bg-gray-500 transition-colors">
                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => startEditing(record)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors" title="تعديل هذا السجل">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                      </button>
                    )}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={8} className="px-6 py-20 text-center text-gray-300 italic">
                    لا توجد سجلات مسجلة لهذا الشهر
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

export default RegistrationList;
