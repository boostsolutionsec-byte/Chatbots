# 01 · Mapa del código (repositorios de referencia "SellerChat")

> Agente 1 · 2026-10-14. `FORMULARIO.md` pregunta 1 está vacía → se analizaron **los tres candidatos**.
> Clonados con `git clone --depth 1` en `/tmp/ref/` (fuera de este repo; nada se copió aquí).
> Toda cita usa el formato `[ALIAS] ruta:línea` sobre el commit indicado.

| Alias | Repositorio | Commit analizado | Fecha del commit |
|---|---|---|---|
| **[PA]** | `funnellersinfo-maker/probaragente` | `24bbf34` | 2026-05-27 |
| **[SB]** | `nelperecas-it/sellerchat-backend-demo` | `78ec360` | 2025-05-08 |
| **[KS]** | `Keyner9/Code-de-SellerChat` | `e4825c1` | 2025-06-17 |

## Conclusión en una línea

**Ninguno de los tres repositorios contiene el motor conversacional de SellerChat** (el bot que responde en WhatsApp).
SellerChat es un SaaS cerrado (sellerchat.ai). Lo que hay en GitHub son: una landing de captación ([PA]), un backend de
**llamadas de voz** de un producto hermano llamado *SellerCall* ([SB]) y un esqueleto Blazor con una pantalla de login ([KS]).
Por eso el comportamiento del bot (prompts, embudo, seguimiento) se documenta en `03`, `04` y `07` a partir de
**investigación pública** y se diseña **desde cero** para nuestro framework. Ver `00-RESUMEN.md`.

## Licencias (¿se puede reutilizar?)

| Repo | Archivo LICENSE | Veredicto |
|---|---|---|
| [PA] | No existe (`git ls-files` no lista ningún LICENSE) | **Todos los derechos reservados** por defecto. No copiar código. Solo describir comportamiento. Además el pie dice "© SellerChat. Todos los derechos reservados" ([PA] `src/app/page.tsx:899-901`). |
| [SB] | No existe | Igual: **no reutilizable**. Solo ideas. |
| [KS] | No existe | Igual: **no reutilizable**. Además no compila (ver abajo). |

Regla aplicada (CLAUDE.md): documentamos el comportamiento y **reimplementamos**. No hay nada en estos repos que valga la pena copiar
de todas formas: nuestro stack es Node/TypeScript y la lógica útil es trivial.

---

## [PA] `funnellersinfo-maker/probaragente` — landing "Configura tu agente"

**Qué es:** página única de marketing de SellerChat con un **asistente (wizard) de 5 pasos** que recoge los datos del negocio
y abre un chat de WhatsApp (`wa.me`) con el texto pre-llenado para que un **humano/bot de SellerChat** haga "la simulación".
No hay backend propio, no hay IA, no se guarda nada.

### Stack y dependencias
- Next.js 16 + React 19 + Tailwind 4 + shadcn/ui ([PA] `package.json:60`, `worklog.md:7`). Se ejecuta con **Bun** ([PA] `package.json:8`).
- Plantilla generada por la plataforma **Z.ai** (agente de código chino): dependencia `z-ai-web-dev-sdk` ([PA] `package.json:79`),
  scripts con comentarios en chino ([PA] `.zscripts/start.sh`), `worklog.md` escrito por "Main Agent" ([PA] `worklog.md:3`),
  y ~490 archivos de `skills/` comiteados aunque el `.gitignore` los excluye ([PA] `.gitignore:54`).
- Prisma + SQLite con modelos de ejemplo `User`/`Post` que **no se usan** ([PA] `prisma/schema.prisma:16-32`); la base `db/custom.db` tiene 0 filas.
- `next-auth`, `socket.io` (ejemplo en `examples/websocket/`), `zustand`, etc.: instaladas por la plantilla, **sin uso**.
- Caddy como proxy inverso al puerto 3000 ([PA] `Caddyfile`).

### Estructura relevante (lo único con lógica)
| Archivo | Líneas | Qué hace |
|---|---|---|
| `src/app/page.tsx` | 948 | Toda la landing: hero, "Cómo funciona", wizard, resultado, CTA, footer, botón flotante |
| `src/app/layout.tsx` | 53 | Metadatos SEO ("SellerChat - Agente WhatsApp Personalizado | Pruébalo Gratis", `layout.tsx:5`), fuentes, Font Awesome por CDN (`layout.tsx:45`) |
| `src/app/globals.css` | 451 | Tema oscuro "dopaminérgico" (verde neón/dorado) |
| `src/components/ui/*` | 48 archivos | shadcn/ui genérico, sin cambios |

