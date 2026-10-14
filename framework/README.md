# Framework de chatbots — un bot = una carpeta

Motor reutilizable para bots de venta y atención (chat web, Telegram; WhatsApp e Instagram preparados).
**Un bot nuevo = una carpeta `bots/<id>/`** con `bot.yaml`, conocimiento, tiendas y evals — sin tocar código.
Formato completo en [`docs/CONTRATO.md`](../docs/CONTRATO.md). Por qué no usamos BuilderBot: [`DECISION-BASE.md`](DECISION-BASE.md).

```
Cliente ─▶ Canal (web · Telegram · WhatsApp* · Instagram*) ─▶ Motor ─▶ IA (Claude / DeepSeek)
                                                               │  └─ herramientas: buscar_tienda, buscar_producto,
                                                               │     registrar_campo, guardar_lead, derivar, consultar_horario
                                                               ├─▶ Localizador de tiendas (24 provincias, GPS, faltas de ortografía)
                                                               ├─▶ Derivación a humano (aviso n8n / Telegram, pausa del bot)
                                                               └─▶ Persistencia (memoria o Supabase)          * esqueleto, sin conectar
```

## 1. Correrlo en tu computadora (5 minutos)

Requisitos: Node.js 20 o superior.

```bash
cd framework
npm install
cp ../.env.example .env        # y llena lo que tengas (puede quedar vacío para probar)
npm test                       # todas las pruebas deben salir en verde
npm run dev                    # servidor en http://localhost:3000
```

- **Chat web de prueba:** abre `http://localhost:3000/chat/mokalu` (o `/chat/_plantilla`). Botón 📍 para compartir ubicación,
  ↺ para reiniciar, y "Depuración" muestra qué herramientas usó el bot.
- **Chat por terminal:** `npm run sim -- mokalu` (agrega `--mock` para no usar IA y `--debug` para ver herramientas).
  Comandos: `/ubicacion -1.67,-78.65`, `/reiniciar`, `/estado`, `/salir`.
- **Validar un bot** (sin IA): `npm run validate -- mokalu` → revisa `bot.yaml`, CSV, evals y tiendas sin coordenadas.
- **Evals:** `npm run eval -- mokalu` (gratis, sin IA) o `npm run eval -- mokalu --ia` (con IA real y juez LLM).
  El reporte queda en `bots/mokalu/reportes/evals-<fecha>.md`.

### ¿Qué IA usa?
| Si hay… | Usa |
|---|---|
| `LLM_PROVIDER=…` | ese (`anthropic`, `deepseek`, `claude-cli`, `mock`) |
| `ANTHROPIC_API_KEY` | Claude por API (Haiku para conversar, Sonnet si la conversación se traba). Con *prompt caching* del conocimiento. |
| `DEEPSEEK_API_KEY` | DeepSeek |
| la CLI `claude` instalada | Claude Code CLI (**solo desarrollo**, usa los créditos de la sesión) |
| nada | `mock`: respuestas por reglas, sin IA (sirve para probar datos y flujo, no la calidad) |

## 2. Probar en Telegram en 5 minutos

1. En Telegram abre **@BotFather** → `/newbot` → nombre (ej. "Mokalú Asesor") → usuario (debe terminar en `bot`).
2. Copia el token que te da y pégalo en `framework/.env`: `TELEGRAM_BOT_TOKEN=123456:ABC...`
3. Pon también la clave de IA: `ANTHROPIC_API_KEY=...`
4. Ejecuta:
   ```bash
   npm run telegram -- mokalu
   ```
5. Abre tu bot en Telegram y escribe "hola". Puedes mandar tu ubicación con 📎 → Ubicación.

Funciona con *long polling*: **no necesita dominio ni servidor público** (sirve desde tu PC). Se apaga con Ctrl+C.

**Avisos de derivación a un grupo de asesores (opcional):** crea un grupo, agrega el bot, escribe algo y obtén el `chat_id`
(por ejemplo con @userinfobot o mirando `https://api.telegram.org/bot<TOKEN>/getUpdates`). Ponlo en `TELEGRAM_ADMIN_CHAT_ID`.
Cuando el bot derive, llega un aviso con la conversación; para devolverle el chat al bot: `/reactivar mokalu <usuario>`.

