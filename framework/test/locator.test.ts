import { describe, expect, it } from 'vitest';
import { Gazetteer } from '../src/locator/gazetteer.js';
import { Locator } from '../src/locator/locator.js';
import { PROVINCES, PLACES } from '../src/locator/ecuador.js';
import { editDistance, haversineKm, normalize } from '../src/locator/normalize.js';
import type { Tienda } from '../src/types.js';

const g = new Gazetteer();

function t(id: string, ciudad: string, provincia: string, lat?: number, lng?: number, extra: Partial<Tienda> = {}): Tienda {
  return { id, nombre: `EJEMPLO Tienda ${id}`, ciudad, provincia, direccion: 'EJEMPLO Av. Siempre Viva', lat, lng, marcas: ['uni-ball', 'POSCA'], ...extra };
}

const TIENDAS: Tienda[] = [
  t('gye-centro', 'Guayaquil', 'Guayas', -2.192, -79.884),
  t('gye-norte', 'Guayaquil', 'Guayas', -2.150, -79.895),
  t('gye-costa', 'Guayaquil', 'Guayas', -2.188, -79.995, { vende_online: true }),
  t('uio-norte', 'Quito', 'Pichincha', -0.178, -78.484),
  t('uio-sur', 'Quito', 'Pichincha', -0.285, -78.545),
  t('cue-1', 'Cuenca', 'Azuay', -2.899, -79.005),
  t('rio-1', 'Riobamba', 'Chimborazo', -1.672, -78.648),
  t('amb-1', 'Ambato', 'Tungurahua', -1.249, -78.617),
  t('lat-1', 'Latacunga', 'Cotopaxi'), // sin coordenadas: usa las de la ciudad
  t('mch-1', 'Machala', 'El Oro', -3.258, -79.955),
  t('nl-1', 'Lago Agrio', 'Sucumbíos', 0.085, -76.883),
  t('sd-1', 'Santo Domingo', 'Santo Domingo de los Tsáchilas', -0.253, -79.175, { marcas: ['otra-marca'] }),
];

describe('normalize y utilidades', () => {
  it('quita tildes, signos y mayúsculas', () => {
    expect(normalize('¡Hola! ¿Dónde está RIOBAMBA, Ñuñoa?')).toBe('hola donde esta riobamba nunoa');
  });
  it('editDistance con transposición', () => {
    expect(editDistance('ambtao', 'ambato')).toBe(1);
    expect(editDistance('quito', 'quito')).toBe(0);
    expect(editDistance('riobanba', 'riobamba')).toBe(1);
  });
  it('haversine Quito–Guayaquil ≈ 270 km', () => {
    const d = haversineKm({ lat: -0.2299, lng: -78.525 }, { lat: -2.1962, lng: -79.8862 });
    expect(d).toBeGreaterThan(250);
    expect(d).toBeLessThan(290);
  });
});

describe('Gazetteer: las 24 provincias', () => {
  it('tiene 24 provincias, cada una con capital', () => {
    expect(PROVINCES).toHaveLength(24);
    for (const p of PROVINCES) {
      expect(PLACES.some((x) => x.province === p.code && x.kind === 'capital'), p.name).toBe(true);
    }
  });

  it.each(PROVINCES.map((p) => [p.name, p.code]))('reconoce la provincia %s', (name, code) => {
    const m = g.resolve(`soy de la provincia de ${name}`);
    expect(m?.place.provinceCode).toBe(code);
  });

  it.each(PROVINCES.map((p) => [p.capital, p.code]))('reconoce la capital %s', (capital, code) => {
    const m = g.resolve(`hola, vivo en ${capital}`);
    expect(m?.place.provinceCode).toBe(code);
    expect(m?.place.kind).not.toBe('provincia');
  });

  it('todas las coordenadas están dentro de Ecuador', () => {
    for (const p of PLACES) {
      const galapagos = p.province === 'W';
      expect(p.lat, p.name).toBeGreaterThan(galapagos ? -1.5 : -5.1);
      expect(p.lat, p.name).toBeLessThan(1.5);
      expect(p.lng, p.name).toBeGreaterThan(galapagos ? -92 : -81.2);
      expect(p.lng, p.name).toBeLessThan(galapagos ? -89 : -75.1);
    }
  });
});

