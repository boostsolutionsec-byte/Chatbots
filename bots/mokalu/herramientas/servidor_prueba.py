"""Servidor de prueba del Agente 3 (solo desarrollo, mientras llega el motor del Agente 2).

Expone `POST /sim/<botId>` con la forma que usa el simulador del validador:
  entrada  {channel, userId, text?, location?: {lat, lng}}
  salida   {replies: [str], toolCalls: [...]}
Simula `buscar_tienda` (haversine sobre tiendas.csv + lugares.csv) y responde con `claude -p --model haiku`
usando prompts/sistema.md + conocimiento/. No es el framework: no usar en producción.

Uso:  python3 bots/mokalu/herramientas/servidor_prueba.py bots/mokalu 3998
"""
import csv, json, math, re, subprocess, sys, threading, unicodedata
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import yaml

BOT = Path(sys.argv[1])
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 3998
T = list(csv.DictReader(open(BOT / "tiendas.csv", encoding="utf-8")))
L = list(csv.DictReader(open(BOT / "lugares.csv", encoding="utf-8")))
CFG = yaml.safe_load(open(BOT / "bot.yaml", encoding="utf-8"))
HIST: dict[str, list] = {}
LOCK = threading.Lock()


def norm(s):
    s = unicodedata.normalize("NFD", s.lower())
    return "".join(c for c in s if unicodedata.category(c) != "Mn")


def hv(a, b, c, d):
    p = math.radians
    x = math.sin(p(c - a) / 2) ** 2 + math.cos(p(a)) * math.cos(p(c)) * math.sin(p(d - b) / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(x))


def resolve(text):
    t = " " + re.sub(r"[^a-z0-9ñ ]", " ", norm(text)) + " "
    best = None
    for l in L:
        for a in [l["nombre"]] + l["alias"].split(";"):
            a = norm(a).strip()
            if a and f" {a} " in t:
                score = (len(a), l["tipo"] == "ciudad")
                if best is None or score > best[0]:
                    best = (score, l)
    return best[1] if best else None


def find(text=None, lat=None, lng=None):
    lugar = None
    if lat is None:
        lugar = resolve(text or "")
        if not lugar:
            return None
        lat, lng = float(lugar["lat"]), float(lugar["lng"])
    res = sorted(T, key=lambda r: hv(lat, lng, float(r["lat"]), float(r["lng"])))[:2]
    out = []
    for r in res:
        d = hv(lat, lng, float(r["lat"]), float(r["lng"]))
        if lugar and norm(r["ciudad"]) == norm(lugar["ciudad"]):
            m = "misma_ciudad"
        elif lugar and norm(r["provincia"]) == norm(lugar["provincia"]):
            m = "misma_provincia"
        else:
            m = "mas_cercana" if d > 15 else "misma_ciudad"
        out.append({k: r[k] for k in ["id", "nombre", "ciudad", "direccion", "maps_url", "whatsapp", "horario"]}
                   | {"distanciaKm": round(d), "motivo": m})
    return {"lugar_detectado": lugar["nombre"] if lugar else "ubicación compartida", "tiendas": out}


SISTEMA = open(BOT / "prompts/sistema.md", encoding="utf-8").read()
for k, v in (CFG.get("variables") or {}).items():
    SISTEMA = SISTEMA.replace("{{variables." + k + "}}", str(v))
for f in sorted((BOT / "conocimiento").glob("*.md")):
    SISTEMA += f"\n\n# Conocimiento: {f.name}\n" + f.read_text(encoding="utf-8")
SISTEMA += """

# Formato de salida (servidor de prueba)
Responde SOLO el texto para el cliente. Si debes pasar a una persona, añade al final una línea aparte exactamente así:
[DERIVAR:<asesor_ventas|distribuidores|reclamos>]
"""


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
        uid = body.get("userId", "anon")
        with LOCK:
            hist = HIST.setdefault(uid, [])
        if body.get("location"):
            msg = "[el cliente compartió su ubicación]"
            loc = find(lat=body["location"]["lat"], lng=body["location"]["lng"])
        else:
            msg = body.get("text") or ""
            joined = " ".join(h for r, h in hist if r == "Cliente")
            loc = find(text=msg) or find(text=joined + " " + msg)
        ctx = f"[Resultado de la herramienta buscar_tienda: {json.dumps(loc, ensure_ascii=False) if loc else 'sin ubicación detectada'}]"
        transcript = "\n".join(f"{r}: {h}" for r, h in hist[-12:])
        prompt = f"{transcript}\nCliente: {msg}\n\n{ctx}\n\nEscribe SOLO la siguiente respuesta del bot (sin prefijo)."
        r = subprocess.run(["claude", "-p", "--model", "haiku", "--system-prompt", SISTEMA, prompt],
                           capture_output=True, text=True, timeout=240)
        ans = r.stdout.strip()
        tool_calls = [{"name": "buscar_tienda", "result": loc}] if loc else []
        m = re.search(r"\[DERIVAR:(\w+)\]", ans)
        if m:
            tool_calls.append({"name": "derivar_humano", "args": {"destino": m.group(1)}})
            ans = ans.replace(m.group(0), "").strip()
        with LOCK:
            hist += [("Cliente", msg), ("Bot", ans)]
        out = json.dumps({"replies": [ans], "toolCalls": tool_calls}, ensure_ascii=False).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(out)


if __name__ == "__main__":
    print(f"servidor de prueba en http://localhost:{PORT}/sim/{CFG['id']}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
