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
                
                # Check for cashier row in Maasara report
                # Format: [المستخدم, المركز, المبلغ النقدى, المطلوب توريده, ...]
                if len(cells) >= 8:
                    user_candidate = cells[5]
                    if user_candidate and user_candidate not in ['المستخدم', 'الكل', 'null'] and not user_candidate.isdigit():
                        try:
                            cash_str = cells[7].replace(',', '')
                            amt = float(cash_str)
                            if amt > 0:
                                users.append({
                                    "userName": user_candidate,
                                    "center": cells[6],
                                    "totalAmount": round(amt, 2),
                                    "rechargesCount": 0
                                })
                                total_amount += amt
                        except Exception:
                            pass
                            
            return {
                "success": True,
                "connected": True,
                "totalUsers": len(users),
                "totalAmount": round(total_amount, 2),
                "users": users
            }
    except Exception as e:
        return {"success": False, "connected": False, "error": str(e), "users": []}

if __name__ == '__main__':
    target = sys.argv[1] if len(sys.argv) > 1 else r'C:\Users\AL-Motahida\Downloads\تقرير إجمالى مبيعات المستخدمين.xlsx'
    res = parse_maasara_report(target)
    sys.stdout.reconfigure(encoding='utf-8')
    print(json.dumps(res, ensure_ascii=False))
