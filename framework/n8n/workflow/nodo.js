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
const tiendas = $input.all().map(i => i.json).filter(t => t.nombre && t.lat !== '' && t.lat != null && t.tienda_id !== 'mokalu-laguna-plaza'); // fila vieja: borrarla de la tabla
const MOK = tiendas.find(x => x.tienda_id === 'mokalu-guayaquil');
const waMok = MOK && MOK.whatsapp ? ` Escríbenos directo al WhatsApp de Mokalú 📲 ${MOK.whatsapp}` : '';

const CONFIG = {
  nombreBot: 'Sofi',
  horarioHumano: 'lunes a viernes de 9h00 a 17h30',
  webTienda: 'https://mokalu.com.ec/tienda/',
  lejosKm: 60,
};
// [nombre, alias|alias, ciudad, provincia, lat, lng] — fuente: framework/n8n/lugares.json
const LUGARES = [["Guayaquil","gye|guayaquil|guayas|gayakil|guayakil|gquil|guayaco|la perla del pacifico","Guayaquil","Guayas",-2.1894,-79.8891],["Mall del Sol","mall del sol|malldelsol","Guayaquil","Guayas",-2.1544,-79.893],["Urdesa","urdesa|urdesa central","Guayaquil","Guayas",-2.165,-79.905],["Alborada","alborada|la alborada","Guayaquil","Guayas",-2.135,-79.9],["Kennedy","kennedy|policentro|san marino","Guayaquil","Guayas",-2.17,-79.899],["Los Ceibos","ceibos|los ceibos|riocentro ceibos","Guayaquil","Guayas",-2.172,-79.945],["San Eduardo","san eduardo|av del bombero|avenida del bombero|av bombero|via al bombero|edificio 100","Guayaquil","Guayas",-2.1745,-79.933],["Vía a la Costa","via a la costa|puerto azul|laguna plaza|chongon","Guayaquil","Guayas",-2.187,-80.006],["Sur de Guayaquil","sur de guayaquil|mall del sur|guasmo|25 de julio","Guayaquil","Guayas",-2.229,-79.896],["Centro de Guayaquil","centro de guayaquil|malecon 2000|9 de octubre|centro guayaquil","Guayaquil","Guayas",-2.1894,-79.885],["Samborondón","samborondon|la puntilla|entreplaza","Samborondón","Guayas",-2.14,-79.865],["Durán","duran","Durán","Guayas",-2.17,-79.838],["Daule","daule|la aurora","Daule","Guayas",-1.86,-79.977],["Milagro","milagro","Milagro","Guayas",-2.1347,-79.5872],["Playas","playas|general villamil","Playas","Guayas",-2.63,-80.39],["Quito","uio|quito|pichincha|kito|qito|la capital|capital|quitu","Quito","Pichincha",-0.1807,-78.4678],["Centro Histórico de Quito","centro historico|plaza grande","Quito","Pichincha",-0.22,-78.512],["La Carolina","la carolina|quicentro|parque la carolina|naciones unidas","Quito","Pichincha",-0.176,-78.48],["El Condado","condado|el condado|carcelen","Quito","Pichincha",-0.105,-78.49],["Cumbayá","cumbaya|tumbaco","Quito","Pichincha",-0.2,-78.433],["Quitumbe","quitumbe|sur de quito|el recreo","Quito","Pichincha",-0.295,-78.55],["Valle de los Chillos","los chillos|valle de los chillos|sangolqui|san rafael","Sangolquí","Pichincha",-0.329,-78.445],["Cayambe","cayambe","Cayambe","Pichincha",0.041,-78.145],["Cuenca","cuenca|azuay|cuenka","Cuenca","Azuay",-2.9001,-79.0059],["Mall del Río","mall del rio","Cuenca","Azuay",-2.92,-79.014],["Gualaceo","gualaceo","Gualaceo","Azuay",-2.892,-78.776],["Ambato","ambato|tungurahua|anbato","Ambato","Tungurahua",-1.2491,-78.6168],["Baños","banos|banos de agua santa","Baños","Tungurahua",-1.396,-78.424],["Riobamba","riobamba|chimborazo|rio bamba|riobanba","Riobamba","Chimborazo",-1.671,-78.647],["Latacunga","latacunga|cotopaxi","Latacunga","Cotopaxi",-0.935,-78.615],["Ibarra","ibarra|imbabura","Ibarra","Imbabura",0.351,-78.122],["Otavalo","otavalo","Otavalo","Imbabura",0.234,-78.262],["Tulcán","tulcan|carchi","Tulcán","Carchi",0.812,-77.717],["Loja","loja","Loja","Loja",-3.993,-79.204],["Machala","machala|el oro","Machala","El Oro",-3.258,-79.955],["Huaquillas","huaquillas","Huaquillas","El Oro",-3.476,-80.231],["Portoviejo","portoviejo|manabi|porto viejo","Portoviejo","Manabí",-1.0546,-80.4545],["Manta","manta","Manta","Manabí",-0.9677,-80.7089],["Chone","chone","Chone","Manabí",-0.698,-80.094],["Esmeraldas","esmeraldas|esmeralda","Esmeraldas","Esmeraldas",0.9682,-79.6517],["Atacames","atacames","Atacames","Esmeraldas",0.87,-79.846],["Santo Domingo","santo domingo|santo domingo de los tsachilas|sto domingo|sto. domingo|santo domingo de los colorados","Santo Domingo","Santo Domingo de los Tsáchilas",-0.253,-79.175],["Babahoyo","babahoyo|los rios","Babahoyo","Los Ríos",-1.8022,-79.5344],["Quevedo","quevedo","Quevedo","Los Ríos",-1.0286,-79.4635],["Salinas","salinas","Salinas","Santa Elena",-2.215,-80.952],["Santa Elena","santa elena|la libertad","Santa Elena","Santa Elena",-2.226,-80.858],["Montañita","montanita","Montañita","Santa Elena",-1.827,-80.753],["Azogues","azogues|canar","Azogues","Cañar",-2.739,-78.846],["Tena","tena|napo","Tena","Napo",-0.9938,-77.8129],["Puyo","puyo|pastaza","Puyo","Pastaza",-1.4924,-78.0024],["Nueva Loja","nueva loja|lago agrio|sucumbios|lagoagrio","Nueva Loja","Sucumbíos",0.0847,-76.8828],["Guaranda","guaranda|bolivar","Guaranda","Bolívar",-1.5926,-79.001],["Macas","macas|morona santiago|morona","Macas","Morona Santiago",-2.3087,-78.1114],["Zamora","zamora|zamora chinchipe","Zamora","Zamora Chinchipe",-4.0692,-78.9567],["Coca","coca|el coca|puerto francisco de orellana|orellana","Puerto Francisco de Orellana","Orellana",-0.4625,-76.987],["Puerto Ayora","puerto ayora|santa cruz|galapagos|isla santa cruz","Puerto Ayora","Galápagos",-0.743,-90.315],["Puerto Baquerizo Moreno","san cristobal|puerto baquerizo","Puerto Baquerizo Moreno","Galápagos",-0.902,-89.61],["La Mariscal","la mariscal|mariscal|plaza foch|la foch","Quito","Pichincha",-0.203,-78.491],["La Floresta","la floresta|floresta|gonzalez suarez","Quito","Pichincha",-0.211,-78.485],["Sauces / Garzota","sauces|la garzota|garzota|samanes|los samanes","Guayaquil","Guayas",-2.125,-79.897],["Ciudad Celeste","ciudad celeste|via a samborondon km 10|via a samborondon","Samborondón","Guayas",-2.09,-79.858],["Vilcabamba","vilcabamba","Vilcabamba","Loja",-4.26,-79.222],["Puerto López","puerto lopez","Puerto López","Manabí",-1.56,-80.81],["Pedernales","pedernales","Pedernales","Manabí",0.071,-80.052],["Jipijapa","jipijapa","Jipijapa","Manabí",-1.348,-80.579],["Pasaje","pasaje","Pasaje","El Oro",-3.33,-79.807],["Santa Rosa","santa rosa","Santa Rosa","El Oro",-3.449,-79.96],["Salcedo","salcedo","Salcedo","Cotopaxi",-1.045,-78.59],["Alausí","alausi","Alausí","Chimborazo",-2.2,-78.847],["Cañar","ciudad de canar","Cañar","Cañar",-2.56,-78.938],["Yantzaza","yantzaza","Yantzaza","Zamora Chinchipe",-3.827,-78.759],["Sucúa","sucua","Sucúa","Morona Santiago",-2.46,-78.17],["Shushufindi","shushufindi","Shushufindi","Sucumbíos",-0.186,-76.647],["El Carmen","el carmen","El Carmen","Manabí",-0.27,-79.456],["La Concordia","la concordia","La Concordia","Santo Domingo de los Tsáchilas",0.006,-79.396],["Nobol","nobol|narcisa de jesus","Nobol","Guayas",-1.914,-80.004],["Machachi","machachi|mejia","Machachi","Pichincha",-0.51,-78.567],["Pelileo","pelileo|san pedro de pelileo","Pelileo","Tungurahua",-1.33,-78.543],["Cuyabeno","cuyabeno|santa rosa de cuyabeno|tarapoa","Cuyabeno","Sucumbíos",-0.12,-76.34]];

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
  for (const l of LUGARES) for (const a of [norm(l[0]), ...l[1].split('|')]) if (a && t.includes(' ' + a + ' ')) hits.push({ l, n: a.length, sector: l[0] !== l[2] });
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

