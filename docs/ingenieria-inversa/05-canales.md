# 05 · Canales: cómo se conecta SellerChat y qué hace falta para el nuestro

> Agente 1 · 2026-10-14. Alias de repos: ver `01-mapa-del-codigo.md`. Fuentes numeradas [Sx]: ver `07`.
> Recordatorio (CLAUDE.md): **esta noche no se conecta Meta**. Se prueba con simulador, chat web y Telegram.

## 1. Lo que usa SellerChat (y los repos de referencia)

| Canal | Cómo | Evidencia |
|---|---|---|
| WhatsApp (bot) | **API oficial — WhatsApp Cloud API** de Meta; el asistente usa ChatGPT | sitio sellerchat.ai según resultados de búsqueda [S1] |
| WhatsApp (captación) | Enlaces `wa.me/<número>?text=…` con mensaje pre-llenado; sin API | [PA] `src/app/page.tsx:92-100`, `:45` |
| Instagram / Messenger | No hay evidencia pública de soporte en SellerChat (su oferta se presenta como "para WhatsApp") | [S1] |
| Teléfono (SellerCall) | **Twilio** (PSTN) + **Ultravox** (agente de voz) por SIP; webhook `POST /api/inbound` responde TwiML | [SB] `Controllers/InboundController.cs:37-103`, `Services/UltravoxService.cs:67-109` |
| Panel interno | SignalR (`/callhub`, `/loghub`) | [SB] `Program.cs:94-95` |

Conclusión: SellerChat se apoya en la **API oficial** (no en WhatsApp Web/QR no oficial), lo cual coincide con nuestra decisión.

## 2. Nuestra interfaz (del contrato) y lo que cada canal debe mapear

```ts
interface ChannelAdapter { name; parseWebhook(req): IncomingMessage[]; send(userId, msg: OutgoingMessage): Promise<void>; verifyWebhook?(req): boolean }
```

| Capacidad | Web local | Telegram (ahora) | WhatsApp Cloud API (después) | Instagram Messaging (después) |
|---|---|---|---|---|
| Recepción | HTTP/WebSocket propio | webhook **o** long-polling `getUpdates` (excluyentes) | webhook HTTPS (verificación GET `hub.challenge` + POST firmado) | webhook HTTPS (mismo esquema de Meta) |
| Verificación | — (local) | header `X-Telegram-Bot-Api-Secret-Token` = `secret_token` de `setWebhook` [S20] | `X-Hub-Signature-256` HMAC-SHA256 con App Secret | igual que WhatsApp |
| `userId` | id de sesión | `chat.id` | `wa_id` (teléfono) | IGSID (id con alcance de la página) |
| Id para idempotencia | uuid | `update_id` | `messages[].id` (wamid) | `message.mid` |
| Texto | ✔ | ✔ | ✔ (≤ 4096 car.) | ✔ (≤ 1000 car. según terceros [S16]) |
| Botones | HTML | teclado inline (`callback_data`) | **reply buttons máx. 3**, título ≤ 20 car. [S18] | quick replies |
| Lista/menú | HTML | teclado | **list message** hasta 10 filas [S18] | — |
| Pedir ubicación | geolocalización del navegador | `KeyboardButton(request_location)` | **location request message** (botón "enviar ubicación") [S18] | no hay; pedir texto |
| Ubicación entrante | lat/lng | `message.location` | `messages[].location` | — (solo texto) |
| Enviar ubicación de tienda | link Maps | `sendLocation` / `sendVenue` | mensaje tipo `location` | link Maps |
| Audio entrante | grabación | `message.voice` → `getFile` | `messages[].audio` → descargar media por id | `attachments[type=audio]` |
| Imagen entrante | ✔ | `message.photo` | `messages[].image` | `attachments[type=image]` |
| "Escribiendo…" | UI | `sendChatAction typing` (~5 s) | typing indicator al marcar leído (dura hasta 25 s según [S19]) | `sender_action typing_on` |
| Ventana de respuesta | libre | libre | **24 h** desde el último mensaje del cliente; fuera → plantilla de pago | **24 h**; humano con etiqueta `HUMAN_AGENT` hasta 7 días [S12] |
| Mensajes proactivos | — | permitidos si el usuario inició el bot | solo plantillas aprobadas (marketing/utility/auth) | no (solo dentro de ventana) |
| Límite de envío | — | ~30 msg/s global, ~1 msg/s por chat (Bot FAQ; verificar) | por portafolio: 250 usuarios únicos/24 h sin verificar → escalones superiores [S9] | límite por caso de uso de negocio [S15] |

