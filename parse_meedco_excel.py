import sys
import os
import json
import zipfile
import xml.etree.ElementTree as ET

def parse_report(file_path):
    if not os.path.exists(file_path):
        return {"success": False, "error": "File not found"}
        
    try:
        with zipfile.ZipFile(file_path) as z:
            # 1. Load shared strings
            shared = []
            if 'xl/sharedStrings.xml' in z.namelist():
                tree = ET.fromstring(z.read('xl/sharedStrings.xml'))
                ns = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
                for si in tree.findall('main:si', ns):
                    texts = [t.text for t in si.findall('.//main:t', ns) if t.text]
                    shared.append(''.join(texts))
            
            # 2. Parse sheet1.xml
            sheet_tree = ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
            ns = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
            
            users = {}
            current_user = None
            total_recharges = 0
            total_revenue = 0.0
            
            for row in sheet_tree.findall('.//main:row', ns):
                row_dict = {}
                for c in row.findall('main:c', ns):
                    ref = c.attrib.get('r', '')
                    col = ''.join(ch for ch in ref if ch.isalpha())
                    t = c.attrib.get('t', '')
                    v = c.find('main:v', ns)
                    val = v.text if v is not None else ''
                    if t == 's' and val.isdigit():
                        idx = int(val)
                        val = shared[idx] if idx < len(shared) else val
                    row_dict[col] = val
                
                # Check user section header
                if row_dict.get('A') == 'اسم المستخدم':
                    uname = (row_dict.get('B') or '').strip()
                    if uname:
                        current_user = uname
                        if current_user not in users:
                            users[current_user] = {
                                "userName": current_user,
                                "rechargesCount": 0,
                                "totalAmount": 0.0,
                                "items": []
                            }
                elif row_dict.get('A') == 'عدد النتائج' and current_user:
                    try:
                        c_val = int(row_dict.get('B', 0))
                        users[current_user]["rechargesCount"] = c_val
                    except:
                        pass
                elif current_user and 'A' in row_dict and row_dict['A'] != 'رقم المشترك':
                    # This is a transaction row!
                    # A: رقم المشترك / العداد
                    # B: اسم المشترك
                    # C: الإدارة الفرعية
                    # D: رقم الإيصال
                    # E: وقت السداد
                    # F: نوع الدفع
                    # V: إجمالي المبلغ
                    meter_no = row_dict.get('A', '').strip()
                    cust_name = row_dict.get('B', '').strip()
                    sub_admin = row_dict.get('C', '').strip()
                    receipt_no = row_dict.get('D', '').strip()
                    pay_time = row_dict.get('E', '').strip()
                    pay_type = row_dict.get('F', '').strip()
                    
                    amt_str = row_dict.get('V', '0').strip()
                    try:
                        amt = float(amt_str)
                    except:
                        amt = 0.0
                        
                    if meter_no and amt > 0:
                        users[current_user]["items"].append({
                            "meterNumber": meter_no,
                            "customerName": cust_name,
                            "subAdmin": sub_admin,
                            "receiptNumber": receipt_no,
                            "paymentTime": pay_time,
                            "paymentType": pay_type,
                            "amount": amt
                        })
            
            # Recalculate totals and verification
            users_list = []
            for uname, udata in users.items():
                items_sum = round(sum(item["amount"] for item in udata["items"]), 2)
                udata["totalAmount"] = items_sum
                if udata["rechargesCount"] == 0:
                    udata["rechargesCount"] = len(udata["items"])
                total_recharges += udata["rechargesCount"]
                total_revenue += items_sum
                users_list.append(udata)
                
            return {
                "success": True,
                "totalUsers": len(users_list),
                "totalRecharges": total_recharges,
                "totalRevenue": round(total_revenue, 2),
                "users": users_list
            }
            
    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == '__main__':
    target = sys.argv[1] if len(sys.argv) > 1 else 'D:/منظومة العدادت 2025/test_meedco_report.xlsx'
    res = parse_report(target)
    sys.stdout.reconfigure(encoding='utf-8')
    print(json.dumps(res, ensure_ascii=False))
