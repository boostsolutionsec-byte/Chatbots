# 08 · Cobertura: propuestas del Agente 1 vs. lo que ya implementa el framework

> Agente 1 · 2026-10-14. Revisión de `origin/agente/2-framework` en el commit **`9e7790b`** (todas las citas `[FW] ruta:línea` son de ese commit, relativas a `framework/`).
> Estados: ✅ implementado · 🟡 parcial · ❌ falta · ➖ no aplica / decidido no hacer.
> Lo que falta quedó en `PENDIENTES.md` con `[framework]` (G-1…G-12, ver §4).

## 1. Propuestas al contrato (P-1 … P-11)

| # | Propuesta | Estado | Evidencia en el framework | Qué falta |
|---|---|---|---|---|
| P-1 | Tools estándar (`buscar_tienda`, `buscar_producto`, `derivar_humano`, `guardar_dato`, `etiquetar`) | 🟡 | `TOOL_DEFINITIONS` con `buscar_tienda`, `buscar_producto`, `registrar_campo` (= guardar_dato), `guardar_lead`, `derivar`, `consultar_horario` ([FW] `src/engine/tools.ts:10-73`); `buscar_tienda` es la única fuente de tiendas ([FW] `tools.ts:14`, `src/engine/engine.ts:74`) | `etiquetar` (G-1) |
| P-2 | `OutgoingMessage.location / list / requestLocation` | 🟡 | `location` ✅ ([FW] `src/types.ts:24-25`), lo usa `buscar_tienda` para mandar el pin ([FW] `tools.ts:163-166`) y lo arman WhatsApp ([FW] `src/channels/whatsapp.ts:85-87`), Instagram (link de Maps, [FW] `src/channels/instagram.ts:56-59`) y web ([FW] `src/channels/web.ts:81`) | `list` y `requestLocation` (G-3). En Telegram `/start` se convierte en "hola" sin botón de ubicación ([FW] `src/cli/telegram.ts:56`) |
| P-3 | `externalId` para idempotencia + `media` tipado | 🟡 | Idempotencia ✅ con `messageId` ([FW] `types.ts:11-12`) en dos niveles: `Debouncer` ([FW] `src/channels/debounce.ts:18-22`) y conversación ([FW] `engine.ts:156-159`) | Medios siguen como `mediaUrl` con prefijos `whatsapp-media:` / `telegram-file:` ([FW] `whatsapp.ts:58`, `src/channels/telegram.ts:144`); no se distingue audio de imagen (G-4) |
| P-4 | Agrupar ráfagas (debounce) | ✅ | `Debouncer` + `mergeMessages` ([FW] `debounce.ts:7-61`), en webhooks ([FW] `src/app.ts:133-148`) y en Telegram por polling ([FW] `cli/telegram.ts:33`, `:57`); ventana `DEBOUNCE_SECONDS` (defecto 3 s) | Opcional: configurarlo por bot en `bot.yaml` (hoy es variable de entorno) |
| P-5 | Modo humano con expiración | ✅ | `paused`, `pausedAt` ([FW] `types.ts:154-158`); pausa al derivar ([FW] `tools.ts:377-381`); vence a las 12 h ([FW] `engine.ts:28-29`, `:177-181`); el bot calla mientras tanto ([FW] `engine.ts:182-185`); reactivar por API ([FW] `app.ts:160-165`) o `/reactivar` en Telegram ([FW] `cli/telegram.ts:48-54`) | — |
| P-6 | Guardas de salida | 🟡 | (b) precios: regex + reintento + borrado de oraciones con montos ([FW] `engine.ts:251-268`, `:420-443`); (c) largo por palabras/caracteres ([FW] `engine.ts:430-434`); teléfonos y links no verificados se reemplazan ([FW] `engine.ts:401-418`) | (a) **nombres de tienda** no se verifican contra `tiendas.csv` (solo teléfonos/links) (G-5) |
| P-7 | Etiquetas + `resumen_corto` | 🟡 | `Handoff.resumen` existe ([FW] `types.ts:185`), la tool `derivar` lo acepta ([FW] `tools.ts:63`, `:361`) y se guarda en Supabase ([FW] `src/store/supabase.ts:82`); el aviso al humano lleva transcript ([FW] `src/handoff/index.ts:4-10`, `handoff/index.ts:94-99`) | `Conversation.tags` (G-1); resumen **automático** cuando el LLM no lo da o cuando deriva por palabra clave (entrada sin `resumen`, [FW] `engine.ts:209`) (G-2) |
| P-8 | Reglas de seguimiento | 🟡 | Clave única por regla ([FW] `src/followups/index.ts:27-28`); respuesta del cliente reinicia el conteo (se mide desde `lastUserAt`, `followups/index.ts:29`); no insiste pasado 2× el tiempo (`followups/index.ts:32-33`); ventana de 24 h ([FW] `followups/index.ts:47-49`, `src/channels/meta.ts:71-80`); se activa con `FOLLOWUPS_ENABLED=true` ([FW] `src/server.ts:19`) | Validar `despues_de` ≤ 23 h en WA/IG al cargar; horario silencioso 08–20 h; máx. 1 seguimiento **por conversación** (hoy 1 por regla); dentro de 24 h en WhatsApp manda plantilla aunque podría ir texto libre gratis (`followups/index.ts:48`) (G-6) |
| P-9 | Claves nuevas de evals | ✅ | `no_pide_campo`, `tienda_id_en`, `max_tiendas`, `no_inventa_tiendas`, `contiene_alguno`, `deriva_a`, `prioridad`, `ofrece_humano`, `max_burbujas`, `seguimientos_*`, `respuestas_totales`, `audio_transcrito`, `imagen_descrita`, `esperar`, `hora_simulada` ([FW] `src/evals/runner.ts:184-276`, `:295-298`, `:313-322`, `:370-373`); claves desconocidas van al juez ([FW] `runner.ts:13`) | — (`docs/ingenieria-inversa/evals-propuestos.yaml` se puede correr tal cual) |
| P-10 | `limites.fuera_de_tema` | ✅ | Esquema ([FW] `src/config/schema.ts:105`) y prompt ([FW] `engine.ts:344`); el bot Mokalú ya lo usa (`bots/mokalu/bot.yaml:114`, rama agente/3-bots) | — |
| P-11 | Transparencia (reconoce ser asistente virtual) | ✅ | Regla fija del núcleo ([FW] `engine.ts:81`) | — |

