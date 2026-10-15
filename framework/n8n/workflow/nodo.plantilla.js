// Bot Mokalú — responde sin IA cuando puede (tienda más cercana, reclamos, horario, precio…)
// y, si no, prepara un contexto corto para DeepSeek. Las tiendas vienen de la Data Table "Mokalú tiendas".
const msg = $('Telegram Trigger').first().json.message || {};
const chatId = msg.chat ? msg.chat.id : null;
const texto = (msg.text || msg.caption || '').slice(0, 500);
const memo = $getWorkflowStaticData('global');
memo.chats = memo.chats || {};
const hoyMs = Date.now();
for (const k of Object.keys(memo.chats)) if (hoyMs - memo.chats[k].ts > 7 * 864e5) delete memo.chats[k]; // olvida tras 7 días
const previo = (chatId != null && memo.chats[chatId] && hoyMs - memo.chats[chatId].ts < 2 * 864e5) ? memo.chats[chatId] : null;
const tiendas = $input.all().map(i => i.json).filter(t => t.nombre && t.lat !== '' && t.lat != null)
  .map(t => ({ ...t, maps_url: t.maps_url || 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(`${t.nombre} ${t.direccion || ''} ${t.ciudad || ''}`.trim()) }));
const MOK = tiendas.find(x => x.tienda_id === 'mokalu-guayaquil');
const waMok = MOK && MOK.whatsapp ? ` Escríbenos directo al WhatsApp de Mokalú 📲 ${MOK.whatsapp}` : '';

const CONFIG = {
  nombreBot: 'Sofi',
  horarioHumano: 'lunes a viernes de 9h00 a 17h30',
  webTienda: 'https://mokalu.com.ec/tienda/',
  lejosKm: 60,
};
// [nombre, alias|alias, ciudad, provincia, lat, lng] — fuente: framework/n8n/lugares.json
const LUGARES = __LUGARES__;

const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9ñ ]/g, ' ').replace(/\s+/g, ' ').trim();
const t = ' ' + norm(texto) + ' ';
const has = list => list.some(k => t.includes(' ' + k + ' ') || (k.includes(' ') && t.includes(k)));
const km = (a, b, c, d) => { const r = Math.PI / 180, x = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2; return 6371 * 2 * Math.asin(Math.sqrt(x)); };

const ahora = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Guayaquil' }));
const enHorario = ahora.getDay() >= 1 && ahora.getDay() <= 5 && ahora.getHours() * 60 + ahora.getMinutes() >= 540 && ahora.getHours() * 60 + ahora.getMinutes() < 1050; // 9h00–17h30
const aviso = enHorario ? '' : ` Te responden en horario de atención (${CONFIG.horarioHumano}).`;

