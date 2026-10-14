# Agente 2 · Arquitecto — el framework para crear chatbots

**Rama:** `agente/2-framework` · **Carpetas:** `framework/`, `.env.example`

## Misión
Construir un motor reutilizable: **un bot nuevo = una carpeta `bots/<id>/`**, sin tocar código.
Debe quedar listo para que mañana solo falte pegar el token de Telegram y la clave de IA. Meta (WhatsApp/Instagram) **no** se conecta todavía.

## Pasos
1. Lee `CLAUDE.md`, `FORMULARIO.md` (sección E), `docs/CONTRATO.md` y `docs/repos-base.md`. Respeta las interfaces del contrato.
1b. **Primera hora — no empezar de cero:** evalúa [BuilderBot](https://github.com/codigoencasa/builderbot) como base
   (licencia, providers disponibles —¿Telegram? ¿Instagram?—, cómo meter un LLM con herramientas, calidad del código).
   Escribe la decisión en `framework/DECISION-BASE.md` y en `PENDIENTES.md` `[decisión]`. Sea cual sea la base,
   los bots siguen siendo carpetas `bots/<id>/` según el contrato.
2. Inicializa `framework/` (Node 20 + TypeScript + Vitest; ESLint opcional). Scripts: `npm test`, `npm run dev`,
   `npm run sim -- <bot-id>`, `npm run eval -- <bot-id>`.
3. Implementa, con pruebas para cada pieza:
   - `config/` — carga y valida `bot.yaml` (zod), resuelve `${VARIABLES}` desde el entorno, carga `conocimiento/` y `catalogo.csv`.
   - `engine/` — el ciclo de conversación: historial → prompt de sistema + conocimiento relevante → LLM con
     herramientas (`buscar_tienda`, `buscar_producto`, `registrar_campo`, `guardar_lead`, `derivar`, `consultar_horario`)
     → respuesta. Máquina de estados para `flujos` (qué campos faltan). Reglas de derivación y límites.
     Anti-alucinación: tiendas, direcciones y teléfonos **solo** salen de `buscar_tienda`; productos de `buscar_producto`.
   - `locator/` — **pieza central del bot**: `StoreLocator` del contrato. Normaliza lo que escribe la gente
     ("rio bamba", "riobamba", "en la capital" → Quito, "guayaco", sectores conocidos), con un diccionario de
     cantones y provincias de Ecuador con coordenadas (fuente pública, cítala); acepta ubicación compartida
     (Telegram/WhatsApp) y elige por distancia (haversine). Si la ciudad no tiene tienda → la más cercana + aviso.
     Pruebas exhaustivas (las 24 provincias, faltas de ortografía, ciudades ambiguas).
   - `llm/` — `AnthropicProvider` (SDK oficial `@anthropic-ai/sdk`, prompt caching del sistema+conocimiento),
     `DeepSeekProvider` (compatible OpenAI), `MockProvider` determinista para pruebas unitarias y **`ClaudeCliProvider`**
     (solo desarrollo: llama a `claude -p` con el prompt armado y devuelve la respuesta; herramientas vía JSON en el texto).
     Selección automática: `ANTHROPIC_API_KEY` → Anthropic; si no, `claude` disponible → ClaudeCli; si no → Mock.
     **Hazlo en las primeras 2 horas**: los Agentes 3 y 4 lo necesitan para probar con IA real.
   - `channels/` — **prioridad:** `WebChatAdapter` (página HTML simple servida en `/chat/:botId`, para probar en el navegador),
     `TelegramAdapter` (Bot API: modo *long polling* para correr sin dominio público + modo webhook; texto, botones inline,
     fotos de producto), `SimulatorAdapter`.
     **Después (esqueleto + pruebas con mocks, sin llamadas reales):** `WhatsAppCloudAdapter` (firma `X-Hub-Signature-256`,
     plantillas, ventana de 24 h), `InstagramAdapter`, `PeriskopeAdapter`.
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
   cómo probar en Telegram en 5 minutos (crear bot en @BotFather → `TELEGRAM_BOT_TOKEN` → `npm run telegram -- mokalu`),
   cómo desplegar (Railway/Render/VPS y opción n8n) y, para el futuro, cómo se conectaría Meta.
5. Crea `bots/_plantilla/` (un bot de ejemplo genérico) para probar el motor sin depender del Agente 3.
6. Cada hora: `git fetch origin agente/3-bots` en una carpeta temporal y corre las evals de `bots/mokalu/` con tu motor; si fallan
   por el framework, arréglalo; si es por su config, anótalo en `PENDIENTES.md` con `[bots]`.

## Criterio de terminado
`npm test` verde, `npm run sim -- _plantilla` funciona con `MockProvider`, el chat web abre en el navegador,
el modo Telegram está listo para recibir el token, README explica el despliegue,
y cada paso que requiere a una persona está en `PASOS-HUMANOS.md`.
