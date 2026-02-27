
import React, { useState } from 'react';
import { Transformer, LightingRecord } from '../types';

interface SettingsProps {
  transformers: Transformer[];
  isAdmin: boolean;
  onAdd: (name: string, chassisNumber: string) => void;
  onUpdate: (id: string, name: string, chassisNumber: string) => void;
  onDelete: (id: string) => void;
  onImport: (
    newTransformers: Transformer[], 
    records: LightingRecord[], 
    stats: { totalRowsFound: number }
  ) => void;
}

const Settings: React.FC<SettingsProps> = ({ transformers, isAdmin, onAdd, onUpdate, onDelete, onImport }) => {
  const [newName, setNewName] = useState('');
  const [newChassis, setNewChassis] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const normalizeText = (text: string) => {
    if (!text) return "";
    return text.toString()
      .trim()
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/\s+/g, '') 
      .toLowerCase();
  };

  const ARABIC_MONTHS_MAP: { [key: string]: number } = {
    'يناير': 0, 'فبراير': 1, 'مارس': 2, 'ابريل': 3, 'أبريل': 3, 'مايو': 4, 'يونيو': 5,
    'يوليو': 6, 'اغسطس': 7, 'أغسطس': 7, 'سبتمبر': 8, 'اكتوبر': 9, 'أكتوبر': 9, 'نوفمبر': 10, 'ديسمبر': 11
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = (window as any).XLSX.read(bstr, { type: 'binary' });
        
        const importedRecords: LightingRecord[] = [];
        const localNewTransformersMap = new Map<string, Transformer>();
        let totalRowsFound = 0;
        
        const currentMasterMap = new Map();
        transformers.forEach(t => currentMasterMap.set(normalizeText(t.name), t));

        wb.SheetNames.forEach((wsname: string) => {
          const ws = wb.Sheets[wsname];
          const data = (window as any).XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

          let detectedMonth = -1;
          let detectedYear = -1;
          const cleanWsName = normalizeText(wsname);
          
          for (const [mName, mIdx] of Object.entries(ARABIC_MONTHS_MAP)) {
            if (cleanWsName.includes(normalizeText(mName))) {
              detectedMonth = mIdx;
              break;
            }
          }
          const yearMatch = wsname.match(/202[0-9]/);
          if (yearMatch) detectedYear = parseInt(yearMatch[0]);

          const finalMonth = detectedMonth !== -1 ? detectedMonth : new Date().getMonth();
          const finalYear = detectedYear !== -1 ? detectedYear : new Date().getFullYear();

          let colIndices = { name: -1, chassis: -1, prev: -1, curr: -1, diff: -1, notes: -1 };
          let dataStartRow = -1;

          for (let i = 0; i < Math.min(data.length, 25); i++) {
            const row = data[i];
            if (!row) continue;
            const rowStr = row.join(' ');
            if (rowStr.includes('المحول') || rowStr.includes('اسم')) {
              row.forEach((cell, idx) => {
                const c = String(cell || '');
                if (c.includes('المحول') || c.includes('اسم')) colIndices.name = idx;
                if (c.includes('شاسية') || c.includes('عداد')) colIndices.chassis = idx;
                if (c.includes('سابقة')) colIndices.prev = idx;
                if (c.includes('حالية')) colIndices.curr = idx;
                if (c.includes('فرق')) colIndices.diff = idx;
                if (c.includes('ملاحظات')) colIndices.notes = idx;
              });
              if (colIndices.name !== -1) { dataStartRow = i + 1; break; }
            }
          }

          if (dataStartRow === -1) dataStartRow = 1;

          data.slice(dataStartRow).forEach((row) => {
            const rawName = String(row[colIndices.name] || '').trim();
            if (!rawName || rawName === '0' || rawName === 'null' || rawName.includes('إجمالي') || rawName.includes('مجموع')) return;

            totalRowsFound++;
            const normalized = normalizeText(rawName);
            
            let transformerObj = currentMasterMap.get(normalized) || localNewTransformersMap.get(normalized);
            const chassisInExcel = String(row[colIndices.chassis] || '').trim();
            
            if (!transformerObj) {
              const newT: Transformer = {
                id: 't_' + Math.random().toString(36).substr(2, 9),
                name: rawName,
                chassisNumber: chassisInExcel || '---'
              };
              transformerObj = newT;
              localNewTransformersMap.set(normalized, newT);
            }

            const prev = parseFloat(String(row[colIndices.prev] || '0').replace(/,/g, ''));
            const curr = parseFloat(String(row[colIndices.curr] || '0').replace(/,/g, ''));
            const diff = parseFloat(String(row[colIndices.diff] || (curr - prev)).replace(/,/g, ''));
            
            const recordDate = new Date(finalYear, finalMonth, 1, 12, 0, 0);
            const monthName = Object.keys(ARABIC_MONTHS_MAP).find(k => ARABIC_MONTHS_MAP[k] === finalMonth) || 'يناير';

            importedRecords.push({
              id: 'rec_' + Math.random().toString(36).substr(2, 9),
              transformerId: transformerObj.id,
              transformerName: transformerObj.name,
              chassisNumber: chassisInExcel || transformerObj.chassisNumber,
              previousReading: prev,
              currentReading: curr,
              difference: diff,
              notes: String(row[colIndices.notes] || '').trim(),
              timestamp: recordDate.getTime(),
              date: `${monthName} ${finalYear.toLocaleString('ar-EG', {useGrouping:false})}`
            });
          });
        });

        onImport(Array.from(localNewTransformersMap.values()), importedRecords, { totalRowsFound });

      } catch (err) {
        console.error(err);
        alert('حدث خطأ أثناء معالجة الملف.');
      } finally {
        setIsImporting(false);
        if (e.target) e.target.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim() && newChassis.trim()) {
      onAdd(newName.trim(), newChassis.trim());
      setNewName('');
      setNewChassis('');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-slideUp">
      <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
        <h3 className="text-xl font-bold flex items-center text-gray-800 mb-6">
          <svg className="w-6 h-6 ml-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          استيراد "سلاسل القراءات" من ملف الإكسل
        </h3>
        
        <div className="bg-blue-50 border-r-4 border-blue-400 p-6 mb-6 rounded-2xl">
          <h4 className="font-bold text-blue-900 mb-2">تعليمات الاستيراد الشامل:</h4>
          <ul className="text-sm text-blue-800 space-y-2 list-disc pr-4">
            <li>سيتم سحب **كافة الأسماء** المكتوبة في الملف وإضافتها لقاعدة البيانات فوراً.</li>
            <li>يقوم النظام بالتعرف على الشهر من "اسم الشيت" (مثال: شيت باسم "يناير 2025").</li>
            <li>يمكنك رفع نفس الملف عدة مرات لتحديث البيانات دون قلق من التكرار.</li>
          </ul>
        </div>

        <div className="border-2 border-dashed border-gray-200 rounded-3xl p-12 text-center hover:border-blue-500 hover:bg-blue-50/30 transition-all cursor-pointer relative group">
          <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10" disabled={isImporting} />
          <div className="space-y-4">
            <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
              {isImporting ? <svg className="w-10 h-10 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg> : <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>}
            </div>
            <p className="text-xl font-black text-gray-700">اضغط أو اسحب ملف القراءات هنا</p>
            <p className="text-sm text-gray-400 font-bold">يدعم ملفات XLSX المسحوبة من نظام الفواتير</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
          <h4 className="font-bold text-gray-800 mb-6">إضافة محول يدوياً</h4>
          <form onSubmit={handleAddSubmit} className="space-y-4">
            <input type="text" required placeholder="اسم المحول" value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none font-bold" />
            <input type="text" required placeholder="رقم الشاسية" value={newChassis} onChange={(e) => setNewChassis(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none font-mono" />
            <button type="submit" className="w-full py-4 bg-blue-600 text-white font-black rounded-xl shadow-md active:scale-95 transition-all">إضافة للقاعدة</button>
          </form>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="p-4 bg-gray-50 font-black border-b text-sm text-blue-600 flex justify-between items-center">
            <span>المحولات المعتمدة بالنظام</span>
            <span className="bg-blue-100 px-2 py-0.5 rounded text-xs">{transformers.length} محول</span>
          </div>
          <div className="max-h-[300px] overflow-y-auto divide-y divide-gray-50">
            {transformers.length > 0 ? transformers.map(t => (
              <div key={t.id} className="p-4 flex justify-between items-center text-sm group hover:bg-gray-50 transition-colors">
                <div className="flex-1">
                  <span className="font-black block text-gray-800">{t.name}</span>
                  <span className="text-[10px] text-gray-400 font-mono">ID: {t.chassisNumber}</span>
                </div>
                {isAdmin && (
                  <button onClick={() => onDelete(t.id)} className="text-red-400 p-2 opacity-0 group-hover:opacity-100 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                )}
              </div>
            )) : (
              <div className="p-10 text-center text-gray-300 italic text-xs">لا يوجد محولات مسجلة</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
