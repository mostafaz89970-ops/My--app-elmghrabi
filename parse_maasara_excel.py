import sys
import os
import json
import re
import zipfile
from datetime import datetime
import xml.etree.ElementTree as ET

def clean_arabic_num(val):
    if not val:
        return 0.0
    s = str(val).replace(',', '').replace(' ', '').replace('\u200f', '').strip()
    try:
        return float(s)
    except:
        return 0.0

def parse_maasara_report(file_path, target_date=None):
    if not os.path.exists(file_path):
        return {"success": False, "error": "File not found", "users": []}
        
    try:
        today_str = datetime.now().strftime('%Y-%m-%d')
        file_mtime_date = datetime.fromtimestamp(os.path.getmtime(file_path)).strftime('%Y-%m-%d')
        file_dates = set([file_mtime_date])

        with zipfile.ZipFile(file_path) as z:
            # 1. Extract metadata creation/modified dates
            for fname in z.filelist:
                if 'core' in fname.filename or 'psmdcp' in fname.filename:
                    txt = z.read(fname.filename).decode('utf-8', errors='ignore')
                    found_iso = re.findall(r'(\d{4}-\d{2}-\d{2})', txt)
                    file_dates.update(found_iso)

            # 2. Shared strings
            shared = []
            if 'xl/sharedStrings.xml' in z.namelist():
                tree = ET.fromstring(z.read('xl/sharedStrings.xml'))
                ns = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
                for si in tree.findall('main:si', ns):
                    texts = [t.text for t in si.findall('.//main:t', ns) if t.text]
                    s_val = ''.join(texts)
                    shared.append(s_val)
                    # Check date patterns in strings: e.g. 20/09/2026 or 20/9/2026
                    s_clean = s_val.replace('\u200f', '').strip()
                    m = re.findall(r'(\d{1,2})[/](\d{1,2})[/](\d{4})', s_clean)
                    for d_day, d_month, d_year in m:
                        file_dates.add(f"{d_year}-{int(d_month):02d}-{int(d_day):02d}")
            
            sheet = ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
            ns = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
            
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
            
            # Check target_date compatibility
            # If target_date is provided and file does not belong to target_date:
            # Exception: if target_date is today, and this is the active file in Downloads/cache, allow it for today.
            is_date_match = True
            if target_date:
                norm_target = target_date.strip()
                if norm_target in file_dates:
                    is_date_match = True
                elif norm_target == today_str:
                    # When querying today, accept the active report exported in Downloads/cache
                    is_date_match = True
                else:
                    # Specific historical date requested that is NOT in this file
                    is_date_match = False

            if not is_date_match:
                return {
                    "success": True,
                    "connected": True,
                    "fileDates": list(file_dates),
                    "totalUsers": 0,
                    "totalRecharges": 0,
                    "totalAmount": 0,
                    "users": []
                }

            # Detect format
            # Format 3: Detailed transaction sheet with 'رقم المشترك' and 'وقت السداد'
            is_format3 = False
            for r in all_rows[:5]:
                if any('رقم المشترك' in x for x in r) and any('وقت السداد' in x for x in r):
                    is_format3 = True
                    break

            # Format 1: 'مبيعات المستخدم' (Cashier single summary)
            is_format1 = False
            if not is_format3:
                for r in all_rows[:3]:
                    if any('عدد الشحنات' in x for x in r) and any('المستخدم' in x for x in r):
                        is_format1 = True
                        break

            users = []
            total_amount = 0.0
            total_recharges = 0

            if is_format3:
                # Format 3: Detailed receipts
                user_name = ''
                for r in all_rows[:4]:
                    if len(r) >= 2 and ('اسم المستخدم' in r[0] or 'المستخدم' in r[0]):
                        user_name = r[1].strip()
                        break

                header_idx = -1
                for idx, r in enumerate(all_rows[:6]):
                    if any('رقم المشترك' in x for x in r):
                        header_idx = idx
                        break

                time_col = 4
                paid_col = 21
                debt_col = 19
                meter_col = 0
                cust_col = 1
                admin_col = 2
                receipt_col = 3

                tx_items = []
                cashier_recharges = 0
                cashier_amount = 0.0
                cashier_debt = 0.0

                for r in all_rows[header_idx + 1:]:
                    if len(r) > max(time_col, paid_col):
                        t_raw = r[time_col].replace('\u200f', '').strip()
                        # Extract date from payment time (e.g. 20/9/2026)
                        m = re.search(r'(\d{1,2})[/](\d{1,2})[/](\d{4})', t_raw)
                        row_date = None
                        if m:
                            row_date = f"{m.group(3)}-{int(m.group(2)):02d}-{int(m.group(1)):02d}"

                        # If specific date is requested and row does not match:
                        if target_date and row_date and target_date != today_str and row_date != target_date:
                            continue

                        paid_amt = clean_arabic_num(r[paid_col])
                        debt_amt = clean_arabic_num(r[debt_col]) if len(r) > debt_col else 0.0

                        if paid_amt > 0 or debt_amt > 0:
                            cashier_amount += paid_amt
                            cashier_debt += debt_amt
                            cashier_recharges += 1
                            tx_items.append({
                                "meterNumber": r[meter_col] if len(r) > meter_col else '',
                                "customerName": r[cust_col] if len(r) > cust_col else '',
                                "subAdmin": r[admin_col] if len(r) > admin_col else '',
                                "receiptNumber": r[receipt_col] if len(r) > receipt_col else '',
                                "paymentTime": t_raw,
                                "amount": paid_amt,
                                "debtAmount": debt_amt
                            })

                if user_name and cashier_recharges > 0:
                    final_user_amt = round(cashier_amount + cashier_debt, 2)
                    users.append({
                        "userName": user_name,
                        "rechargesCount": cashier_recharges,
                        "rechargeAmount": round(cashier_amount, 2),
                        "debtAmount": round(cashier_debt, 2),
                        "totalAmount": final_user_amt,
                        "items": tx_items
                    })
                    total_amount += final_user_amt
                    total_recharges += cashier_recharges

            elif is_format1:
                # Format 1: 'مبيعات المستخدم'
                for r in all_rows:
                    if len(r) >= 5 and r[0] not in ['المستخدم', 'اجمالي عدد الشحنات', 'اجمالي عدد العدادات', 'اجمالي  قيمه الشحنات']:
                        uname = r[0]
                        if uname and not uname.startswith('اجمالي') and not uname.isdigit():
                            try:
                                count = int(clean_arabic_num(r[3]))
                                recharge_amt = clean_arabic_num(r[2])
                                debt_amt = clean_arabic_num(r[4]) if len(r) > 4 else 0.0
                                
                                last_col_amt = clean_arabic_num(r[-1]) if r[-1] else 0.0
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
                            except Exception:
                                pass
            else:
                # Format 2: 'تقرير إجمالى مبيعات المستخدمين'
                for r in all_rows:
                    if len(r) >= 8:
                        user_candidate = r[5] if len(r) > 5 else ''
                        if user_candidate and user_candidate not in ['المستخدم', 'الكل', 'null', 'نقدى', 'شيك', 'كاش', 'اجل'] and not user_candidate.isdigit() and not user_candidate.startswith('فى الفترة') and not user_candidate.startswith('اجمالي'):
                            try:
                                cash_amt = clean_arabic_num(r[7]) if len(r) > 7 else 0.0
                                required_amt = clean_arabic_num(r[8]) if len(r) > 8 else 0.0
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
                "fileDates": list(file_dates),
                "totalUsers": len(users),
                "totalRecharges": total_recharges,
                "totalAmount": round(total_amount, 2),
                "users": users
            }
    except Exception as e:
        return {"success": False, "connected": False, "error": str(e), "users": []}

if __name__ == '__main__':
    target = sys.argv[1] if len(sys.argv) > 1 else r'C:\Users\AL-Motahida\Downloads\مبيعات المستخدم .xlsx'
    t_date = sys.argv[2] if len(sys.argv) > 2 else None
    res = parse_maasara_report(target, t_date)
    sys.stdout.reconfigure(encoding='utf-8')
    print(json.dumps(res, ensure_ascii=False))
