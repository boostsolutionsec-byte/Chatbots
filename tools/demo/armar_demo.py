# Arma la demo web del asistente (chat + panel) con el MISMO código del nodo de n8n y las tiendas reales.
# Uso: python3 tools/demo/armar_demo.py  → docs/demo/asistente-uni-ball-demo.html
import json, os
R = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
nodo = open(os.path.join(R, 'framework/n8n/workflow/nodo.js'), encoding='utf-8').read()
# La demo es para uni-ball: siempre modo 'marca' (manda a la tienda más cercana), aunque el nodo de n8n esté en 'tienda'.
assert "modo: 'tienda'" in nodo or "modo: 'marca'" in nodo, 'no encuentro CONFIG.modo en nodo.js'
nodo = nodo.replace("modo: 'tienda'", "modo: 'marca'", 1)
nodo = nodo.replace("Soy ${CONFIG.nombreBot}, asesora de Mokalú 🎨", "Soy la asistente virtual de uni-ball Ecuador 🎨")
T = json.load(open(os.path.join(R, 'framework/n8n/tiendas.json'), encoding='utf-8'))
T = [{**t, 'tienda_id': t['id']} for t in T]
h = open(os.path.join(R, 'tools/demo/plantilla.html'), encoding='utf-8').read()
h = h.replace('__TIENDAS__', json.dumps(T, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/'))
h = h.replace('__NODO__', nodo.replace('</', '<\\/')).replace('__N__', str(len(T)))
out = os.path.join(R, 'docs/demo/asistente-uni-ball-demo.html')
open(out, 'w', encoding='utf-8').write(h)
print(out, len(h) // 1024, 'KB')