## 3. Endpoints del servidor (`npm run dev` / `npm start`)

| Método y ruta | Para qué |
|---|---|
| `GET /health` | estado, proveedor de IA y bots disponibles |
| `GET /chat/:botId` | chat web de prueba |
| `POST /sim/:botId` | simulador para pruebas automáticas. Body `{"userId":"u1","text":"hola"}` o `{"userId":"u1","location":{"lat":-1.67,"lng":-78.65}}` o `{"userId":"u1","reset":true}`. Responde `{replies, toolCalls, actions, tiendas, motivos, state, skipped?}` |
| `POST /webhook/telegram/:botId` | Telegram en modo webhook (con `TELEGRAM_WEBHOOK_SECRET`) |
| `GET/POST /webhook/whatsapp/:botId` · `/webhook/instagram/:botId` | Meta (verificación + firma). **Envío apagado** |
| `POST /admin/:botId/:userId/resume` | reactivar el bot tras derivar (header `Authorization: Bearer $ADMIN_TOKEN`) |
| `GET /admin/:botId/conversations` | listado de conversaciones (mismo token) |
| `GET /admin/:botId/metricas` | conteos por etiqueta: ciudades, intenciones, derivaciones y **ciudades sin tienda** (`sin_cobertura`) |
| `POST /admin/:botId/reload` | recarga la carpeta del bot (tras editar `tiendas.csv`, prompt o conocimiento) sin reiniciar |
| `POST /webhook/evolution/:botId?secret=…` | Evolution API (WhatsApp no oficial) — esqueleto, **envío apagado** |

Los webhooks responden 200 de inmediato y procesan en segundo plano; mensajes repetidos (mismo id) se ignoran y las ráfagas
del mismo cliente se agrupan (`DEBOUNCE_SECONDS`, 3 s por defecto).

## 4. Desplegar (para que el bot quede encendido 24/7)

El servicio es un proceso Node sin estado propio (el estado va en Supabase si lo configuras).

**Opción A — Railway / Render (lo más simple)**
1. Crea un servicio desde este repositorio de GitHub. *Root directory*: `framework`.
2. *Build command*: `npm install` · *Start command*: `npm start` (servidor HTTP) o `npm run telegram -- mokalu` (solo Telegram por polling).
3. Variables de entorno: copia las de `.env.example` que uses (`ANTHROPIC_API_KEY`, `TELEGRAM_BOT_TOKEN`, `ADMIN_TOKEN`, `SUPABASE_*`…).
   **En un servidor público define `SIM_TOKEN`**: así `/sim` y `/chat` (que usan tu clave de IA) piden ese token
   (en el navegador: `https://<servicio>/chat/mokalu?token=<SIM_TOKEN>` la primera vez). `RATE_LIMIT_PER_MINUTE` frena el spam.
4. Para Telegram por webhook (recomendado en producción): con la URL pública del servicio, ejecuta una vez
   `curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<tu-servicio>/webhook/telegram/mokalu&secret_token=<TELEGRAM_WEBHOOK_SECRET>"`.
   (No uses polling y webhook a la vez.)

**Opción B — VPS (Ubuntu)**: instala Node 20, clona el repo, `cd framework && npm install`, y deja el proceso con
`pm2 start "npm start" --name bots` (o un servicio de systemd). Pon un proxy con HTTPS (Caddy o Nginx) delante del puerto 3000.

**Opción C — n8n (ya lo usan)**: n8n puede ser la puerta de entrada y llamar al motor:
nodo *Webhook/Telegram Trigger* → nodo *HTTP Request* `POST https://<servicio>/sim/mokalu` con `{"userId": "{{chat.id}}", "text": "{{mensaje}}"}`
→ enviar `replies[].text` por el canal. Las derivaciones pueden volver a n8n con `HANDOFF_WEBHOOK_URL` (JSON con motivo,
destino, campos y transcript) para crear una tarea en ClickUp, avisar por WhatsApp a un asesor, etc.

