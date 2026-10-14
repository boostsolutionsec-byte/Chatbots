/** minúsculas, sin tildes, sin signos; ñ → n. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function tokens(s: string): string[] {
  const n = normalize(s);
  return n ? n.split(' ') : [];
}

/** Distancia de Damerau-Levenshtein (transposiciones adyacentes). */
export function editDistance(a: string, b: string, max = Infinity): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) d[i][0] = i;
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      rowMin = Math.min(rowMin, d[i][j]);
    }
    if (rowMin > max) return max + 1;
  }
  return d[a.length][b.length];
}

/** Distancia en km entre dos puntos (fórmula de haversine). */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Palabras comunes del español de chat que nunca deben "corregirse" a un lugar
 * (p. ej. "quiero" ≠ Quero, "mira" ≠ Mira salvo con "en/de").
 */
export const STOPWORDS = new Set(
  `a al algo alguna alguno algun ahi aqui alla asi bien bueno buenas buenos buen como con cual cuales cuando cuanto cuesta
  de del desde donde dond dnd dime el ella ellos en entre es esa ese eso esta estan estas este esto estoy hay hola holi
  holaa ola la las le les lo los mas me mi mis mucho muy no nos o para pero por porfa porfavor favor que q quiero quisiera
  quero kiero se si sin sobre soy su sus tambien te tengo tiene tienen tienes tu un una uno unos unas usted ustedes vivo
  vendo venden vende y ya yo gracias ok okey dale listo compro comprar consigo conseguir encuentro encontrar tienda tiendas
  local locales punto puntos venta ventas cerca cercano cercana mas marcador marcadores lapiz lapices esfero esferos pluma
  plumas color colores pintura pinturas precio precios cuanto vale valen ciudad sector provincia zona barrio casa trabajo
  ayuda ayudame necesito busco buscando queria quieria saber info informacion mira mire oye disculpa perdon tal vez talvez
  hijo hija mama papa amigo amiga estudiante colegio escuela universidad clase clases regalo regalar arte artista dibujo
  dibujar pintar papel tela vidrio madera zapatos zapatillas taza tazas piedra piedras lienzo pared
  bazar papeleria papelerias libreria librerias negocio empresa unidad educativa escuela senor senora senorita lcda lic
  ingeniero doctor nombre llamo llama mio mia aqui alla sale salen brilla brillan tiktok instagram whatsapp facebook
  envio envios enviar demora cuesta cuestan valor gracias muchas buenos buenas tardes noches dias porfa plis please`.split(/\s+/).filter(Boolean),
);

/** Nombres de lugar que también son palabras comunes: solo cuentan con una pista de ubicación delante. */
export const WEAK_PLACE_KEYS = new Set([
  'mira', 'quero', 'baba', 'mocha', 'shell', 'mera', 'bahia', 'capital', 'playas', 'valencia', 'palestina', 'loreto',
  'santa ana', 'el valle', 'la perla', 'el pan', 'sacha', 'ona', 'el carmen', 'el tambo', 'santa clara', 'la joya',
  'condado', 'scala', 'cci', 'junin', 'limones', 'guano', 'mejia', 'espejo', 'bolivar', 'sucre', 'olmedo', 'calvas',
]);

export const LOCATION_CUES = new Set(['en', 'de', 'desde', 'del', 'por', 'vivo', 'estoy', 'soy', 'cerca', 'sector', 'ciudad', 'a']);