## 2. Funcionalidades P0 de `00-RESUMEN.md`

| Funcionalidad | Estado | Evidencia |
|---|---|---|
| Telegram y chat web para pruebas | ✅ | Telegram polling + webhook con secreto ([FW] `telegram.ts:38`, `:53`, `:105`, `:115`), "escribiendo…" ([FW] `telegram.ts:97`); chat web con geolocalización y botones ([FW] `web.ts:80-91`); simulador `POST /sim/:botId` ([FW] `app.ts:69-85`) |
| IA con datos del negocio | ✅ | Conocimiento completo y cacheado si < 40.000 caracteres, si no recuperación por palabras ([FW] `engine.ts:331-337`, `src/engine/knowledge.ts:11-53`); prompt caching de Anthropic ([FW] `src/llm/anthropic.ts:18-19`); proveedores Anthropic/DeepSeek/Claude CLI/mock ([FW] `src/llm/index.ts:12-28`) |
| Localizador de tienda más cercana | ✅ | `Locator` con haversine, fuzzy y lugares del bot ([FW] `src/locator/locator.ts:50-59`, `:91`, `:118`, `:164`); oferta online según distancia ([FW] `tools.ts:206-225`) |
| Nunca inventar tiendas/precios | 🟡 | ver P-6 (falta verificar nombres de tienda, G-5) |
| Paso a humano con contexto | ✅ | `derivar` + reglas por palabra clave deterministas ([FW] `engine.ts:203-212`, `:313-316`) + avisos consola/webhook n8n/Telegram admin ([FW] `handoff/index.ts:18-92`) + derivación automática tras N turnos sin avance ([FW] `engine.ts:276-283`) |
| Configuración del bot por archivos | ✅ | `loadBot` + validación zod ([FW] `src/config/loader.ts:192-242`, `src/config/schema.ts`) |
| Tono configurable | ✅ | `persona` en `bot.yaml` → plantilla del prompt ([FW] `loader.ts:233`) |
| Objetivos / flujos con campos | ✅ | `registrar_campo`, `missingFields`, `al_completar` ([FW] `tools.ts:270-307`); estado en `<estado>` ([FW] `engine.ts:361-370`) |
| Agrupar ráfagas | ✅ | ver P-4 |
| Idempotencia de webhooks | ✅ | ver P-3 |
| Evals automáticas y juez | ✅ | runner ([FW] `src/evals/runner.ts`), CLI ([FW] `src/cli/eval.ts:47-52`) |
| Multi-bot | ✅ | rutas `/:botId` ([FW] `app.ts:69`, `:117-124`), tokens por bot ([FW] `src/runtime.ts:42-56`) |
| Seguridad | ✅ | firma Meta HMAC ([FW] `meta.ts:9-17`), secreto de Telegram ([FW] `telegram.ts:53`), 401 si la firma falla ([FW] `app.ts:131`), admin con `ADMIN_TOKEN` ([FW] `app.ts:161-162`); envío a Meta **apagado** por defecto ([FW] `meta.ts:30-37`, `meta.ts:66-69`) |

