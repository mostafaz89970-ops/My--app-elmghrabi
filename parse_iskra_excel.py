import sys
import os
import json
import zipfile
import xml.etree.ElementTree as ET

def fix_arabic(t):
    if not t:
        return ""
    try:
        return t.encode('raw_unicode_escape').decode('windows-1256')
    except:
        return t

def parse_iskra_report(file_path):
    if not os.path.exists(file_path):
        return {"success": False, "error": "File not found", "users": []}
        
    try:
        with zipfile.ZipFile(file_path) as z:
            sheet_tree = ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
            ns = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}

            # Read shared strings if any
            shared = []
            if 'xl/sharedStrings.xml' in z.namelist():
                s_tree = ET.fromstring(z.read('xl/sharedStrings.xml'))
                for si in s_tree.findall('main:si', ns):
                    texts = [t.text for t in si.findall('.//main:t', ns) if t.text]
                    shared.append(''.join(texts))

            # First attempt: Report 15 (rechargeDetails with detailed items)
            users_map = {}
            total_recharges = 0
            total_amount = 0.0

            all_rows = []
            for row in sheet_tree.findall('.//main:row', ns):
                cells = {}
                for c in row.findall('main:c', ns):
                    r_ref = c.attrib.get('r', '')
                    col_letter = ''.join([ch for ch in r_ref if ch.isalpha()])
                    t_type = c.attrib.get('t', '')
                    val = ''
                    t_el = c.find('.//main:t', ns)
                    if t_el is not None and t_el.text:
                        val = t_el.text.strip()
                    else:
                        v_el = c.find('main:v', ns)
                        if v_el is not None and v_el.text:
                            v_txt = v_el.text.strip()
                            if t_type == 's' and v_txt.isdigit() and int(v_txt) < len(shared):
                                val = shared[int(v_txt)]
                            else:
                                val = v_txt
                    cells[col_letter] = fix_arabic(val)

                all_rows.append(cells)

                meter_no = cells.get('L', '').strip()
                receipt_no = cells.get('E', '').strip()
                amt_str = cells.get('X', '').replace(',', '').strip()
                user_name = cells.get('AB', '').strip()

                if meter_no.isdigit() and receipt_no.isdigit() and amt_str and user_name:
                    try:
                        amt = float(amt_str)
                    except:
                        amt = 0.0

                    if user_name not in users_map:
                        users_map[user_name] = {
                            "userName": user_name,
                            "rechargesCount": 0,
                            "totalAmount": 0.0,
                            "items": []
                        }

                    users_map[user_name]["rechargesCount"] += 1
                    users_map[user_name]["totalAmount"] += amt
                    total_recharges += 1
                    total_amount += amt

                    users_map[user_name]["items"].append({
                        "meterNumber": meter_no,
                        "customerName": cells.get('AI', '') or cells.get('AQ', ''),
                        "subAdmin": cells.get('AL', ''),
                        "receiptNumber": receipt_no,
                        "paymentTime": cells.get('H', ''),
                        "amount": round(amt, 2)
                    })

            detailed_users = list(users_map.values())
            for u in detailed_users:
                u["totalAmount"] = round(u["totalAmount"], 2)

            if len(detailed_users) > 0:
                return {
                    "success": True,
                    "connected": True,
                    "reportType": "detailed",
                    "totalUsers": len(detailed_users),
                    "totalRecharges": total_recharges,
                    "totalAmount": round(total_amount, 2),
                    "users": detailed_users
                }

            # Second attempt: Report 14 format (Summary)
            users = []
            total_recharges = 0
            total_amount = 0.0

            for cells_dict in all_rows:
                vals = [v for v in cells_dict.values() if v]
                if len(vals) == 7:
                    user_name = vals[-1].strip()
                    if user_name and user_name not in ['المستخدم', 'الكل', 'null']:
                        try:
                            count_str = vals[3].replace(',', '').strip()
                            count = int(float(count_str))
                            amt_str = vals[0].replace(',', '').strip()
                            amt = float(amt_str)

                            if count > 0 or amt > 0:
                                users.append({
                                    "userName": user_name,
                                    "rechargesCount": count,
                                    "totalAmount": round(amt, 2),
                                    "items": []
                                })
                                total_recharges += count
                                total_amount += amt
                        except Exception:
                            pass

            return {
                "success": True,
                "connected": True,
                "reportType": "summary",
                "totalUsers": len(users),
                "totalRecharges": total_recharges,
                "totalAmount": round(total_amount, 2),
                "users": users
            }

    except Exception as e:
        return {"success": False, "connected": False, "error": str(e), "users": []}

if __name__ == '__main__':
    target = sys.argv[1] if len(sys.argv) > 1 else 'test_iskra_report_14.xlsx'
    res = parse_iskra_report(target)
    sys.stdout.reconfigure(encoding='utf-8')
    print(json.dumps(res, ensure_ascii=False))
