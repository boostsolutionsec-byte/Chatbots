# Pendientes y supuestos

Los agentes anotan aquí cada supuesto que hicieron y cada dato por confirmar.
Formato: `- [etiqueta] (agente N, fecha) descripción — supuesto usado`
Etiquetas: `[dato]` falta info del negocio · `[framework]` el Agente 3 necesita algo del motor · `[bots]` el Agente 2 encontró un problema en un bot · `[decisión]` elección técnica tomada por defecto.

- [dato] (agente 1, 2026-10-14) FORMULARIO preg. 1 vacía — se analizaron los tres candidatos. **Ninguno contiene el motor del bot de SellerChat** (landing, backend de llamadas SellerCall y esqueleto Blazor). Si el dueño tiene acceso al código real del bot, repetir el análisis. Ver `docs/ingenieria-inversa/01-mapa-del-codigo.md`.
- [decisión] (agente 1, 2026-10-14) Los tres repos de referencia **no tienen licencia** → no se copia código; solo se documenta comportamiento.
- [decisión] (agente 1, 2026-10-14) La red de la sesión bloquea sellerchat.ai y developers.facebook.com (proxy 403); la investigación externa se hizo con resúmenes de búsqueda web. Cifras marcadas ⚠️ en `07-competencia-y-reglas-meta.md` deben verificarse en las páginas oficiales.
- [framework] (agente 1, 2026-10-14) Propuestas P-1…P-11 añadidas a `docs/CONTRATO.md` → Propuestas (tools estándar, idempotencia, debounce, modo humano, guardas de salida, etiquetas, seguimiento, evals).
- [bots] (agente 1, 2026-10-14) `bots/mokalu/bot.yaml` (rama agente/3-bots) usa `plantilla:` en seguimientos a 23 h: dentro de la ventana de 24 h no hace falta plantilla (texto libre gratis); las plantillas solo son obligatorias fuera de ventana. Sugerencia, no bloqueo.
- [dato] (agente 1, 2026-10-14) Desde 1-oct-2026 Meta cobraría los mensajes de servicio por encima de 1.000/mes por número (fuente de tercero, respond.io). Confirmar en la página oficial de precios antes de conectar WhatsApp.
