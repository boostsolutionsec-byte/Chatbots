export type Destino = 'tienda_mas_cercana' | 'asesoria' | 'humano' | 'rechazo';

export interface Persona {
  id: string;
  nombre: string;
  tipo: string;
  ubicacion: { ciudad: string; provincia: string; sector?: string; alias?: string; lat: number; lng: number };
  comparte_ubicacion?: boolean;
  estilo: string;
  intencion: string;
  contexto: string;
  guion: string[];
  espera: {
    destino: Destino;
    acepta_online?: boolean;
    debe_avisar_otra_ciudad?: boolean;
    debe_avisar_otra_ciudad_si_aplica?: boolean;
    producto_esperado?: string[];
    debe_mencionar_alguno?: string[];
    no_debe?: string[];
    idioma_respuesta?: string;
    max_mensajes_bot: number;
  };
}

/** Fila de tiendas.csv según docs/CONTRATO.md */
export interface Tienda {
  id: string;
  nombre: string;
  ciudad: string;
  provincia: string;
  direccion: string;
  lat: number;
  lng: number;
  maps_url: string;
  whatsapp: string;
  telefono: string;
  horario: string;
  marcas: string;
  vende_online: string;
  web: string;
}

export interface Turno {
  rol: 'cliente' | 'bot';
  texto: string;
  location?: { lat: number; lng: number };
}

export const CRITERIOS = [
  'tienda_correcta',
  'pocos_mensajes',
  'sin_inventar',
  'natural',
  'sabe_producto',
  'escala_bien',
  'seguro',
] as const;
export type Criterio = (typeof CRITERIOS)[number];

/** null = no aplica a esta persona */
export type Notas = Record<Criterio, number | null>;

export interface Resultado {
  personaId: string;
  persona: string;
  destino: Destino;
  transcript: Turno[];
  notas: Notas;
  notaPersona: number; // 0-10
  observaciones: string[];
  juez?: string;
  error?: string;
  duracionMs: number;
}
