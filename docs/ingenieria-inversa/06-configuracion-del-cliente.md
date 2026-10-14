# 06 · Qué se le pide al negocio para configurar un agente

> Agente 1 · 2026-10-14. Alias de repos: ver `01-mapa-del-codigo.md`.

## 1. Lo que pide SellerChat (landing [PA])

Wizard de 5 pasos, todo obligatorio ([PA] `src/app/page.tsx:103-118`), ~2 minutos ("Configura tu agente inteligente en 2 minutos", `page.tsx:251-252`):

| Paso | Pregunta en pantalla | Campo | Tipo | Cita |
|---|---|---|---|---|
| 1 · Negocio | "¿Qué tipo de negocio tienes?" | `tipoNegocio` | 1 de 8: E-commerce, Restaurante, Belleza, Salud, Inmobiliaria, Educación, Agencia B2B, Otro | `page.tsx:19-28`, `:473` |
| 2 · Datos | "Cuéntanos sobre tu negocio" | `nombreNegocio`, `descripcion` ("Descripción en una línea"), `nombreAgente` | texto | `page.tsx:519-556` |
| 3 · Productos | "Tus productos o servicios" — "Escribe un producto/servicio por línea. Incluye nombre y descripción breve." | `productos` | texto libre multilínea | `page.tsx:571-583` |
| 4 · Tono | "Tono de comunicación" | `tono` | Formal / Amigable / Entusiasta / Empático | `page.tsx:30-35`, `:597` |
| 5 · Objetivo | "Objetivo principal" | `objetivo` | Vender / Agendar / Soporte / Leads / Múltiples | `page.tsx:37-43`, `:644` |
| Resultado | "¡Tu agente está listo!" + resumen + "Abrir Simulación en WhatsApp" | — | enlace `wa.me` con todo el texto | `page.tsx:740-804` |

Observaciones:
- Es un **gancho comercial**: pocos campos, sin cuenta, resultado inmediato "en WhatsApp real" (`page.tsx:253`). La configuración real
  (FAQ, políticas, catálogo completo, integraciones) se hace después en una **sesión 1:1 con un humano** (`page.tsx:400-403`, `:816`).
- No pide: horarios, cuándo derivar a humano, qué no decir, FAQ, ubicación/sucursales, canales, datos legales. Todo eso lo completa el equipo después.
- [KS] confirma que hay un **panel con cuentas** (login, registro, recuperar contraseña: `Code.Client/Pages/LoginPage.razor:57-69`) y
  [SB] que el **prompt se edita** desde el panel (`Controllers/PromptController.cs:17-31`) y que cada usuario activa/desactiva **seguimiento automático y cada cuántos días**
  (`Controllers/UserController.cs:20-52`, por defecto 15 días `Models/User.cs:23`).

## 2. Lo que debe pedir nuestro framework (propuesta)

Principio: **dos niveles**. (a) Mínimo para que el bot funcione hoy (5 minutos, como SellerChat). (b) Completo para producción.
Todo cae en archivos de `bots/<id>/` según `docs/CONTRATO.md`; nada en el código.

### (a) Mínimo viable — 8 preguntas
| # | Pregunta | Va a | Valor por defecto si falta |
|---|---|---|---|
| 1 | Nombre del negocio y una línea de qué hace | `bot.yaml → marca`, `prompts/sistema.md` | — (obligatorio) |
| 2 | Objetivo: vender · redirigir a sucursal/tienda · agendar · soporte · captar datos | `bot.yaml → objetivo` | `asesoria` |
| 3 | Nombre y tono del asistente (tuteo/usted, emojis sí/no) | `bot.yaml → persona` | "Asistente", tuteo, emojis moderados |
| 4 | Productos/servicios (pegar lista o Excel) | `catalogo.csv` o `conocimiento/catalogo.md` | — |
| 5 | Dónde comprar / sucursales (Excel con ciudad y dirección) | `tiendas.csv` | sin localizador |
| 6 | 5–10 preguntas frecuentes con su respuesta | `conocimiento/faq.md` | — |
| 7 | Cuándo pasar a una persona y a qué WhatsApp | `bot.yaml → reglas_derivacion`, `destinos` (+ secreto) | pide humano · reclamo · enojo |
| 8 | Qué nunca debe decir (precios, stock, promesas) | `bot.yaml → limites.nunca` | precios, stock, hablar mal de otros |

### (b) Completo — se añade
- Horario de atención humana y días (`horario_humano`).
- Canales y cuentas (WhatsApp/Instagram/Telegram) — y los pasos humanos de Meta (`PASOS-HUMANOS.md`).
- Políticas (envíos, devoluciones, garantía) → `conocimiento/politicas.md`.
- Promociones vigentes con fecha de fin (para que el bot no ofrezca promos vencidas) → `conocimiento/promos.md` con `vigente_hasta:`.
- Seguimientos (sí/no, cuándo, texto) → `seguimiento` + plantillas a aprobar.
- Conversaciones reales anonimizadas → `datos/` (para evals).
- Modelo de IA y presupuesto mensual aproximado.

### Formato de entrega recomendado
1. **Hoy**: el dueño llena `FORMULARIO-FINAL.md` (lo arma el Agente 4 desde `docs/DATOS-INVENTADOS.md`). Ya cubre (a) y gran parte de (b).
2. **Producto (P2)**: un *wizard web* propio, igual de corto que el de SellerChat pero que **genera la carpeta del bot** (bot.yaml + CSV + md)
   y abre el **chat web local** para probar al instante — sin pasar por un humano, sin `wa.me`. Mejora clave sobre SellerChat: la prueba es inmediata
   y la configuración queda versionada.
3. Validación automática del bot generado: `framework` valida `bot.yaml` con zod (decisión del Agente 2) y corre las evals.

## 3. Mapeo SellerChat → nuestro `bot.yaml`

| SellerChat ([PA]) | Nuestro esquema |
|---|---|
| `tipoNegocio` | (no hace falta; se infiere de `objetivo` + conocimiento) |
| `nombreNegocio` | `marca` |
| `descripcion` | primera línea de `prompts/sistema.md` |
| `nombreAgente` | `persona.nombre` |
| `productos` (texto libre) | `catalogo.csv` (estructurado: sku, línea, punta, superficies…) |
| `tono` (4 opciones) | `persona.tono` (texto libre; podemos ofrecer las 4 opciones como plantillas) |
| `objetivo` (5 opciones) | `objetivo: [...]` (lista; permite varios) + `flujos` |
| (no existe) | `tiendas.csv` + `localizador` — **nuestro diferenciador** |
| (no existe) | `reglas_derivacion`, `destinos`, `limites`, `horario_humano`, `seguimiento`, `evals/` |
| Activar re-llamada cada N días ([SB] `Models/User.cs:22-23`) | `seguimiento[].despues_de` (≤ 23 h en WhatsApp) |

## 4. Recomendación para Mokalú (con lo que ya tiene el repo)
El Agente 3 ya creó `bots/mokalu/` con `bot.yaml`, `tiendas.csv` (EJEMPLO), `lugares.csv`, `catalogo.csv`, `conocimiento/*.md` y `prompts/sistema.md`
(rama `agente/3-bots`). Lo único que el dueño **tiene** que aportar para salir a producción, por orden de impacto:
1. **Lista real de puntos de venta** (preg. 5) — sin esto el bot no cumple su objetivo.
2. WhatsApp de los destinos humanos (asesor, distribuidores, reclamos) como secretos.
3. Si el bot puede ofrecer la tienda online/envíos (preg. 7).
4. Nombre del asistente (preg. 14) y horario real (preg. 17).
