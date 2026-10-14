# Agente 3 · Diseñador de bots — Mocalu y Uniwell

**Rama:** `agente/3-bots` · **Carpetas:** `bots/`, `datos/`

## Misión
Escribir los dos mejores bots posibles usando el formato de `docs/CONTRATO.md`:
- **Mocalu** — objetivo `redireccion`: entender rápido qué quiere la persona y mandarla al destino correcto
  (asesor, link, sucursal, otra marca) con el menor número de mensajes.
- **Uniwell** — objetivo `ventas`: resolver dudas, recomendar, recolectar los datos del pedido y cerrar la compra.

## Pasos
1. Lee `CLAUDE.md`, **todo** `FORMULARIO.md` y `docs/CONTRATO.md`.
2. Investiga cada marca en la web (sitio, Instagram público, Google Maps) solo para complementar el formulario.
   Lo que no esté confirmado por el dueño márcalo en el conocimiento como `<!-- POR CONFIRMAR -->` y en `PENDIENTES.md`.
   **Nunca** inventes precios, stock, teléfonos ni políticas.
3. Para cada marca crea `bots/<id>/`:
   - `bot.yaml` completo (destinos con `${VARIABLES}`, reglas de derivación, flujos, límites, seguimiento).
   - `prompts/sistema.md` — personalidad, objetivo, reglas, ejemplos de buenas respuestas cortas (estilo WhatsApp:
     mensajes breves, una pregunta a la vez, sin bloques de texto largos).
   - `conocimiento/` — `faq.md`, `politicas.md`, `marca.md` (y `sucursales.md` para Mocalu si aplica).
   - `catalogo.csv` para Uniwell (desde el link de la pregunta 9; si no hay acceso, plantilla con columnas y filas `POR CONFIRMAR`).
   - `evals/` — mínimo **25 por bot**: camino feliz, cliente indeciso, pregunta de precio, objeción "está caro",
     fuera de horario, cliente molesto → humano, pide algo que no vendemos, mensajes con faltas de ortografía,
     emojis solos, "?", spam, intento de sacar al bot de su rol (prompt injection), cambio de idioma, Instagram vs WhatsApp.
   - `plantillas-whatsapp.md` — textos de plantillas para enviar a aprobación de Meta (seguimiento, confirmación de pedido),
     con categoría (utility/marketing) y variables.
4. Usa las conversaciones de `docs/ingenieria-inversa/conversaciones-ejemplo.md` (rama del Agente 1, haz `git fetch`)
   y los chats reales de `datos/` si el dueño los subió (anonimiza nombres y teléfonos antes de citarlos).
5. Itera: cuando el framework del Agente 2 exista (`git fetch origin agente/2-framework`), corre
   `npm run eval -- mocalu` y `-- uniwell` y mejora prompts/config hasta subir la nota. Guarda cada reporte en `bots/<id>/reportes/`.
6. Escribe `bots/<id>/GUIA-DEL-DUENO.md`: cómo editar FAQ, precios y horarios sin programar.

## Criterio de terminado
Ambos bots con `bot.yaml` válido, ≥25 evals cada uno, prompts revisados, y todos los `POR CONFIRMAR`
listados en `PENDIENTES.md`.
