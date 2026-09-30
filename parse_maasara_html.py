#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
parse_maasara_html.py
تحليل صفحة HTML أو جدول تقرير المعصرة CustomersRechargesTotalPaymentByUser
واستخراج المحصلين والمبالغ وعدد الشحنات
"""
import sys
import json
import re
from datetime import datetime

def clean_num(val):
    if not val:
        return 0.0
    s = re.sub(r'[^\d\.]', '', str(val))
    try:
        return float(s) if s else 0.0
    except:
        return 0.0

def parse_html_content(html_str, target_date=None):
    if not target_date:
        target_date = datetime.now().strftime('%Y-%m-%d')

    # Remove script and style tags
    cleaned = re.sub(r'<script.*?</script>', '', html_str, flags=re.DOTALL | re.IGNORECASE)
    cleaned = re.sub(r'<style.*?</style>', '', cleaned, flags=re.DOTALL | re.IGNORECASE)

    # Find table rows
    rows = re.findall(r'<tr[^>]*>(.*?)</tr>', cleaned, flags=re.DOTALL | re.IGNORECASE)
    
    users = []
    user_map = {}
    total_amount = 0.0
    total_count = 0

    header_cols = []
    for r in rows:
        th_matches = re.findall(r'<th[^>]*>(.*?)</th>', r, flags=re.DOTALL | re.IGNORECASE)
        if th_matches:
            header_cols = [re.sub(r'<[^>]+>', '', th).strip() for th in th_matches]
            continue

        td_matches = re.findall(r'<td[^>]*>(.*?)</td>', r, flags=re.DOTALL | re.IGNORECASE)
        if not td_matches:
            continue

        cells = [re.sub(r'<[^>]+>', '', td).strip() for td in td_matches]
        if len(cells) < 2:
            continue

        # Check if row is a total/footer row
        row_text = ' '.join(cells)
        if any(w in row_text for w in ['الإجمالي', 'الاجمالي', 'المجموع', 'Total', 'إجمالى']):
            continue

        # Identify columns
        # Typical Maasara table: [Index, UserName / Employee, Count, Amount, ...] or similar
        user_name = ''
        amount = 0.0
        count = 0

        # Try to find user name: text with Arabic words, not purely numeric or date
        numeric_vals = []
        for idx, c in enumerate(cells):
            cleaned_c = c.replace(',', '').replace(' ', '')
            if re.match(r'^\d+(\.\d+)?$', cleaned_c):
                num = float(cleaned_c)
                numeric_vals.append((idx, num))
            elif any('\u0600' <= char <= '\u06FF' for char in c) and len(c) > 3 and not any(w in c for w in ['شحن', 'سداد', 'كارت', 'عداد', 'جنيه', 'ج.م', 'مصر', 'المنيا']):
                if not user_name:
                    user_name = c.strip()

        if not user_name and len(cells) > 1:
            # fallback to column 1 or 2
            user_name = cells[1] if len(cells) > 2 else cells[0]

        # Extract amount and count from numeric values
        # If we have numeric values: typically amount is the larger or floating number, count is the integer
        if numeric_vals:
            # Sort or map: last numeric or biggest is often amount
            floats_or_large = [v for v in numeric_vals if v[1] > 50 or '.' in str(v[1])]
            ints_small = [v for v in numeric_vals if v[1] <= 5000 and float(v[1]).is_integer() and v not in floats_or_large]

            if floats_or_large:
                amount = floats_or_large[-1][1]
            elif numeric_vals:
                amount = numeric_vals[-1][1]

            if ints_small:
                count = int(ints_small[0][1])
            elif len(numeric_vals) >= 2:
                count = int(numeric_vals[0][1])
            else:
                count = 1

        if user_name and amount > 0:
            user_clean = re.sub(r'^(م|ا|محاسب|أستاذ)\s*/\s*', '', user_name).strip()
            if user_clean not in user_map:
                user_map[user_clean] = {
                    'userName': user_clean,
                    'amount': 0.0,
                    'count': 0,
                    'date': target_date,
                    'items': []
                }
            user_map[user_clean]['amount'] += amount
            user_map[user_clean]['count'] += count
            total_amount += amount
            total_count += count

    # Also check if page is JSON or contains embedded JSON
    json_match = re.search(r'var\s+(?:dataSource|reportData|data)\s*=\s*(\[.*?\]);', html_str, re.DOTALL)
    if json_match:
        try:
            raw_data = json.loads(json_match.group(1))
            for item in raw_data:
                uname = item.get('UserName') or item.get('userName') or item.get('CollectorName') or ''
                amt = clean_num(item.get('TotalAmount') or item.get('Amount') or item.get('PaidAmount'))
                cnt = int(clean_num(item.get('Count') or item.get('OperationsCount') or 1))
                if uname and amt > 0:
                    if uname not in user_map:
                        user_map[uname] = {'userName': uname, 'amount': 0.0, 'count': 0, 'date': target_date, 'items': []}
                    user_map[uname]['amount'] += amt
                    user_map[uname]['count'] += cnt
                    total_amount += amt
                    total_count += cnt
        except:
            pass

    users = list(user_map.values())
    return {
        'success': True,
        'source': 'Maasara Live HTML/DOM',
        'targetDate': target_date,
        'totalAmount': round(total_amount, 2),
        'totalCount': total_count,
        'usersCount': len(users),
        'users': users
    }

if __name__ == '__main__':
    if len(sys.argv) > 1:
        file_path = sys.argv[1]
        tdate = sys.argv[2] if len(sys.argv) > 2 else None
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            res = parse_html_content(content, tdate)
            print(json.dumps(res, ensure_ascii=False))
        except Exception as e:
            print(json.dumps({'success': False, 'error': str(e)}))
    else:
        print(json.dumps({'success': False, 'error': 'No file provided'}))
