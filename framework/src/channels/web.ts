import type { ChannelAdapter, IncomingMessage, OutgoingMessage, WebhookRequest } from '../types.js';

/**
 * Chat web local para probar en el navegador: GET /chat/:botId sirve la página, que hace POST /chat/:botId/message.
 * Es síncrono: las respuestas vuelven en la misma petición HTTP (send solo las guarda).
 */
export class WebChatAdapter implements ChannelAdapter {
  name = 'web';
  outbox = new Map<string, OutgoingMessage[]>();

  parseWebhook(req: WebhookRequest): IncomingMessage[] {
    const b = (req.body ?? {}) as { userId?: string; text?: string; location?: { lat: number; lng: number }; buttonId?: string };
    if (!b.userId || (!b.text && !b.location && !b.buttonId)) return [];
    return [{ channel: 'web', userId: `web:${String(b.userId).slice(0, 64)}`, text: b.text?.slice(0, 2000), location: b.location, buttonId: b.buttonId, timestamp: Date.now() }];
  }

  async send(userId: string, msg: OutgoingMessage): Promise<void> {
    const list = this.outbox.get(userId) ?? [];
    list.push(msg);
    this.outbox.set(userId, list);
  }
}

export function chatPage(botId: string, title: string): string {
  const safe = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${safe(title)} — chat de prueba</title>
<style>
  :root { --bg:#f4f1ea; --me:#d9fdd3; --bot:#fff; --ink:#1d1d1d; --muted:#6b6b6b; --accent:#0b7a5a; }
  @media (prefers-color-scheme: dark) { :root { --bg:#111b21; --me:#005c4b; --bot:#202c33; --ink:#e9edef; --muted:#8696a0; --accent:#25d366; } }
  * { box-sizing: border-box; }
  body { margin:0; font:15px/1.4 system-ui, sans-serif; background:var(--bg); color:var(--ink); display:flex; flex-direction:column; height:100vh; }
  header { padding:12px 16px; background:var(--accent); color:#fff; display:flex; justify-content:space-between; align-items:center; }
  header small { opacity:.8 }
  #log { flex:1; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:8px; }
  .m { max-width:80%; padding:8px 12px; border-radius:10px; white-space:pre-wrap; word-wrap:break-word; box-shadow:0 1px 1px rgba(0,0,0,.08); }
  .me { align-self:flex-end; background:var(--me); }
  .bot { align-self:flex-start; background:var(--bot); }
  .meta { align-self:center; color:var(--muted); font-size:12px; }
  .m a { color:var(--accent); }
  .btns { display:flex; flex-wrap:wrap; gap:6px; margin-top:6px; }
  .btns button { border:1px solid var(--accent); background:transparent; color:var(--accent); border-radius:14px; padding:4px 10px; cursor:pointer; }
  form { display:flex; gap:8px; padding:10px; background:var(--bot); }
  input { flex:1; padding:10px 12px; border-radius:20px; border:1px solid var(--muted); background:var(--bg); color:var(--ink); font-size:15px; }
  button.send, button.loc { border:0; border-radius:20px; padding:0 14px; background:var(--accent); color:#fff; cursor:pointer; }
  details { padding:0 16px 8px; color:var(--muted); font-size:12px; }
  pre { white-space:pre-wrap; }
</style>
</head>
<body>
<header><div><strong>${safe(title)}</strong><br><small>Chat de prueba local · bot: ${safe(botId)}</small></div><button class="loc" id="reset" title="Reiniciar conversación">↺</button></header>
<div id="log"></div>
<details><summary>Depuración (herramientas y estado)</summary><pre id="dbg"></pre></details>
<form id="f">
  <button type="button" class="loc" id="geo" title="Compartir mi ubicación">📍</button>
  <input id="t" autocomplete="off" placeholder="Escribe un mensaje…" autofocus>
  <button class="send">Enviar</button>
</form>
<script>
const botId = ${JSON.stringify(botId)};
let userId = localStorage.getItem('chat-uid');
if (!userId) { userId = Math.random().toString(36).slice(2); try { localStorage.setItem('chat-uid', userId); } catch (e) {} }
const log = document.getElementById('log'), dbg = document.getElementById('dbg');
function esc(s) { return s.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'})[c]); }
function fmt(s) { return esc(s).replace(/\\*([^*\\n]+)\\*/g, '<b>$1</b>').replace(/(https?:\\/\\/[^\\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>'); }
function add(cls, html) { const d = document.createElement('div'); d.className = 'm ' + cls; d.innerHTML = html; log.appendChild(d); log.scrollTop = log.scrollHeight; return d; }
async function send(body, label) {
  if (label) add('me', esc(label));
  const wait = add('meta', 'escribiendo…');
  try {
    const r = await fetch('/chat/' + encodeURIComponent(botId) + '/message', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ userId, ...body }) });
    const j = await r.json();
    wait.remove();
    if (j.error) { add('meta', 'Error: ' + esc(j.error)); return; }
    for (const m of j.replies || []) {
      if (m.text) { const d = add('bot', fmt(m.text)); if (m.buttons) { const b = document.createElement('div'); b.className='btns'; for (const x of m.buttons) { const bt = document.createElement('button'); bt.textContent = x.title; bt.onclick = () => send({ buttonId: x.id, text: x.title }, x.title); b.appendChild(bt); } d.appendChild(b); } }
      if (m.location) add('bot', '📌 <a target="_blank" rel="noopener" href="https://www.google.com/maps?q=' + m.location.lat + ',' + m.location.lng + '">' + esc(m.location.name || 'Ver en el mapa') + '</a>');
      if (m.mediaUrl) add('bot', '🖼️ <a target="_blank" rel="noopener" href="' + esc(m.mediaUrl) + '">imagen</a>');
    }
    if (j.skipped === 'paused') add('meta', 'Bot en pausa: un asesor humano tomó la conversación.');
    dbg.textContent = JSON.stringify({ acciones: j.actions, herramientas: j.toolCalls, estado: j.state, modelo: j.model }, null, 2);
  } catch (e) { wait.remove(); add('meta', 'Error de red: ' + e); }
}
document.getElementById('f').onsubmit = e => { e.preventDefault(); const t = document.getElementById('t'); const v = t.value.trim(); if (!v) return; t.value=''; send({ text: v }, v); };
document.getElementById('geo').onclick = () => {
  if (!navigator.geolocation) { add('meta', 'El navegador no permite ubicación. Escribe: lat,lng'); return; }
  navigator.geolocation.getCurrentPosition(p => send({ location: { lat: p.coords.latitude, lng: p.coords.longitude } }, '📍 Ubicación compartida'), () => {
    const v = prompt('No se pudo leer la ubicación. Escribe lat,lng (ej. -1.67,-78.65):');
    const m = v && v.match(/(-?\\d+(?:\\.\\d+)?)\\s*,\\s*(-?\\d+(?:\\.\\d+)?)/);
    if (m) send({ location: { lat: +m[1], lng: +m[2] } }, '📍 ' + m[1] + ', ' + m[2]);
  });
};
document.getElementById('reset').onclick = () => { log.innerHTML=''; send({ text: '/reiniciar' }); };
add('meta', 'Escribe "hola" para empezar. 📍 comparte ubicación.');
</script>
</body>
</html>`;
}
