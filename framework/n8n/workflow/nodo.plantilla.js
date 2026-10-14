// Bot Mokalú — responde sin IA cuando puede (tienda más cercana, reclamos, horario, precio…)
// y, si no, prepara un contexto corto para DeepSeek. Las tiendas vienen de la Data Table "Mokalú tiendas".
const msg = $('Telegram Trigger').first().json.message || {};
const chatId = msg.chat ? msg.chat.id : null;
const texto = (msg.text || msg.caption || '').slice(0, 500);
const tiendas = $input.all().map(i => i.json).filter(t => t.nombre && t.lat !== '' && t.lat != null);

const CONFIG = {
  nombreBot: 'Sofi',
  horarioHumano: 'lunes a sábado de 10h00 a 18h00',
  webTienda: 'https://mokalu.com.ec/tienda/',
  lejosKm: 60,
};
// [nombre, alias|alias, ciudad, provincia, lat, lng] — fuente: framework/n8n/lugares.json
const LUGARES = __LUGARES__;

const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ ]/g, ' ').replace(/\s+/g, ' ').trim();
const t = ' ' + norm(texto) + ' ';
const has = list => list.some(k => t.includes(' ' + k + ' ') || (k.includes(' ') && t.includes(k)));
const km = (a, b, c, d) => { const r = Math.PI / 180, x = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2; return 6371 * 2 * Math.asin(Math.sqrt(x)); };

const ahora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Guayaquil' }));
const enHorario = ahora.getDay() >= 1 && ahora.getDay() <= 6 && ahora.getHours() >= 10 && ahora.getHours() < 18;
const aviso = enHorario ? '' : ` Te responden en horario de atención (${CONFIG.horarioHumano}).`;

// 1) ¿Dónde está el cliente? GPS compartido o un lugar escrito.
let lugar = null, lat = null, lng = null;
if (msg.location) { lat = msg.location.latitude; lng = msg.location.longitude; }
else {
  let mejor = 0;
  for (const l of LUGARES) for (const a of [norm(l[0]), ...l[1].split('|')]) {
    if (a && a.length > mejor && t.includes(' ' + a + ' ')) { mejor = a.length; lugar = l; }
  }
  if (lugar) { lat = lugar[4]; lng = lugar[5]; }
}
let cercanas = [];
if (lat != null && tiendas.length) {
  cercanas = tiendas.map(s => ({ ...s, km: Math.round(km(lat, lng, Number(s.lat), Number(s.lng))) })).sort((a, b) => a.km - b.km);
  if (!lugar) { // GPS: nombrar la ciudad más cercana
    lugar = LUGARES.slice().sort((a, b) => km(lat, lng, a[4], a[5]) - km(lat, lng, b[4], b[5]))[0];
  }
}
const ciudad = lugar ? lugar[2] : null;
const ficha = s => `📍 *${s.nombre}* — ${s.direccion}\n🗺️ ${s.maps_url} · 📲 ${s.whatsapp} · 🕒 ${s.horario}`;

const FRAG = __FRAG__;
const pal = new Set(norm(texto).split(' ').filter(w => w.length > 3));
const fragsUtiles = FRAG.map(f => ({ f, p: f[0].split(' ').filter(w => pal.has(w)).length })).filter(x => x.p > 0).sort((a, b) => b.p - a.p);
const preguntaProducto = fragsUtiles.length > 0 && !has(['donde', 'comprar', 'compro', 'consigo', 'venden']);

