import sys
import os
import json
import zipfile
import xml.etree.ElementTree as ET

def parse_iskra_report(file_path):
    if not os.path.exists(file_path):
        return {"success": False, "error": "File not found"}
        
    try:
        with zipfile.ZipFile(file_path) as z:
            sheet_tree = ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
            ns = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
            
            users = []
            total_recharges = 0
            total_amount = 0.0
            
            for row in sheet_tree.findall('.//main:row', ns):
                cells = []
                for c in row.findall('main:c', ns):
                    t_el = c.find('.//main:t', ns)
                    if t_el is not None and t_el.text:
                        cells.append(t_el.text.strip())
                    else:
                        v = c.find('main:v', ns)
                        if v is not None and v.text:
                            cells.append(v.text.strip())
                        else:
                            cells.append('')
                            
                # Report 14 row format:
                # [اجمالي ما تم تحصيله, إجمالي التسديدات, متوسط الشحنه, عدد الشحنات, إجمالي الشحنات, إجمالي الدفعات, المستخدم]
                # cells length is usually 7
                non_empty = [c for c in cells if c]
                if len(non_empty) == 7:
                    user_name = non_empty[-1]
                    if user_name and user_name not in ['المستخدم', 'الكل', 'null']:
                        try:
                            count_str = non_empty[3].replace(',', '')
                            count = int(float(count_str))
                            
                            amt_str = non_empty[0].replace(',', '')
                            amt = float(amt_str)
                            
                            if count > 0 or amt > 0:
                                users.append({
                                    "userName": user_name,
                                    "rechargesCount": count,
                                    "totalAmount": round(amt, 2)
                                })
                                total_recharges += count
                                total_amount += amt
                        except Exception as parse_err:
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
    target = sys.argv[1] if len(sys.argv) > 1 else 'test_iskra_report_14.xlsx'
    res = parse_iskra_report(target)
    sys.stdout.reconfigure(encoding='utf-8')
    print(json.dumps(res, ensure_ascii=False))
