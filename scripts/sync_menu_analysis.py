#!/usr/bin/env python3
"""
مزامنة "مطبخ القرار" — بتاخد تقارير "مبيعات المنتج" من فوديكس (CSV، صف
لكل صنف، عمود "الفرع" فيه اسم الفرع) وتجهّزها كـ SQL upsert واحد لجدول
menu_analysis في Supabase.

الاستخدام (بيتشغل بمعرفة Claude كل يوم الساعة 9 صباحًا بتوقيت القاهرة،
مش بيتشغل تلقائي لوحده — التفاصيل في CLAUDE.md/الملاحظات المرفقة):

    python3 sync_menu_analysis.py <report_date YYYY-MM-DD> <file1.csv> [file2.csv ...]

بيطبع SQL statement واحد (INSERT ... ON CONFLICT DO UPDATE) على stdout،
جاهز يتنفّذ عن طريق mcp__Supabase__execute_sql.

أعمدة تقرير فوديكس المتوقعة (بيتوصل من: التقارير > المبيعات > مبيعات
المنتج، مفلتر بفرع واحد أو بكل الفروع):
  الفرع, كود تعريف المنتج, المنتج, صافي الكمية, صافي المبيعات, التكلفة, الربح
(لو الملف من غير عمود "الفرع" — يبقى المستخدم فلتر التقرير بفرع واحد
بس مسمّيش في الملف، وقتها لازم يتحدد اسم الفرع يدويًا بمعامل --branch)
"""
import csv
import sys
import argparse


def esc(s):
    if s is None:
        return 'NULL'
    return "'" + str(s).replace("'", "''") + "'"


def num(v):
    try:
        return float(str(v).strip() or 0)
    except ValueError:
        return 0.0


def parse_file(path, forced_branch=None):
    with open(path, encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    out = []
    for r in rows:
        branch = forced_branch or r.get('الفرع') or ''
        sku = (r.get('كود تعريف المنتج') or '').strip()
        if not branch or not sku:
            continue
        quantity = num(r.get('صافي الكمية'))
        sales = num(r.get('صافي المبيعات'))
        total_cost = num(r.get('التكلفة'))
        total_profit = num(r.get('الربح'))
        if total_profit == 0 and (sales or total_cost):
            total_profit = sales - total_cost
        item_profit = (total_profit / quantity) if quantity else 0
        profit_pct = (total_profit / sales * 100) if sales else 0
        out.append({
            'sku': sku,
            'branch': branch,
            'product_name': r.get('المنتج') or '',
            'quantity': quantity,
            'sales': sales,
            'total_cost': total_cost,
            'total_profit': total_profit,
            'item_profit': item_profit,
            'profit_pct': profit_pct,
        })
    return out


def build_sql(report_date, rows):
    if not rows:
        return None
    values = []
    for r in rows:
        values.append(
            '(' + ','.join([
                esc(r['sku']), esc(r['branch']), esc(report_date), esc(r['product_name']),
                str(r['quantity']), str(r['sales']), str(r['total_cost']),
                str(r['item_profit']), str(r['total_profit']), str(r['profit_pct']), 'now()'
            ]) + ')'
        )
    sql = (
        "insert into public.menu_analysis "
        "(sku, branch, report_date, product_name, quantity, sales, total_cost, item_profit, total_profit, profit_pct, updated_at) values\n"
        + ",\n".join(values) +
        "\non conflict (sku, branch, report_date) do update set "
        "product_name=excluded.product_name, quantity=excluded.quantity, sales=excluded.sales, "
        "total_cost=excluded.total_cost, item_profit=excluded.item_profit, total_profit=excluded.total_profit, "
        "profit_pct=excluded.profit_pct, updated_at=now();"
    )
    return sql


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('report_date', help='YYYY-MM-DD — اليوم اللي التقرير بيمثله (عادة إمبارح بالنسبة لتشغيل الساعة 9 صباحًا)')
    ap.add_argument('files', nargs='+')
    ap.add_argument('--branch', help='يتحدد لو الملف من غير عمود "الفرع"')
    args = ap.parse_args()

    all_rows = []
    for path in args.files:
        all_rows.extend(parse_file(path, args.branch))

    sql = build_sql(args.report_date, all_rows)
    if not sql:
        print('-- لا توجد صفوف صالحة (تأكد من الأعمدة/اسم الفرع)', file=sys.stderr)
        sys.exit(1)
    print(sql)
    print('-- rows: %d' % len(all_rows), file=sys.stderr)


if __name__ == '__main__':
    main()
