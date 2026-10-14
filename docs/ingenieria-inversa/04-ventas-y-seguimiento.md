# 04 · Ventas, embudo, seguimiento y CRM

> Agente 1 · 2026-10-14. Alias de repos: ver `01-mapa-del-codigo.md`. Fuentes web: ver `07`.

## 1. Qué hace SellerChat (público) y qué se ve en el código

| Función | Evidencia | Tipo de evidencia |
|---|---|---|
| Objetivos configurables: vender, agendar, soporte, captar leads, múltiples | [PA] `src/app/page.tsx:37-43` | código |
| Confirmación de pedidos, seguimiento post-venta, agendar citas | sitio sellerchat.ai (resultado de búsqueda, `07` [S1]) | web |
| Integración con **Dropi** para "subir órdenes" automáticamente (dropshipping LatAm; también MasterShop, Rocketfy) | videos oficiales y sitio (`07` [S2], [S3]) | web |
| Disparadores, acciones masivas, condiciones lógicas y **etiquetas** | temario de la certificación SellerChat (`07` [S4]) | web |
| Recordatorios y seguimientos automáticos | certificación (`07` [S4]) | web |
| CTA a sesión 1:1 humana para implementar (el embudo de SellerChat **vende con humano** al final) | [PA] `page.tsx:45`, `:807-816`, `:886` | código |
| **Re-contacto automático N días después** (SellerCall, voz): si el usuario activa `AutoTriggerEnabled`, cada llamada programa otra a los `AutoTriggerDays` (15 por defecto) | [SB] `Models/User.cs:22-23`, `Services/LlamadaService.cs:188-218` | código |
| No duplicar: no programa si ya hay una pendiente auto-generada para ese número | [SB] `Services/LlamadaService.cs:195-203` | código |
| Ejecutor: job Hangfire **cada minuto** busca programadas vencidas y las ejecuta | [SB] `Program.cs:100-103`, `Services/LlamadaService.cs:97-119` | código |
| CRUD manual de seguimientos (agregar, listar, editar, cancelar, ejecutar ya) | [SB] `Controllers/ScheduledCallController.cs:24-109` | código |
| Resumen corto y largo por interacción (para que el vendedor lea rápido) | [SB] `Models/CallHistory.cs:18-22`, `Controllers/LlamadaController.cs:205-214` | código |

El embudo típico de SellerChat (e-commerce/dropshipping, pago contra entrega) es:
**anuncio → WhatsApp → saludo + calificación → recomendación → captura de datos de envío → confirmación del pedido → orden a Dropi → seguimiento post-venta**.

## 2. El embudo de Mokalú es distinto: **redirigir**, no cobrar

Mokalú es distribuidor: el "cierre" es que el cliente **llegue a una tienda** con el producto claro.
No hay carrito, ni pago, ni datos de envío (salvo la opción secundaria de venta online, pendiente del dueño — `FORMULARIO.md` preg. 7).

```mermaid
flowchart LR
    A[Llega<br/>IG/WA/TG/web] --> B[Saludo + ¿qué buscas?]
    B --> C{¿Sabemos la ciudad?}
    C -- no --> D[Pedir ciudad/sector<br/>o ubicación 📍]
    D --> C
    C -- sí --> E[buscar_tienda]
    E --> F[1-2 tiendas con<br/>dirección, horario, WhatsApp, Maps]
    F --> G{¿Duda de producto?}
    G -- sí --> H[Asesoría: superficie → punta → POSCA]
    H --> I[Resumen "pide en tienda: PC-5M x8"]
    G -- no --> J[Cierre amable]
    I --> J
    B -. mayorista/colegio/empresa .-> K[Derivar a asesor<br/>captura: nombre, empresa, ciudad, volumen]
    B -. quiere ser punto de venta .-> L[Derivar a comercial<br/>captura: negocio, ciudad, RUC opcional]
    B -. reclamo/garantía .-> M[Derivar con prioridad alta]
```

### Datos que se recolectan (mínimos, por caso)
| Caso | Campos | Requeridos |
|---|---|---|
| ¿Dónde compro? (P0) | `ubicacion` (ciudad/sector/lat-lng), `producto_interes` | solo `ubicacion` |
| Asesoría de producto | `superficie`, `uso` (custom, escolar, lettering…), `grosor` | ninguno; se infiere |
| Mayorista / institución | `nombre`, `empresa`, `ciudad`, `volumen_aprox`, `telefono` (si el canal no lo da) | `nombre`, `ciudad` |
| Quiere ser punto de venta | `negocio`, `ciudad`, `tipo` (papelería, librería, arte), `contacto` | `negocio`, `ciudad` |
| Reclamo | `producto`, `tienda_donde_compro`, `descripcion`, `foto` | `descripcion` |