## 3. Funcionalidades P1

| Funcionalidad | Estado | Evidencia / falta |
|---|---|---|
| WhatsApp Cloud API (esqueleto + mocks) | ✅ | Parseo de texto/botones/ubicación/medios ([FW] `whatsapp.ts:32-67`), payloads texto/botones ≤3/ubicación/imagen/plantilla ([FW] `whatsapp.ts:70-100`), bloqueo fuera de 24 h ([FW] `whatsapp.ts:103-110`), verificación GET ([FW] `app.ts:117-122`). Falta: pedir ubicación (*location request*), marcar leído + "escribiendo…", descargar medios por id (G-10, G-12) |
| Instagram (esqueleto + mocks) | ✅ | ([FW] `instagram.ts:28-78`), ignora ecos ([FW] `instagram.ts:35`) |
| Entender notas de voz | ❌ | El motor solo ve "[el cliente envió un archivo/imagen]" ([FW] `engine.ts:393`) → en un canal real C03 (audio) falla (G-4) |
| Entender imágenes | ❌ | Igual; la imagen no llega al LLM (G-4) |
| Etiquetas / CRM | ❌ | G-1 |
| Resumen corto | 🟡 | G-2 |
| Seguimiento automático | 🟡 | G-6 |
| Prompt editable sin redeploy | 🟡 | El prompt vive en `bots/<id>/prompts/sistema.md` (git) y `runtime(botId, reload)` permite recargar ([FW] `engine.ts:111-113`), pero no hay endpoint/comando para recargar en caliente (G-9) |
| Métricas para el dueño | ❌ | Solo listado de conversaciones ([FW] `app.ts:167-172`); ningún reporte de ciudades sin cobertura (G-8) |

## 4. Huecos anotados en `PENDIENTES.md` (`[framework]`)

| Id | Hueco | Prioridad sugerida |
|---|---|---|
| G-1 | Tool `etiquetar` + `Conversation.tags` (intencion/ciudad/producto/resultado/canal) | P1 |
| G-2 | `resumen_corto` automático al derivar (también en derivación por palabra clave) y al cerrar | P1 |
| G-3 | `OutgoingMessage.requestLocation` (Telegram `KeyboardButton.request_location`, WhatsApp *location request*) y `list`; botón de ubicación en `/start` | P1 |
| G-4 | Medios tipados (`audio`/`image`) + transcripción de audio + imagen al LLM con visión | P1 (P0 si el dueño confirma que reciben muchos audios) |
| G-5 | Guarda de salida: cada nombre de tienda citado debe existir en `tiendas.csv` / resultado de `buscar_tienda` | P0 |
| G-6 | Seguimientos: validar ≤ 23 h en WA/IG, horario silencioso, máx. 1 por conversación, texto libre dentro de 24 h | P1 |
| G-8 | Reporte/métrica: ciudades sin cobertura, intenciones, derivaciones | P1 |
| G-9 | Recarga en caliente del bot (endpoint admin) | P2 |
| G-10 | WhatsApp: *location request*, marcar leído + indicador de escritura | P2 (al conectar Meta) |
| G-12 | WhatsApp/Telegram: descargar medios por id (`GET /{media-id}` / `getFile`) | P1 (requisito de G-4) |

(G-7 y G-11 se descartaron: G-7 debounce por bot es opcional; G-11 etiqueta `HUMAN_AGENT` de Instagram la usan humanos desde su bandeja, no el bot.)

---

## 5. Re-verificación final

Ver la sección al final del archivo (se repite la revisión contra el último commit de `agente/2-framework` antes de cerrar la noche).
