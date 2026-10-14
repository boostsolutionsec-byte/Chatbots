# Pasos humanos (para mañana)

Todo lo que los agentes **no pueden** hacer solos. Ellos van añadiendo filas durante la noche.
Formato: `- [ ] [quién] Qué hacer — por qué / dónde — (agente que lo pidió)`

## Ya sabemos que harán falta

### Meta / WhatsApp
- [ ] [dueño] Crear o confirmar la cuenta de **Meta Business** (business.facebook.com) de Mocalu y de Uniwell y verificar el negocio.
- [ ] [dueño] Crear una app en **developers.facebook.com** (tipo Business) y agregar el producto **WhatsApp**.
- [ ] [dueño] Registrar el número de WhatsApp de cada marca en la Cloud API (ojo: un número usado en la app de WhatsApp Business debe migrarse o usar coexistencia).
- [ ] [dueño] Generar un **token permanente** (usuario de sistema) y copiar `WHATSAPP_PHONE_NUMBER_ID` y `WHATSAPP_BUSINESS_ACCOUNT_ID`.
- [ ] [dueño] Enviar a aprobación las plantillas de `bots/*/plantillas-whatsapp.md`.

### Instagram
- [ ] [dueño] Pasar las cuentas de Instagram a **profesionales** y vincularlas a la página de Facebook de cada marca.
- [ ] [dueño] En la app de Meta, agregar **Instagram** con el permiso de mensajería y activar "Permitir acceso a mensajes" en la app de Instagram.
- [ ] [dueño] Para usar con clientes reales: pasar la **revisión de la app** (App Review) para los permisos de mensajería.

### Servidor y claves
- [ ] [dueño] Crear la clave de API en console.anthropic.com → `ANTHROPIC_API_KEY` (o DeepSeek si así lo elige el formulario).
- [ ] [dueño] Crear/elegir el proyecto de **Supabase** y aplicar la migración de `framework/supabase/migrations/` (o pedírselo a Claude).
- [ ] [dueño] Desplegar el servicio (Railway/Render/VPS) y cargar las variables de `.env.example`.
- [ ] [dueño] Configurar en Meta la URL del webhook `https://<tu-dominio>/webhook/whatsapp/<bot-id>` y el token de verificación.
- [ ] [dueño] Probar con un número propio antes de abrir a clientes.

### Contenido
- [ ] [dueño] Revisar y confirmar todo lo marcado `POR CONFIRMAR` (lista en `PENDIENTES.md`).

## Añadidos por los agentes