**Persistencia (opcional pero recomendada en producción):** crea un proyecto en Supabase, abre *SQL Editor*, pega
`supabase/migrations/0001_init.sql` y ejecútalo. Luego `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` (solo en el servidor).

## 5. Futuro: conectar WhatsApp e Instagram (Meta)

Ya están los adaptadores (`src/channels/whatsapp.ts`, `instagram.ts`) con verificación de firma `X-Hub-Signature-256`,
ventana de 24 h (fuera de ella solo plantillas aprobadas), botones (≤3, títulos ≤20 caracteres), ubicación e imágenes.
**El envío real está apagado** (`DisabledTransport`) hasta que se haga lo siguiente:

1. Meta Business verificado, app en developers.facebook.com con los productos WhatsApp e Instagram (ver `PASOS-HUMANOS.md`, Fase 2).
2. Variables: `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TOKEN` (permanente), `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`
   (e `INSTAGRAM_*` equivalentes).
3. En la app de Meta, URL del webhook: `https://<servicio>/webhook/whatsapp/mokalu` con el *verify token* elegido;
   suscribirse a `messages`. Para Instagram: `https://<servicio>/webhook/instagram/mokalu`.
4. Aprobar las plantillas de `bots/mokalu/plantillas-whatsapp.md` (para seguimientos fuera de 24 h).
5. Recién entonces: `META_ENABLE_SEND=true`. Probar primero con un número de prueba de Meta.

## 6. Crear un bot nuevo

1. Copia `bots/_plantilla/` a `bots/<nuevo-id>/` y cambia `id:` en `bot.yaml`.
2. Edita `prompts/sistema.md`, `conocimiento/*.md`, `tiendas.csv` (y opcional `catalogo.csv`, `lugares.csv`).
3. `npm run validate -- <nuevo-id>` y `npm run eval -- <nuevo-id>`.
4. Ábrelo en `http://localhost:3000/chat/<nuevo-id>`.

### Localizador de tiendas
- Entiende ciudades, cantones, provincias, sectores ("cerca del Mall del Sol", "sur de Quito", "Cumbayá"), gentilicios
  ("guayaco", "morlaco", "quiteño"), faltas de ortografía ("rio bamba", "guayakil", "ambtao") y ubicación compartida (GPS).
- Si no hay tienda en la ciudad: la más cercana por distancia (haversine) con aviso, y si queda lejos, la compra online
  (`localizador.ofrecer_ademas`).
- Diccionario en `src/locator/ecuador.ts` (24 provincias, ~250 lugares; fuente dr5hn/ODbL + complemento aproximado).
  Cada bot puede sumar lugares propios con `localizador.lugares: lugares.csv` y alias con `localizador.alias`.
- Anti-alucinación: las tiendas solo salen de `tiendas.csv` vía la herramienta; cualquier teléfono o link que la IA escriba
  y no esté en los datos se borra antes de enviar.

## 7. Estructura del código

```
src/
  types.ts            interfaces del contrato
  config/             carga y valida bot.yaml (zod), CSV, conocimiento, ${VARIABLES}
  locator/            diccionario de Ecuador, normalización, StoreLocator
  llm/                Anthropic, DeepSeek, ClaudeCli (dev), Mock; protocolo de herramientas por texto
  engine/             ciclo de conversación, herramientas, conocimiento, horario, guardas de salida
  channels/           simulador, chat web, Telegram, WhatsApp*, Instagram*, Periskope*, agrupación de ráfagas
  store/              memoria y Supabase
  handoff/            avisos de derivación (consola, webhook n8n, grupo de Telegram)
  followups/          seguimientos programados
  evals/              runner de evals + juez LLM + reporte
  app.ts / server.ts  servidor HTTP (Hono)
  cli/                sim, telegram, eval, validate
supabase/migrations/  SQL (no aplicado a ningún proyecto)
test/                 pruebas (Vitest)
```
