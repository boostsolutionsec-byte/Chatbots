# Pendientes y supuestos

Los agentes anotan aquí cada supuesto que hicieron y cada dato por confirmar.
Formato: `- [etiqueta] (agente N, fecha) descripción — supuesto usado`
Etiquetas: `[dato]` falta info del negocio · `[framework]` el Agente 3 necesita algo del motor · `[bots]` el Agente 2 encontró un problema en un bot · `[decisión]` elección técnica tomada por defecto.

- [decisión] (agente 2, 2026-10-14) Base del framework: **motor propio** (Node + TypeScript + Hono + zod), no BuilderBot. Motivos en `framework/DECISION-BASE.md` (su provider de Telegram usa MTProto/GramJS, ffmpeg en el núcleo, modelo de flujos por palabra clave que choca con `bot.yaml` + LLM con herramientas). Reversible: el motor se puede llamar desde BuilderBot.
- [decisión] (agente 2, 2026-10-14) El framework vive en `framework/` y busca los bots en `../bots` (variable `BOTS_DIR` para cambiarlo). Servidor: `POST /sim/:botId` con `{ "userId": "...", "text": "..." }` → `{ "replies": [...], "toolCalls": [...], "state": {...} }`.
