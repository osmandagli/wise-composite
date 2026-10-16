# Excel parça listesi → D1 için SQL (parça + fotoğraf). Ayrıntılar: CLAUDE.md > "Bulk import from Excel".
# Kullanım: python araclar/excel_iceaktar.py liste.xlsx cikti.sql   (gerekenler: openpyxl, pillow)
# Excel biçimi: A sütununda "<model> <parça adı> <Sağ/Sol> <OEM>" metni, B sütununda o satıra yerleştirilmiş fotoğraf.
# Fotoğraflar satırdaki konumlarına göre eşlenir. Fiyat sütunu kullanılmaz (sitede fiyat yok).
# Yeni marka/model kalıpları için aşağıdaki "rules" listesine satır ekleyin.
import zipfile, re, io, json, sys, openpyxl
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
z = zipfile.ZipFile(src)
d = z.read('xl/drawings/drawing1.xml').decode()
relx = z.read('xl/drawings/_rels/drawing1.xml.rels').decode()
rels = {}
for m in re.finditer(r'<Relationship ([^>]*)/>', relx):
    a = dict(re.findall(r'(\w+)="([^"]*)"', m.group(1)))
    if 'media/' in a.get('Target', ''): rels[a['Id']] = a['Target'].split('/')[-1]
img = {}
for a in re.findall(r'<xdr:twoCellAnchor[^>]*>(.*?)</xdr:twoCellAnchor>', d, re.S):
    row = int(re.search(r'<xdr:from>.*?<xdr:row>(\d+)</xdr:row>', a, re.S).group(1)) + 1
    assert row not in img, f'satır {row}: birden fazla fotoğraf'
    img[row] = rels[re.search(r'r:embed="(rId\d+)"', a).group(1)]

def jpeg(name, limit=45_000):
    im = Image.open(io.BytesIO(z.read('xl/media/' + name)))
    im = im.convert('RGBA')
    bg = Image.new('RGB', im.size, 'white'); bg.paste(im, mask=im.split()[3])
    for side, q in [(800, 85), (800, 75), (640, 75), (560, 70), (480, 65)]:
        x = bg.copy(); x.thumbnail((side, side))
        b = io.BytesIO(); x.save(b, 'JPEG', quality=q, optimize=True, progressive=True)
        if b.tell() <= limit: return b.getvalue(), x.size
    raise SystemExit(f'{name}: çok büyük')

ws = openpyxl.load_workbook(src).active
parts = []
for r in range(1, ws.max_row + 1):
    t = ws.cell(r, 1).value
    if not t: continue
    t = re.sub(r'\s+', ' ', str(t)).strip()
    if t.startswith('Fiyatlarımız'): continue
    m = re.match(r'^(.*?\b(?:Sağ|Sol|Tampon))\s*:?\s*([A-Z0-9][A-Z0-9 ]{5,})$', t)
    assert m, t
    head, digits = m.group(1).strip(), m.group(2).replace(' ', '')
    rules = [
        (r'^(\d{4})(?: - (\d{4}))? (.*)$', lambda g: ('Mercedes-Benz', [x for x in g[:2] if x], g[2])),
        (r'^Arocs/Actros (.*)$',           lambda g: ('Mercedes-Benz', ['Arocs', 'Actros'], g[0])),
        (r'^Actros Mp4 (.*)$',             lambda g: ('Mercedes-Benz', ['Actros MP4'], g[0])),
        (r'^(Actros|Arocs) (.*)$',         lambda g: ('Mercedes-Benz', [g[0]], g[1])),
        (r'^Isuzu Npr 75 (.*)$',           lambda g: ('Isuzu', ['NPR 75'], g[0])),
        (r'^Isuzu (.*)$',                  lambda g: ('Isuzu', [], g[0])),
        (r'^Ford F-Max (.*)$',             lambda g: ('Ford', ['F-MAX'], g[0])),
        (r'^Ford Cargo 4142 (.*)$',        lambda g: ('Ford', ['Cargo 4142'], g[0])),
        (r'^Man Sl-313 (.*)$',             lambda g: ('MAN', ['SL 313'], g[0])),
    ]
    for pat, f in rules:
        if mm := re.match(pat, head):
            marka, uyumlu, ad = f(mm.groups()); break
    else: raise SystemExit('marka? ' + t)
    oem = f'{digits[:3]} {digits[3:6]} {digits[6:8]} {digits[8:]}' if marka == 'Mercedes-Benz' and re.fullmatch(r'\d{10}', digits) else digits
    parts.append(dict(row=r, marka=marka, uyumlu=uyumlu, ad=ad, oem=[oem], foto=img.get(r)))

order = {'Mercedes-Benz': 0, 'MAN': 1, 'Ford': 2, 'Isuzu': 3}
parts.sort(key=lambda p: (order[p['marka']], p['row']))
# Excel'de ters girilmiş Sol/Sağ çiftlerinde önce Sağ gelsin
for i in range(len(parts) - 1):
    x, y = parts[i], parts[i + 1]
    if x['ad'].endswith('Sol') and y['ad'] == x['ad'][:-3] + 'Sağ' and x['uyumlu'] == y['uyumlu']:
        parts[i], parts[i + 1] = y, x
q = lambda s: "'" + s.replace("'", "''") + "'"
out = []
for p in parts:
    blob, size = jpeg(p['foto'])
    out.append(f"INSERT INTO parca (kategori, ad, marka, uyumlu, oem, kod, gorsel, gorsel_tip) VALUES ('kara-araclari', {q(p['ad'])}, {q(p['marka'])}, {q(json.dumps(p['uyumlu'], ensure_ascii=False))}, {q(json.dumps(p['oem'], ensure_ascii=False))}, '', X'{blob.hex()}', 'image/jpeg');")
    print(f"{p['row']:>2} {p['marka']:<13} {','.join(p['uyumlu']):<12} {p['ad']:<34} {p['oem'][0]:<14} {p['foto']:<13} {size[0]}x{size[1]} {len(blob)//1024}KB")
open(dst, 'w').write('\n'.join(out) + '\n')
print(len(out), 'parça; en uzun SQL satırı', max(map(len, out)), 'bayt')
