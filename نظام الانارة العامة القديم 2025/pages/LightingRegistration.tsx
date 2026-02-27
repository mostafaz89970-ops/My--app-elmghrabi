
import React, { useState, useEffect, useMemo } from 'react';
import { Transformer, LightingRecord } from '../types';

interface LightingRegistrationProps {
  transformers: Transformer[];
  records: LightingRecord[];
  onSave: (record: Omit<LightingRecord, 'id' | 'date' | 'timestamp'> & { timestamp: number; date: string }) => void;
}

const ARABIC_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

const LightingRegistration: React.FC<LightingRegistrationProps> = ({ transformers, records, onSave }) => {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  const [formData, setFormData] = useState({
    transformerId: '',
    chassisNumber: '',
    previousReading: 0,
    currentReading: 0,
    notes: '',
    selectedMonth: currentMonth,
    selectedYear: currentYear
  });

  const [lastRecordInfo, setLastRecordInfo] = useState<{ text: string; isFuture: boolean } | null>(null);
  const [difference, setDifference] = useState(0);

  // التحقق مما إذا كان هذا الشهر مسجلاً بالفعل لهذا المحول
  const isAlreadyRegistered = useMemo(() => {
    if (!formData.transformerId) return false;
    return records.some(r => {
      const d = new Date(r.timestamp);
      return r.transformerId === formData.transformerId && 
             d.getMonth() === formData.selectedMonth && 
             d.getFullYear() === formData.selectedYear;
    });
  }, [formData.transformerId, formData.selectedMonth, formData.selectedYear, records]);

  // تحديث البيانات تلقائياً عند اختيار المحول
  useEffect(() => {
    if (formData.transformerId) {
      const selected = transformers.find(t => t.id === formData.transformerId);
      
      // جلب آخر سجل تاريخي لهذا المحول (بغض النظر عن الشهر المختار حالياً) ليكون هو القراءة السابقة
      const lastRecord = [...records]
        .filter(r => r.transformerId === formData.transformerId)
        .sort((a, b) => b.timestamp - a.timestamp)[0];

      if (selected) {
        setFormData(prev => ({
          ...prev,
          chassisNumber: selected.chassisNumber,
          previousReading: lastRecord ? lastRecord.currentReading : 0,
        }));

        if (lastRecord) {
          setLastRecordInfo({
            text: `آخر قراءة مسجلة بالنظام كانت لشهر: ${lastRecord.date}`,
            isFuture: lastRecord.timestamp > Date.now()
          });
        } else {
          setLastRecordInfo({
            text: "لا توجد سجلات سابقة لهذا المحول (بداية جديدة)",
            isFuture: false
          });
        }
      }
    }
  }, [formData.transformerId, transformers, records]);

  // حساب الفرق تلقائياً
  useEffect(() => {
    const diff = formData.currentReading - formData.previousReading;
    setDifference(diff > 0 ? diff : 0);
  }, [formData.currentReading, formData.previousReading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.transformerId) return alert('يرجى اختيار المحول أولاً');
    
    if (isAlreadyRegistered) {
      const confirmUpdate = window.confirm(`تنبيه: شهر ${ARABIC_MONTHS[formData.selectedMonth]} ${formData.selectedYear} مسجل بالفعل لهذا المحول. هل تريد إضافة سجل جديد مكرر أم تفضل تحديث القائمة؟ (يفضل التعديل من قائمة السجلات)`);
      if (!confirmUpdate) return;
    }

    const selectedTransformer = transformers.find(t => t.id === formData.transformerId);
    
    // إنشاء تاريخ بناءً على الشهر والسنة المختارين
    const recordDate = new Date(formData.selectedYear, formData.selectedMonth, 1, 12, 0, 0);
    
    onSave({
      transformerId: formData.transformerId,
      transformerName: selectedTransformer?.name || '',
      chassisNumber: formData.chassisNumber,
      previousReading: formData.previousReading,
      currentReading: formData.currentReading,
      notes: formData.notes,
      difference: difference,
      timestamp: recordDate.getTime(),
      date: `${ARABIC_MONTHS[formData.selectedMonth]} ${formData.selectedYear.toLocaleString('ar-EG', {useGrouping:false})}`
    });

    setFormData({
      ...formData,
      transformerId: '',
      chassisNumber: '',
      previousReading: 0,
      currentReading: 0,
      notes: '',
    });
    setLastRecordInfo(null);
    alert('تم حفظ قراءة الشهر بنجاح');
  };

  const isReadingLower = formData.currentReading > 0 && formData.currentReading < formData.previousReading;
  const lowerAmount = formData.previousReading - formData.currentReading;

  return (
    <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden animate-slideUp">
      <div className="bg-gradient-to-l from-blue-700 to-blue-500 px-10 py-8 text-white relative">
        <h3 className="text-2xl font-bold">تسجيل واحتفاظ بقراءة الشهر</h3>
        <p className="text-blue-100 mt-2 opacity-90">يمكنك تحديد الشهر والسنة لضمان أرشفة البيانات بشكل تاريخي دقيق</p>
      </div>

      <form onSubmit={handleSubmit} className="p-10 space-y-8">
        
        {/* اختيار الفترة الزمنية */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-6 rounded-3xl border-2 border-gray-100">
          <div className="space-y-2">
            <label className="block text-sm font-black text-gray-700">تاريخ السجل (الشهر)</label>
            <select
              value={formData.selectedMonth}
              onChange={(e) => setFormData({...formData, selectedMonth: parseInt(e.target.value)})}
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl font-bold outline-none focus:border-blue-500"
            >
              {ARABIC_MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-black text-gray-700">تاريخ السجل (السنة)</label>
            <select
              value={formData.selectedYear}
              onChange={(e) => setFormData({...formData, selectedYear: parseInt(e.target.value)})}
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl font-bold outline-none focus:border-blue-500"
            >
              {Array.from({length: 10}, (_, i) => currentYear - 5 + i).map(y => (
                <option key={y} value={y}>{y.toLocaleString('ar-EG', {useGrouping:false})}</option>
              ))}
            </select>
          </div>
        </div>

        {isAlreadyRegistered && (
          <div className="bg-orange-50 border-r-4 border-orange-500 p-4 rounded-xl flex items-center gap-3">
            <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
            <span className="text-orange-800 font-bold">هذا الشهر مسجل بالفعل لهذا المحول في قاعدة البيانات.</span>
          </div>
        )}

        {isReadingLower && (
          <div className="bg-red-50 border-r-4 border-red-500 p-6 rounded-2xl">
            <h4 className="text-red-800 font-black">تنبيه: القراءة الحالية أقل من السابقة!</h4>
            <p className="text-red-600 font-bold">النقص: {lowerAmount.toLocaleString('ar-EG')} كيلو وات.</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-2">
            <label className="block text-sm font-black text-gray-700">1. اسم المحول / الكشك</label>
            <select
              required
              value={formData.transformerId}
              onChange={(e) => setFormData({ ...formData, transformerId: e.target.value })}
              className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-blue-500 transition-all outline-none font-bold"
            >
              <option value="">-- اختر المحول --</option>
              {transformers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-black text-gray-700">2. رقم شاسية العداد</label>
            <input readOnly type="text" value={formData.chassisNumber} className="w-full px-5 py-4 bg-gray-100 border-2 border-gray-200 rounded-2xl text-gray-500 font-mono" />
          </div>

          <div className="bg-blue-50/50 p-6 rounded-3xl border-2 border-blue-100/50">
            <label className="block text-sm font-black text-blue-800 mb-3">3. القراءة السابقة (التاريخية)</label>
            <div className="text-4xl font-black text-blue-600">{formData.previousReading.toLocaleString('ar-EG')}</div>
            {lastRecordInfo && <p className="text-[10px] text-blue-700 mt-2 font-bold">{lastRecordInfo.text}</p>}
          </div>

          <div className="bg-green-50/50 p-6 rounded-3xl border-2 border-green-100/50">
            <label className="block text-sm font-black text-green-800 mb-3">4. القراءة الحالية للشهر المختار</label>
            <input
              required
              type="number"
              value={formData.currentReading || ''}
              onChange={(e) => setFormData({ ...formData, currentReading: parseFloat(e.target.value) || 0 })}
              className="w-full px-6 py-4 bg-white border-2 border-green-200 rounded-2xl text-3xl font-black outline-none focus:border-green-500"
            />
          </div>

          <div className={`md:col-span-2 p-8 rounded-3xl flex items-center justify-between text-white shadow-xl ${isReadingLower ? 'bg-red-600' : 'bg-gray-900'}`}>
            <h4 className="text-xl font-bold">{isReadingLower ? 'قيمة العجز (النقص)' : 'استهلاك الشهر المختار'}</h4>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black">{isReadingLower ? lowerAmount.toLocaleString('ar-EG') : difference.toLocaleString('ar-EG')}</span>
              <span className="text-xl opacity-50">KWH</span>
            </div>
          </div>
        </div>

        <button type="submit" className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-xl transition-all flex items-center justify-center gap-4">
          <span className="text-xl">حفظ قراءة شهر {ARABIC_MONTHS[formData.selectedMonth]}</span>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/></svg>
        </button>
      </form>
    </div>
  );
};

export default LightingRegistration;
