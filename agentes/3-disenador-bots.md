# Agente 3 · Diseñador del bot — Mokalú → tienda más cercana

**Rama:** `agente/3-bots` · **Carpetas:** `bots/`, `datos/`, `docs/marcas.md`

## Misión
Escribir el mejor bot posible, **uno solo**: `bots/mokalu/`, con el formato de `docs/CONTRATO.md`.
Mokalú es el **distribuidor** en Ecuador de uni-ball/POSCA (y las marcas que diga el formulario). El bot:
1. **Objetivo principal:** averigua en qué ciudad/sector está la persona (o recibe su ubicación) y la **redirige a la
   tienda/punto de venta más cercano** con nombre, dirección, link de Maps y contacto — en el menor número de mensajes.
2. Si pregunta qué comprar, recomienda el producto correcto (qué POSCA para qué superficie) para que llegue sabiendo qué pedir.
3. Deriva a humano: quien quiere ser punto de venta/distribuidor, mayoristas, reclamos.
Nunca inventa tiendas, direcciones, teléfonos, precios ni stock.

## Pasos
1. Lee `CLAUDE.md`, **todo** `FORMULARIO.md`, `docs/marcas.md` y `docs/CONTRATO.md`.
2. **Investiga a fondo ambas marcas** (son internacionales, hay mucha información pública):
   - uni-ball / Mitsubishi Pencil: líneas de producto, especialmente **POSCA** (puntas PC-1M, PC-1MR, PC-3M, PC-5M,
     PC-8K, PC-17K, brush PCF-350; superficies; cómo fijar/sellar; diferencias con marcadores de alcohol),
     PIN, Signo, Jetstream, Kuru Toga; usos típicos (customizar zapatillas, tazas, lienzos, rocas, lettering).
   - Mokalú: sitio (`mokalu.com.ec/tienda/`), Instagram `@mokalu_ec`, ubicación (C.C. Laguna Plaza), envíos, horario,
     qué marcas/productos uni-ball vende realmente. Si el sitio no carga desde la sesión, anótalo y sigue.
   - Amplía `docs/marcas.md` con lo encontrado, **con la fuente de cada dato**.
   - Lo que no esté confirmado por el dueño márcalo `<!-- POR CONFIRMAR -->` y en `PENDIENTES.md`.
     **Nunca** inventes precios, stock, teléfonos ni políticas.
3. Crea `bots/mokalu/`:
   - `bot.yaml` completo (destinos con `${VARIABLES}`, reglas de derivación, flujos, límites, seguimiento).
   - `prompts/sistema.md` — personalidad (asesor que ama el arte), objetivo, reglas, ejemplos de buenas respuestas
     cortas estilo chat: mensajes breves, una pregunta a la vez, sin bloques largos.
   - `conocimiento/` — `productos-uni.md` (guía de producto: qué punta para qué), `faq.md`, `politicas.md`,
     `distribuidor.md` (quién es Mokalú, tienda propia, canales, a quién derivar).
   - `tiendas.csv` — **lo más importante.** Si el formulario no trae la lista (lo esperado esta noche): llénalo con
     ~40 tiendas **inventadas** con prefijo `EJEMPLO` repartidas en las 24 provincias (varias en Guayaquil, Quito y Cuenca;
     algunas provincias sin tienda para probar "la más cercana"), con coordenadas plausibles de cada ciudad.
     La única fila real posible es la tienda propia de Mokalú (C.C. Laguna Plaza, Guayaquil), marcada `POR CONFIRMAR`.
     Regístralo todo en `docs/DATOS-INVENTADOS.md`.
   - `catalogo.csv` — productos de las marcas distribuidas (sin precios salvo que el formulario lo permita).
   - `evals/` — mínimo **30**: "¿dónde compro?" desde muchas ciudades (con y sin tienda), ubicación compartida,
     sector ("cerca del Mall del Sol"), "¿qué posca uso para zapatillas?", pregunta de precio, quiero ser distribuidor,
     mayorista/colegio, reclamo → humano, producto que no distribuimos, faltas de ortografía, emojis solos, "?", spam,
     prompt injection, cambio de idioma.
   - `plantillas-whatsapp.md` — textos para cuando se conecte WhatsApp (seguimiento, confirmación), con categoría y variables.
4. Usa las conversaciones de ejemplo del Agente 1 (`git fetch origin agente/1-ingenieria-inversa`) y los chats reales de
   `datos/` si el dueño los subió (anonimiza antes de citarlos).
5. Itera: cuando exista el framework del Agente 2 (`git fetch origin agente/2-framework`), corre `npm run eval -- mokalu`
   y mejora prompts/config hasta subir la nota. Guarda cada reporte en `bots/mokalu/reportes/`.
6. Escribe `bots/mokalu/GUIA-DEL-DUENO.md`: cómo agregar o cambiar tiendas, FAQ y productos sin programar.

## Criterio de terminado
`bot.yaml` válido, `tiendas.csv` con el formato del contrato, ≥30 evals, guía de producto con fuentes,
los hallazgos 🔴 del validador atendidos, y todos los `POR CONFIRMAR` listados en `PENDIENTES.md`.