`OutgoingMessage` del contrato (`text`, `buttons`, `mediaUrl`, `template`) cubre todo salvo **ubicación** y **lista**.
→ Propuesta en `docs/CONTRATO.md` (sección Propuestas): añadir `location?: {lat,lng,name?,address?}`, `list?: {...}` y `requestLocation?: boolean`.
Cada adaptador degrada con gracia (ej. sin lista → botones; sin botones → opciones numeradas "Responde 1, 2 o 3").

## 3. Telegram (prioridad de esta noche)

Por qué: gratis, se crea en 2 minutos con @BotFather, sin verificar empresa, soporta ubicación y botones → ideal para probar el localizador.

Recomendaciones de implementación:
1. **Desarrollo:** long-polling (`getUpdates`) → no necesita URL pública. **Producción:** webhook con `secret_token` [S20].
   No se pueden usar ambos a la vez (borrar webhook antes de hacer polling).
2. `/start` → saludo + botón "📍 Compartir mi ubicación" (`request_location`) + "Escribir mi ciudad".
3. Responder rápido con 2xx; Telegram reintenta si no recibe 2xx [S20] → idempotencia por `update_id`.
4. Formato: usar `parse_mode: HTML` (más fácil de escapar que MarkdownV2).
5. Token en `TELEGRAM_BOT_TOKEN` (ya listado en `PASOS-HUMANOS.md`). Opcional `TELEGRAM_WEBHOOK_SECRET`.

## 4. WhatsApp — opciones para conectar después

| Opción | Pros | Contras | Recomendación |
|---|---|---|---|
| **Cloud API directa de Meta** | oficial, sin intermediario, sin costo de BSP; lo usa SellerChat [S1] | requiere app en developers.facebook.com, Business verificado para escalar, plantillas aprobadas, webhook público | **Sí (camino principal)** |
| BSP (360dialog, Twilio, Gupshup, YCloud…) | onboarding más guiado, soporte | costo extra por mensaje/mes | alternativa si Meta se complica |
| **Coexistence** (mismo número en la app WhatsApp Business **y** en la Cloud API) | Mokalú puede seguir usando su app en el celular mientras el bot responde | app ≥ 2.24.17, no comparten estado de ventana ni facturación, throughput fijo ~20 msg/s, algunas funciones (ver una vez, ubicación en tiempo real) dejan de funcionar [S13] | **Evaluar**: probable deseo del dueño |
| No oficial (Baileys, WhatsApp Web, Evolution API en modo Baileys, Periskope) | rápido, sin aprobaciones | **riesgo de bloqueo del número**, contra los términos de WhatsApp | **No** para el número principal. Solo pruebas con un número desechable, si acaso |

Política relevante (2026): WhatsApp prohíbe en la Business API los **chatbots de IA de propósito general** desde el 15-ene-2026;
están permitidos bots acotados al negocio (soporte, FAQ, pedidos, citas) [S6][S7]. Nuestro bot debe **rechazar temas ajenos** (ver `03` §5).

Pasos humanos ya listados en `PASOS-HUMANOS.md` (Fase 2). Añadimos los que faltaban (ver ese archivo).

## 5. Instagram — qué hace falta

- Cuenta **profesional** (empresa/creador). Dos rutas de API: *Instagram API con inicio de sesión de Instagram* (permiso
  `instagram_business_manage_messages`) o vía página de Facebook; no se pueden usar ambas en la misma app [S14].
- **App Review** para acceso avanzado si la app no lo tiene automáticamente [S14].
- Activar "Permitir acceso a mensajes" en la app de Instagram (ya en `PASOS-HUMANOS.md`).
- Solo se responde dentro de 24 h; `HUMAN_AGENT` (7 días) solo para personas, nunca para el bot [S12].
- Instagram es probablemente el **canal de entrada principal** de Mokalú (@mokalu_ec, ~40 mil seguidores — `docs/marcas.md`):
  muchas preguntas llegan como respuesta a historias o comentarios → considerar (P2) *respuesta privada a comentarios* ("¿dónde lo compro?" en un post → DM).

## 6. Riesgos de canal (resumen)
1. **Bloqueo de número** si se usa cliente no oficial o si muchos usuarios bloquean/reportan → bajar calidad → bajar límites [S9].
2. **Costos**: desde 2025 Meta cobra por mensaje de plantilla entregado; dentro de la ventana de servicio las respuestas libres y las plantillas utility son gratis [S8].
   Un tercero (respond.io) reporta que desde 1-oct-2026 los mensajes de servicio superiores a 1.000/mes por número también se cobran [S10] — **confirmar en la página oficial de precios**.
3. **Entradas por anuncios Click-to-WhatsApp** abren una ventana gratuita de **72 h** [S8] → útil si Mokalú hace pauta.