describe('Gazetteer: cómo escribe la gente', () => {
  const cases: [string, string][] = [
    ['soy de rio bamba', 'Riobamba'],
    ['riobamba', 'Riobamba'],
    ['RIOBAMBA!!!', 'Riobamba'],
    ['estoy en riobanba', 'Riobamba'],
    ['vivo en ambtao', 'Ambato'],
    ['en la capital', 'Quito'],
    ['soy guayaco', 'Guayaquil'],
    ['gye', 'Guayaquil'],
    ['soy de guayakil', 'Guayaquil'],
    ['cuenca', 'Cuenca'],
    ['soy morlaco', 'Cuenca'],
    ['vivo en lago agrio', 'Nueva Loja'],
    ['estoy en el coca', 'Puerto Francisco de Orellana'],
    ['sto domingo', 'Santo Domingo'],
    ['santo domingo de los colorados', 'Santo Domingo'],
    ['vivo en duran', 'Durán'],
    ['soy de sangolqui', 'Sangolquí'],
    ['en cumbaya', 'Cumbayá'],
    ['portoviejo', 'Portoviejo'],
    ['manta', 'Manta'],
    ['salinas', 'Salinas'],
    ['puyo', 'Puyo'],
    ['ibarra', 'Ibarra'],
    ['otavalo', 'Otavalo'],
    ['loja', 'Loja'],
    ['esmeraldas', 'Esmeraldas'],
    ['quevedo', 'Quevedo'],
    ['tulcan', 'Tulcán'],
    ['galapagos', 'Galápagos'],
    ['puerto ayora', 'Puerto Ayora'],
    ['soy de machala', 'Machala'],
    ['quiteño', 'Quito'],
    ['ambateño', 'Ambato'],
  ];
  it.each(cases)('"%s" → %s', (text, expected) => {
    expect(g.resolve(text)?.place.name).toBe(expected);
  });

  it('sectores conocidos devuelven la ciudad que los contiene', () => {
    expect(g.resolve('vivo cerca del Mall del Sol')?.place).toMatchObject({ name: 'Mall del Sol', city: 'Guayaquil' });
    expect(g.resolve('estoy por urdesa')?.place.city).toBe('Guayaquil');
    expect(g.resolve('vivo en el sur de quito')?.place).toMatchObject({ city: 'Quito', kind: 'sector' });
    expect(g.resolve('cerca del quicentro')?.place.city).toBe('Quito');
    expect(g.resolve('en via a la costa')?.place.city).toBe('Guayaquil');
    expect(g.resolve('mall del rio')?.place.city).toBe('Cuenca');
  });

  it('no confunde palabras comunes con lugares', () => {
    expect(g.resolve('hola quiero posca')).toBeUndefined();
    expect(g.resolve('mira, necesito marcadores para tela')).toBeUndefined();
    expect(g.resolve('?')).toBeUndefined();
    expect(g.resolve('👍')).toBeUndefined();
    expect(g.resolve('cuanto cuesta el posca pc-5m')).toBeUndefined();
  });

  it('palabras ambiguas cuentan con pista de ubicación', () => {
    expect(g.resolve('soy de mira')?.place.name).toBe('Mira');
    expect(g.resolve('vivo en playas')?.place.name).toBe('Playas');
  });

  it('la provincia desambigua', () => {
    expect(g.resolve('soy de bolivar, carchi')?.place.provinceCode).toBe('C');
    expect(g.resolve('provincia de bolivar')?.place.provinceCode).toBe('B');
  });

  it('el último lugar mencionado gana', () => {
    expect(g.resolve('soy de quito pero ahora vivo en ambato')?.place.name).toBe('Ambato');
  });

  it('ciudad y provincia homónimas → ciudad', () => {
    expect(g.resolve('loja')?.place.kind).toBe('capital');
    expect(g.resolve('provincia de loja')?.place.kind).toBe('provincia');
  });

  it('ubicación GPS → ciudad más cercana', () => {
    expect(g.nearestCity(-1.67, -78.65).name).toBe('Riobamba');
    expect(g.nearestCity(-2.17, -79.92).name).toBe('Guayaquil');
  });

  it('alias del bot (nombre o coordenadas)', () => {
    const g2 = new Gazetteer({ 'la piazza': 'samborondon', 'plaza ejemplo': '-1.6700,-78.6500' });
    expect(g2.resolve('cerca de la piazza')?.place.name).toBe('Samborondón');
    expect(g2.resolve('en plaza ejemplo')?.place.city).toBe('Riobamba');
  });
});

