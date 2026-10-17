#!/usr/bin/env python3
"""Builds dist/abuelfadl.html (one self-contained file) from the project folders.
Usage:  python3 build.py
Order of CSS/JS files comes from manifest.json (order matters: CSS cascade, JS variables)."""
import re, json, base64, os, glob, mimetypes
ROOT = os.path.dirname(os.path.abspath(__file__))
def rd(p): return open(os.path.join(ROOT, p), encoding='utf-8').read().rstrip('\n')
MIME = {'.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.woff':'font/woff','.woff2':'font/woff2','.svg':'image/svg+xml'}
def data_uri(path):
    ext = os.path.splitext(path)[1].lower()
    b = open(os.path.join(ROOT, path), 'rb').read()
    return 'data:%s;base64,%s' % (MIME[ext], base64.b64encode(b).decode())
def inline_assets(css):
    # url("../assets/x.ext") -> data URI
    return re.sub(r'url\((["\']?)\.\./(assets/[^)"\']+)\1\)', lambda m: 'url("%s")' % data_uri(m.group(2)), css)
man = json.load(open(os.path.join(ROOT, 'manifest.json')))
css = '\n'.join(inline_assets(rd(p)) for p in man['css'])
js = '\n\n'.join(rd(p) for p in man['js'])
photos = {}
for f in sorted(glob.glob(os.path.join(ROOT, 'assets/products/*.webp'))):
    photos[os.path.basename(f)[:-5]] = data_uri(os.path.relpath(f, ROOT))
js = js.replace('/*@PHOTOS*/{}', json.dumps(photos, ensure_ascii=False, separators=(',', ':')))
html = rd('index.html')
html = re.sub(r'<!-- @@include (\S+) -->', lambda m: rd(m.group(1)), html)
html = html.replace('/* @@CSS */', css).replace('/* @@JS */', js)
os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
out = os.path.join(ROOT, 'dist', 'abuelfadl.html')
open(out, 'w', encoding='utf-8').write(html)
print('built', out, round(len(html.encode())/1024), 'KB')
