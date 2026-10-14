# Agente 2 · Arquitecto — el framework para crear chatbots

**Rama:** `agente/2-framework` · **Carpetas:** `framework/`, `.env.example`

## Misión
Construir un motor reutilizable: **un bot nuevo = una carpeta `bots/<id>/`**, sin tocar código.
Debe quedar listo para que mañana solo falte pegar tokens y apuntar los webhooks de Meta.

## Pasos
1. Lee `CLAUDE.md`, `FORMULARIO.md` (sección E) y `docs/CONTRATO.md`. Respeta las interfaces del contrato.
2. Inicializa `framework/` (Node 20 + TypeScript + Vitest; ESLint opcional). Scripts: `npm test`, `npm run dev`,
   `npm run sim -- <bot-id>`, `npm run eval -- <bot-id>`.
3. Implementa, con pruebas para cada pieza:
   - `config/` — carga y valida `bot.yaml` (zod), resuelve `${VARIABLES}` desde el entorno, carga `conocimiento/` y `catalogo.csv`.
   - `engine/` — el ciclo de conversación: historial → prompt de sistema + conocimiento relevante → LLM con
     herramientas (`buscar_producto`, `registrar_campo`, `guardar_pedido`, `derivar`, `consultar_horario`)
     → respuesta. Máquina de estados para `flujos` (qué campos faltan). Reglas de derivación y límites.
     Anti-alucinación: precios y stock **solo** salen de la herramienta `buscar_producto`.
   - `llm/` — `AnthropicProvider` (SDK oficial `@anthropic-ai/sdk`, prompt caching del sistema+conocimiento),
     `DeepSeekProvider` (compatible OpenAI) y `MockProvider` determinista para pruebas.
   - `channels/` — `WhatsAppCloudAdapter` (verificación de webhook, firma `X-Hub-Signature-256`, envío de texto,
     botones, plantillas), `InstagramAdapter` (Graph API Messaging), `PeriskopeAdapter` (esqueleto), `SimulatorAdapter`.
     Respeta la ventana de 24 h: fuera de ella solo plantillas.
   - `store/` — `MemoryStore` y `SupabaseStore` + migración SQL en `framework/supabase/migrations/`
     (conversaciones, mensajes, pedidos, derivaciones). **No** apliques la migración a ningún proyecto real.
   - `server.ts` — HTTP (Fastify o Hono): `GET/POST /webhook/:channel/:botId`, `POST /sim/:botId`, `/health`.
     Responder 200 rápido a Meta y procesar en segundo plano; idempotencia por id de mensaje.
   - `handoff/` — al derivar: avisa al humano (WhatsApp al asesor o webhook a n8n), pausa el bot para ese chat,
     comando para reactivarlo.
   - `followups/` — seguimientos programados según `seguimiento` del bot.
   - `evals/` — runner del formato del contrato: corre cada eval con el LLM real si hay `ANTHROPIC_API_KEY`
     o con `MockProvider` si no; juez LLM opcional; reporte en `reportes/`.
   - `cli/sim.ts` — chat por terminal con cualquier bot (para que el dueño pruebe mañana).
4. `.env.example` con **todas** las variables (sin valores reales) y `framework/README.md`: cómo correrlo local,
   cómo desplegar (Railway/Render/VPS y opción n8n), cómo registrar webhooks en Meta.
5. Crea `bots/_plantilla/` (un bot de ejemplo genérico) para probar el motor sin depender del Agente 3.
6. Cada hora: `git pull` de `agente/3-bots` en una carpeta temporal y corre sus evals con tu motor; si fallan
   por el framework, arréglalo; si es por su config, anótalo en `PENDIENTES.md` con `[bots]`.

## Criterio de terminado
`npm test` verde, `npm run sim -- _plantilla` funciona con `MockProvider`, README explica el despliegue,
y cada paso que requiere a una persona está en `PASOS-HUMANOS.md`.