Regla: **no pedir datos que el canal ya da** (en WhatsApp ya tenemos el teléfono; en Telegram el `first_name`).

## 3. Etiquetas (CRM) propuestas

Una conversación puede tener varias. El framework las asigna con reglas/tool `etiquetar(tag)`; se guardan en `Store`.

| Etiqueta | Cuándo |
|---|---|
| `intencion:donde_comprar` / `intencion:asesoria` / `intencion:mayorista` / `intencion:ser_distribuidor` / `intencion:reclamo` / `intencion:otro` | clasificador del primer mensaje con intención |
| `ciudad:<slug>` · `provincia:<slug>` | al resolver ubicación |
| `producto:<linea>` (posca, signo, jetstream, kurutoga…) | al mencionar producto |
| `resultado:tienda_entregada` · `resultado:sin_cobertura` · `resultado:derivado` · `resultado:abandonó` | al cerrar |
| `canal:<canal>` | siempre |

Con esto el dueño puede responder mañana: *"¿de qué ciudades nos escriben y no tenemos tienda?"* (`resultado:sin_cobertura` × `ciudad`) —
**el dato más valioso para un distribuidor** (dónde abrir nuevos puntos de venta).

## 4. Seguimiento automático (propuesta y límites)

| Regla | Detalle |
|---|---|
| Solo con motivo | Seguimiento solo si quedó algo **pendiente** (ej.: pidió tienda pero no dijo ciudad; mayorista sin datos completos). Nunca "spam" de marketing. |
| Dentro de la ventana | WhatsApp: mensaje libre **solo < 24 h** desde el último mensaje del cliente → programar a ~23 h como máximo (como ya sugiere `docs/CONTRATO.md` §2). Después, solo plantilla aprobada (de pago). |
| Instagram | Solo < 24 h. Fuera de eso, únicamente un humano con la etiqueta `HUMAN_AGENT` (hasta 7 días). |
| Telegram / web | Sin restricción técnica, pero aplicar la misma regla por cortesía. |
| Máximo 1 seguimiento | por conversación sin respuesta. Si no responde, se cierra como `resultado:abandonó`. |
| Cancelar si responde | cualquier mensaje del cliente cancela el seguimiento pendiente. |
| Horario | no enviar fuera de 08h00–20h00 hora de Ecuador (`America/Guayaquil`). |
| Idempotencia | clave única `(bot, usuario, tipo)` — idea de [SB] `LlamadaService.cs:195-203`. |
| Ejecutor | un único scheduler (no dos como [SB] `Program.cs:100-103` + `ScheduledCallExecutor.cs`), con estado `pendiente → enviado/cancelado/fallido`. |

Ejemplo de seguimiento útil (dentro de 24 h): *"¡Hola de nuevo! 🎨 ¿Pudiste ver en qué ciudad estás para pasarte la tienda más cercana?"*

## 5. Paso a humano (handoff)

- Disparadores (orden de `reglas_derivacion`): pide persona · enojo/reclamo · mayorista/colegio/empresa · quiere ser distribuidor ·
  2 respuestas sin avance · tema que el bot no sabe 2 veces.
- Qué hace el framework: `saveHandoff({motivo, prioridad, resumen_corto, datos})`, pone la conversación en **modo humano** (el bot calla),
  avisa al asesor (por ahora: log + destino `${WHATSAPP_ASESOR_VENTAS}`; luego Chatwoot o n8n), y al cliente le dice **qué va a pasar y cuándo**:
  - en horario: "Te paso con una persona del equipo, te escribe en unos minutos 🙌";
  - fuera de horario (10h00–18h00 por defecto): "Nuestro equipo atiende de 10h00 a 18h00; te escriben apenas abran. ¿Me dejas tu nombre y ciudad?".
- **Resumen para el asesor** (idea de [SB] `shortSummary`): 2–3 líneas con intención, ciudad, producto, datos capturados.

## 6. Métricas que el framework debería registrar (para el dueño)
- Conversaciones/día por canal; % con ciudad resuelta; % `tienda_entregada`; top ciudades sin cobertura; top productos preguntados;
  derivaciones por motivo; tiempo a primera respuesta; mensajes por conversación; costo LLM por conversación.
