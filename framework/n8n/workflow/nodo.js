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
const LUGARES = [["Guayaquil","gye|guayaquil|guayas|gayakil|guayakil|gquil|guayaco|la perla del pacifico","Guayaquil","Guayas",-2.1894,-79.8891],["Mall del Sol","mall del sol|malldelsol","Guayaquil","Guayas",-2.1544,-79.893],["Urdesa","urdesa|urdesa central","Guayaquil","Guayas",-2.165,-79.905],["Alborada","alborada|la alborada","Guayaquil","Guayas",-2.135,-79.9],["Kennedy","kennedy|policentro|san marino","Guayaquil","Guayas",-2.17,-79.899],["Los Ceibos","ceibos|los ceibos|riocentro ceibos","Guayaquil","Guayas",-2.172,-79.945],["San Eduardo","san eduardo|la vista san eduardo|edificio 100","Guayaquil","Guayas",-2.1745,-79.933],["Vía a la Costa","via a la costa|puerto azul|laguna plaza|chongon","Guayaquil","Guayas",-2.187,-80.006],["Sur de Guayaquil","sur de guayaquil|mall del sur|guasmo|25 de julio","Guayaquil","Guayas",-2.229,-79.896],["Centro de Guayaquil","centro de guayaquil|malecon 2000|9 de octubre|centro guayaquil","Guayaquil","Guayas",-2.1894,-79.885],["Samborondón","samborondon|la puntilla|entreplaza","Samborondón","Guayas",-2.14,-79.865],["Durán","duran","Durán","Guayas",-2.17,-79.838],["Daule","daule|la aurora","Daule","Guayas",-1.86,-79.977],["Milagro","milagro","Milagro","Guayas",-2.1347,-79.5872],["Playas","playas|general villamil","Playas","Guayas",-2.63,-80.39],["Quito","uio|quito|pichincha|kito|qito|la capital|capital|quitu","Quito","Pichincha",-0.1807,-78.4678],["Centro Histórico de Quito","centro historico|plaza grande","Quito","Pichincha",-0.22,-78.512],["La Carolina","la carolina|quicentro|parque la carolina|naciones unidas|inaquito|cci|centro comercial inaquito","Quito","Pichincha",-0.176,-78.48],["El Condado","condado|el condado|carcelen","Quito","Pichincha",-0.105,-78.49],["Cumbayá","cumbaya|tumbaco","Quito","Pichincha",-0.2,-78.433],["Quitumbe","quitumbe|sur de quito|el recreo|quicentro sur","Quito","Pichincha",-0.295,-78.55],["Valle de los Chillos","los chillos|valle de los chillos|sangolqui|san rafael","Sangolquí","Pichincha",-0.329,-78.445],["Cayambe","cayambe","Cayambe","Pichincha",0.041,-78.145],["Cuenca","cuenca|azuay|cuenka","Cuenca","Azuay",-2.9001,-79.0059],["Mall del Río","mall del rio","Cuenca","Azuay",-2.92,-79.014],["Gualaceo","gualaceo","Gualaceo","Azuay",-2.892,-78.776],["Ambato","ambato|tungurahua|anbato","Ambato","Tungurahua",-1.2491,-78.6168],["Baños","banos|banos de agua santa","Baños","Tungurahua",-1.396,-78.424],["Riobamba","riobamba|chimborazo|rio bamba|riobanba","Riobamba","Chimborazo",-1.671,-78.647],["Latacunga","latacunga|cotopaxi","Latacunga","Cotopaxi",-0.935,-78.615],["Ibarra","ibarra|imbabura","Ibarra","Imbabura",0.351,-78.122],["Otavalo","otavalo","Otavalo","Imbabura",0.234,-78.262],["Tulcán","tulcan|carchi","Tulcán","Carchi",0.812,-77.717],["Loja","loja","Loja","Loja",-3.993,-79.204],["Machala","machala|el oro","Machala","El Oro",-3.258,-79.955],["Huaquillas","huaquillas","Huaquillas","El Oro",-3.476,-80.231],["Portoviejo","portoviejo|manabi|porto viejo","Portoviejo","Manabí",-1.0546,-80.4545],["Manta","manta","Manta","Manabí",-0.9677,-80.7089],["Chone","chone","Chone","Manabí",-0.698,-80.094],["Esmeraldas","esmeraldas|esmeralda","Esmeraldas","Esmeraldas",0.9682,-79.6517],["Atacames","atacames","Atacames","Esmeraldas",0.87,-79.846],["Santo Domingo","santo domingo|santo domingo de los tsachilas|sto domingo|sto. domingo|santo domingo de los colorados","Santo Domingo","Santo Domingo de los Tsáchilas",-0.253,-79.175],["Babahoyo","babahoyo|los rios","Babahoyo","Los Ríos",-1.8022,-79.5344],["Quevedo","quevedo","Quevedo","Los Ríos",-1.0286,-79.4635],["Salinas","salinas","Salinas","Santa Elena",-2.215,-80.952],["Santa Elena","santa elena","Santa Elena","Santa Elena",-2.226,-80.858],["Montañita","montanita","Montañita","Santa Elena",-1.827,-80.753],["Azogues","azogues|canar","Azogues","Cañar",-2.739,-78.846],["Tena","tena|napo","Tena","Napo",-0.9938,-77.8129],["Puyo","puyo|pastaza","Puyo","Pastaza",-1.4924,-78.0024],["Nueva Loja","nueva loja|lago agrio|sucumbios|lagoagrio","Nueva Loja","Sucumbíos",0.0847,-76.8828],["Guaranda","guaranda|bolivar","Guaranda","Bolívar",-1.5926,-79.001],["Macas","macas|morona santiago|morona","Macas","Morona Santiago",-2.3087,-78.1114],["Zamora","zamora|zamora chinchipe","Zamora","Zamora Chinchipe",-4.0692,-78.9567],["Coca","coca|el coca|puerto francisco de orellana|orellana","Puerto Francisco de Orellana","Orellana",-0.4625,-76.987],["Puerto Ayora","puerto ayora|santa cruz|galapagos|isla santa cruz","Puerto Ayora","Galápagos",-0.743,-90.315],["Puerto Baquerizo Moreno","san cristobal|puerto baquerizo","Puerto Baquerizo Moreno","Galápagos",-0.902,-89.61],["La Mariscal","la mariscal|mariscal|plaza foch|la foch","Quito","Pichincha",-0.203,-78.491],["La Floresta","la floresta|floresta|gonzalez suarez","Quito","Pichincha",-0.211,-78.485],["Sauces / Garzota","sauces|la garzota|garzota|samanes|los samanes","Guayaquil","Guayas",-2.125,-79.897],["Ciudad Celeste","ciudad celeste|via a samborondon km 10|via a samborondon","Samborondón","Guayas",-2.09,-79.858],["Vilcabamba","vilcabamba","Vilcabamba","Loja",-4.26,-79.222],["Puerto López","puerto lopez","Puerto López","Manabí",-1.56,-80.81],["Pedernales","pedernales","Pedernales","Manabí",0.071,-80.052],["Jipijapa","jipijapa","Jipijapa","Manabí",-1.348,-80.579],["Pasaje","pasaje","Pasaje","El Oro",-3.33,-79.807],["Santa Rosa","santa rosa","Santa Rosa","El Oro",-3.449,-79.96],["Salcedo","salcedo","Salcedo","Cotopaxi",-1.045,-78.59],["Alausí","alausi","Alausí","Chimborazo",-2.2,-78.847],["Cañar","ciudad de canar","Cañar","Cañar",-2.56,-78.938],["Yantzaza","yantzaza","Yantzaza","Zamora Chinchipe",-3.827,-78.759],["Sucúa","sucua","Sucúa","Morona Santiago",-2.46,-78.17],["Shushufindi","shushufindi","Shushufindi","Sucumbíos",-0.186,-76.647],["El Carmen","el carmen","El Carmen","Manabí",-0.27,-79.456],["La Concordia","la concordia","La Concordia","Santo Domingo de los Tsáchilas",0.006,-79.396],["Nobol","nobol|narcisa de jesus","Nobol","Guayas",-1.914,-80.004],["Machachi","machachi|mejia","Machachi","Pichincha",-0.51,-78.567],["Pelileo","pelileo|san pedro de pelileo","Pelileo","Tungurahua",-1.33,-78.543],["Cuyabeno","cuyabeno|santa rosa de cuyabeno|tarapoa","Cuyabeno","Sucumbíos",-0.12,-76.34],["Norte de Guayaquil","mall del norte|riocentro norte|world trade center|wtc|city mall|av francisco de orellana","Guayaquil","Guayas",-2.1395,-79.8955],["Albán Borja","alban borja|av carlos julio arosemena","Guayaquil","Guayas",-2.1687,-79.9166],["Carapungo / El Portal","carapungo|el portal|panamericana norte","Quito","Pichincha",-0.1005,-78.4555],["Los Granados","granados|los granados|granados plaza","Quito","Pichincha",-0.1655,-78.4655],["Villa Club","villa club|riocentro el dorado|el dorado","Daule","Guayas",-2.0505,-79.9035],["La Libertad","la libertad","La Libertad","Santa Elena",-2.2314,-80.9008],["Cariamanga","cariamanga","Cariamanga","Loja",-4.3297,-79.5555],["Macará","macara","Macará","Loja",-4.3814,-79.9437]];

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

