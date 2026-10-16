// Bot Mokalú — responde sin IA cuando puede (tienda más cercana, pedidos, reclamos, horario, precio…)
// y, si no, prepara un contexto corto para DeepSeek. Las tiendas vienen de la Data Table "uni-ball puntos de venta".
const CONFIG = {
  modo: 'tienda',             // 'tienda' = WhatsApp de Mokalú (vende y envía) · 'marca' = cuenta de uni-ball (manda a la tienda más cercana)
  canal: 'whatsapp',          // 'whatsapp' | 'telegram' (solo cambia el formato del texto)
  entrada: 'Normalizar mensaje', // nodo de n8n que entrega { message } con forma estándar
  nombreBot: 'Sofi',
  horarioHumano: 'lunes a viernes de 9h00 a 17h30',
  webTienda: 'https://mokalu.com.ec/tienda/',
  envio: 'Servientrega (llega en 24–48 h)',
  lejosKm: 60,
  pausaHoras: 12,             // tras pasar un caso al equipo, el bot no responde en ese chat por estas horas
  horarioMall: 'de 10h00 a 21h00 todos los días',     // si una tienda de centro comercial no tiene horario (aproximado)
  horarioLocal: 'de lunes a sábado de 9h00 a 18h00', // si una papelería de calle no tiene horario (aproximado)
};
const TIENDA = CONFIG.modo === 'tienda';
const msg = $(CONFIG.entrada).first().json.message || {};
const chatId = msg.chat ? msg.chat.id : null;
// Foto: la describe ChatGPT en el nodo "Ver foto (ChatGPT)" (solo corre si el cliente mandó una foto).
let fotoDesc = '';
if (msg.photo) {
  try {
    const n = $('Ver foto (ChatGPT)');
    if (n && n.isExecuted) {
      const j = n.first().json || {};
      const d = typeof j.content === 'string' ? j.content : (j.text || (j.message && j.message.content) || (Array.isArray(j.output) && j.output[0] && j.output[0].content && j.output[0].content[0] && j.output[0].content[0].text) || '');
      fotoDesc = String(d).replace(/\s+/g, ' ').trim().slice(0, 300);
    }
  } catch (e) { fotoDesc = ''; }
}
const texto = ((msg.text || msg.caption || '') + (fotoDesc ? ` [foto: ${fotoDesc}]` : '')).slice(0, 700);
const memo = $getWorkflowStaticData('global');
memo.chats = memo.chats || {};
const hoyMs = Date.now();
for (const k of Object.keys(memo.chats)) if (hoyMs - memo.chats[k].ts > 7 * 864e5) delete memo.chats[k]; // olvida tras 7 días
if (TIENDA && chatId != null && memo.chats[chatId] && memo.chats[chatId].pausaHasta > hoyMs) return []; // una persona atiende este chat
const previo = (chatId != null && memo.chats[chatId] && hoyMs - memo.chats[chatId].ts < 2 * 864e5) ? memo.chats[chatId] : null;

// [nombre, alias|alias, ciudad, provincia, lat, lng] — fuente: framework/n8n/lugares.json
const LUGARES = __LUGARES__;

const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9ñ ]/g, ' ').replace(/\s+/g, ' ').trim();
const t = ' ' + norm(texto) + ' ';
const has = list => list.some(k => t.includes(' ' + k + ' ') || (k.includes(' ') && t.includes(k)));
const km = (a, b, c, d) => { const r = Math.PI / 180, x = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2; return 6371 * 2 * Math.asin(Math.sqrt(x)); };
// Tiendas: vienen de la Data Table. Para dar de baja una tienda: activo = false (no hace falta borrarla).
// Si una fila no tiene lat/lng, se ubica en el centro de su ciudad (basta escribir nombre + ciudad).
const centroCiudad = c => { const n = norm(c); return n ? LUGARES.find(l => norm(l[2]) === n || norm(l[0]) === n || l[1].split('|').includes(n)) : null; };
const tiendas = $input.all().map(i => i.json)
  .filter(t => t.nombre && t.activo !== false && !['no', 'false', '0'].includes(norm(String(t.activo == null ? '' : t.activo))))
  .map(t => { if (t.lat === '' || t.lat == null || t.lng === '' || t.lng == null) { const c = centroCiudad(t.ciudad); return c ? { ...t, lat: c[4], lng: c[5] } : null; } return t; })
  .filter(Boolean)
  .map(t => ({ ...t, maps_url: t.maps_url || 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(`${t.nombre} ${t.direccion || ''} ${t.ciudad || ''}`.trim()) }));