const FRAG = [["posca que es marcador pintura acrilica agua opaca superficies permanente","POSCA = marcador de pintura acrílica al agua, opaca, mate y sin olor. Pinta papel, cartón, madera, tela, vidrio, metal, plástico, cerámica, piedra, lienzo y cuero. Seca rápido y se pinta capa sobre capa. Permanente en superficies porosas; en vidrio, metal o plástico se puede quitar si no se sella."],["posca puntas modelos grosor mm pc 1mr pc 1m pc 3m pc 5m pc 7m pc 8k pc 17k pcf 350","PC-1MR 0,7 mm calibrada (detalles mínimos) · PC-1M 0,7 mm (contornos) · PC-3M 0,9–1,3 mm (dibujo general) · PC-5M 1,8–2,5 mm (todo terreno, más colores) · PC-7M 4,5–5,5 mm (rellenos) · PC-8K 8 mm biselada (áreas grandes) · PC-17K 15–17 mm (murales) · PCF-350 pincel. Kit de inicio: PC-1M + PC-3M + PC-5M."],["posca como usar agitar cebar no sale pintura seca","Agitar con la tapa puesta ~10 s hasta oír la bolita; presionar la punta en un papel hasta que baje la pintura (sin exagerar). Capas finas, dejar secar entre capas. Guardar tapada y horizontal. Si llegó seca o con la punta dañada → reclamo."],["zapatillas tenis sneakers custom cuero lona posca sellar barniz no se borre","Zapatillas: PC-1M o PC-3M para contornos y PC-5M para rellenar. Cuero: limpiar/desengrasar antes. Al final barniz acrílico al agua en capas finas; probar antes en una zona escondida (algunos selladores disuelven la pintura)."],["taza ceramica porcelana lavavajillas hornear decorativa alimentos","Taza: PC-1M o PC-3M por fuera, lejos del borde donde va la boca. Hornear según el folleto POSCA (porcelana ~160 °C, 45 min) y barnizar. Queda decorativa: lavar a mano, no lavavajillas, no apta para alimentos."],["ropa tela camiseta tote bag lavar planchar","Tela: PC-3M o PC-5M con un cartón dentro de la prenda. Planchar por el reverso sin vapor. Lavar al revés en ciclo suave; el color baja tras muchos lavados y se puede retocar."],["vidrio ventana espejo metal plastico vitrina","Vidrio, metal o plástico: PC-5M o PC-8K. Sin sellar se puede limpiar; para que dure, barniz en spray transparente a ~30 cm en capas finas."],["mural pared grande cartel letrero vitrina","Áreas grandes: PC-8K (8 mm) y PC-17K (15–17 mm); PC-5M para detalles. Si es exterior, barnizar."],["rocas piedras lienzo cuadro madera tablas surf","Rocas: PC-3M/PC-5M, PC-1M para puntillismo. Lienzo o madera: PC-8K para fondos, PC-5M y PC-1M para detalles. Si va a la intemperie, barniz al final."],["lettering caligrafia bullet journal letras","Lettering: PC-1MR o PC-1M para letras finas, PC-3M para trazos marcados, PCF-350 pincel para caligrafía. Tinta negra en papel: uni PIN."],["posca vs alcohol copic marcadores alcohol diferencia","POSCA cubre (opaca), pinta sobre cualquier superficie y no traspasa el papel. Los marcadores de alcohol son tinta transparente para degradados suaves en papel. Cubrir/cualquier superficie → POSCA; degradados en papel → alcohol."],["otras marcas no distribuimos copic molotow sharpie faber castell pilot acuarelas alternativa","No las manejamos. Alternativas uni: marcador de pintura (Molotow, Sharpie Paint) → POSCA · marcador de alcohol (Copic) → POSCA PC-3M/PC-5M o uni PIN · acuarelas → uni PIN para entintar antes · bolígrafo de gel → Signo. Nunca hablar mal de otra marca."],["uni pin estilografo fineliner tinta acuarela dibujo tecnico","uni PIN: tinta pigmentada resistente al agua al secar, para entintar antes de acuarela y dibujo técnico. Tamaños 005 a 08 y brush."],["signo gel boligrafo esfero blanco brillos","uni-ball Signo: gel pigmentado, resistente al agua y a la decoloración (0,28–0,7 mm). La Signo blanca sirve para brillos sobre ilustraciones."],["jetstream zurdo esfero no se corre secado rapido","Jetstream (SX/SXN-101): tinta híbrida de secado rápido que no se corre; buena opción para zurdos. 0,5 / 0,7 / 1,0 mm."],["kuru toga portaminas lapiz mina arquitectura","Kuru Toga: portaminas que gira la mina al escribir para mantener la punta fina. Mina 0,3 o 0,5 mm."],["ninos seguridad toxico","POSCA es a base de agua y sin olor. Niños: con supervisión de un adulto, sin llevarlos a la boca. No afirmar \"no tóxico\" ni certificaciones (por confirmar con la ficha local)."]];
const pal = new Set(norm(texto).split(' ').filter(w => w.length > 3 && !['posca', 'poscas', 'marcador', 'marcadores'].includes(w))); // palabras demasiado comunes
const fragsUtiles = FRAG.map(f => ({ f, p: f[0].split(' ').filter(w => pal.has(w)).length })).filter(x => x.p > 0).sort((a, b) => b.p - a.p);
const preguntaProducto = fragsUtiles.length > 0 && !has(['donde', 'comprar', 'compro', 'consigo', 'conseguir', 'venden', 'adquirir', 'where', 'buy']);

