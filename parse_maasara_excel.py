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
    s = str(val).replace(',', '').replace(' ', '').replace('\u200f', '').replace('\u200e', '').strip()
    try:
        return float(s)
    except:
        return 0.0

def extract_date(time_str):
    if not time_str:
        return None
    s = str(time_str).replace('\u200f', '').replace('\u200e', '').strip()
    # Match DD/MM/YYYY or DD-MM-YYYY (e.g. 20/9/2026 or 20/09/2026)
    m1 = re.search(r'(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})', s)
    if m1:
        d, m, y = int(m1.group(1)), int(m1.group(2)), int(m1.group(3))
        if 1 <= m <= 12 and 1 <= d <= 31:
            return f"{y:04d}-{m:02d}-{d:02d}"
    # Match YYYY/MM/DD or YYYY-MM-DD
    m2 = re.search(r'(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})', s)
    if m2:
        y, m, d = int(m2.group(1)), int(m2.group(2)), int(m2.group(3))
        if 1 <= m <= 12 and 1 <= d <= 31:
            return f"{y:04d}-{m:02d}-{d:02d}"
    return None

def parse_maasara_report(file_path, target_date=None):
    if not os.path.exists(file_path):
        return {"success": False, "error": "File not found", "users": []}
        
    try:
        if target_date:
            target_date = target_date.strip()
            if target_date.lower() in ('all', '*', ''):
                target_date = None

        file_dates = set()

        with zipfile.ZipFile(file_path) as z:
            # 1. Extract dates from metadata core / psmdcp
            for fname in z.filelist:
                if 'core' in fname.filename or 'psmdcp' in fname.filename:
                    txt = z.read(fname.filename).decode('utf-8', errors='ignore')
                    found_iso = re.findall(r'(\d{4}-\d{2}-\d{2})', txt)
                    file_dates.update(found_iso)

            # 2. Extract shared strings
            shared = []
            if 'xl/sharedStrings.xml' in z.namelist():
                tree = ET.fromstring(z.read('xl/sharedStrings.xml'))
                ns = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
                for si in tree.findall('main:si', ns):
                    texts = [t.text for t in si.findall('.//main:t', ns) if t.text]
                    s_val = ''.join(texts)
                    shared.append(s_val)
                    # Check date patterns in strings
                    d_found = extract_date(s_val)
                    if d_found:
                        file_dates.add(d_found)
            
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
            
            # Detect format
            # Format 3: Detailed transaction sheet with 'رقم المشترك' and 'وقت السداد'
            is_format3 = False
            header_idx = -1
            for idx, r in enumerate(all_rows[:10]):
                if any('رقم المشترك' in x for x in r) and any('وقت السداد' in x for x in r):
                    is_format3 = True
                    header_idx = idx
                    break

            # Format 1: 'مبيعات المستخدم' (Cashier single summary)
            is_format1 = False
            if not is_format3:
                for r in all_rows[:5]:
                    if any('عدد الشحنات' in x for x in r) and any('المستخدم' in x for x in r):
                        is_format1 = True
                        break

            users = []
            total_amount = 0.0
            total_recharges = 0

            if is_format3:
                # Format 3: Detailed receipts
                user_name = ''
                for r in all_rows[:header_idx]:
                    for ci, cell in enumerate(r):
                        if 'اسم المستخدم' in cell or 'المستخدم' in cell:
                            if ci + 1 < len(r) and r[ci + 1].strip():
                                user_name = r[ci + 1].strip()
                                break
                            elif len(r) > 1 and r[1].strip():
                                user_name = r[1].strip()
                                break
                    if user_name:
                        break

                header_row = all_rows[header_idx]
                time_col = 4
                paid_col = 21
                debt_col = 19
                meter_col = 0
                cust_col = 1
                admin_col = 2
                receipt_col = 3
                net_col = 7

                for ci, h in enumerate(header_row):
                    if 'وقت السداد' in h or 'وقت' in h:
                        time_col = ci
                    elif 'المبلغ المدفوع' in h:
                        paid_col = ci
                    elif 'التسديدات المباشرة' in h or 'تسديد مباشر' in h:
                        debt_col = ci
                    elif 'رقم المشترك' in h:
                        meter_col = ci
                    elif 'اسم المشترك' in h:
                        cust_col = ci
                    elif 'الادارة الفرعية' in h:
                        admin_col = ci
                    elif 'رقم الايصال' in h:
                        receipt_col = ci
                    elif 'صافي الشحن' in h:
                        net_col = ci

                # Group transactions strictly by day
                daily_groups = {}

                for r in all_rows[header_idx + 1:]:
                    if len(r) > time_col:
                        t_raw = r[time_col].replace('\u200f', '').replace('\u200e', '').strip()
                        row_date = extract_date(t_raw)
                        if not row_date:
                            continue  # skip summary rows like 'نقدى', totals, empty rows
                        
                        file_dates.add(row_date)

                        paid_amt = clean_arabic_num(r[paid_col]) if len(r) > paid_col else 0.0
                        debt_amt = clean_arabic_num(r[debt_col]) if len(r) > debt_col else 0.0
                        net_amt = clean_arabic_num(r[net_col]) if len(r) > net_col else 0.0

                        # Total paid for this receipt: paid_amt if > 0 else direct debt
                        tx_amt = paid_amt if paid_amt > 0 else debt_amt
                        if tx_amt == 0.0 and net_amt > 0:
                            tx_amt = net_amt

                        if tx_amt <= 0:
                            continue

                        if row_date not in daily_groups:
                            daily_groups[row_date] = {
                                "date": row_date,
                                "count": 0,
                                "rechargeAmount": 0.0,
                                "debtAmount": 0.0,
                                "totalAmount": 0.0,
                                "items": []
                            }

                        group = daily_groups[row_date]
                        group["count"] += 1
                        group["rechargeAmount"] += paid_amt
                        group["debtAmount"] += debt_amt
                        group["totalAmount"] += tx_amt
                        group["items"].append({
                            "meterNumber": r[meter_col] if len(r) > meter_col else '',
                            "customerName": r[cust_col] if len(r) > cust_col else '',
                            "subAdmin": r[admin_col] if len(r) > admin_col else '',
                            "receiptNumber": r[receipt_col] if len(r) > receipt_col else '',
                            "paymentTime": t_raw,
                            "paymentDate": row_date,
                            "amount": tx_amt,
                            "paidAmount": paid_amt,
                            "debtAmount": debt_amt,
                            "netAmount": net_amt
                        })

                # If target_date is given, ONLY pick the day that matches target_date
                if target_date:
                    if target_date in daily_groups:
                        g = daily_groups[target_date]
                        amt = round(g["totalAmount"], 2)
                        cnt = g["count"]
                        users.append({
                            "userName": user_name,
                            "date": target_date,
                            "rechargesCount": cnt,
                            "rechargeAmount": round(g["rechargeAmount"], 2),
                            "debtAmount": round(g["debtAmount"], 2),
                            "totalAmount": amt,
                            "items": g["items"],
                            "dailyBreakdown": [
                                {
                                    "date": d,
                                    "rechargesCount": dg["count"],
                                    "totalAmount": round(dg["totalAmount"], 2)
                                }
                                for d, dg in sorted(daily_groups.items())
                            ]
                        })
                        total_amount += amt
                        total_recharges += cnt
                    else:
                        # Target date has NO operations in this file
                        # Do NOT add user or add with 0
                        pass
                else:
                    # No target_date specified: return all daily breakdowns
                    all_days_cnt = sum(g["count"] for g in daily_groups.values())
                    all_days_amt = sum(g["totalAmount"] for g in daily_groups.values())
                    all_days_paid = sum(g["rechargeAmount"] for g in daily_groups.values())
                    all_days_debt = sum(g["debtAmount"] for g in daily_groups.values())
                    all_items = []
                    for g in daily_groups.values():
                        all_items.extend(g["items"])

                    users.append({
                        "userName": user_name,
                        "date": sorted(list(daily_groups.keys()))[0] if daily_groups else None,
                        "rechargesCount": all_days_cnt,
                        "rechargeAmount": round(all_days_paid, 2),
                        "debtAmount": round(all_days_debt, 2),
                        "totalAmount": round(all_days_amt, 2),
                        "items": all_items,
                        "dailyBreakdown": [
                            {
                                "date": d,
                                "rechargesCount": dg["count"],
                                "rechargeAmount": round(dg["rechargeAmount"], 2),
                                "debtAmount": round(dg["debtAmount"], 2),
                                "totalAmount": round(dg["totalAmount"], 2)
                            }
                            for d, dg in sorted(daily_groups.items())
                        ]
                    })
                    total_amount += all_days_amt
                    total_recharges += all_days_cnt

            elif is_format1:
                # Format 1: 'مبيعات المستخدم' (Cashier single summary)
                # Check if target_date matches file dates
                file_date = None
                for d in file_dates:
                    file_date = d
                    break

                if not target_date or (file_date and target_date == file_date) or target_date in file_dates:
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
                                        "date": file_date or target_date,
                                        "rechargesCount": count,
                                        "rechargeAmount": recharge_amt,
                                        "debtAmount": debt_amt,
                                        "totalAmount": final_amt,
                                        "items": [],
                                        "dailyBreakdown": [
                                            {
                                                "date": file_date or target_date,
                                                "rechargesCount": count,
                                                "totalAmount": final_amt
                                            }
                                        ]
                                    })
                                    total_amount += final_amt
                                    total_recharges += count
                                except Exception:
                                    pass

            else:
                # Format 2: 'تقرير إجمالى مبيعات المستخدمين'
                # Extract period from Row 1
                report_from_date = None
                report_to_date = None
                for r in all_rows[:3]:
                    for cell in r:
                        d = extract_date(cell)
                        if d:
                            if not report_from_date:
                                report_from_date = d
                            else:
                                report_to_date = d

                is_date_ok = True
                if target_date:
                    if report_from_date and report_to_date:
                        is_date_ok = (report_from_date <= target_date <= report_to_date)
                    elif report_from_date:
                        is_date_ok = (report_from_date == target_date)
                    else:
                        is_date_ok = (target_date in file_dates)

                if is_date_ok:
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
                                            "date": report_from_date or target_date,
                                            "center": r[6] if len(r) > 6 else '',
                                            "totalAmount": final_amt,
                                            "rechargesCount": 0,
                                            "items": [],
                                            "dailyBreakdown": [
                                                {
                                                    "date": report_from_date or target_date,
                                                    "rechargesCount": 0,
                                                    "totalAmount": final_amt
                                                }
                                            ]
                                        })
                                        total_amount += final_amt
                                except Exception:
                                    pass

            return {
                "success": True,
                "connected": True,
                "fileDates": sorted(list(file_dates)),
                "totalUsers": len(users),
                "totalRecharges": total_recharges,
                "totalAmount": round(total_amount, 2),
                "users": users
            }
    except Exception as e:
        return {"success": False, "connected": False, "error": str(e), "users": []}

if __name__ == '__main__':
    target = sys.argv[1] if len(sys.argv) > 1 else r'C:\Users\AL-Motahida\Downloads\مبيعات المستخدم (1).xlsx'
    t_date = sys.argv[2] if len(sys.argv) > 2 else None
    res = parse_maasara_report(target, t_date)
    sys.stdout.reconfigure(encoding='utf-8')
    print(json.dumps(res, ensure_ascii=False))