// 2) Respuestas fijas, en orden de prioridad (bots/mokalu/plantillas-respuesta.md).
let respuesta = null, derivar = null, intencion = 'ia';
if (has(['reclamo', 'defectuoso', 'dañado', 'danado', 'vino seco', 'vinieron secos', 'no sirve', 'estafa', 'devolucion', 'garantia', 'queja'])) {
  intencion = 'reclamo'; derivar = 'reclamos';
  respuesta = `Lamento mucho lo que pasó 🙏 Te paso ahora con el equipo de Mokalú que ve reclamos para resolverlo directamente.${aviso}`;
} else if (has(['ser distribuidor', 'punto de venta', 'revender', 'vender posca', 'al por mayor', 'mayorista', 'mayoristas', 'proforma', 'cotizacion', 'colegio', 'empresa'])
  || (t.includes('distribuidor') && has(['tengo', 'mi negocio', 'mi papeleria', 'mi tienda']))) {
  intencion = 'distribuidor'; derivar = 'distribuidores';
  respuesta = `¡Qué buena noticia! 🙌 Te conecto con el equipo comercial de Mokalú. Si quieres, déjame el nombre de tu negocio y tu ciudad para pasárselos.${aviso}`;
} else if (has(['hablar con una persona', 'asesor', 'asesora', 'humano', 'persona real'])) {
  intencion = 'humano'; derivar = 'asesor_ventas';
  respuesta = `Claro 🙂 Te paso con una persona del equipo de Mokalú.${aviso}`;
} else if (has(['precio', 'precios', 'cuanto cuesta', 'cuanto vale', 'valor', 'dolares']) && !cercanas.length) {
  intencion = 'precio';
  respuesta = 'El precio lo pone cada tienda, así que no te quiero dar un dato equivocado 🙏 Dime tu ciudad y te paso el WhatsApp de la tienda más cercana para que te lo confirmen.';
} else if (has(['horario', 'a que hora', 'atienden', 'abren']) && !cercanas.length) {
  intencion = 'horario';
  respuesta = `Nuestro equipo atiende ${CONFIG.horarioHumano} 🕒 Yo te respondo a cualquier hora: ¿en qué ciudad estás para pasarte la tienda más cercana?`;
} else if (cercanas.length && !preguntaProducto && (texto.split(' ').length <= 12 || msg.location || has(['donde', 'comprar', 'compro', 'consigo', 'venden', 'tienda', 'local']))) {
  const s = cercanas[0];
  intencion = 'donde_compro';
  if (s.ciudad === ciudad || s.km <= 5) {
    respuesta = `En ${ciudad} puedes comprar en:\n${ficha(s)}\nTe recomiendo escribirles antes para confirmar colores. ¿Te ayudo a elegir qué POSCA llevar?`;
  } else if (s.km <= CONFIG.lejosKm) {
    respuesta = `En ${ciudad} aún no tenemos punto de venta 😕 La más cercana está en ${s.ciudad}, a ~${s.km} km:\n${ficha(s)}`;
  } else {
    respuesta = `En ${ciudad} aún no tenemos punto de venta 😕 Puedes pedir en la tienda online de Mokalú, con envíos a todo el país: ${CONFIG.webTienda}\nLa tienda física más cercana está en ${s.ciudad} (~${s.km} km): *${s.nombre}*, 📲 ${s.whatsapp}.`;
  }
} else if (!texto.trim() || /^(hola|holi|buenas|buenos dias|buenas tardes|buenas noches|hi|hello|ola)$/.test(norm(texto)) || !/[a-z]/.test(norm(texto))) {
  intencion = 'saludo';
  respuesta = `¡Hola! Soy ${CONFIG.nombreBot}, asesora de Mokalú 🎨 Te ayudo a encontrar dónde comprar uni/POSCA o a elegir cuál te sirve. ¿En qué ciudad estás? (también puedes enviarme tu ubicación 📍)`;
}

// 3) Si va a la IA: solo 2 fragmentos de producto y, si hay, 1–2 tiendas cercanas.
let contexto = '';
if (!respuesta) {
  const elegidos = fragsUtiles.slice(0, 2).map(x => x.f[1]);
  if (elegidos.length) contexto += 'PRODUCTO:\n' + elegidos.join('\n') + '\n';
  if (cercanas.length) contexto += `TIENDAS (cliente en ${ciudad}):\n` + cercanas.slice(0, 2).map(s => `${s.nombre} (${s.ciudad}, ~${s.km} km) — ${s.direccion} · ${s.maps_url} · WhatsApp ${s.whatsapp} · ${s.horario}`).join('\n') + '\n';
  if (!cercanas.length) contexto += 'TIENDAS: aún no sabes la ciudad del cliente; si quiere comprar, pregúntala.\n';
  if (!enHorario) contexto += `Ahora el equipo humano no atiende (horario: ${CONFIG.horarioHumano}).\n`;
}

return [{ json: { chatId, texto, intencion, atajo: !!respuesta, respuesta, derivar, ciudad, contexto } }];
