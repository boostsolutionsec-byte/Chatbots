// Diccionario geográfico de Ecuador para el localizador de tiendas.
//
// Fuentes:
//  - [d] dr5hn/countries-states-cities-database (https://github.com/dr5hn/countries-states-cities-database),
//        licencia ODbL 1.0 — coordenadas de provincias y de ~130 ciudades (descargado 2026-10-14).
//  - [a] Complemento del Agente 2: cabeceras cantonales, parroquias y sectores conocidos con coordenadas
//        APROXIMADAS (±2 km), tomadas de conocimiento general/mapas públicos. Sirven para elegir la tienda más
//        cercana, no para navegar. Corrige o amplía aquí si un lugar sale mal.
//
// Nada de este archivo es específico de un bot: es geografía pública de Ecuador.

export type PlaceKind = 'provincia' | 'capital' | 'canton' | 'parroquia' | 'sector';

export interface Province {
  code: string; // ISO 3166-2:EC sin prefijo
  name: string;
  capital: string;
  lat: number;
  lng: number;
  aliases?: string[];
}

export interface Place {
  name: string;
  /** Ciudad a la que pertenece (para sectores/parroquias urbanas). Si falta, es la propia `name`. */
  city?: string;
  province: string; // code
  lat: number;
  lng: number;
  kind: PlaceKind;
  aliases?: string[];
  src: 'd' | 'a';
}

export const PROVINCES: Province[] = [
  { code: 'A', name: 'Azuay', capital: 'Cuenca', lat: -3.0524, lng: -79.2395 },
  { code: 'B', name: 'Bolívar', capital: 'Guaranda', lat: -1.5393, lng: -79.0817 },
  { code: 'F', name: 'Cañar', capital: 'Azogues', lat: -2.5745, lng: -78.9805 },
  { code: 'C', name: 'Carchi', capital: 'Tulcán', lat: 0.8375, lng: -78.2075 },
  { code: 'H', name: 'Chimborazo', capital: 'Riobamba', lat: -1.4681, lng: -78.8156 },
  { code: 'X', name: 'Cotopaxi', capital: 'Latacunga', lat: -0.8269, lng: -78.8938 },
  { code: 'O', name: 'El Oro', capital: 'Machala', lat: -3.5311, lng: -79.8333, aliases: ['orense'] },
  { code: 'E', name: 'Esmeraldas', capital: 'Esmeraldas', lat: 0.9682, lng: -79.6517 },
  { code: 'W', name: 'Galápagos', capital: 'Puerto Baquerizo Moreno', lat: -0.6, lng: -90.4, aliases: ['islas galapagos', 'las islas', 'galapagos islands'] },
  { code: 'G', name: 'Guayas', capital: 'Guayaquil', lat: -2.0, lng: -80.0 },
  { code: 'I', name: 'Imbabura', capital: 'Ibarra', lat: 0.2543, lng: -78.1804 },
  { code: 'L', name: 'Loja', capital: 'Loja', lat: -3.9931, lng: -79.2042 },
  { code: 'R', name: 'Los Ríos', capital: 'Babahoyo', lat: -1.4941, lng: -79.5542, aliases: ['los rios'] },
  { code: 'M', name: 'Manabí', capital: 'Portoviejo', lat: -0.7588, lng: -80.0612, aliases: ['manabita'] },
  { code: 'S', name: 'Morona Santiago', capital: 'Macas', lat: -2.6233, lng: -78.0048, aliases: ['morona'] },
  { code: 'N', name: 'Napo', capital: 'Tena', lat: -0.6082, lng: -77.952 },
  { code: 'D', name: 'Orellana', capital: 'Puerto Francisco de Orellana', lat: -0.7862, lng: -76.4803 },
  { code: 'Y', name: 'Pastaza', capital: 'Puyo', lat: -1.9167, lng: -77.0 },
  { code: 'P', name: 'Pichincha', capital: 'Quito', lat: -0.0585, lng: -78.3284 },
  { code: 'SE', name: 'Santa Elena', capital: 'Santa Elena', lat: -2.2267, lng: -80.8595, aliases: ['la peninsula', 'peninsula de santa elena'] },
  { code: 'SD', name: 'Santo Domingo de los Tsáchilas', capital: 'Santo Domingo', lat: -0.2546, lng: -79.1687, aliases: ['santo domingo de los tsachilas', 'tsachilas'] },
  { code: 'U', name: 'Sucumbíos', capital: 'Nueva Loja', lat: -0.0391, lng: -76.512 },
  { code: 'T', name: 'Tungurahua', capital: 'Ambato', lat: -1.2766, lng: -78.4755 },
  { code: 'Z', name: 'Zamora Chinchipe', capital: 'Zamora', lat: -4.062, lng: -78.7752, aliases: ['zamora chinchipe'] },
];

