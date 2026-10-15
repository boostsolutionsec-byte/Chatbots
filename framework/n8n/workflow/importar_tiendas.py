# Convierte la lista de puntos de venta (CSV extraído de Instagram/Google Maps + coordenadas de OpenStreetMap)
# en bots/mokalu/tiendas.csv y framework/n8n/tiendas.json.
# Uso: python3 framework/n8n/workflow/importar_tiendas.py <geo.json>
import csv, io, json, os, re, sys, unicodedata
R = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(R, '..', '..', '..'))
geo = json.load(open(sys.argv[1]))
L = json.load(open(os.path.join(R, 'lugares.compacto.json')))
def norm(s): return re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9ñ ]', ' ', ''.join(c for c in unicodedata.normalize('NFD', (s or '').lower()) if unicodedata.category(c) != 'Mn'))).strip()
CIUDAD = {'Cumbayá (Quito)': 'Quito', 'El Tingo (Valle de los Chillos)': 'Sangolquí'}
CODE = {'Guayaquil': 'gye', 'Quito': 'uio', 'Cuenca': 'cue', 'Samborondón': 'sam', 'Sangolquí': 'sgq', 'Durán': 'dur', 'Daule': 'dau', 'Milagro': 'mil', 'Playas': 'pla',
        'Machala': 'mch', 'Manta': 'mta', 'Loja': 'loj', 'Zamora': 'zam', 'Cariamanga': 'car', 'Macará': 'mcr', 'Quevedo': 'qvd', 'Babahoyo': 'bab',
        'Santo Domingo': 'sdo', 'La Libertad': 'lib', 'Ambato': 'amb', 'Ibarra': 'iba'}
STOP = {'papeleria', 'libreria', 'y', 'de', 'del', 'la', 'el', 'los', 'las', 'c', 'cc'}
def wa(v):
    v = (v or '').strip()
    if not v: return ''
    if 'wa.me' in v: return 'https://' + v if not v.startswith('http') else v
    d = re.sub(r'\D', '', v)
    if d.startswith('593') and len(d) == 12: return f'+593 {d[3:5]} {d[5:8]} {d[8:]}'
    if d.startswith('0') and len(d) == 10: return f'+593 {d[1:3]} {d[3:6]} {d[6:]}'
    return v
def km(a, b, c, d):
    import math
    r = math.pi / 180; x = math.sin((c-a)*r/2)**2 + math.cos(a*r)*math.cos(c*r)*math.sin((d-b)*r/2)**2
    return 6371 * 2 * math.asin(math.sqrt(x))
def hor(h): return (h or '').replace('Lun', 'lun').replace('Mar', 'mar').replace('Mié', 'mié').replace('Jue', 'jue').replace('Vie', 'vie').replace('Sáb', 'sáb').replace('Dom', 'dom')
filas, usados = [], set()
for g in geo:
    ciudad = CIUDAD.get(g['ciudad'], g['ciudad_base'])
    lat, lng, prec = g['lat'], g['lng'], g['precision']
    # Si la dirección nombra un sector conocido y la coordenada está lejos de él (o solo hay ciudad), gana el sector.
    t = ' ' + norm(g['direccion'] + ' ' + g['nombre'] + ' ' + g['ciudad']) + ' '
    best = None
    for l in L:
        if l[0] == l[2] or l[2] != ciudad: continue
        for a in [norm(l[0])] + l[1].split('|'):
            if a and ' ' + a + ' ' in t and (not best or len(a) > best[0]): best = (len(a), l)
    if best and (prec == 'ciudad' or km(lat, lng, best[1][4], best[1][5]) > 3):
        lat, lng, prec = best[1][4], best[1][5], 'sector'
    if prec == 'ciudad':  # centro de la ciudad según el propio bot (OSM a veces da la cabecera cantonal)
        c = next((l for l in L if l[0] == l[2] == ciudad), None)
        if c: lat, lng = c[4], c[5]
    if 'mokal' in norm(g['nombre']):
        tid = 'mokalu-guayaquil'
        g = {**g, 'nombre': 'Mokalú Art Shop', 'direccion': 'Av. del Bombero, La Vista, San Eduardo, Edificio 100', 'horario': 'lun-vie 09h00-17h30'}
        lat, lng, prec = -2.1745, -79.933, 'sector'
    else:
        base = CODE.get(ciudad, norm(ciudad).replace(' ', '')[:3]) + '-' + '-'.join([w for w in norm(g['nombre']).split() if w not in STOP][:4])
        tid = re.sub(r'-+', '-', base).strip('-'); n = 2
        while tid in usados: tid = f'{base}-{n}'; n += 1
    usados.add(tid)
    ig = g.get('instagram', '').strip()
    q = re.sub(r'\s+', '+', f"{g['nombre']} {g['direccion']} {ciudad}".strip())
    filas.append({'id': tid, 'nombre': g['nombre'], 'ciudad': ciudad, 'provincia': g['provincia'], 'direccion': g['direccion'] or f'{ciudad} (dirección por confirmar)',
                  'lat': lat, 'lng': lng, 'maps_url': 'https://www.google.com/maps/search/?api=1&query=' + q.replace('#', ''),
                  'whatsapp': wa(g['whatsapp']) or wa(g['telefono'].split('/')[0]), 'telefono': g['telefono'], 'horario': hor(g['horario']),
                  'marcas': 'uni-ball', 'vende_online': 'si' if tid == 'mokalu-guayaquil' else '',
                  'web': 'https://mokalu.com.ec/tienda/' if tid == 'mokalu-guayaquil' else (f'https://www.instagram.com/{ig.lstrip("@")}/' if ig else ''),
                  'precision': prec, 'fuente': g['fuente']})
H = ['id', 'nombre', 'ciudad', 'provincia', 'direccion', 'lat', 'lng', 'maps_url', 'whatsapp', 'telefono', 'horario', 'marcas', 'vende_online', 'web', 'precision', 'fuente']
o = io.StringIO(); w = csv.DictWriter(o, H, lineterminator='\r\n'); w.writeheader(); w.writerows(filas)
open(os.path.join(ROOT, 'bots/mokalu/tiendas.csv'), 'w', newline='').write(o.getvalue())
J = [{'id': f['id'], 'nombre': f['nombre'], 'ciudad': f['ciudad'], 'provincia': f['provincia'], 'direccion': f['direccion'], 'lat': f['lat'], 'lng': f['lng'],
      'maps_url': f['maps_url'], 'whatsapp': f['whatsapp'], 'horario': f['horario'], 'marcas': ['uni-ball'], 'vende_online': f['vende_online'] == 'si'} for f in filas]
open(os.path.join(ROOT, 'framework/n8n/tiendas.json'), 'w').write(json.dumps(J, ensure_ascii=False, indent=1) + '\n')
from collections import Counter
print(len(filas), 'tiendas ·', dict(Counter(f['precision'] for f in filas)))
