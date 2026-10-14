#!/usr/bin/env python3
"""Genera panel.html con el avance de los agentes. Uso: gen.py estado.json salida.html"""
import json, subprocess, sys, html, datetime, re

REPO = "/home/user/Chatbots"
BASE = "origin/claude/mocalu-uniwell-chatbot-agents-lp0vn0"
AGENTS = [
    ("1", "Investigador", "agente/1-ingenieria-inversa", "Ingeniería inversa de SellerChat y reglas de Meta"),
    ("2", "Arquitecto", "agente/2-framework", "Framework: IA, localizador de tiendas, chat web, Telegram"),
    ("3", "Bot Mokalú", "agente/3-bots", "Tiendas, productos uni-ball/POSCA, prompts y pruebas"),
    ("4", "Validador", "agente/4-validador", "Revisa a los demás y simula clientes reales"),
]

def git(*a):
    r = subprocess.run(["git", "-C", REPO, *a], capture_output=True, text=True)
    return r.stdout.strip() if r.returncode == 0 else None

def ls(ref, path):
    out = git("ls-tree", "-r", "--name-only", ref, "--", path)
    return out.splitlines() if out else []

def show(ref, path):
    return git("show", f"{ref}:{path}") or ""

def milestones(n, ref):
    """Hitos verificables por rama: (texto, hecho, detalle)."""
    m = []
    if n == "1":
        docs = [f for f in ls(ref, "docs/ingenieria-inversa") if f.endswith(".md")]
        m.append(("Documentos de ingeniería inversa", len(docs) >= 6, f"{len(docs)} de 8"))
        m.append(("Resumen 00-RESUMEN.md", any(f.endswith("00-RESUMEN.md") for f in docs), ""))
        conv = show(ref, "docs/ingenieria-inversa/conversaciones-ejemplo.md")
        k = len(re.findall(r"^#{2,3} ", conv, re.M))
        m.append(("Conversaciones de ejemplo", k >= 30, f"{k}"))
    if n == "2":
        fw = ls(ref, "framework")
        m.append(("Proyecto iniciado (package.json)", "framework/package.json" in fw, ""))
        m.append(("Decisión BuilderBot vs propio", "framework/DECISION-BASE.md" in fw, ""))
        tests = [f for f in fw if re.search(r"\.(test|spec)\.ts$", f)]
        m.append(("Pruebas automáticas", len(tests) >= 5, f"{len(tests)} archivos"))
        for label, pat in [("Localizador de tiendas", "locator/"), ("IA vía Claude CLI", "ClaudeCli"),
                           ("Chat web", "web"), ("Telegram", "elegram")]:
            m.append((label, any(pat.lower() in f.lower() for f in fw), ""))
    if n == "3":
        b = ls(ref, "bots/mokalu")
        m.append(("bot.yaml", "bots/mokalu/bot.yaml" in b, ""))
        t = show(ref, "bots/mokalu/tiendas.csv")
        rows = max(0, len([l for l in t.splitlines() if l.strip()]) - 1)
        m.append(("Tiendas (ejemplo)", rows >= 30, f"{rows} tiendas"))
        ev = [f for f in b if "/evals/" in f]
        m.append(("Pruebas (evals)", len(ev) >= 30, f"{len(ev)} de 30"))
        m.append(("Prompt del bot", "bots/mokalu/prompts/sistema.md" in b, ""))
        kn = [f for f in b if "/conocimiento/" in f]
        m.append(("Conocimiento de producto", len(kn) >= 3, f"{len(kn)} archivos"))
    if n == "4":
        v = ls(ref, "validacion")
        p = [f for f in v if "/personas/" in f]
        m.append(("Clientes simulados", len(p) >= 40, f"{len(p)} de 40"))
        m.append(("Simulador", any("/simulador/" in f for f in v), ""))
        h = show(ref, "validacion/hallazgos.md")
        m.append(("Hallazgos reportados", bool(h), f"🔴 {h.count('🔴')} · 🟡 {h.count('🟡')}"))
        rp = [f for f in v if "/reportes/" in f]
        m.append(("Corridas contra el bot", len(rp) >= 1, f"{len(rp)}"))
        m.append(("FORMULARIO-FINAL.md", bool(ls(ref, "FORMULARIO-FINAL.md")), ""))
    return m

def main():
    estado = json.load(open(sys.argv[1]))
    git("fetch", "-q", "origin")
    now = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=5)
    cards, feed, total = [], [], 0
    for n, name, br, role in AGENTS:
        ref = f"origin/{br}"
        exists = git("rev-parse", "--verify", "-q", ref) is not None
        st = estado.get(n, {})
        commits = []
        if exists:
            log = git("log", "--format=%h\x1f%ct\x1f%s", f"{BASE}..{ref}") or ""
            for line in log.splitlines():
                h, ts, s = line.split("\x1f", 2)
                t = datetime.datetime.fromtimestamp(int(ts), datetime.timezone.utc) - datetime.timedelta(hours=5)
                commits.append((h, t, s))
                feed.append((t, n, name, s))
        total += len(commits)
        ms = milestones(n, ref) if exists else []
        done = sum(1 for _, d, _ in ms if d)
        pct = round(100 * done / len(ms)) if ms else 0
        state = st.get("estado", "trabajando")
        pill = {"trabajando": "ok", "esperando": "warn", "detenido": "bad", "terminado": "done"}.get(state, "ok")
        ms_html = "".join(
            f'<li class="{"y" if d else "n"}"><span class="tick" aria-hidden="true">{"✓" if d else "·"}</span>'
            f'<span>{html.escape(t)}</span><span class="det">{html.escape(det)}</span></li>' for t, d, det in ms
        ) or '<li class="n"><span class="tick">·</span><span>Aún no ha subido su rama</span><span class="det"></span></li>'
        last = commits[0][1].strftime("%H:%M") if commits else "—"
        cards.append(f'''
<article class="card">
  <header><span class="num">{n}</span><div><h2>{name}</h2><p class="role">{html.escape(role)}</p></div>
  <span class="pill {pill}">{html.escape(state)}</span></header>
  <p class="now"><span class="lbl">Ahora</span>{html.escape(st.get("resumen", "—"))}</p>
  <div class="bar" role="progressbar" aria-valuenow="{pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:{pct}%"></i></div>
  <p class="meta"><span>{pct}% de hitos</span><span>{len(commits)} commits</span><span>último {last}</span></p>
  <ul class="ms">{ms_html}</ul>
</article>''')
    feed.sort(reverse=True)
    feed_html = "".join(
        f'<li><time>{t.strftime("%H:%M")}</time><span class="who">A{n}</span><span class="msg">{html.escape(s)}</span></li>'
        for t, n, _, s in feed[:30]
    ) or '<li><time>—</time><span class="who"></span><span class="msg">Todavía no hay commits. Los agentes están leyendo e investigando.</span></li>'
    notas = "".join(f"<li>{html.escape(x)}</li>" for x in estado.get("notas", []))
    tpl = open(sys.argv[0].replace("gen.py", "plantilla.html"), encoding="utf-8").read()
    out = (tpl.replace("{{HORA}}", now.strftime("%d/%m %H:%M"))
              .replace("{{TOTAL}}", str(total))
              .replace("{{CARDS}}", "".join(cards))
              .replace("{{FEED}}", feed_html)
              .replace("{{NOTAS}}", notas or "<li>Sin novedades.</li>")
              .replace("{{PROX}}", html.escape(estado.get("proxima", ""))))
    open(sys.argv[2], "w", encoding="utf-8").write(out)

main()
