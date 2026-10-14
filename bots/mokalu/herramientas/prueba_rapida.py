"""Mini-arnés del Agente 3 (uso: python3 prueba_rapida.py bots/mokalu casos.json): simula buscar_tienda (haversine sobre tiendas.csv + lugares.csv) y llama
`claude -p --model haiku` con el prompt de sistema del bot. Solo para iterar el prompt mientras llega el motor."""
import csv, math, re, subprocess, sys, unicodedata, json, yaml

BOT = sys.argv[1]
cases = json.load(open(sys.argv[2]))
T = list(csv.DictReader(open(f"{BOT}/tiendas.csv", encoding="utf-8")))
L = list(csv.DictReader(open(f"{BOT}/lugares.csv", encoding="utf-8")))
cfg = yaml.safe_load(open(f"{BOT}/bot.yaml", encoding="utf-8"))

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
            if a and f" {a} " in t and (best is None or len(a) > best[0]):
                best = (len(a), l)
    return best[1] if best else None

def find(text=None, lat=None, lng=None):
    lugar = None
    if lat is None and text:
        lugar = resolve(text)
        if not lugar:
            return None
        lat, lng = float(lugar["lat"]), float(lugar["lng"])
    res = sorted(T, key=lambda r: hv(lat, lng, float(r["lat"]), float(r["lng"])))[:2]
    out = []
    for r in res:
        d = hv(lat, lng, float(r["lat"]), float(r["lng"]))
        if lugar and norm(r["ciudad"]) == norm(lugar["ciudad"]): m = "misma_ciudad"
        elif lugar and norm(r["provincia"]) == norm(lugar["provincia"]): m = "misma_provincia"
        else: m = "mas_cercana" if d > 15 else "misma_ciudad"
        out.append({k: r[k] for k in ["nombre", "ciudad", "direccion", "maps_url", "whatsapp", "horario"]} | {"distanciaKm": round(d), "motivo": m})
    return {"lugar_detectado": lugar["nombre"] if lugar else "ubicación compartida", "tiendas": out}

sistema = open(f"{BOT}/prompts/sistema.md", encoding="utf-8").read()
for k, v in cfg.get("variables", {}).items():
    sistema = sistema.replace("{{variables." + k + "}}", str(v))
sistema += "\n\n# Conocimiento\n" + open(f"{BOT}/conocimiento/productos-uni.md", encoding="utf-8").read()

for c in cases:
    hist = []
    print(f"\n===== {c['id']}")
    for turn in c["turnos"]:
        if isinstance(turn, dict):
            msg = "[el cliente compartió su ubicación]"; loc = find(lat=turn["lat"], lng=turn["lng"])
        else:
            msg = turn; joined = " ".join(h for r, h in hist if r == "Cliente") + " " + msg
            loc = find(text=joined)
        ctx = f"[Resultado de la herramienta buscar_tienda para este turno: {json.dumps(loc, ensure_ascii=False) if loc else 'sin ubicación detectada'}]"
        transcript = "\n".join(f"{r}: {h}" for r, h in hist)
        prompt = f"{transcript}\nCliente: {msg}\n\n{ctx}\n\nEscribe SOLO la siguiente respuesta del bot (sin prefijo)."
        r = subprocess.run(["claude", "-p", "--model", "haiku", "--system-prompt", sistema, prompt], capture_output=True, text=True, timeout=180)
        ans = r.stdout.strip()
        print(f"Cliente: {msg}\nBot: {ans}\n  ({len(ans.split())} palabras)")
        hist += [("Cliente", msg), ("Bot", ans)]
