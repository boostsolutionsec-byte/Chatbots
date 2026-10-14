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
