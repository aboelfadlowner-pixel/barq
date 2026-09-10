#!/usr/bin/env python3
"""
استيراد تاريخي بالجملة لـ "مطبخ القرار" — لملفات فوديكس اللي فيها عمود
"يوم" (تاريخ لكل صف)، يعني ملف واحد بيغطي شهر كامل لصنف واحد لمدة أيام
كتير (بعكس sync_menu_analysis.py اللي كان بياخد ملف يومي واحد).

الاستخدام:
    python3 import_historical_daily.py <branch_name> <file.csv> [--outdir DIR] [--chunk N]

بيقسّم النتيجة لملفات SQL (chunks) في outdir، كل واحد فيه INSERT ...
ON CONFLICT DO UPDATE statement جاهز يتنفّذ عن طريق mcp__Supabase__execute_sql.
"""
import csv
import sys
import argparse
import os


def esc(s):
    if s is None:
        return 'NULL'
    return "'" + str(s).replace("'", "''") + "'"


def num(v):
    try:
        return float(str(v).strip() or 0)
    except ValueError:
        return 0.0


def parse_file(path, branch):
    with open(path, encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    out = []
    for r in rows:
        sku = (r.get('كود تعريف المنتج') or '').strip()
        report_date = (r.get('يوم') or '').strip()
        if not sku or not report_date:
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
            'report_date': report_date,
            'product_name': r.get('المنتج') or '',
            'quantity': quantity,
            'sales': sales,
            'total_cost': total_cost,
            'item_profit': item_profit,
            'total_profit': total_profit,
            'profit_pct': profit_pct,
        })
    return out


def build_sql(rows):
    values = []
    for r in rows:
        values.append(
            '(' + ','.join([
                esc(r['sku']), esc(r['branch']), esc(r['report_date']), esc(r['product_name']),
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
    ap.add_argument('branch')
    ap.add_argument('file')
    ap.add_argument('--outdir', default='/tmp/menu_analysis_import_chunks')
    ap.add_argument('--chunk', type=int, default=200)
    args = ap.parse_args()

    rows = parse_file(args.file, args.branch)
    os.makedirs(args.outdir, exist_ok=True)
    n_chunks = 0
    for i in range(0, len(rows), args.chunk):
        part = rows[i:i + args.chunk]
        sql = build_sql(part)
        with open(os.path.join(args.outdir, 'part_%03d.sql' % (i // args.chunk)), 'w', encoding='utf-8') as f:
            f.write(sql)
        n_chunks += 1

    print('rows: %d, chunks: %d, outdir: %s' % (len(rows), n_chunks, args.outdir), file=sys.stderr)


if __name__ == '__main__':
    main()
