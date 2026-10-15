# Arma nodo.js (lo que se pega en el nodo Code "Responder sin IA") desde la plantilla.
# Uso: python3 framework/n8n/workflow/armar.py
import json, os
d = os.path.dirname(os.path.abspath(__file__))
L = json.load(open(os.path.join(d, 'lugares.compacto.json')))
F = json.load(open(os.path.join(d, 'fragmentos.json')))
t = open(os.path.join(d, 'nodo.plantilla.js')).read()
t = t.replace('__LUGARES__', json.dumps(L, ensure_ascii=False, separators=(',', ':')))
t = t.replace('__FRAG__', json.dumps(F, ensure_ascii=False, separators=(',', ':')))
open(os.path.join(d, 'nodo.js'), 'w').write(t)
print('nodo.js armado:', len(L), 'lugares,', len(F), 'fragmentos')