### Lógica de `page.tsx` (resumen con citas)
- Modelo de datos del wizard `WizardData` = `tipoNegocio, nombreNegocio, descripcion, nombreAgente, productos, tono, objetivo` ([PA] `src/app/page.tsx:7-15`).
- Catálogos cerrados: 8 tipos de negocio ([PA] `page.tsx:19-28`), 4 tonos *formal/amigable/entusiasta/empático* (`page.tsx:30-35`),
  5 objetivos *vender/agendar/soporte/leads/múltiples* (`page.tsx:37-43`).
- Validación por paso: pasos 1, 4, 5 exigen selección; pasos 2 y 3 exigen texto no vacío (`page.tsx:103-118`).
- Al terminar, `buildWhatsAppUrl()` arma un mensaje "Hola SellerChat! Acabo de configurar mi agente…" con todos los campos y lo
  codifica en un enlace `wa.me/<número de SellerChat>?text=…` (`page.tsx:92-100`).
- CTA secundario: agendar sesión 1:1 de implementación con un asesor humano por `wa.me` (`page.tsx:45`, `page.tsx:807-816`).
- Promesa de privacidad: "Tus datos solo se usan para personalizar la simulación. No almacenamos información." (`page.tsx:822`).

### Calidad / problemas observados
- Números de WhatsApp de ventas **hardcodeados** en el código (`page.tsx:45`, `page.tsx:99`). (No los reproducimos aquí.)
- `.env` comiteado pese a estar en `.gitignore` (`.gitignore:34`); solo contiene `DATABASE_URL` local.
- Todo el contenido en un único componente de ~950 líneas.

---

## [SB] `nelperecas-it/sellerchat-backend-demo` — backend de **SellerCall** (voz)

**Qué es:** API ASP.NET Core 9 que conecta **Twilio** (telefonía) con **Ultravox** (agente de voz IA) para atender llamadas
entrantes y hacer llamadas salientes, con historial, resumen post-llamada y **re-llamadas automáticas programadas**.
El README lo llama "SellerCall IA Backend Demo" ([SB] `README.md:1-6`). No hay chat ni WhatsApp.

### Stack y dependencias ([SB] `SCIABackendDemo.csproj:9-25`)
- .NET 9, EF Core + MySQL (`MySql.EntityFrameworkCore`), **Hangfire** (jobs recurrentes, almacenamiento MySQL), **SignalR**
  (tiempo real al panel), **Serilog** (logs a archivo), **Twilio SDK 7.10**.
- Ultravox se llama por HTTP directo ([SB] `Services/UltravoxService.cs:31-109`).

### Estructura
| Carpeta | Contenido | Citas |
|---|---|---|
| `Program.cs` | DI, CORS, Serilog, Hangfire, hubs, job "cada minuto" | [SB] `Program.cs:20-30`, `66-72`, `100-103` |
| `Controllers/` | `InboundController` (webhook Twilio), `LlamadaController` (listar, terminar, llamar), `PromptController` (GET/POST del prompt), `ScheduledCallController` (CRUD de llamadas programadas), `UserController` (config de auto-rellamada) | ver `02` y `04` |
| `Services/` | `UltravoxService` (crear llamada SIP, detalles, TTS), `LlamadaService` (historial, ejecutar llamada, programar seguimiento), `PromptService` (prompt en memoria), `ScheduledCallExecutor` (BackgroundService cada 2 min) | |
| `Models/` | `User`, `CallHistory`, `CallMappingEntry`, `ScheduledCall`, `Prompt`, `CallDetails` | [SB] `Models/*.cs` |
| `Hubs/` | `CallHub`, `LogHub` (SignalR) | [SB] `Hubs/CallHub.cs:6-19` |
| `Migrations/` | 4 migraciones EF (01–04 may 2025) | |
| `bin/`, `obj/`, `publish/` | **Binarios comiteados** (cientos de archivos, carpetas `publish/publish/publish/…` anidadas) pese al `.gitignore` | [SB] `.gitignore:1-3` |
| `logs/` | Logs reales de producción comiteados | |