const FRAG = [["posca que es marcador pintura acrilica agua opaca superficies permanente","POSCA = marcador de pintura acrílica al agua, opaca, mate y sin olor. Pinta papel, cartón, madera, tela, vidrio, metal, plástico, cerámica, piedra, lienzo y cuero. Seca rápido y se pinta capa sobre capa. Permanente en superficies porosas; en vidrio, metal o plástico se puede quitar si no se sella."],["posca puntas modelos grosor mm pc 1mr pc 1m pc 3m pc 5m pc 7m pc 8k pc 17k pcf 350","PC-1MR 0,7 mm calibrada (detalles mínimos) · PC-1M 0,7 mm (contornos) · PC-3M 0,9–1,3 mm (dibujo general) · PC-5M 1,8–2,5 mm (todo terreno, más colores) · PC-7M 4,5–5,5 mm (rellenos) · PC-8K 8 mm biselada (áreas grandes) · PC-17K 15–17 mm (murales) · PCF-350 pincel. Kit de inicio: PC-1M + PC-3M + PC-5M."],["posca como usar agitar cebar no sale pintura seca","Agitar con la tapa puesta ~10 s hasta oír la bolita; presionar la punta en un papel hasta que baje la pintura (sin exagerar). Capas finas, dejar secar entre capas. Guardar tapada y horizontal. Si llegó seca o con la punta dañada → reclamo."],["zapatillas tenis sneakers custom cuero lona posca sellar barniz no se borre","Zapatillas: PC-1M o PC-3M para contornos y PC-5M para rellenar. Cuero: limpiar/desengrasar antes. Al final barniz acrílico al agua en capas finas; probar antes en una zona escondida (algunos selladores disuelven la pintura)."],["taza ceramica porcelana lavavajillas hornear decorativa alimentos","Taza: PC-1M o PC-3M por fuera, lejos del borde donde va la boca. Hornear según el folleto POSCA (porcelana ~160 °C, 45 min) y barnizar. Queda decorativa: lavar a mano, no lavavajillas, no apta para alimentos."],["ropa tela camiseta tote bag lavar planchar","Tela: PC-3M o PC-5M con un cartón dentro de la prenda. Planchar por el reverso sin vapor. Lavar al revés en ciclo suave; el color baja tras muchos lavados y se puede retocar."],["vidrio ventana espejo metal plastico vitrina mampara mamparas borrar quitar","Vidrio, metal o plástico: PC-5M o PC-8K. Sin sellar se puede limpiar; para que dure, barniz en spray transparente a ~30 cm en capas finas."],["mural pared grande cartel letrero vitrina mampara mamparas grueso gruesa gruesos gruesas punta mas gruesa","Áreas grandes: PC-8K (8 mm) y PC-17K (15–17 mm); PC-5M para detalles. Si es exterior, barnizar."],["rocas piedras lienzo cuadro madera tablas surf","Rocas: PC-3M/PC-5M, PC-1M para puntillismo. Lienzo o madera: PC-8K para fondos, PC-5M y PC-1M para detalles. Si va a la intemperie, barniz al final."],["lettering caligrafia bullet journal letras","Lettering: PC-1MR o PC-1M para letras finas, PC-3M para trazos marcados, PCF-350 pincel para caligrafía. Tinta negra en papel: uni-ball PIN."],["posca vs alcohol copic marcadores alcohol diferencia","POSCA cubre (opaca), pinta sobre cualquier superficie y no traspasa el papel. Los marcadores de alcohol son tinta transparente para degradados suaves en papel. Cubrir/cualquier superficie → POSCA; degradados en papel → alcohol."],["otras marcas no distribuimos copic molotow sharpie faber castell pilot acuarelas alternativa","No las manejamos. Alternativas uni-ball: marcador de pintura (Molotow, Sharpie Paint) → POSCA · marcador de alcohol (Copic) → POSCA PC-3M/PC-5M o uni-ball PIN · acuarelas → uni-ball PIN para entintar antes · bolígrafo de gel → Signo. Nunca hablar mal de otra marca."],["ninos seguridad toxico","POSCA es a base de agua y sin olor. Niños: con supervisión de un adulto, sin llevarlos a la boca. No afirmar \"no tóxico\" ni certificaciones (por confirmar con la ficha local)."],["uni pin unipin fineliner estilografo tinta acuarela dibujo tecnico ilustracion pin200 200 brush pincel chisel biselado","uni-ball PIN (PIN-200): fineliner calibrado de tinta pigmentada, resistente al agua y a la luz; no mancha al secar. Grosores 0.03 a 1.2 mm, punta pincel (Brush, PINBR-500EF) y biselada (Chisel CS1/CS2/CS3). Ideal para dibujo técnico, ilustración y entintar antes de acuarela."],["pin03 fineliner colores apuntes subrayar 100","uni-ball PIN03-100: fineliner de 0.3 mm en varios colores, tinta resistente al agua y a la luz, con grip de goma. Bueno para apuntes y esquemas."],["signo gel boligrafo esfero 120 colores dibujo manualidades","uni-ball Signo UM-120: roller de gel con tinta pigmentada resistente al agua y a la luz. 0.5 mm (negro, azul, rojo) y 0.7 mm (8 colores: negro, azul, rojo, naranja, verde, celeste, violeta, rosado). Para escribir, dibujar y manualidades."],["signo pastel metalico metalicos brillo brillos glitter escarchado opaco papel negro oscuro fondo oscuro blanco 120ac 120nm 120sp 153 impact negra hoja cartulina","Para papel negro u oscuro: Signo UM-120AC pastel (0.7 mm) y UM-120NM metálicos (0.8 mm), tinta opaca; UM-120SP con brillos (1.0 mm); Signo Broad/Impact UM-153 y UM-153S (1.0 mm, trazo grueso e intenso). Todos con tinta pigmentada resistente al agua y a la luz."],["signo retractil 207 307 rt rt1 155 138 105 firma documentos cheques seguro tinta","Signo retráctiles: Signo 207 (UMN-207, 0.5/0.7/1.0 mm, tinta Super Ink resistente al agua y al tiempo, buena para documentos), Signo 307 (UMN-307, 0.7 mm, trazo limpio incluso en papel laminado), Signo RT1 (UMN-155N, 0.7 mm) y Signo RT (UMN-138 0.38 mm / UMN-105 0.5 mm)."],["signo dx 151 ultra micro fino 038 agenda diario detalle","Signo DX UM-151: gel ultra micro 0.38 mm, tinta resistente al agua y a la luz, colores vibrantes; ideal para agendas, diarios y detalles."],["one negro intenso zento minimalista sf sp zsc","uni-ball ONE (UMN-SF-05 / UMN-SP-05, 0.5 mm): tinta negra más intensa que los geles tradicionales, cuerpos pastel. uni-ball ZENTO (UBN-ZSC-07, 0.7 mm): retráctil de diseño minimalista, tinta azul, cuerpos Ivory, Fog, Linen, Lavender, Adobe y Coastal. Repuesto: UMR-05S."],["borrable borra friccion se borra 181 tinta borrable","uni-ball borrable URN-181-07 (0.7 mm): gel de tinta borrable; se borra frotando con la parte trasera del bolígrafo."],["eye roller tinta liquida 150 157 micro ultra fino broad firma","uni-ball Eye: roller de tinta líquida pigmentada resistente al agua y a la luz, con ventana para ver la tinta. UB-150 en 0.38 (ultra micro), 0.5 (micro) y 1.0 mm (broad); Eye Fine UB-157 en 0.7 mm con más colores. UB-104 (0.5 mm) es el clásico de trazo fino."],["vision elite viaje avion fuga 200 205 188 pluma estilografica firma antifraude","uni-ball Vision Elite (UB-205 0.5 mm / UB-200 0.8 mm): roller que no se derrama en el avión (Airplane Safe), tinta pigmentada resistente al agua; repuestos UBR-95 y UBR-90. Para firmas: UBA-188 (0.5/0.7 mm), trazo tipo pluma con tinta antifraude."],["jetstream zurdo zurdos no se corre no mancha secado rapido 101 210 esfero","Jetstream: tinta híbrida de secado rápido que no se corre; ideal para zurdos. SXN-101 en 0.5 y 0.7 mm y SXN-210 en 1.0 mm, con grip de goma."],["boligrafo esfero economico diario sn 100 220 power tank boca arriba papel mojado frio","Bolígrafos uni-ball: SN-100 retráctil de escritura suave (0.5, 0.7, 1.0 y 1.4 mm) con grip de goma. SN-220 (1.0 mm) con tinta presurizada: escribe boca arriba, sobre papel húmedo y hasta –20 °C."],["gelstick 170 xsg r7 escolar colegio gel economico","Gel para el día a día: Signo Gelstick UM-170 (capuchón con clip, grip antideslizante) y XSG-R7-07 retráctil de 0.7 mm con grip de goma, tinta pigmentada resistente al agua y a la luz; buenos para colegio y oficina."],["kuru toga kurutoga portaminas lapiz mina arquitectura dibujo afilada 450 559","Kuru Toga: portaminas cuyo engranaje gira la mina para mantenerla siempre afilada. M3-450 (0.3 mm), M5-450T (0.5 mm, cuerpo negro o smoke) y M5-559 (0.5 mm). Minas de repuesto: UL-1403 0.3 HB, UL-SS-05 0.5 HB/2B, UL-SS-07 0.7 HB."],["portaminas economico estudiantes escolar 100 228 pastel borrador minas repuesto","Portaminas uni-ball de diario: M5-100 (0.5 mm, cuerpos negro, azul, verde, rosado, celeste y pasteles), M7-100 (0.7 mm), M5-228/M7-228 con grip, botón lateral y borrador grande. Minas: UL-SS-05 (0.5 HB/2B), UL-SS-07 (0.7 HB), UL-1403 (0.3 HB)."],["borrador corrector liquido corrector lapiz ek 100 clp 300","Borrador tipo lápiz EK-100 (rollo de papel, 175 mm) y corrector tipo pluma CLP-300N con punta metálica de precisión y secado rápido."],["uni chalk tiza liquida pwe vidrio vitrina mampara ventana pizarra negra borrable blanco","uni-ball Chalk (tiza líquida): PWE-5M (1.8–2.5 mm) y PWE-8K (8 mm). Tinta opaca para vidrio, plástico y metal; resiste el clima y se limpia con un paño húmedo. Ideal para vitrinas y mamparas."],["pizarra pizarron pizarra blanca tiza borrable pwb 50","Marcador de pizarra blanca uni-ball PWB-50K (punta biselada, 1.0–5.0 mm) y PWB-50M (1.8–2.2 mm): tinta brillante de fácil borrado, sin xileno ni tolueno."],["unipaint paint marcador pintura aceite permanente metal superficies rugosas exterior calor px 20 21 30 203 llantas","uni-ball PAINT (Unipaint), base aceite, permanente en todas las superficies, resiste agua, luz y hasta 250 °C: PX-203 extra fino (1 mm), PX-21 fino (0.8–1.2 mm), PX-20 medio (2.2–2.8 mm), PX-30 grueso (4.0–8.5 mm). Tiene olor: usar en lugar ventilado. POSCA es la opción al agua y sin olor."],["permanente marcador permanente rotulador cajas carton plastico cd tela pna 125 155 380","Marcadores permanentes base aceite: PNA-125 (punta bala 0.9 mm) y PNA-155T (doble punta 0.4/0.9 mm) para vidrio, plástico, cartón, cerámica y tela; No.380B (punta biselada 1–5 mm), sin xileno."]];
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