const MOK = tiendas.find(x => x.tienda_id === 'mokalu-guayaquil');
const waMok = TIENDA ? ' Una persona del equipo te responde por aquí mismo 🙌' : (MOK && MOK.whatsapp ? ` Escríbenos directo al WhatsApp de Mokalú 📲 ${MOK.whatsapp}` : '');

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
const md = v => CONFIG.canal === 'telegram' ? String(v == null ? '' : v).replace(/([_*`\[])/g, '\\$1') : String(v == null ? '' : v).replace(/[*_~`]/g, ''); // texto seguro para el canal
const ficha = s => `📍 *${md(s.nombre)}* — ${md(s.direccion)}\n🗺️ ${s.maps_url}${s.whatsapp ? ' · 📲 ' + md(s.whatsapp) : ''}${s.horario ? ' · 🕒 ' + md(s.horario) : ''}`;
// La tienda que se le recomendó antes (para "¿a qué hora atienden?", "¿dirección?", "¿otra opción?").
const tiendaPrevia = !lugarNuevo && previo && previo.tienda ? cercanas.find(x => x.nombre === previo.tienda) || null : null;

// Horario: "lun-jue 10:00-20:00; vie-sáb 10:00-21:00; dom y feriados 11:00-20:00" → tramo de un día (0 = domingo).
const DIAS = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];
const DIAS_LARGO = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const horarioDia = (h, dia) => {
  const txt = String(h || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/(\d)h(\d)/g, '$1:$2');
  for (const seg of txt.split(/[;\n|]/)) {
    const m = seg.match(/^\s*([a-z ,y-]+?)\s*:?\s*(cerrado|(\d{1,2}:\d{2})\s*(?:-|a)\s*(\d{1,2}:\d{2}))/);
    if (!m) continue;
    const dias = new Set();
    for (const p of m[1].split(/,| y /)) {
      const r = p.trim().match(/^([a-z]{3})[a-z]*(?:\s*-\s*([a-z]{3})[a-z]*)?$/);
      if (!r || DIAS.indexOf(r[1]) < 0) continue;
      const a = DIAS.indexOf(r[1]), b = r[2] ? DIAS.indexOf(r[2]) : a;
      if (b < 0) continue;
      for (let d = a; ; d = (d + 1) % 7) { dias.add(d); if (d === b) break; }
    }
    if (dias.has(dia)) return m[2] === 'cerrado' ? { cerrado: true } : { abre: m[3], cierra: m[4] };
  }
  return null;
};
const minutos = x => { const [h, m] = x.split(':').map(Number); return h * 60 + m; };
const esMall = s => /\b(c c|cc|centro comercial|mall|shopping|riocentro|quicentro|piazza|multiplaza|plaza)\b/.test(norm(`${s.nombre} ${s.direccion}`));
const horarioTienda = s => {
  const nom = `*${md(s.nombre)}*`, wa = s.whatsapp ? ` Si quieres confirmar antes de ir: 📲 ${md(s.whatsapp)}` : '';
  if (!s.horario) return (esMall(s)
    ? `${nom} está en un centro comercial; no tengo su horario exacto, pero esos locales suelen atender ${CONFIG.horarioMall} (aprox.).`
    : `No tengo el horario exacto de ${nom}; las papelerías suelen atender ${CONFIG.horarioLocal} (aprox.).`) + wa;
  const dia = ahora.getDay(), hoy = horarioDia(s.horario, dia), min = ahora.getHours() * 60 + ahora.getMinutes();
  if (!hoy) return `${nom} atiende: ${md(s.horario)} 🕒`;
  if (hoy.cerrado) return `Hoy ${DIAS_LARGO[dia]} ${nom} no abre 😕 Su horario: ${md(s.horario)}.`;
  const estado = min < minutos(hoy.abre) ? 'todavía no abre' : min < minutos(hoy.cierra) ? 'ahora está abierto ✅' : 'ya cerró por hoy';
  return `Hoy ${DIAS_LARGO[dia]} ${nom} atiende de ${hoy.abre} a ${hoy.cierra} 🕒 (${estado}).\nHorario completo: ${md(s.horario)}`;
};

