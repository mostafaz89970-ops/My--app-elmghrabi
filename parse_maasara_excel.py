import sys
import os
import json
import zipfile
import xml.etree.ElementTree as ET

def parse_maasara_report(file_path):
    if not os.path.exists(file_path):
        return {"success": False, "error": "File not found", "users": []}
        
    try:
        with zipfile.ZipFile(file_path) as z:
            shared = []
            if 'xl/sharedStrings.xml' in z.namelist():
                tree = ET.fromstring(z.read('xl/sharedStrings.xml'))
                ns = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
                for si in tree.findall('main:si', ns):
                    texts = [t.text for t in si.findall('.//main:t', ns) if t.text]
                    shared.append(''.join(texts))
            
            sheet = ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
            ns = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
            
            users = []
            total_amount = 0.0
            total_recharges = 0
            
            all_rows = []
            for row in sheet.findall('.//main:row', ns):
                cells = []
                for c in row.findall('main:c', ns):
                    t = c.attrib.get('t', '')
                    v = c.find('main:v', ns)
                    val = v.text if v is not None else ''
                    if t == 's' and val.isdigit():
                        idx = int(val)
                        val = shared[idx] if idx < len(shared) else val
                    cells.append(val.strip())
                all_rows.append(cells)
            
            # Detect Format:
            # Format 1: 'مبيعات المستخدم'
            # Row 0: ['المستخدم', 'اجمالي العدادات', 'اجمالي المبلغ المدفوع', 'عدد الشحنات', 'اجمالي التسديدات الديون مباشر', ...]
            is_format1 = False
            for r in all_rows[:3]:
                if any('عدد الشحنات' in x for x in r) and any('المستخدم' in x for x in r):
                    is_format1 = True
                    break
                    
            if is_format1:
                # Find data rows
                for r in all_rows:
                    if len(r) >= 5 and r[0] not in ['المستخدم', 'اجمالي عدد الشحنات', 'اجمالي عدد العدادات', 'اجمالي  قيمه الشحنات']:
                        uname = r[0]
                        if uname and not uname.startswith('اجمالي') and not uname.isdigit():
                            try:
                                count = int(float(r[3].replace(',', '')))
                                recharge_amt = float(r[2].replace(',', ''))
                                debt_amt = float(r[4].replace(',', '')) if len(r) > 4 and r[4] else 0.0
                                
                                # Final amount from last column or sum
                                last_col_amt = float(r[-1].replace(',', '')) if r[-1] else 0.0
                                final_amt = round(last_col_amt if last_col_amt > 0 else (recharge_amt + debt_amt), 2)
                                
                                users.append({
                                    "userName": uname,
                                    "rechargesCount": count,
                                    "rechargeAmount": recharge_amt,
                                    "debtAmount": debt_amt,
                                    "totalAmount": final_amt
                                })
                                total_amount += final_amt
                                total_recharges += count
                            except Exception as ex:
                                pass
                                
            else:
                # Format 2: 'تقرير إجمالى مبيعات المستخدمين'
                # ['المبلغ الاجل', 'اجمالى مدفوعات و.م', 'اجمالى اذن دفع الكترونى', 'اجمالى شيكات', 'إجمالى دفع الاقساط', 'المستخدم', 'المركز', 'المبلغ النقدى', 'المطلوب توريده', 'اجمالى دفع الاقساط']
                for r in all_rows:
                    if len(r) >= 8:
                        user_candidate = r[5] if len(r) > 5 else ''
                        if user_candidate and user_candidate not in ['المستخدم', 'الكل', 'null', 'نقدى', 'شيك', 'كاش', 'اجل'] and not user_candidate.isdigit() and not user_candidate.startswith('فى الفترة') and not user_candidate.startswith('اجمالي'):
                            try:
                                cash_amt = float(r[7].replace(',', '')) if len(r) > 7 and r[7] else 0.0
                                required_amt = float(r[8].replace(',', '')) if len(r) > 8 and r[8] else 0.0
                                final_amt = round(required_amt if required_amt > 0 else cash_amt, 2)
                                
                                if final_amt > 0:
                                    users.append({
                                        "userName": user_candidate,
                                        "center": r[6] if len(r) > 6 else '',
                                        "totalAmount": final_amt,
                                        "rechargesCount": 0
                                    })
                                    total_amount += final_amt
                            except Exception:
                                pass
                                
            return {
                "success": True,
                "connected": True,
                "totalUsers": len(users),
                "totalRecharges": total_recharges,
                "totalAmount": round(total_amount, 2),
                "users": users
            }
    except Exception as e:
        return {"success": False, "connected": False, "error": str(e), "users": []}

if __name__ == '__main__':
    target = sys.argv[1] if len(sys.argv) > 1 else r'C:\Users\AL-Motahida\Downloads\مبيعات المستخدم .xlsx'
    res = parse_maasara_report(target)
    sys.stdout.reconfigure(encoding='utf-8')
    print(json.dumps(res, ensure_ascii=False))
