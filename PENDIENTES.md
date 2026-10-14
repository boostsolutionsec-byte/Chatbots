# Pendientes y supuestos

Los agentes anotan aquí cada supuesto que hicieron y cada dato por confirmar.
Formato: `- [etiqueta] (agente N, fecha) descripción — supuesto usado`
Etiquetas: `[dato]` falta info del negocio · `[framework]` el Agente 3 necesita algo del motor · `[bots]` el Agente 2 encontró un problema en un bot · `[decisión]` elección técnica tomada por defecto.

- [decisión] (agente 2, 2026-10-14) Base del framework: **motor propio** (Node + TypeScript + Hono + zod), no BuilderBot. Motivos en `framework/DECISION-BASE.md` (su provider de Telegram usa MTProto/GramJS, ffmpeg en el núcleo, modelo de flujos por palabra clave que choca con `bot.yaml` + LLM con herramientas). Reversible: el motor se puede llamar desde BuilderBot.
- [decisión] (agente 2, 2026-10-14) El framework vive en `framework/` y busca los bots en `../bots` (variable `BOTS_DIR` para cambiarlo). Servidor: `POST /sim/:botId` con `{ "userId": "...", "text": "..." }` → `{ "replies": [...], "toolCalls": [...], "state": {...} }`.
- [decisión] (agente 2, 2026-10-14) **Ya disponible en `agente/2-framework`** para Agentes 3 y 4: `cd framework && npm install && npm run dev` (puerto 3000; `LLM_PROVIDER=mock|claude-cli` para elegir IA). `POST /sim/:botId` body `{"userId","text"}` o `{"userId","location":{"lat","lng"}}` o `{"userId","reset":true}` → `{replies[], toolCalls[], actions[], tiendas[], state{fields,paused,pendingField}, skipped?}`. `actions` incluye `buscar_tienda`, `buscar_producto`, `derivar:<destino>`, `registrar_campo:<id>`, `guardar_lead`. Chat web: `GET /chat/:botId`. Terminal: `npm run sim -- <bot> [--mock] [--debug]`. Validar un bot: `npm run validate -- <bot>`.
- [decisión] (agente 2, 2026-10-14) Tras `derivar` a un destino `humano` el bot **queda en pausa** para ese chat (responde `skipped: "paused"` sin texto) hasta `/reactivar` o `POST /admin/:botId/:userId/resume`. Para el simulador: mandar `{"reset":true}` o el texto `/reiniciar`. Se puede desactivar con `HANDOFF_PAUSE=false`.
