# 09 · Guía paso a paso: conectar WhatsApp e Instagram (Meta) al framework

> Agente 1 · 2026-10-14. **Runbook para el dueño (o quien le ayude) cuando decida salir de Telegram.**
> Esta noche **no se conecta nada** (regla de `CLAUDE.md`): este documento solo describe los pasos.
> Las "capturas" están **descritas** (qué se ve en pantalla y dónde hacer clic) porque las pantallas de Meta cambian seguido;
> si algo no coincide, busca el mismo nombre en el menú. Fuentes al final [M#]. Cifras de terceros marcadas ⚠️.
> Nombres de variables y rutas: los del framework en `agente/2-framework@9e7790b` (`framework/README.md` §5, `.env.example`).

## 0. Mapa rápido

| Ruta | Para qué | Tiempo de tu trabajo | Espera de Meta | Riesgo |
|---|---|---|---|---|
| **A. WhatsApp Cloud API oficial** (recomendada) | Bot en el WhatsApp de Mokalú | ~3–4 h repartidas | verificación del negocio 2–14 días ⚠️ [M5]; nombre visible minutos–24 h ⚠️ [M6]; plantillas minutos–48 h ⚠️ [M7] | Bajo |
| **B. Instagram Messaging API** | Bot en los DM de @mokalu_ec | ~2–3 h + grabar video | App Review: Meta indica hasta ~10 días, hay casos de semanas ⚠️ [M9] | Bajo |
| **C. Evolution API** (alternativa) | Puente auto-hospedado; modo Baileys (no oficial) o modo Cloud API | ~2 h + servidor | ninguna (Baileys) | **Alto en modo Baileys** (bloqueo del número) |

Orden recomendado: **Fase 1 (servidor) → Fase 2 (Meta Business y verificación, arrancar YA porque tarda) → A (con número de prueba mientras verifican) → B → producción.**

---

## Fase 1 — Servidor público con HTTPS (30–60 min)

Meta solo envía webhooks a una URL **https** pública que responda rápido (Instagram: en < 5 s [M8]; el framework responde 200 de inmediato y procesa después, `framework/src/app.ts:133-135`).

1. Despliega el framework como dice `framework/README.md` §4 (Railway/Render: *Root directory* `framework`, *Start* `npm start`; o VPS con Caddy).
   *Captura descrita (Railway):* panel del proyecto → pestaña **Settings** → sección **Networking** → botón **Generate Domain** → aparece `https://<algo>.up.railway.app`.
2. Comprueba: `curl https://<tu-servicio>/health` → `{"ok":true,...,"bots":["mokalu"]}`.
3. Variables mínimas en el servicio: `ANTHROPIC_API_KEY`, `ADMIN_TOKEN` (texto largo aleatorio), `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (recomendado para no perder conversaciones al reiniciar), `META_ENABLE_SEND=false` (por ahora).
4. *Solo para pruebas rápidas desde tu PC:* un túnel (p. ej. `cloudflared tunnel --url http://localhost:3000`) da una URL https temporal. No lo uses en producción: la URL cambia.

✅ Listo cuando `/health` responde por https.

## Fase 2 — Meta Business Manager y verificación del negocio (1 h de trabajo + 2–14 días de espera ⚠️)

1. Entra a **business.facebook.com** con tu Facebook personal → **Crear cuenta** → nombre legal de Mokalú, tu nombre, correo del negocio.
2. **Configuración del negocio → Centro de seguridad → Verificación del negocio → Iniciar verificación.**
   *Captura descrita:* asistente con pasos "Detalles del negocio → Documentos → Contacto". Pide nombre legal, dirección, teléfono, web.
3. Documentos (Ecuador, adaptado de lo que piden en LatAm [M5]): **RUC** (documento tributario con el nombre legal) y **comprobante de dirección** (planilla de luz/agua/internet o estado de cuenta) con la **misma** razón social y dirección. Sin recortes, sin capturas, sin PDF con contraseña [M5].
4. La web (`mokalu.com.ec`) y el correo de dominio ayudan a validar (mismo nombre en todos lados).
5. Mientras esperas, sigue con la Fase A usando el **número de prueba** de Meta (no requiere verificación).

✅ Listo cuando el Centro de seguridad dice **Verificado**. Sin verificación: 250 conversaciones iniciadas por el negocio por día y no se puede pasar App Review de Instagram [M9] [S9 en `07`].

---

## Ruta A — WhatsApp Cloud API (oficial)

### A1. Crear la app (15 min)
1. **developers.facebook.com → Mis apps → Crear app.** Caso de uso: *Otro* → tipo **Negocio (Business)** → vincúlala al Business Manager de Mokalú.
   *Captura descrita:* pantalla "Agregar productos a tu app" con tarjetas; en la de **WhatsApp** clic en **Configurar**.
2. Meta crea una **cuenta de WhatsApp Business (WABA) de prueba** y un **número de prueba**. En **WhatsApp → Configuración de la API** verás:
   *Captura descrita:* bloque "Enviar y recibir mensajes" con **Token de acceso temporal** (botón *Generar*), desplegable **De** (el número de prueba) con su **Identificador del número de teléfono** (Phone number ID) e **Identificador de la cuenta de WhatsApp Business** (WABA ID), y **Para** (hasta 5 números destinatarios de prueba que debes verificar con un código).
3. Anota **Phone number ID** y **WABA ID** (no son secretos, pero tampoco van al repo).
4. **Configuración de la app → Básica → Clave secreta de la app** (App Secret) → *Mostrar*. Esto **sí es secreto**.

### A2. Primer mensaje de prueba (10 min)
1. En "Para", agrega tu celular personal y verifícalo.
2. Envía la plantilla `hello_world` con el botón de la página o con:
   ```bash
   curl -X POST "https://graph.facebook.com/v21.0/<PHONE_NUMBER_ID>/messages" \
     -H "Authorization: Bearer <TOKEN_TEMPORAL>" -H "Content-Type: application/json" \
     -d '{"messaging_product":"whatsapp","to":"<TU_CELULAR_593...>","type":"template","template":{"name":"hello_world","language":{"code":"en_US"}}}'
   ```
3. Responde "hola" desde tu celular: eso **abre la ventana de 24 h** y ahora el bot podrá contestarte con texto libre.

### A3. Webhook hacia el framework (20 min)
1. Elige un **verify token** (texto aleatorio tuyo) y ponlo en el servicio: `WHATSAPP_VERIFY_TOKEN=<texto>`.
2. Pon también: `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_TOKEN=<token temporal por ahora>`. Deja `META_ENABLE_SEND=false`. Redespliega.
3. Prueba tú mismo el handshake (lo que hará Meta):
   ```bash
   curl "https://<tu-servicio>/webhook/whatsapp/mokalu?hub.mode=subscribe&hub.verify_token=<texto>&hub.challenge=123"
   # debe responder: 123   (framework/src/app.ts:117-122)
   ```
4. En la app: **WhatsApp → Configuración → Webhook → Editar**.
   *Captura descrita:* ventana con **URL de devolución de llamada** = `https://<tu-servicio>/webhook/whatsapp/mokalu` y **Token de verificación** = `<texto>` → **Verificar y guardar**.
5. En la misma página, **Campos del webhook → `messages` → Suscribirse**.
6. Escribe "hola, dónde compro posca en Riobamba" desde tu celular. En los logs del servicio debe aparecer el mensaje recibido; la respuesta **no sale** todavía (envío apagado: `framework/src/channels/meta.ts:30-37`). Si ves `firma inválida` (401), el `WHATSAPP_APP_SECRET` no coincide (`app.ts:131`).

### A4. Encender el envío con el número de prueba (5 min)
1. `META_ENABLE_SEND=true` (y `META_GRAPH_VERSION` si Meta pide una versión más nueva). Redespliega.
2. Repite el "hola…": ahora el bot responde por WhatsApp. Prueba 5–10 conversaciones de `conversaciones-ejemplo.md` (C01, C04 con ubicación, C24 precio, C30 reclamo).
3. **Rollback inmediato** si algo sale mal: `META_ENABLE_SEND=false` (el bot deja de enviar, los webhooks siguen llegando).

### A5. Token permanente (20 min)
El temporal vence en ~24 h [M1].
1. **business.facebook.com → Configuración del negocio → Usuarios → Usuarios del sistema → Agregar** (rol *Administrador*).
2. **Asignar activos**: la app (control total) y la cuenta de WhatsApp (control total).
3. **Generar token** → elegir la app → permisos `whatsapp_business_messaging` y `whatsapp_business_management` → caducidad **Nunca**.
   *Captura descrita:* modal con la lista de permisos con casillas y, al final, el token largo con botón *Copiar* (solo se muestra una vez).
4. Reemplaza `WHATSAPP_TOKEN` en el servicio. Nunca lo pegues en el repo ni en chats.

### A6. Número real de Mokalú (30–60 min + esperas)
Decide antes (ver `05-canales.md` §4):
- **Número nuevo** (chip dedicado al bot): más simple; no puede estar registrado en la app de WhatsApp (o hay que borrarlo de la app primero).
- **Coexistencia** (mismo número que hoy usan en la app WhatsApp Business del celular, app ≥ 2.24.17): Mokalú sigue viendo y respondiendo desde el celular; se hace con el flujo de *Embedded Signup* de un proveedor o de Meta, escaneando un QR desde la app [S13 en `07`].

Pasos (número nuevo):
1. **WhatsApp Manager → Números de teléfono → Agregar número** → nombre visible (ej. "Mokalú") → categoría → verificación por SMS o llamada.
   El **nombre visible** pasa revisión (minutos a 24 h ⚠️, se rechaza si no coincide con la marca) [M6].
2. El número real tiene **otro Phone number ID**: actualiza `WHATSAPP_PHONE_NUMBER_ID` [M2].
3. **Registrar** el número en la Cloud API con un PIN de 6 dígitos (también queda como PIN de verificación en dos pasos; guárdalo en un gestor de contraseñas) [M1][M3]:
   ```bash
   curl -X POST "https://graph.facebook.com/v21.0/<PHONE_NUMBER_ID>/register" \
     -H "Authorization: Bearer <TOKEN_PERMANENTE>" -H "Content-Type: application/json" \
     -d '{"messaging_product":"whatsapp","pin":"<6 DIGITOS>"}'
   ```
4. **Suscribir la app a la WABA real** (si no, no llegan webhooks del número real) [M2]:
   ```bash
   curl -X POST "https://graph.facebook.com/v21.0/<WABA_ID>/subscribed_apps" -H "Authorization: Bearer <TOKEN_PERMANENTE>"
   ```
5. Método de pago en WhatsApp Manager (las plantillas se cobran; las respuestas dentro de 24 h son gratis, con el posible tope de 1.000/mes desde oct-2026 ⚠️ — ver `07` §3).

### A7. Plantillas (15 min + revisión minutos–48 h ⚠️ [M7])
1. **WhatsApp Manager → Plantillas de mensajes → Crear plantilla.** Sube las de `bots/mokalu/plantillas-whatsapp.md` (rama agente/3-bots).
2. Categoría **Utilidad** solo si no tienen tono promocional (Meta reclasifica a Marketing si hay ofertas/descuentos [M7]). Idioma `es` (el adaptador envía `language.code = "es"`, `framework/src/channels/whatsapp.ts:79`; si la plantilla se aprueba como `es_EC` o `es_LA`, ajustar).
3. Recuerda: dentro de 24 h **no** hace falta plantilla (ver hallazgo G-6 en `08-cobertura.md`).

### A8. Lista de salida a producción
- [ ] Negocio verificado · [ ] nombre visible aprobado · [ ] token permanente · [ ] número real registrado y app suscrita a la WABA
- [ ] webhook verificado y campo `messages` suscrito · [ ] `WHATSAPP_APP_SECRET` correcto (sin 401 en logs)
- [ ] `tiendas.csv` **real** cargado (sin filas `EJEMPLO`) · [ ] destinos humanos `WHATSAPP_ASESOR_*` configurados
- [ ] evals verdes (`npm run eval -- mokalu`) · [ ] Supabase activo · [ ] `FOLLOWUPS_ENABLED` decidido
- [ ] `META_ENABLE_SEND=true` · [ ] 10 conversaciones de prueba reales · [ ] revisar **calidad del número** en WhatsApp Manager la primera semana

---

## Ruta B — Instagram Messaging API (DM de @mokalu_ec)

> Usa la variante **Instagram API con inicio de sesión de Instagram** (no requiere página de Facebook). No mezclar con la variante de Facebook Login en la misma app [S14 en `07`].

### B1. Preparar la cuenta (10 min)
1. En la app de Instagram: **Configuración → Tipo de cuenta y herramientas → Cambiar a cuenta profesional** (Empresa).
2. **Configuración → Mensajes y respuestas a historias → Controles de mensajes → Herramientas conectadas → Permitir acceso a mensajes = activado.** Si está apagado, los webhooks **nunca llegan y no hay error** [M8].

### B2. Producto Instagram en la app (20 min)
1. En la misma app de Meta: **Agregar producto → Instagram → API setup with Instagram login** (Configuración de la API con inicio de sesión de Instagram).
2. **Roles de la app → Evaluadores de Instagram**: agrega @mokalu_ec (y una cuenta personal tuya para probar); acepta la invitación desde Instagram (web: Configuración → Apps y sitios web → Invitaciones de evaluador).
3. **Generar token** para la cuenta (botón *Generate token*; el de prueba dura ~60 días ⚠️ [M8]) → `INSTAGRAM_TOKEN`. El id de la cuenta que muestra → `INSTAGRAM_USER_ID`.
4. **Clave secreta de la app de Instagram** (en la misma sección) → `INSTAGRAM_APP_SECRET`. Elige `INSTAGRAM_VERIFY_TOKEN`.

### B3. Webhook (20 min)
1. **Configurar webhooks**: URL `https://<tu-servicio>/webhook/instagram/mokalu`, verify token = `INSTAGRAM_VERIFY_TOKEN` → *Verificar y guardar*.
2. Suscribir el campo **`messages`** (y `messaging_postbacks` si se usan botones).
3. Suscribir **la cuenta** a la app (sin esto el webhook de la app existe pero no recibe nada) [M8]:
   `POST /<INSTAGRAM_USER_ID>/subscribed_apps?subscribed_fields=messages,messaging_postbacks` con el token de la cuenta.
4. Desde tu cuenta personal (evaluadora) manda un DM a @mokalu_ec → debe aparecer en los logs.

### B4. ⚠️ Revisar el host de la API antes de encender el envío
El transporte del framework envía a `https://graph.facebook.com/<versión>/<INSTAGRAM_USER_ID>/messages` (`framework/src/channels/meta.ts:52-62`, `instagram.ts:77`).
Con **inicio de sesión de Instagram** los tokens son de `graph.instagram.com`; confirmar en la documentación de Meta cuál host acepta ese token y,
si es `graph.instagram.com`, hace falta un ajuste en el framework (anotado como **G-13** en `PENDIENTES.md`). Probar con `META_ENABLE_SEND=true` solo con cuentas evaluadoras.

### B5. App Review y modo Live (1–2 h + espera ⚠️ [M9])
1. Requisitos: negocio **verificado**, política de privacidad pública (URL), icono, categoría [M9].
2. **Revisión de la app → Solicitar** `instagram_business_basic` + `instagram_business_manage_messages` **en el mismo envío** [M8].
3. **Screencast** (video de pantalla, 1–3 min): mostrar login, un DM que llega y **la respuesta del bot recibida en Instagram** — enviar y recibir en la misma grabación; rechazan videos que solo muestran el envío [M9].
   *Captura descrita del video:* (1) navegador con el chat web/servidor; (2) app de Instagram de la cuenta evaluadora escribiendo "hola, ¿dónde compro POSCA en Quito?"; (3) la respuesta del bot apareciendo en el DM.
4. Tras la aprobación, poner la app en **Live** (interruptor arriba en el panel) para recibir mensajes de cualquier persona [M8].
5. Recordatorio de reglas: solo se responde dentro de 24 h; `HUMAN_AGENT` (7 días) es solo para personas [S12 en `07`].

---

## Ruta C — Evolution API (alternativa)

Qué es: servidor abierto (Docker) que expone una API REST de WhatsApp. Tiene dos modos [M10][M11]:
- **`WHATSAPP-BAILEYS`**: conecta escaneando un QR como WhatsApp Web. **No oficial** → riesgo de bloqueo del número. Útil solo para **pruebas con un chip desechable**, nunca con el número de Mokalú.
- **`WHATSAPP-BUSINESS`**: usa la Cloud API oficial por debajo (mismos requisitos de Meta que la Ruta A). Solo vale la pena si se quiere su panel o su integración con n8n/Chatwoot.

⚠️ Una fuente reporta que desde v2.4.0 cada instancia debe activarse contra el servidor de licencias de Evolution Foundation [M12]; revisar la licencia y las notas de versión antes de adoptarlo.

Pasos (modo Baileys, solo pruebas, ~1–2 h):
1. VPS con Docker → `docker run -d -p 8080:8080 --env-file .env evoapicloud/evolution-api:<versión fija>` (variables: API key global, URL del servidor, base de datos Postgres para producción) [M10].
2. Crear instancia: `POST /instance/create` con `{"instanceName":"mokalu-pruebas","integration":"WHATSAPP-BAILEYS","qrcode":true}` → escanear el QR con el chip de pruebas [M11].
3. Webhook de la instancia hacia nuestro servicio con el evento **`MESSAGES_UPSERT`** [M10].
4. **Falta en el framework:** no hay `EvolutionAdapter` (sí hay `periskope.ts`, otro proveedor no oficial). Habría que escribir uno que traduzca `MESSAGES_UPSERT` a `IncomingMessage` y envíe con el endpoint de texto de Evolution (anotado como **G-14** en `PENDIENTES.md`). Alternativa sin código: n8n recibe el webhook de Evolution, llama a `POST /sim/mokalu` y envía `replies[].text` de vuelta (`framework/README.md` §4, opción C).

---

## Problemas comunes

| Síntoma | Causa probable | Arreglo |
|---|---|---|
| Meta dice "No se pudo validar la URL de devolución de llamada" | verify token distinto, URL sin https, servicio caído | probar el `curl` de A3.3 |
| Llegan mensajes pero el log dice `firma inválida` (401) | App Secret equivocado (WhatsApp e Instagram tienen secretos distintos) | revisar `WHATSAPP_APP_SECRET` / `INSTAGRAM_APP_SECRET` |
| No llegan webhooks del número real | app no suscrita a la WABA real | A6.4 |
| No llegan DM de Instagram | "Permitir acceso a mensajes" apagado, cuenta no suscrita, app en modo desarrollo y remitente no evaluador | B1.2, B3.3, B5.4 |
| Error "fuera de la ventana de 24 h" en logs | el bot intentó escribir pasado 24 h (seguimiento) | usar plantilla aprobada o no enviar (`whatsapp.ts:103-110`) |
| El bot no responde y no hay error | `META_ENABLE_SEND=false` o conversación en pausa por derivación | revisar variable; `POST /admin/mokalu/<userId>/resume` |
| Mensajes duplicados | reintentos de Meta | ya se filtran por id (`debounce.ts:18-21`, `engine.ts:156-159`); si persiste, revisar que el servicio responda en < 5 s |
| Token deja de funcionar al día siguiente | se usó el temporal | A5 |

## Huecos del framework que esta guía encontró
- **G-13** Host de la API de Instagram con inicio de sesión de Instagram (`graph.instagram.com` vs `graph.facebook.com`) — verificar antes de encender (B4).
- **G-14** No existe adaptador para Evolution API (Ruta C).
- (Ya listados en `08`: G-10 *location request*/marcar leído, G-12 descarga de medios por id, G-6 plantilla vs texto libre dentro de 24 h.)

## Fuentes
- [M1] Kommunicate, Meta Cloud API integration — https://docs.kommunicate.io/docs/whatsapp-cloud-api ; WinSender, registro y token — https://www.winsender.net/how-to-setup-whatsapp-cloud-api-register-your-phone-number-and-get-your-access-token/
- [M2] OnCloudAPI, número de prueba vs producción — https://oncloudapi.com/blogs/whatsapp-cloud-api-test-number-vs-production-number-how-to-go-live
- [M3] Meta (Postman), Register Phone Number — https://www.postman.com/meta/whatsapp-business-platform/request/mk4p87j/register-phone-number ; Medium, registro de número — https://medium.com/@hamzas2401/how-i-registered-my-whatsapp-business-number-on-meta-b175a290a451
- [M4] Meta, Pricing on the WhatsApp Business Platform — https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing
- [M5] Verificación del negocio: Aurora Inbox — https://www.aurorainbox.com/en/2026/05/14/what-is-meta-business-verification/ ; Wati — https://www.wati.io/en/blog/whatsapp-api-access/ ; foro de Meta (caso Colombia, 2026) — https://developers.facebook.com/community/threads/3091343734393360/
- [M6] Revisión del nombre visible: MyOperator — https://support.myoperator.com/portal/en/kb/articles/what-is-whatsapp-business-display-name-review-22-9-2025 ; 360dialog FAQ — https://docs.360dialog.com/docs/useful/common-issues
- [M7] Plantillas: Twilio — https://static0.twilio.com/docs/whatsapp/tutorial/message-template-approvals-statuses ; Telnyx — https://support.telnyx.com/en/articles/13986483 ; ChatDaddy — https://help.chatdaddy.tech/article/waba-template-message-approval-timeline
- [M8] Instagram con inicio de sesión de Instagram: Meta, Business Login — https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/business-login ; Flowgent (2026) — https://flowgent.ai/blog/instagram-messaging-api ; referencia comunitaria (abr-2026) — https://gist.github.com/jameschapman2c/65eff9f54a2d350b17a6ce5127b9fe42 ; Medium (webhooks) — https://innocentanyaele.medium.com/setup-meta-webhooks-for-instagram-messaging-and-respond-to-message-4575bc95c7a2
- [M9] App Review: Meta — https://developers.facebook.com/docs/instagram-platform/app-review ; foro de Meta (13 días) — https://developers.facebook.com/community/threads/3459359287566790/ ; Chatwoot — https://developers.chatwoot.com/self-hosted/instagram-app-review ; caso de screencast — https://singhamandeep.com/instagram-dm-screencast-case/
- [M10] Evolution API: documentación — https://docs.evolutionfoundation.com.br/en/evolution-api ; Hysenlabs (Docker) — https://hysenlabs.com/en/projects/evolution-foundation-evolution-api ; freeCodeCamp (MESSAGES_UPSERT) — https://www.freecodecamp.org/news/how-to-build-and-deploy-a-production-ready-whatsapp-bot/
- [M11] Manual de integración Evolution API v2 (comunidad) — https://gist.github.com/dantetesta/b8b7e7e2d6196beae968c8b0a61afb7a
- [M12] Railway, plantilla Evolution API (nota de licencias v2.4.0) — https://railway.com/deploy/evolution-api-whatsapp
