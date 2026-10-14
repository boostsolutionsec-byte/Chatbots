# Pasos humanos (para mañana)

Todo lo que los agentes **no pueden** hacer solos. Ellos van añadiendo filas durante la noche.
Formato: `- [ ] [quién] Qué hacer — por qué / dónde — (agente que lo pidió)`

## Fase 1 — probar el bot (mañana, ~20 minutos)

- [ ] [dueño] **Lista real de puntos de venta** (si no la dio en el formulario): llenar `bots/mokalu/tiendas.csv` o pasar el Excel/Sheets a Claude.

- [ ] [dueño] Crear la clave de IA en console.anthropic.com → `ANTHROPIC_API_KEY` (o la de DeepSeek si así lo eligió en el formulario).
- [ ] [dueño] Crear el bot de prueba en **Telegram**: abrir @BotFather → `/newbot` → nombre (ej. "Mokalú Asesor") → copiar el token → `TELEGRAM_BOT_TOKEN`.
- [ ] [dueño] Pegar ambas claves como secretos (archivo `.env` local o variables del entorno en la nube; **nunca** en el repo).
- [ ] [dueño] Probar en el navegador (chat web) y en Telegram desde su celular; anotar respuestas malas para corregirlas.
- [ ] [dueño] Revisar y confirmar todo lo marcado `POR CONFIRMAR` (lista en `PENDIENTES.md`): tiendas, productos, horarios, contactos.
- [ ] [dueño] (Opcional) Crear/elegir el proyecto de **Supabase** para guardar conversaciones y aplicar la migración de `framework/supabase/migrations/`.
- [ ] [dueño] (Opcional) Desplegar el servicio (Railway/Render/VPS) para que el bot de Telegram quede encendido 24/7.

## Fase 2 — más adelante: WhatsApp e Instagram (Meta)

- [ ] [dueño] Cuenta de **Meta Business** verificada de la marca que tendrá el bot.
- [ ] [dueño] App en developers.facebook.com con WhatsApp e Instagram; número registrado en la Cloud API; token permanente.
- [ ] [dueño] Instagram profesional vinculado a la página de Facebook; activar "Permitir acceso a mensajes"; revisión de la app (App Review).
- [ ] [dueño] Enviar a aprobación las plantillas de `bots/mokalu/plantillas-whatsapp.md`.
- [ ] [dueño] Configurar las URLs de webhook que indique `framework/README.md`.

## Añadidos por los agentes
- [ ] [dueño] (Opcional) Si tiene acceso al **código real del bot de SellerChat** (no la landing), dar acceso al repo para repetir la ingeniería inversa — los tres candidatos del formulario no lo contienen — (agente 1)
- [ ] [dueño] Fase 2: decidir si el número de WhatsApp de Mokalú seguirá usándose en la app del celular → activar **Coexistencia** (app WhatsApp Business ≥ 2.24.17) al conectar la Cloud API; **no** usar conexiones por QR/no oficiales con el número real (riesgo de bloqueo) — ver `docs/ingenieria-inversa/05-canales.md` (agente 1)
- [ ] [dueño] Fase 2: completar la **verificación del negocio** en Meta Business (sube el límite de 250 conversaciones iniciadas por día) — (agente 1)
- [ ] [dueño] Fase 2: revisar la tarifa vigente de WhatsApp para Ecuador en la página oficial de precios de Meta (cambio de cobro de mensajes de servicio desde oct-2026) — (agente 1)
- [ ] [dueño] Copiar `.env.example` a `framework/.env` y pegar ahí `ANTHROPIC_API_KEY` y `TELEGRAM_BOT_TOKEN`; luego `cd framework && npm install && npm run telegram -- mokalu` — guía paso a paso en `framework/README.md` §2 — (agente 2)
- [ ] [dueño] (Opcional) Crear un grupo de Telegram de asesores, agregar el bot y poner su id en `TELEGRAM_ADMIN_CHAT_ID` para recibir avisos de derivación y usar `/reactivar` — `framework/README.md` §2 — (agente 2)
- [ ] [dueño] Definir los números reales de WhatsApp de los destinos (`WHATSAPP_ASESOR_VENTAS`, `WHATSAPP_DISTRIBUIDORES`, `WHATSAPP_RECLAMOS`) como variables de entorno, no en el repo — `.env.example` — (agente 2)
- [ ] [dueño] Elegir una cadena larga al azar para `ADMIN_TOKEN` (protege `/admin/*`) — `.env.example` — (agente 2)
- [ ] [dueño] (Opcional) Si quieren que n8n reciba cada derivación: crear un webhook en n8n y poner su URL en `HANDOFF_WEBHOOK_URL` — `framework/README.md` §4 opción C — (agente 2)
- [ ] [dueño] (Opcional) Desplegar en Railway/Render: root `framework`, start `npm start` o `npm run telegram -- mokalu`, y cargar las variables — `framework/README.md` §4 — (agente 2)
- [ ] [dueño] (Opcional) Supabase: SQL Editor → pegar `framework/supabase/migrations/0001_init.sql` → Run; luego `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en el servidor — (agente 2)
- [ ] [dueño] (Fase 2, Meta) Cuando se conecte WhatsApp/Instagram: configurar webhook `https://<servicio>/webhook/whatsapp/mokalu` con `WHATSAPP_VERIFY_TOKEN`, cargar `WHATSAPP_*` y recién al final `META_ENABLE_SEND=true` — `framework/README.md` §5 — (agente 2)