type Row = [name: string, province: string, lat: number, lng: number, kind: PlaceKind, src: 'd' | 'a', aliases?: string[], city?: string];

// prettier-ignore
const ROWS: Row[] = [
  // ── Azuay
  ['Cuenca', 'A', -2.9005, -79.0045, 'capital', 'd', ['morlaco', 'morlaca', 'cuencano', 'cuencana', 'atenas del ecuador']],
  ['Gualaceo', 'A', -2.8923, -78.7768, 'canton', 'd'],
  ['San Fernando', 'A', -3.1333, -79.2667, 'canton', 'd'],
  ['Paute', 'A', -2.78, -78.76, 'canton', 'a'],
  ['Sígsig', 'A', -3.05, -78.79, 'canton', 'a'],
  ['Santa Isabel', 'A', -3.27, -79.31, 'canton', 'a'],
  ['Girón', 'A', -3.16, -79.15, 'canton', 'a'],
  ['Nabón', 'A', -3.33, -79.06, 'canton', 'a'],
  ['Chordeleg', 'A', -2.92, -78.77, 'canton', 'a'],
  ['Camilo Ponce Enríquez', 'A', -3.05, -79.74, 'canton', 'a', ['ponce enriquez']],
  ['Oña', 'A', -3.47, -79.16, 'canton', 'a'],
  ['Sevilla de Oro', 'A', -2.79, -78.65, 'canton', 'a'],
  ['Guachapala', 'A', -2.77, -78.71, 'canton', 'a'],
  ['El Pan', 'A', -2.78, -78.63, 'canton', 'a'],
  ['Pucará', 'A', -3.17, -79.48, 'canton', 'a'],
  ['Mall del Río', 'A', -2.919, -79.011, 'sector', 'a', ['mall del rio'], 'Cuenca'],
  ['Centro de Cuenca', 'A', -2.897, -79.004, 'sector', 'a', ['centro historico de cuenca', 'parque calderon'], 'Cuenca'],
  ['El Ejido', 'A', -2.906, -79.011, 'sector', 'a', ['ejido'], 'Cuenca'],
  ['Totoracocha', 'A', -2.895, -78.982, 'sector', 'a', [], 'Cuenca'],
  ['Ricaurte', 'A', -2.857, -78.952, 'parroquia', 'a', [], 'Cuenca'],

  // ── Bolívar
  ['Guaranda', 'B', -1.5926, -79.0010, 'capital', 'd', ['guarandeño']],
  ['Chillanes', 'B', -1.9393, -79.0659, 'canton', 'd'],
  ['Echeandía', 'B', -1.4319, -79.2784, 'canton', 'd'],
  ['San Miguel', 'B', -1.7096, -79.0420, 'canton', 'd', ['san miguel de bolivar']],
  ['Caluma', 'B', -1.63, -79.26, 'canton', 'a'],
  ['Chimbo', 'B', -1.68, -79.03, 'canton', 'a', ['san jose de chimbo']],
  ['Las Naves', 'B', -1.28, -79.31, 'canton', 'a'],

  // ── Cañar
  ['Azogues', 'F', -2.7397, -78.8486, 'capital', 'd', ['azogueño']],
  ['Cañar', 'F', -2.5589, -78.9381, 'canton', 'd'],
  ['La Troncal', 'F', -2.4233, -79.3394, 'canton', 'd', ['troncal']],
  ['Biblián', 'F', -2.71, -78.89, 'canton', 'a'],
  ['El Tambo', 'F', -2.51, -78.93, 'canton', 'a'],
  ['Déleg', 'F', -2.79, -78.91, 'canton', 'a'],
  ['Suscal', 'F', -2.44, -79.06, 'canton', 'a'],

  // ── Carchi
  ['Tulcán', 'C', 0.8122, -77.7173, 'capital', 'd', ['tulcaneño']],
  ['El Ángel', 'C', 0.6167, -77.9333, 'canton', 'd', ['espejo']],
  ['San Gabriel', 'C', 0.5933, -77.8341, 'canton', 'd', ['montufar']],
  ['Mira', 'C', 0.55, -78.04, 'canton', 'a'],
  ['Huaca', 'C', 0.63, -77.73, 'canton', 'a', ['san pedro de huaca']],
  ['Bolívar (Carchi)', 'C', 0.50, -77.90, 'canton', 'a', []],

  // ── Chimborazo
  ['Riobamba', 'H', -1.6710, -78.6471, 'capital', 'd', ['rio bamba', 'riobambeño', 'riobambeña', 'sultana de los andes', 'rbba']],
  ['Alausí', 'H', -2.2000, -78.8500, 'canton', 'd'],
  ['Cumandá', 'H', -2.2000, -79.1333, 'canton', 'd'],
  ['Guano', 'H', -1.6066, -78.6302, 'canton', 'd'],
  ['Colta', 'H', -1.73, -78.76, 'canton', 'a', ['villa la union', 'cajabamba']],
  ['Chambo', 'H', -1.73, -78.59, 'canton', 'a'],
  ['Chunchi', 'H', -2.29, -78.92, 'canton', 'a'],
  ['Guamote', 'H', -1.93, -78.71, 'canton', 'a'],
  ['Penipe', 'H', -1.57, -78.53, 'canton', 'a'],
  ['Pallatanga', 'H', -2.00, -78.96, 'canton', 'a'],

  // ── Cotopaxi
  ['Latacunga', 'X', -0.9352, -78.6155, 'capital', 'd', ['latacungueño', 'mashca']],
  ['La Maná', 'X', -0.9408, -79.2343, 'canton', 'd', ['la mana']],
  ['Pujilí', 'X', -0.9573, -78.6963, 'canton', 'd'],
  ['Salcedo', 'X', -1.0455, -78.5906, 'canton', 'd', ['san miguel de salcedo']],
  ['Saquisilí', 'X', -0.8385, -78.6671, 'canton', 'd'],
  ['Sigchos', 'X', -0.7033, -78.8873, 'canton', 'd'],
  ['El Corazón', 'X', -1.1342, -79.0756, 'canton', 'd', ['pangua']],

  // ── El Oro
  ['Machala', 'O', -3.2581, -79.9554, 'capital', 'd', ['machaleño', 'machaleña', 'capital bananera']],
  ['El Guabo', 'O', -3.2387, -79.8293, 'canton', 'd', ['guabo']],
  ['Huaquillas', 'O', -3.4757, -80.2308, 'canton', 'd'],
  ['Pasaje', 'O', -3.3340, -79.8127, 'canton', 'd'],
  ['Piñas', 'O', -3.6806, -79.6803, 'canton', 'd'],
  ['Portovelo', 'O', -3.7172, -79.6195, 'canton', 'd'],
  ['Puerto Bolívar', 'O', -3.2700, -80.0000, 'parroquia', 'd', [], 'Machala'],
  ['Santa Rosa', 'O', -3.4488, -79.9595, 'canton', 'd', ['santa rosa de el oro']],
  ['Zaruma', 'O', -3.6911, -79.6114, 'canton', 'd'],
  ['Arenillas', 'O', -3.55, -80.06, 'canton', 'a'],
  ['Balsas', 'O', -3.77, -79.82, 'canton', 'a'],
  ['Marcabelí', 'O', -3.78, -79.90, 'canton', 'a'],
  ['Paccha', 'O', -3.57, -79.69, 'canton', 'a', ['atahualpa']],
  ['Las Lajas', 'O', -3.80, -80.06, 'canton', 'a'],

  // ── Esmeraldas
  ['Esmeraldas', 'E', 0.9592, -79.6539, 'capital', 'd', ['esmeraldeño', 'esmeraldeña']],
  ['Atacames', 'E', 0.8695, -79.8480, 'canton', 'd'],
  ['Tonsupa', 'E', 0.89, -79.80, 'parroquia', 'a'],
  ['Muisne', 'E', 0.6100, -80.0186, 'canton', 'd'],
  ['Río Verde', 'E', 1.0626, -79.3957, 'canton', 'd', ['rioverde']],
  ['Quinindé', 'E', 0.3263, -79.4695, 'canton', 'd', ['rosa zarate', 'quininde']],
  ['San Lorenzo', 'E', 1.2864, -78.8357, 'canton', 'd', ['san lorenzo de esmeraldas']],
  ['Valdez', 'E', 1.2490, -78.9831, 'canton', 'd', ['limones', 'eloy alfaro (esmeraldas)']],

  // ── Galápagos
  ['Puerto Ayora', 'W', -0.7393, -90.3138, 'canton', 'd', ['santa cruz galapagos', 'isla santa cruz']],
  ['Puerto Baquerizo Moreno', 'W', -0.9019, -89.6107, 'capital', 'd', ['san cristobal galapagos', 'isla san cristobal', 'baquerizo moreno']],
  ['Puerto Villamil', 'W', -0.9568, -90.9672, 'canton', 'd', ['isabela', 'isla isabela']],

  // ── Guayas
  ['Guayaquil', 'G', -2.1962, -79.8862, 'capital', 'd', ['guayaco', 'guayaca', 'guayaquileño', 'guayaquileña', 'gye', 'gquil', 'guayakil', 'perla del pacifico', 'la perla']],
  ['Durán', 'G', -2.1700, -79.8300, 'canton', 'a', ['duran', 'eloy alfaro duran']],
  ['Samborondón', 'G', -1.9631, -79.7244, 'canton', 'd', ['samborondon', 'samboro']],
  ['La Puntilla', 'G', -2.140, -79.865, 'parroquia', 'a', ['puntilla', 'via a samborondon', 'entre rios'], 'Samborondón'],
  ['Daule', 'G', -1.8609, -79.9777, 'canton', 'd'],
  ['La Aurora', 'G', -2.050, -79.895, 'parroquia', 'a', ['la joya', 'villa club'], 'Daule'],
  ['Milagro', 'G', -2.1346, -79.5874, 'canton', 'd', ['milagreño']],
  ['Naranjal', 'G', -2.6737, -79.6183, 'canton', 'd'],
  ['Naranjito', 'G', -2.1667, -79.4653, 'canton', 'd'],
  ['Playas', 'G', -2.6315, -80.3884, 'canton', 'd', ['general villamil', 'villamil playas']],
  ['El Triunfo', 'G', -1.9333, -79.9667, 'canton', 'd'],
  ['Balzar', 'G', -1.3656, -79.9054, 'canton', 'd'],
  ['Colimes', 'G', -1.5459, -80.0115, 'canton', 'd'],
  ['Pedro Carbo', 'G', -1.8233, -80.2333, 'canton', 'd'],
  ['Isidro Ayora', 'G', -1.8794, -80.1460, 'canton', 'd'],
  ['Lomas de Sargentillo', 'G', -1.8833, -80.0833, 'canton', 'd'],
  ['Palestina', 'G', -1.9333, -79.7167, 'canton', 'd'],
  ['Santa Lucía', 'G', -2.1833, -80.0000, 'canton', 'd'],
  ['Simón Bolívar', 'G', -2.0000, -79.4833, 'canton', 'd'],
  ['El Empalme', 'G', -1.0402, -79.6366, 'canton', 'd', ['velasco ibarra', 'empalme']],
  ['Yaguachi', 'G', -2.0971, -79.6921, 'canton', 'd', ['yaguachi nuevo', 'san jacinto de yaguachi']],
  ['Alfredo Baquerizo Moreno', 'G', -1.9167, -79.5167, 'canton', 'd', ['jujan']],
  ['Balao', 'G', -2.9104, -79.8125, 'canton', 'd'],
  ['Coronel Marcelino Maridueña', 'G', -2.2075, -79.4296, 'canton', 'd', ['marcelino mariduena']],
  ['Nobol', 'G', -1.92, -80.00, 'canton', 'a', ['narcisa de jesus']],
  ['Salitre', 'G', -1.83, -79.82, 'canton', 'a', ['urbina jado']],
  ['Bucay', 'G', -2.20, -79.13, 'canton', 'a', ['general antonio elizalde']],
  ['Mall del Sol', 'G', -2.155, -79.893, 'sector', 'a', ['mall del sol'], 'Guayaquil'],
  ['Urdesa', 'G', -2.165, -79.905, 'sector', 'a', ['urdesa central'], 'Guayaquil'],
  ['Kennedy', 'G', -2.170, -79.898, 'sector', 'a', ['ciudadela kennedy', 'kennedy norte'], 'Guayaquil'],
  ['Alborada', 'G', -2.135, -79.905, 'sector', 'a', ['la alborada'], 'Guayaquil'],
  ['Sauces', 'G', -2.120, -79.900, 'sector', 'a', ['los sauces'], 'Guayaquil'],
  ['Los Ceibos', 'G', -2.170, -79.945, 'sector', 'a', ['ceibos', 'riocentro ceibos'], 'Guayaquil'],
  ['Vía a la Costa', 'G', -2.185, -80.000, 'sector', 'a', ['via a la costa', 'via la costa', 'puerto azul', 'laguna plaza'], 'Guayaquil'],
  ['Centro de Guayaquil', 'G', -2.192, -79.884, 'sector', 'a', ['malecon 2000', 'malecon', 'bahia de guayaquil', 'la bahia'], 'Guayaquil'],
  ['Mall del Sur', 'G', -2.229, -79.898, 'sector', 'a', ['mall del sur'], 'Guayaquil'],
  ['Sur de Guayaquil', 'G', -2.235, -79.895, 'sector', 'a', ['sur de guayaquil', 'el sur de guayaquil', 'guasmo', 'suburbio', 'la floresta'], 'Guayaquil'],
  ['Norte de Guayaquil', 'G', -2.125, -79.905, 'sector', 'a', ['norte de guayaquil', 'el norte de guayaquil', 'garzota', 'samanes', 'mucho lote'], 'Guayaquil'],
  ['San Marino', 'G', -2.170, -79.902, 'sector', 'a', ['san marino shopping', 'policentro'], 'Guayaquil'],
  ['City Mall', 'G', -2.141, -79.909, 'sector', 'a', ['citymall'], 'Guayaquil'],
  ['Riocentro Norte', 'G', -2.119, -79.909, 'sector', 'a', [], 'Guayaquil'],
  ['Mapasingue', 'G', -2.158, -79.928, 'sector', 'a', ['prosperina'], 'Guayaquil'],
  ['Pascuales', 'G', -2.070, -79.935, 'sector', 'a', ['bastion popular', 'bastion'], 'Guayaquil'],

  // ── Imbabura
  ['Ibarra', 'I', 0.3517, -78.1223, 'capital', 'd', ['ibarreño', 'ciudad blanca']],
  ['Otavalo', 'I', 0.2342, -78.2625, 'canton', 'd', ['otavaleño']],
  ['Cotacachi', 'I', 0.3010, -78.2645, 'canton', 'd'],
  ['Atuntaqui', 'I', 0.3317, -78.2137, 'canton', 'd', ['antonio ante']],
  ['Pimampiro', 'I', 0.3910, -77.9409, 'canton', 'd'],
  ['Urcuquí', 'I', 0.42, -78.20, 'canton', 'a', ['yachay']],

  // ── Loja
  ['Loja', 'L', -3.9931, -79.2042, 'capital', 'd', ['lojano', 'lojana']],
  ['Cariamanga', 'L', -4.3317, -79.5554, 'canton', 'd', ['calvas']],
  ['Catacocha', 'L', -4.0510, -79.6474, 'canton', 'd', ['paltas']],
  ['Catamayo', 'L', -3.9860, -79.3584, 'canton', 'd'],
  ['Saraguro', 'L', -3.6211, -79.2390, 'canton', 'd'],
  ['Macará', 'L', -4.38, -79.94, 'canton', 'a'],
  ['Alamor', 'L', -4.02, -80.02, 'canton', 'a', ['puyango']],
  ['Celica', 'L', -4.10, -79.95, 'canton', 'a'],
  ['Zapotillo', 'L', -4.39, -80.24, 'canton', 'a'],
  ['Vilcabamba', 'L', -4.26, -79.22, 'parroquia', 'a'],
  ['Gonzanamá', 'L', -4.23, -79.43, 'canton', 'a'],

  // ── Los Ríos
  ['Babahoyo', 'R', -1.8022, -79.5344, 'capital', 'd', ['babahoyense']],
  ['Quevedo', 'R', -1.0286, -79.4635, 'canton', 'd', ['quevedeño']],
  ['Buena Fe', 'R', -0.8893, -79.4891, 'canton', 'd', ['san jacinto de buena fe']],
  ['Valencia', 'R', -0.9526, -79.3532, 'canton', 'd'],
  ['Ventanas', 'R', -1.4446, -79.4589, 'canton', 'd'],
  ['Vinces', 'R', -1.5555, -79.7519, 'canton', 'd'],
  ['Catarama', 'R', -1.5833, -79.4667, 'canton', 'd', ['urdaneta']],
  ['Montalvo', 'R', -1.7907, -79.2853, 'canton', 'd'],
  ['Palenque', 'R', -1.4385, -79.7619, 'canton', 'd'],
  ['Mocache', 'R', -1.18, -79.50, 'canton', 'a'],
  ['Puebloviejo', 'R', -1.53, -79.53, 'canton', 'a', ['pueblo viejo']],
  ['Baba', 'R', -1.78, -79.67, 'canton', 'a'],
  ['Quinsaloma', 'R', -1.21, -79.31, 'canton', 'a'],

  // ── Manabí
  ['Portoviejo', 'M', -1.0546, -80.4545, 'capital', 'd', ['portovejense']],
  ['Manta', 'M', -0.9677, -80.7089, 'canton', 'd', ['mantense']],
  ['Montecristi', 'M', -1.0458, -80.6587, 'canton', 'd'],
  ['Chone', 'M', -0.6981, -80.0936, 'canton', 'd', ['chonero']],
  ['Bahía de Caráquez', 'M', -0.5981, -80.4239, 'canton', 'd', ['bahia', 'bahia de caraquez', 'sucre manabi']],
  ['Calceta', 'M', -0.8452, -80.1675, 'canton', 'd', ['bolivar manabi']],
  ['Jama', 'M', -0.2004, -80.2632, 'canton', 'd'],
  ['Jipijapa', 'M', -1.3487, -80.5788, 'canton', 'd'],
  ['Junín', 'M', -0.9283, -80.2066, 'canton', 'd'],
  ['Paján', 'M', -1.5532, -80.4287, 'canton', 'd'],
  ['Pedernales', 'M', 0.0716, -80.0526, 'canton', 'd'],
  ['Puerto López', 'M', -1.5594, -80.8126, 'canton', 'd'],
  ['Rocafuerte', 'M', -0.9227, -80.4483, 'canton', 'd'],
  ['San Vicente', 'M', -0.5970, -80.4020, 'canton', 'd'],
  ['Santa Ana', 'M', -1.2072, -80.3711, 'canton', 'd', ['santa ana de vuelta larga']],
  ['Tosagua', 'M', -0.7865, -80.2349, 'canton', 'd'],
  ['El Carmen', 'M', -0.27, -79.46, 'canton', 'a'],
  ['Flavio Alfaro', 'M', -0.40, -79.91, 'canton', 'a'],
  ['Crucita', 'M', -0.87, -80.54, 'parroquia', 'a'],
  ['24 de Mayo', 'M', -1.27, -80.42, 'canton', 'a', ['sucre 24 de mayo']],
  ['Olmedo (Manabí)', 'M', -1.40, -80.21, 'canton', 'a'],
  ['Pichincha (Manabí)', 'M', -1.04, -79.82, 'canton', 'a'],
  ['Jaramijó', 'M', -0.95, -80.63, 'canton', 'a'],

  // ── Morona Santiago
  ['Macas', 'S', -2.3087, -78.1114, 'capital', 'd', ['morona macas']],
  ['Gualaquiza', 'S', -3.3982, -78.5764, 'canton', 'd'],
  ['Palora', 'S', -1.7004, -77.9667, 'canton', 'd'],
  ['Sucúa', 'S', -2.4583, -78.1695, 'canton', 'd'],
  ['General Plaza', 'S', -2.97, -78.43, 'canton', 'a', ['limon indanza']],
  ['Méndez', 'S', -2.72, -78.31, 'canton', 'a', ['santiago de mendez']],
  ['Logroño', 'S', -2.62, -78.20, 'canton', 'a'],
  ['Taisha', 'S', -2.38, -77.50, 'canton', 'a'],

  // ── Napo
  ['Tena', 'N', -0.9938, -77.8129, 'capital', 'd', ['teneño']],
  ['Archidona', 'N', -0.9093, -77.8077, 'canton', 'd'],
  ['El Chaco', 'N', -0.33, -77.81, 'canton', 'a'],
  ['Baeza', 'N', -0.46, -77.89, 'canton', 'a', ['quijos']],
  ['Carlos Julio Arosemena Tola', 'N', -1.15, -77.87, 'canton', 'a', ['arosemena tola']],

  // ── Orellana
  ['Puerto Francisco de Orellana', 'D', -0.4662, -76.9872, 'capital', 'd', ['coca', 'el coca', 'francisco de orellana']],
  ['La Joya de los Sachas', 'D', -0.30, -76.86, 'canton', 'a', ['sacha', 'joya de los sachas']],
  ['Loreto', 'D', -0.6917, -77.3043, 'canton', 'd'],
  ['Nuevo Rocafuerte', 'D', -0.92, -75.40, 'canton', 'a', ['aguarico']],

  // ── Pastaza
  ['Puyo', 'Y', -1.4836, -78.0026, 'capital', 'd', ['el puyo']],
  ['Shell', 'Y', -1.50, -78.06, 'canton', 'a', ['mera']],
  ['Santa Clara', 'Y', -1.27, -77.88, 'canton', 'a'],
  ['Arajuno', 'Y', -1.24, -77.68, 'canton', 'a'],

  // ── Pichincha
  ['Quito', 'P', -0.2299, -78.5250, 'capital', 'd', ['la capital', 'capital', 'quiteño', 'quiteña', 'uio', 'kito', 'san francisco de quito', 'carita de dios', 'distrito metropolitano']],
  ['Sangolquí', 'P', -0.3343, -78.4516, 'canton', 'd', ['rumiñahui', 'ruminahui', 'sangolqui']],
  ['Machachi', 'P', -0.5101, -78.5673, 'canton', 'd', ['mejia']],
  ['Cayambe', 'P', 0.0414, -78.1459, 'canton', 'd'],
  ['Tabacundo', 'P', 0.05, -78.20, 'canton', 'a', ['pedro moncayo']],
  ['Pedro Vicente Maldonado', 'P', 0.09, -79.05, 'canton', 'a'],
  ['Puerto Quito', 'P', 0.12, -79.25, 'canton', 'a'],
  ['San Miguel de los Bancos', 'P', 0.02, -78.89, 'canton', 'a', ['los bancos']],
  ['Cumbayá', 'P', -0.200, -78.430, 'parroquia', 'a', ['cumbaya'], 'Quito'],
  ['Tumbaco', 'P', -0.212, -78.400, 'parroquia', 'a', [], 'Quito'],
  ['Puembo', 'P', -0.177, -78.357, 'parroquia', 'a', ['tababela', 'aeropuerto de quito'], 'Quito'],
  ['Conocoto', 'P', -0.290, -78.480, 'parroquia', 'a', [], 'Quito'],
  ['Valle de los Chillos', 'P', -0.305, -78.455, 'sector', 'a', ['los chillos', 'el valle', 'san rafael', 'san luis shopping'], 'Sangolquí'],
  ['Calderón', 'P', -0.100, -78.420, 'parroquia', 'a', ['calderon', 'carapungo'], 'Quito'],
  ['Pomasqui', 'P', -0.050, -78.455, 'parroquia', 'a', ['mitad del mundo', 'san antonio de pichincha'], 'Quito'],
  ['La Carolina', 'P', -0.180, -78.485, 'sector', 'a', ['parque la carolina', 'quicentro', 'cci', 'centro comercial inaquito', 'inaquito', 'avenida amazonas', 'av amazonas', 'naciones unidas'], 'Quito'],
  ['La Mariscal', 'P', -0.203, -78.492, 'sector', 'a', ['mariscal', 'plaza foch'], 'Quito'],
  ['Centro Histórico de Quito', 'P', -0.220, -78.512, 'sector', 'a', ['centro historico', 'centro de quito', 'plaza grande', 'la ronda'], 'Quito'],
  ['El Condado', 'P', -0.105, -78.495, 'sector', 'a', ['condado shopping', 'condado'], 'Quito'],
  ['Norte de Quito', 'P', -0.140, -78.480, 'sector', 'a', ['norte de quito', 'el norte de quito', 'el inca', 'la kennedy de quito', 'el labrador'], 'Quito'],
  ['Sur de Quito', 'P', -0.280, -78.545, 'sector', 'a', ['sur de quito', 'el sur de quito', 'quitumbe', 'chillogallo', 'el recreo', 'quicentro sur', 'solanda', 'la magdalena'], 'Quito'],
  ['Scala Shopping', 'P', -0.208, -78.418, 'sector', 'a', ['scala', 'paseo san francisco'], 'Quito'],

  // ── Santa Elena
  ['Santa Elena', 'SE', -2.2262, -80.8587, 'capital', 'd'],
  ['La Libertad', 'SE', -2.2334, -80.9103, 'canton', 'd', ['la libertad santa elena']],
  ['Salinas', 'SE', -2.2146, -80.9521, 'canton', 'd'],
  ['Montañita', 'SE', -1.83, -80.75, 'parroquia', 'a', ['montanita', 'manglaralto', 'olon']],
  ['Ballenita', 'SE', -2.20, -80.87, 'parroquia', 'a'],
  ['Anconcito', 'SE', -2.33, -80.89, 'parroquia', 'a'],

  // ── Santo Domingo de los Tsáchilas
  ['Santo Domingo', 'SD', -0.2530, -79.1754, 'capital', 'd', ['santo domingo de los colorados', 'sto domingo', 'sto. domingo', 'santo domingo tsachilas']],
  ['La Concordia', 'SD', 0.0068, -79.3934, 'canton', 'd'],

  // ── Sucumbíos
  ['Nueva Loja', 'U', 0.0847, -76.8828, 'capital', 'd', ['lago agrio']],
  ['Shushufindi', 'U', -0.18, -76.65, 'canton', 'a'],
  ['Lumbaquí', 'U', -0.04, -77.33, 'canton', 'a', ['gonzalo pizarro']],
  ['El Dorado de Cascales', 'U', 0.05, -77.25, 'canton', 'a', ['cascales']],
  ['Puerto El Carmen', 'U', 0.20, -75.85, 'canton', 'a', ['putumayo']],
  ['Tarapoa', 'U', -0.12, -76.34, 'canton', 'a', ['cuyabeno']],

  // ── Tungurahua
  ['Ambato', 'T', -1.2491, -78.6168, 'capital', 'd', ['ambateño', 'ambateña', 'tierra de las flores y las frutas']],
  ['Baños', 'T', -1.3964, -78.4247, 'canton', 'd', ['banos', 'banos de agua santa']],
  ['Pelileo', 'T', -1.3307, -78.5434, 'canton', 'd'],
  ['Píllaro', 'T', -1.1667, -78.5500, 'canton', 'd', ['pillaro']],
  ['Patate', 'T', -1.31, -78.51, 'canton', 'a'],
  ['Quero', 'T', -1.38, -78.61, 'canton', 'a'],
  ['Cevallos', 'T', -1.35, -78.61, 'canton', 'a'],
  ['Mocha', 'T', -1.42, -78.67, 'canton', 'a'],
  ['Tisaleo', 'T', -1.35, -78.67, 'canton', 'a'],

  // ── Zamora Chinchipe
  ['Zamora', 'Z', -4.0692, -78.9567, 'capital', 'd'],
  ['Yantzaza', 'Z', -3.8277, -78.7593, 'canton', 'd'],
  ['Zumba', 'Z', -4.87, -79.13, 'canton', 'a', ['chinchipe']],
  ['El Pangui', 'Z', -3.63, -78.59, 'canton', 'a'],
  ['Zumbi', 'Z', -3.87, -78.78, 'canton', 'a', ['centinela del condor']],
  ['Palanda', 'Z', -4.65, -79.13, 'canton', 'a'],
  ['Guayzimi', 'Z', -4.03, -78.66, 'canton', 'a', ['nangaritza']],
];

export const PLACES: Place[] = ROWS.map(([name, province, lat, lng, kind, src, aliases, city]) => ({
  name,
  province,
  lat,
  lng,
  kind,
  src,
  aliases,
  city,
}));

export function provinceByCode(code: string): Province | undefined {
  return PROVINCES.find((p) => p.code === code);
}