// 1) ¿Dónde está el cliente? GPS compartido o un lugar escrito.
let lugar = null, lat = null, lng = null;
if (msg.location) { lat = msg.location.latitude; lng = msg.location.longitude; }
else {
  // Todas las coincidencias; gana la más larga, pero un sector le gana a su propia ciudad ("guayaco, por urdesa").
  const hits = [];
  const tl = t.replace(/ cuanto (?:me |les |te )?duran /g, ' '); // "¿cuánto duran?" no es Durán
  for (const l of LUGARES) for (const a of [norm(l[0]), ...l[1].split('|')]) if (a && tl.includes(' ' + a + ' ')) hits.push({ l, n: a.length, sector: l[0] !== l[2] });
  hits.sort((x, y) => y.n - x.n);
  lugar = hits.length ? (hits.find(h => h.sector && h.l[2] === hits[0].l[2]) || hits[0]).l : null;
  if (lugar) { lat = lugar[4]; lng = lugar[5]; }
}
const lugarNuevo = !!(lugar || msg.location);
if (!lugarNuevo && previo && previo.lat != null) { // recuerda la ciudad que dio antes
  lat = previo.lat; lng = previo.lng; lugar = LUGARES.find(l => l[2] === previo.ciudad) || [previo.ciudad, '', previo.ciudad, '', lat, lng];
}
let cercanas = [];
if (lat != null && tiendas.length) {
  cercanas = tiendas.map(s => ({ ...s, km: Math.round(km(lat, lng, Number(s.lat), Number(s.lng))) })).sort((a, b) => a.km - b.km);
  if (!lugar) { // GPS: nombrar la ciudad más cercana
    lugar = LUGARES.slice().sort((a, b) => km(lat, lng, a[4], a[5]) - km(lat, lng, b[4], b[5]))[0];
  }
}
const ciudad = lugar ? lugar[2] : null;
const md = v => String(v == null ? '' : v).replace(/([_*`\[])/g, '\\$1'); // escapa Markdown de Telegram
const ficha = s => `📍 *${md(s.nombre)}* — ${md(s.direccion)}\n🗺️ ${s.maps_url} · 📲 ${md(s.whatsapp)} · 🕒 ${md(s.horario)}`;

const FRAG = __FRAG__;
const pal = new Set(norm(texto).split(' ').filter(w => w.length > 3 && !['posca', 'poscas', 'marcador', 'marcadores', 'como', 'para', 'esta', 'este', 'estos', 'estas', 'tiene', 'tienen', 'mismo', 'misma', 'verdad', 'favor', 'gracias', 'quiero', 'tengo', 'pero', 'donde', 'cual', 'cuales'].includes(w))); // palabras demasiado comunes
const fragsUtiles = FRAG.map(f => ({ f, p: f[0].split(' ').filter(w => pal.has(w)).length })).filter(x => x.p > 0).sort((a, b) => b.p - a.p);
const preguntaProducto = fragsUtiles.length > 0 && !has(['donde', 'comprar', 'compro', 'consigo', 'conseguir', 'venden', 'adquirir', 'where', 'buy']);

// 2) Respuestas fijas, en orden de prioridad (bots/mokalu/plantillas-respuesta.md).
let respuesta = null, derivar = null, intencion = 'ia';
const pideDonde = has(['donde', 'comprar', 'compro', 'consigo', 'venden', 'tienda', 'local', 'conseguir', 'adquirir', 'establecimiento', 'where', 'buy', 'store']);
if (has(['reclamo', 'defectuoso', 'defectuosos', 'danado', 'danados', 'vino seco', 'vinieron secos', 'vinieron secas', 'llego seco', 'llegaron secos', 'llegaron secas', 'llegaron danados', 'llegaron mal', 'llegaron rotos', 'esta seco', 'estan secos', 'no sirve', 'no pinta', 'no pintan', 'no funciona', 'no funcionan', 'no sale', 'llego roto', 'llego mal', 'roto', 'rota', 'fallado', 'estafa', 'devolucion', 'devolver', 'garantia', 'queja'])) {
  intencion = 'reclamo'; derivar = 'reclamos';
  respuesta = `Lamento mucho lo que pasó 🙏 Te paso ahora con el equipo de Mokalú que ve reclamos para resolverlo directamente.${waMok}${aviso}`;
} else if (msg.photo || msg.document || msg.video) {
  intencion = 'foto'; derivar = 'ventas';
  respuesta = `¡Gracias por la imagen! 📸 Todavía no puedo verlas, así que se la paso al equipo de Mokalú para que te confirme.${waMok}${aviso}`;
} else if (/\b\d{10}(\d{3})?\b/.test(t.replace(/ /g, '')) || has(['cedula', 'ruc', 'datos para la factura', 'datos para el envio', 'mi correo', 'correo electronico', 'factura', 'facturando', 'facturar', 'deposito', 'comprobante', 'transferencia', 'mi pedido', 'el pedido', 'un pedido', 'hacer un pedido', 'hacerles un pedido', 'concretar', 'cuando llega', 'cuando me llega', 'llega mi', 'la guia', 'servientrega', 'hacen envios', 'hacen envio', 'envio a', 'envios a', 'me envian', 'comprar con ustedes', 'comprarles', 'a domicilio'])) {
  intencion = 'pedido'; derivar = 'ventas';
  respuesta = `¡Perfecto! 🙌 Pedidos, envíos a todo el país, facturas y pagos los atiende directamente el equipo de Mokalú; ya les avisé.${waMok}${aviso}`;
} else if (has(['ser distribuidor', 'ser distribuidora', 'distribuir', 'punto de venta', 'revender', 'vender posca', 'vender sus productos', 'asesora de ventas', 'asesor de ventas', 'trabajar con ustedes', 'al por mayor', 'por mayor', 'mayorista', 'mayoristas', 'proforma', 'cotizacion', 'para mi colegio', 'para el colegio', 'para la escuela', 'para mi empresa', 'para la empresa', 'para mi negocio'])
  || /\b([5-9]\d|\d{3,})\s*(marcadores|poscas|posca|unidades|cajas|esferos|boligrafos)/.test(t)
  || (t.includes('distribuidor') && has(['tengo', 'mi negocio', 'mi papeleria', 'mi tienda', 'quiero', 'como']))) {
  intencion = 'distribuidor'; derivar = 'distribuidores';
  respuesta = `¡Qué buena noticia! 🙌 Te conecto con el equipo comercial de Mokalú. Si quieres, déjame el nombre de tu negocio y tu ciudad para pasárselos.${waMok}${aviso}`;
} else if (has(['hablar con una persona', 'asesor', 'asesora', 'humano', 'persona real'])) {
  intencion = 'humano'; derivar = 'asesor_ventas';
  respuesta = `Claro 🙂 Te paso con una persona del equipo de Mokalú.${waMok}${aviso}`;
} else if (t.includes(' mokalu ') && has(['donde', 'direccion', 'queda', 'quedan', 'ubicados', 'ubicacion', 'local', 'tienda', 'estan'])) {
  intencion = 'mokalu';
  respuesta = (MOK ? `Mokalú está en Guayaquil:\n${ficha(MOK)}\n` : 'Mokalú está en Guayaquil, Av. del Bombero, La Vista, San Eduardo, Edificio 100 📍\n')
    + `También puedes comprar en la tienda online, con envíos a todo el país: ${CONFIG.webTienda}\nSi estás en otra ciudad, dime cuál y te paso el punto de venta más cercano 📍`;
} else if (has(['precio', 'precios', 'cuanto cuesta', 'cuanto vale', 'cuanto sale', 'a como', 'valor', 'valorcito', 'dolares', 'combo', 'promo', 'promos', 'promocion', 'descuento'])) {
  intencion = 'precio';
  respuesta = `Los precios y promociones dependen del punto de venta, así que no te quiero dar un dato equivocado 🙏 ${cercanas.length ? `En ${ciudad} te lo confirman en *${md(cercanas[0].nombre)}* 📲 ${md(cercanas[0].whatsapp)}.` : 'Dime tu ciudad y te paso la tienda más cercana.'} Si prefieres comprar con envío a domicilio, pregúntale a Mokalú.${waMok}`;
} else if (has(['horario', 'a que hora', 'atienden', 'abren']) && !cercanas.length) {
  intencion = 'horario';
  respuesta = `Nuestro equipo atiende ${CONFIG.horarioHumano} 🕒 Yo te respondo a cualquier hora: ¿en qué ciudad estás para pasarte la tienda más cercana?`;
} else if (cercanas.length && !preguntaProducto && (lugarNuevo ? (texto.split(' ').length <= 12 || msg.location || pideDonde) : pideDonde)) {
  const s = cercanas[0];
  intencion = 'donde_compro';
  if (s.ciudad === ciudad || s.km <= 5) {
    respuesta = `En ${ciudad} puedes comprar en:\n${ficha(s)}\nTe recomiendo escribirles antes para confirmar colores. ¿Te ayudo a elegir qué POSCA llevar?`;
  } else if (s.km <= CONFIG.lejosKm) {
    respuesta = `En ${ciudad} aún no tenemos punto de venta 😕 La más cercana está en ${s.ciudad}, a ~${s.km} km:\n${ficha(s)}`;
  } else {
    respuesta = s.km > 300
      ? `En ${ciudad} aún no tenemos punto de venta 😕 Pero Mokalú hace envíos a todo el país: pide en la tienda online ${CONFIG.webTienda} o escríbeles para coordinar.${waMok}`
      : `En ${ciudad} aún no tenemos punto de venta 😕 Puedes pedir en la tienda online de Mokalú, con envíos a todo el país: ${CONFIG.webTienda}\nLa tienda física más cercana está en ${s.ciudad} (~${s.km} km): *${md(s.nombre)}*, 📲 ${md(s.whatsapp)}.`;
  }
} else if (has(['donde', 'consigo', 'conseguir', 'venden', 'local', 'tienda']) && !cercanas.length && !preguntaProducto) {
  intencion = 'pedir_ciudad';
  respuesta = '¡Claro! ¿En qué ciudad o sector estás? 📍 (también puedes enviarme tu ubicación) Así te paso la tienda más cercana.';
} else if (!msg.location && texto.trim() && !/[a-z0-9]/.test(norm(texto))) {
  intencion = 'reaccion';
  respuesta = texto.includes('?') ? '¿En qué te puedo ayudar? 🙂' : '🙂';
} else if (!msg.location && (!texto.trim() || norm(texto).split(' ').every(w => ['hola', 'holi', 'holaa', 'ola', 'buenas', 'buenos', 'buen', 'dia', 'dias', 'tardes', 'noches', 'que', 'tal', 'saludos', 'estimados', 'estimado', 'senores', 'hi', 'hello', 'hey'].includes(w)))) {
  intencion = 'saludo';
  respuesta = previo ? '¡Hola de nuevo! 🙂 ¿En qué te ayudo hoy?' : `¡Hola! Soy ${CONFIG.nombreBot}, asesora de Mokalú 🎨 Te ayudo a encontrar dónde comprar uni/POSCA o a elegir cuál te sirve. ¿En qué ciudad estás? (también puedes enviarme tu ubicación 📍)`;
}

// 3) Si va a la IA: solo 2 fragmentos de producto y, si hay, 1–2 tiendas cercanas.
let contexto = '';
if (!respuesta) {
  const elegidos = fragsUtiles.slice(0, 2).map(x => x.f[1]);
  if (elegidos.length) contexto += 'PRODUCTO:\n' + elegidos.join('\n') + '\n';
  if (cercanas.length) contexto += `TIENDAS (cliente en ${ciudad}):\n` + cercanas.slice(0, 2).map(s => `${s.nombre} (${s.ciudad}, ~${s.km} km) — ${s.direccion} · ${s.maps_url} · WhatsApp ${s.whatsapp} · ${s.horario}`).join('\n') + '\n';
  if (!cercanas.length) contexto += 'TIENDAS: aún no sabes la ciudad del cliente; si quiere comprar, pregúntala.\n';
  if (!enHorario) contexto += `Ahora el equipo humano no atiende (horario: ${CONFIG.horarioHumano}).\n`;
  if (previo && previo.ultimo) contexto += `TU MENSAJE ANTERIOR: ${previo.ultimo}\n`;
}
if (chatId != null) {
  const c = memo.chats[chatId] || {};
  if (lugarNuevo && lat != null) Object.assign(c, { ciudad, lat, lng });
  c.ultimo = respuesta ? respuesta.replace(/\s+/g, ' ').slice(0, 220) : c.ultimo;
  c.ts = hoyMs;
  memo.chats[chatId] = c;
}

return [{ json: { chatId, texto, intencion, atajo: !!respuesta, respuesta, derivar, ciudad, contexto } }];