const FRAG = __FRAG__;
const pal = new Set(norm(texto).split(' ').flatMap(w => w.length > 4 && w.endsWith('s') ? [w, w.slice(0, -1)] : [w]).filter(w => (w.length > 3 || /^(\d+[km]|\d{3}|1mr|pc|pcf|pin|eye|one|gel|sn|px|pwe|pwb|pna|ek|clp|sxn|umn|ub|um)$/.test(w)) && !['ball', 'uniball', 'color', 'colores', 'punta', 'puntas', 'marca', 'posca', 'poscas', 'marcador', 'marcadores', 'como', 'para', 'esta', 'este', 'estos', 'estas', 'tiene', 'tienen', 'mismo', 'misma', 'verdad', 'favor', 'gracias', 'quiero', 'tengo', 'pero', 'donde', 'cual', 'cuales'].includes(w))); // palabras demasiado comunes
const fragsUtiles = FRAG.map(f => ({ f, p: f[0].split(' ').filter(w => pal.has(w)).length })).filter(x => x.p > 0).sort((a, b) => b.p - a.p);
const preguntaProducto = fragsUtiles.length > 0 && !has(['donde', 'comprar', 'compro', 'consigo', 'conseguir', 'venden', 'adquirir', 'where', 'buy']);

// 2) Respuestas fijas, en orden de prioridad (bots/mokalu/plantillas-respuesta.md).
let respuesta = null, derivar = null, intencion = 'ia', tiendaSel = null;
const pideDonde = has(['donde', 'comprar', 'compro', 'consigo', 'venden', 'tienda', 'local', 'conseguir', 'adquirir', 'establecimiento', 'where', 'buy', 'store']);
if (has(['reclamo', 'defectuoso', 'defectuosos', 'danado', 'danados', 'vino seco', 'vinieron secos', 'vinieron secas', 'llego seco', 'llegaron secos', 'llegaron secas', 'llegaron danados', 'llegaron mal', 'llegaron rotos', 'esta seco', 'estan secos', 'no sirve', 'no pinta', 'no pintan', 'no funciona', 'no funcionan', 'no sale', 'llego roto', 'llego mal', 'roto', 'rota', 'fallado', 'estafa', 'devolucion', 'devolver', 'garantia', 'queja'])) {
  intencion = 'reclamo'; derivar = 'reclamos';
  respuesta = `Lamento mucho lo que pasó 🙏 Te paso ahora con el equipo de Mokalú que ve reclamos para resolverlo directamente.${waMok}${aviso}`;
} else if ((msg.photo && !fotoDesc) || msg.document || msg.video || msg.voice || msg.audio) {
  intencion = 'foto'; derivar = 'ventas';
  respuesta = `¡Gracias! 📎 Ese archivo se lo paso al equipo de Mokalú para que te confirme.${waMok}${aviso}`;
} else if (/\b\d{10}(\d{3})?\b/.test(t.replace(/ /g, '')) || has(['cedula', 'ruc', 'datos para la factura', 'datos para el envio', 'mi correo', 'correo electronico', 'factura', 'facturando', 'facturar', 'deposito', 'comprobante', 'transferencia', 'mi pedido', 'el pedido', 'un pedido', 'hacer un pedido', 'hacerles un pedido', 'concretar', 'cuando llega', 'cuando me llega', 'llega mi', 'la guia', 'servientrega', 'hacen envios', 'hacen envio', 'envio a', 'envios a', 'me envian', 'comprar con ustedes', 'comprarles', 'a domicilio', 'comprobante de pago', 'documento con datos'])) {
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
  if (TIENDA) {
    derivar = 'ventas';
    respuesta = `¡Claro! Precio y stock te los confirma el equipo de Mokalú por aquí mismo 🙌 Si me dices qué producto, color y cantidad, y desde qué ciudad nos escribes, se lo dejo listo.${aviso}`;
  } else {
    if (cercanas.length) tiendaSel = cercanas[0];
    respuesta = `Los precios y promociones dependen del punto de venta, así que no te quiero dar un dato equivocado 🙏 ${cercanas.length ? `En ${ciudad} te lo confirman en *${md(cercanas[0].nombre)}* 📲 ${md(cercanas[0].whatsapp)}.` : 'Dime tu ciudad y te paso la tienda más cercana.'} Si prefieres comprar con envío a domicilio, pregúntale a Mokalú.${waMok}`;
  }
} else if (has(['horario', 'horarios', 'a que hora', 'que hora', 'atienden', 'abren', 'abre', 'cierran', 'cierra', 'abierto', 'abierta']) && (TIENDA || cercanas.length)) {
  intencion = 'horario';
  const s = tiendaPrevia || cercanas[0];
  if (TIENDA) {
    respuesta = `En Mokalú te atendemos ${CONFIG.horarioHumano} 🕒 y por aquí te respondo a cualquier hora.`
      + (s && s.km <= CONFIG.lejosKm && s.tienda_id !== 'mokalu-guayaquil' ? `\nSi prefieres ir en persona: ${horarioTienda(s)}` : '\n¿Qué producto estás buscando?');
  } else { respuesta = (tiendaPrevia ? '' : `La tienda más cercana${ciudad ? ' en ' + ciudad : ''} es esta 👇\n`) + horarioTienda(s); tiendaSel = s; }
} else if (tiendaPrevia && !t.includes(' mokalu ') && has(['direccion', 'ubicacion', 'como llego', 'como llegar', 'mapa', 'telefono', 'whatsapp', 'numero', 'contacto', 'celular', 'donde queda', 'donde esta', 'donde quedan'])) {
  intencion = 'datos_tienda';
  tiendaSel = tiendaPrevia;
  respuesta = `Aquí tienes los datos:\n${ficha(tiendaSel)}`;
} else if (tiendaPrevia && cercanas.length > 1 && has(['otra tienda', 'otras tiendas', 'otro local', 'otros locales', 'otro lugar', 'otros lugares', 'otra opcion', 'otras opciones', 'mas opciones', 'mas cerca', 'mas cercana', 'mas cercano', 'alguna otra', 'algun otro', 'otra sucursal', 'otras sucursales'])) {
  intencion = 'mas_tiendas';
  const lista = cercanas.filter(x => !tiendaPrevia || x.nombre !== tiendaPrevia.nombre).slice(0, 3);
  respuesta = `Otras opciones${ciudad ? ' cerca de ' + ciudad : ''}:\n` + lista.map(x => `📍 *${md(x.nombre)}* (~${x.km} km) — ${md(x.direccion)}${x.whatsapp ? ' · 📲 ' + md(x.whatsapp) : ''}`).join('\n') + '\n¿Quieres el horario o la ubicación de alguna?';
} else if (has(['horario', 'horarios', 'a que hora', 'atienden', 'abren']) && !cercanas.length) {
  intencion = 'horario';
  respuesta = `Nuestro equipo atiende ${CONFIG.horarioHumano} 🕒 Yo te respondo a cualquier hora: ${TIENDA ? '¿qué producto estás buscando?' : '¿en qué ciudad estás para pasarte la tienda más cercana?'}`;
} else if (cercanas.length && !preguntaProducto && (lugarNuevo ? (texto.split(' ').length <= 12 || msg.location || pideDonde) : pideDonde)) {
  const s = cercanas[0];
  intencion = 'donde_compro';
  if (!TIENDA || s.km <= CONFIG.lejosKm) tiendaSel = s;
  if (TIENDA) {
    respuesta = `¡Claro! Desde Mokalú te lo enviamos a ${ciudad} por ${CONFIG.envio} 📦 ¿Qué producto buscas?`
      + (s.km <= CONFIG.lejosKm ? `\nSi prefieres comprarlo en persona, ${s.ciudad === ciudad || s.km <= 5 ? 'en ' + ciudad + ' lo tienes en' : `lo más cercano está en ${s.ciudad} (~${s.km} km)`}:\n${ficha(s)}` : '');
  } else if (s.ciudad === ciudad || s.km <= 5) {
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
  respuesta = TIENDA ? '¡Claro! ¿Desde qué ciudad nos escribes? 📍 Te lo enviamos a domicilio o te digo dónde comprarlo en persona.' : '¡Claro! ¿En qué ciudad o sector estás? 📍 (también puedes enviarme tu ubicación) Así te paso la tienda más cercana.';
} else if (!msg.location && texto.trim() && !/[a-z0-9]/.test(norm(texto))) {
  intencion = 'reaccion';
  respuesta = texto.includes('?') ? '¿En qué te puedo ayudar? 🙂' : '🙂';
} else if (!msg.location && texto.trim() && norm(texto).split(' ').every(w => ['gracias', 'gracia', 'muchas', 'mil', 'ok', 'okey', 'oki', 'listo', 'perfecto', 'vale', 'dale', 'chevere', 'genial', 'super', 'excelente', 'entendido', 'thanks', 'muy', 'amable'].includes(w))) {
  intencion = 'cierre';
  respuesta = '¡Con gusto! 🙌 Si necesitas algo más, aquí estoy.';
} else if (!msg.location && (!texto.trim() || norm(texto).split(' ').every(w => ['hola', 'holi', 'holaa', 'ola', 'buenas', 'buenos', 'buen', 'dia', 'dias', 'tardes', 'noches', 'que', 'tal', 'saludos', 'estimados', 'estimado', 'senores', 'hi', 'hello', 'hey'].includes(w)))) {
  intencion = 'saludo';
  respuesta = previo ? '¡Hola de nuevo! 🙂 ¿En qué te ayudo hoy?' : (TIENDA ? `¡Hola! Soy ${CONFIG.nombreBot}, asistente virtual de Mokalú Art Shop 🎨 Te ayudo a elegir tu material y a hacer tu pedido con envío a todo el país. ¿Qué estás buscando y desde qué ciudad nos escribes?` : `¡Hola! Soy ${CONFIG.nombreBot}, asesora de Mokalú 🎨 Te ayudo a encontrar dónde comprar uni-ball o a elegir cuál te sirve. ¿En qué ciudad estás? (también puedes enviarme tu ubicación 📍)`);
}

// 3) Si va a la IA: solo 2 fragmentos de producto y, si hay, 1–2 tiendas cercanas.
let contexto = '';
if (!respuesta) {
  const elegidos = fragsUtiles.slice(0, 2).map(x => x.f[1]);
  if (elegidos.length) contexto += 'PRODUCTO:\n' + elegidos.join('\n') + '\n';
  if (cercanas.length) contexto += `TIENDAS (cliente en ${ciudad}):\n` + cercanas.slice(0, 2).map(s => `${s.nombre} (${s.ciudad}, ~${s.km} km) — ${s.direccion} · ${s.maps_url} · WhatsApp ${s.whatsapp} · ${s.horario}`).join('\n') + '\n';
  if (TIENDA) contexto += `VENTA: Mokalú vende y envía a todo el país por ${CONFIG.envio}; precio, stock y pedido los confirma una persona del equipo por este mismo chat.\n`;
  if (!cercanas.length) contexto += 'TIENDAS: aún no sabes la ciudad del cliente; si quiere comprar, pregúntala.\n';
  if (!enHorario) contexto += `Ahora el equipo humano no atiende (horario: ${CONFIG.horarioHumano}).\n`;
  if (fotoDesc) contexto += `FOTO DEL CLIENTE (descrita por visión, puede tener errores): ${fotoDesc}\n`;
  if (previo && previo.ultimo) contexto += `TU MENSAJE ANTERIOR: ${previo.ultimo}\n`;
}
if (chatId != null) {
  const c = memo.chats[chatId] || {};
  if (lugarNuevo && lat != null) Object.assign(c, { ciudad, lat, lng });
  c.ultimo = respuesta ? respuesta.replace(/\s+/g, ' ').slice(0, 220) : c.ultimo;
  if (tiendaSel) c.tienda = tiendaSel.nombre; else if (lugarNuevo) delete c.tienda;
  c.ts = hoyMs;
  if (TIENDA && derivar) c.pausaHasta = hoyMs + CONFIG.pausaHoras * 36e5;
  memo.chats[chatId] = c;
}

return [{ json: { chatId, texto, intencion, atajo: !!respuesta, respuesta, derivar, ciudad, contexto } }];