### Problemas graves (lecciones para nosotros)
1. **Secretos en el repositorio**: claves de Ultravox y Twilio y la cadena de conexión MySQL con contraseña y IP pública están en
   `appsettings.json` ([SB] `appsettings.json:10-23`). *No las copiamos.* → Nuestra regla "secretos solo en variables de entorno" es obligatoria.
2. Prompt guardado **solo en memoria** (`PromptService`, [SB] `Services/PromptService.cs:8-16`): se pierde al reiniciar y es global para todos los usuarios.
3. Multiusuario falso: `userId: 1` fijo en todos los controladores ([SB] `Controllers/InboundController.cs:64`, `LlamadaController.cs:61`, `:261`).
4. Código muerto: el *seed* del usuario admin está **después** de `app.Run()` ([SB] `Program.cs:105-121`), nunca corre.
5. Dos mecanismos duplicados de seguimiento (Hangfire cada minuto + BackgroundService cada 2 min) y el segundo **marca la llamada como hecha sin llamar**
   ([SB] `Services/ScheduledCallExecutor.cs:40-47`).
6. URLs de producción hardcodeadas en el TwiML ([SB] `Controllers/InboundController.cs:98`, `Services/LlamadaService.cs:130`).
7. Sin autenticación en ningún endpoint (cualquiera puede cambiar el prompt: [SB] `Controllers/PromptController.cs:26-31`).

---

## [KS] `Keyner9/Code-de-SellerChat` — esqueleto Blazor + login

**Qué es:** plantilla Blazor WebAssembly (.NET 9) "Hello, world!" ([KS] `Code/Components/Pages/Home.razor:1-7`) más **una** página de login
copiada de otro proyecto llamado **SmartChat** (`namespace SmartChat.Client.Pages`, [KS] `Code.Client/Pages/LoginPage.razor.cs:9`).
La descripción del repo dice "Backup/Apoyo para SellerCall".

- **No compila**: el login usa Blazorise, `PageBase`, `IAuthenticationService`, `SmartChat.Shared.Models` y `Translation[...]`, que no existen en el repo
  ([KS] `LoginPage.razor.cs:1-6`, `:11`, `:14`; el `.csproj` solo referencia `Microsoft.AspNetCore.Components.WebAssembly`, [KS] `Code.Client/Code.csproj:11-13`).
- Fallo de seguridad: envía **email y contraseña por querystring en un GET** (`api/user/login?email=…&password=…`, [KS] `LoginPage.razor.cs:33`).
- Pistas de producto: login con captcha (`LoginPage.razor:57`), registro (`/signup`, `:66`), recuperar contraseña (`:69`), i18n por diccionario `Translation`.

Valor para nosotros: **ninguno técnico**; confirma solo que SellerChat/SmartChat tiene panel web con cuentas de usuario.

---

## Qué tomamos de cada uno

| Idea | De dónde | Cómo la reimplementamos |
|---|---|---|
| Configurar un agente con pocos campos (tipo, nombre, descripción, nombre del agente, productos, tono, objetivo) | [PA] `page.tsx:7-15` | `bot.yaml` + formulario (`06-configuracion-del-cliente.md`) |
| "Pruébalo en un chat real" antes de pagar | [PA] `page.tsx:251-255`, `:804` | Chat web local + Telegram de prueba |
| Prompt editable sin redeploy | [SB] `PromptController.cs:17-31` | `prompts/sistema.md` versionado en git (no en memoria) |
| Resumen corto + largo al terminar cada conversación | [SB] `LlamadaController.cs:205-214`, `Models/CallHistory.cs:18-22` | `Store.saveConversation` con `resumen` y `resumen_corto` generados por LLM |
| Seguimiento automático N días después si el usuario lo activa | [SB] `LlamadaService.cs:188-218`, `Models/User.cs:22-23` | Bloque `seguimiento:` de `bot.yaml`, respetando ventana de 24 h |
| Evitar duplicar seguimientos al mismo número | [SB] `LlamadaService.cs:195-203` | Clave única (bot, usuario, tipo de seguimiento) |
| Panel en tiempo real | [SB] `Hubs/CallHub.cs` | Opcional (Chatwoot o panel simple); no es P0 |