describe('Locator', () => {
  const loc = new Locator(TIENDAS, { maxResults: 2 });

  it('misma ciudad', async () => {
    const r = await loc.find({ text: 'soy de riobamba' });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ motivo: 'misma_ciudad' });
    expect(r[0].tienda.id).toBe('rio-1');
  });

  it('ordena por cercanía al sector dentro de la ciudad', async () => {
    const r = await loc.find({ text: 'vivo por la vía a la costa' });
    expect(r[0].tienda.id).toBe('gye-costa');
    expect(r.every((x) => x.motivo === 'misma_ciudad')).toBe(true);
    const r2 = await loc.find({ text: 'sur de quito' });
    expect(r2[0].tienda.id).toBe('uio-sur');
  });

  it('respeta max_resultados', async () => {
    expect(await loc.find({ text: 'guayaquil' })).toHaveLength(2);
  });

  it('ciudad sin tienda → la más cercana con aviso', () => {
    const r = loc.locate({ text: 'soy de guano' });
    expect(r.resultados[0].tienda.id).toBe('rio-1');
    expect(r.resultados[0].motivo).toBe('misma_provincia');
    expect(r.aviso).toMatch(/No hay tiendas en Guano/);
  });

  it('provincia sin tienda → más cercana en otra provincia', () => {
    const r = loc.locate({ text: 'vivo en Tena' });
    expect(r.resultados[0].motivo).toBe('mas_cercana');
    expect(r.resultados[0].distanciaKm).toBeGreaterThan(0);
    expect(r.aviso).toMatch(/en línea/); // hay una tienda con vende_online
  });

  it('solo provincia → tiendas de esa provincia', () => {
    const r = loc.locate({ text: 'provincia de pichincha' });
    expect(r.resultados.every((x) => x.motivo === 'misma_provincia')).toBe(true);
    expect(r.resultados[0].tienda.ciudad).toBe('Quito');
  });

  it('ubicación compartida (lat/lng)', async () => {
    const r = await loc.find({ lat: -1.255, lng: -78.62 });
    expect(r[0].tienda.id).toBe('amb-1');
    expect(r[0].motivo).toBe('misma_ciudad');
    expect(r[0].distanciaKm).toBeLessThan(2);
  });

  it('ubicación compartida en medio de la nada → más cercana', async () => {
    const r = await loc.find({ lat: -2.3, lng: -78.1 }); // cerca de Macas
    expect(r[0].motivo).toBe('mas_cercana');
  });

  it('tienda sin coordenadas usa la ciudad', async () => {
    const r = await loc.find({ text: 'latacunga' });
    expect(r[0].tienda.id).toBe('lat-1');
  });

  it('ciudad de la tienda con otro nombre (Lago Agrio = Nueva Loja)', async () => {
    const r = await loc.find({ text: 'vivo en nueva loja' });
    expect(r[0]).toMatchObject({ motivo: 'misma_ciudad' });
    expect(r[0].tienda.id).toBe('nl-1');
  });

  it('filtra por marca si se pide un producto', async () => {
    const r = await loc.find({ text: 'santo domingo', producto: 'posca' });
    expect(r.every((x) => x.tienda.marcas.includes('POSCA'))).toBe(true);
    expect(r[0].tienda.id).not.toBe('sd-1');
  });

  it('ubicación no reconocida → sin resultados y aviso', () => {
    const r = loc.locate({ text: 'hola' });
    expect(r.resultados).toEqual([]);
    expect(r.aviso).toMatch(/No reconocí/);
  });

  it('modo derivar si no hay tienda en la ciudad', () => {
    const l2 = new Locator(TIENDAS, { fallback: 'derivar:asesor' });
    const r = l2.locate({ text: 'soy de tena' });
    expect(r.resultados).toEqual([]);
    expect(r.derivar).toBe('asesor');
  });

  it('sin tiendas → nunca inventa', () => {
    const empty = new Locator([]);
    const r = empty.locate({ text: 'quito' });
    expect(r.resultados).toEqual([]);
    expect(r.aviso).toMatch(/No inventes/);
  });
});