// 2) Respuestas fijas, en orden de prioridad (bots/mokalu/plantillas-respuesta.md).
let respuesta = null, derivar = null, intencion = 'ia';
const pideDonde = has(['donde', 'comprar', 'compro', 'consigo', 'venden', 'tienda', 'local', 'conseguir', 'adquirir', 'establecimiento', 'where', 'buy', 'store']);
if (has(['reclamo', 'defectuoso', 'defectuosos', 'danado', 'danados', 'vino seco', 'vinieron secos', 'llego seco', 'esta seco', 'no sirve', 'no pinta', 'no pintan', 'no funciona', 'no funcionan', 'no sale', 'llego roto', 'llego mal', 'roto', 'rota', 'fallado', 'estafa', 'devolucion', 'devolver', 'garantia', 'queja'])) {
  intencion = 'reclamo'; derivar = 'reclamos';
  respuesta = `Lamento mucho lo que pasó 🙏 Te paso ahora con el equipo de Mokalú que ve reclamos para resolverlo directamente.${waMok}${aviso}`;
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
} else if (has(['precio', 'precios', 'cuanto cuesta', 'cuanto vale', 'valor', 'dolares']) && !cercanas.length) {
  intencion = 'precio';
  respuesta = 'El precio lo pone cada tienda, así que no te quiero dar un dato equivocado 🙏 Dime tu ciudad y te paso el WhatsApp de la tienda más cercana para que te lo confirmen.';
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
    respuesta = `En ${ciudad} aún no tenemos punto de venta 😕 Puedes pedir en la tienda online de Mokalú, con envíos a todo el país: ${CONFIG.webTienda}\nLa tienda física más cercana está en ${s.ciudad} (~${s.km} km): *${md(s.nombre)}*, 📲 ${md(s.whatsapp)}.`;
  }
} else if (has(['donde', 'consigo', 'conseguir', 'venden', 'local', 'tienda']) && !cercanas.length && !preguntaProducto) {
  intencion = 'pedir_ciudad';
  respuesta = '¡Claro! ¿En qué ciudad o sector estás? 📍 (también puedes enviarme tu ubicación) Así te paso la tienda más cercana.';
} else if (!msg.location && (!texto.trim() || !/[a-z]/.test(norm(texto)) || norm(texto).split(' ').every(w => ['hola', 'holi', 'holaa', 'ola', 'buenas', 'buenos', 'buen', 'dia', 'dias', 'tardes', 'noches', 'que', 'tal', 'saludos', 'estimados', 'estimado', 'senores', 'hi', 'hello', 'hey'].includes(w)))) {
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
