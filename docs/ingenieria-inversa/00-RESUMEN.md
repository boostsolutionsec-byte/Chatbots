# 00 · Resumen de la ingeniería inversa (Agente 1)

> 2026-10-14. Documentos: `01` mapa del código · `02` flujo de un mensaje · `03` prompts · `04` ventas y seguimiento ·
> `05` canales · `06` configuración del cliente · `07` competencia y reglas de Meta · `conversaciones-ejemplo.md`.
> Alias de repos: **[PA]** `funnellersinfo-maker/probaragente@24bbf34` · **[SB]** `nelperecas-it/sellerchat-backend-demo@78ec360` · **[KS]** `Keyner9/Code-de-SellerChat@e4825c1`.

## Lo esencial en 6 puntos
1. **Ningún repositorio candidato contiene el bot de SellerChat.** [PA] es la landing de captación (wizard de 5 pasos → `wa.me`, [PA] `src/app/page.tsx:92-100`);
   [SB] es el backend de **SellerCall** (llamadas de voz Twilio + Ultravox, [SB] `README.md:1-6`); [KS] es un esqueleto Blazor que no compila ([KS] `Code.Client/Pages/LoginPage.razor.cs:1-14`).
   SellerChat es un SaaS cerrado: su comportamiento se reconstruyó con fuentes públicas (`07`).
2. **Ninguno tiene licencia** → no se reutiliza código; solo ideas (y tampoco hay código que valga la pena: stacks distintos, lógica mínima).
3. [SB] tiene **secretos comiteados** ([SB] `appsettings.json:10-23`) y endpoints sin autenticación ([SB] `Controllers/PromptController.cs:26-31`): ejemplo de lo que **no** hacer.
4. Ideas que sí tomamos: configuración por pocos campos ([PA] `page.tsx:7-15`), prompt editable ([SB] `PromptController.cs`), **resumen corto/largo** por interacción
   ([SB] `Models/CallHistory.cs:18-22`), **seguimiento automático con anti-duplicado** ([SB] `Services/LlamadaService.cs:188-218`), probar "en chat real" antes de pagar.
5. Meta 2026: bots de IA **de propósito general prohibidos** en la WhatsApp Business API desde el 15-ene-2026; bots acotados al negocio, permitidos ([S6]).
   Cobro por mensaje de plantilla; respuestas dentro de 24 h gratis (con posible tope de 1.000/mes desde oct-2026 ⚠️ [S10]).
6. Nuestro diferenciador frente a SellerChat, Wati, Manychat, Respond.io y Leadsales: **redirigir a la tienda/punto de venta más cercano de un distribuidor**
   con datos verificables (tool + CSV), honestidad ("soy un asistente virtual"), y configuración versionada en git con evals.

## Tabla de funcionalidades

| Funcionalidad | SellerChat (evidencia) | Nuestro framework (propuesta) | Prioridad |
|---|---|---|---|
| Canal WhatsApp oficial | Cloud API [S1] | `ChannelAdapter` WhatsApp Cloud API (esqueleto + mocks esta noche) | P1 |
| Canal Instagram DM | sin evidencia | `ChannelAdapter` Instagram (esqueleto + mocks) | P1 |
| Telegram y chat web para pruebas | no | adaptadores reales esta noche | **P0** |
| Respuestas con IA entrenada con datos del negocio | ChatGPT + datos [S1] | `LLMProvider` (Claude Haiku/Sonnet) + `conocimiento/*.md` recuperado por turno (`03` §2) | **P0** |
| Localizador de tienda más cercana | no | tool `buscar_tienda` sobre `tiendas.csv` + `lugares.csv`, fuzzy, distancia | **P0** |
| Nunca inventar tiendas/precios | no documentado | guardas de salida: verificar tiendas contra CSV, bloquear precios (`02` etapa 10) | **P0** |
| Paso a humano con contexto | CTA humano [PA] `page.tsx:807-816` | `reglas_derivacion` + modo humano por conversación + resumen para el asesor (`04` §5) | **P0** |
| Configuración del bot sin programar | wizard 5 pasos [PA] `page.tsx:7-15` | carpeta `bots/<id>/` + `FORMULARIO-FINAL.md`; luego wizard web (`06`) | P0 (archivos) / P2 (wizard) |
| Tono configurable | 4 tonos [PA] `page.tsx:30-35` | `persona.tono` texto libre + plantillas | P0 |
| Objetivos/flujos | 5 objetivos [PA] `page.tsx:37-43` | `objetivo` + `flujos` con campos a recolectar | P0 |
| Agrupar mensajes en ráfaga (debounce) | "parece humano" [S11] (no observable) | cola por usuario 2–4 s (`02` etapa 4) | **P0** |
| Idempotencia de webhooks | n/d | por id externo (`02` etapa 3); patrón de [SB] `Models/CallMappingEntry.cs` | P0 |
| Entender notas de voz | sí [S1] | transcripción en pre-procesado (`02` etapa 5) | P1 |
| Entender imágenes | sí [S1] | visión del LLM: identificar producto/superficie | P1 |
| Enviar notas de voz IA | sí [S1] | no (texto es más claro para direcciones) | — |
| Etiquetas / CRM | etiquetas, disparadores [S4] | etiquetas automáticas `intencion:*`, `ciudad:*`, `resultado:*` (`04` §3) | P1 |
| Resumen corto de la conversación | resumen por llamada [SB] `LlamadaController.cs:205-214` | `resumen_corto` al cerrar/derivar | P1 |
| Seguimiento automático | recordatorios [S4]; re-llamada N días [SB] `LlamadaService.cs:188-218` | `seguimiento` ≤ 23 h, máx. 1, cancelable, anti-duplicado (`04` §4) | P1 |
| Prompt editable sin redeploy | API en memoria [SB] `PromptService.cs:8-16` | `prompts/sistema.md` en git + recarga en caliente | P1 |
| Panel / bandeja humana en tiempo real | SignalR [SB] `Hubs/CallHub.cs` | Chatwoot o panel simple; por ahora log + WhatsApp del asesor | P2 |
| Integración de pedidos (Dropi etc.) | sí [S2] | no aplica a Mokalú (redirige, no vende) | — |
| Confirmación de pedidos / agendar citas | sí [S1] | posible con `flujos` + tool genérica HTTP/n8n | P2 |
| Comentario de Instagram → DM | no (Manychat sí [S24]) | respuesta privada a comentarios con palabra clave | P2 |
| Métricas para el dueño (ciudades sin cobertura, productos) | n/d | reporte desde etiquetas (`04` §6) | P1 |
| Evals automáticas y clientes simulados | no | runner de evals + juez LLM (Agente 4) + `conversaciones-ejemplo.md` | **P0** |
| Multi-negocio / multi-bot | sí (SaaS) | una carpeta por bot | P0 (estructura) |
| Seguridad (secretos, firma de webhooks, auth panel) | deficiente [SB] `appsettings.json:10-23`, [KS] `LoginPage.razor.cs:33` | env vars, `verifyWebhook`, sin endpoints de admin abiertos | **P0** |

## Las 10 mejores prácticas de conversación de venta por chat que debemos copiar
1. **Mensajes cortos, una pregunta a la vez.** Máx. ~3 líneas por burbuja; si hay más, partir en 2 burbujas, nunca 5.
2. **Responder primero lo que preguntó y luego preguntar lo que falta.** "¡Sí tenemos POSCA! 🎨 ¿En qué ciudad estás para decirte dónde?" — no un interrogatorio antes de responder.
3. **Pedir solo el dato mínimo para avanzar** (la ciudad) y no pedir lo que el canal ya sabe (teléfono en WhatsApp).
4. **Ofrecer botones/opciones** cuando hay ≤ 3 caminos (📍 compartir ubicación · escribir ciudad · hablar con alguien); reduce errores de escritura.
5. **Recomendar 1–2 opciones concretas, no un catálogo.** "Para zapatillas: PC-1M para contornos y PC-5M para rellenos."
6. **Cerrar cada respuesta con un siguiente paso claro** ("¿Te paso la ubicación en Maps?") — nunca dejar la conversación colgada.
7. **Usar el lenguaje del cliente** (español de Ecuador, tuteo, "chévere", tolerar "poska", "qito", "zapas") y reflejar su intención ("para tu hija", "para tu emprendimiento").
8. **Ser honesto y no prometer lo que no controla**: precios, stock y envíos los confirma la tienda; decir que es asistente virtual si lo preguntan.
9. **Derivar a humano a tiempo y con contexto**: al primer signo de enojo, reclamo, pedido grande o 2 vueltas sin avanzar — y decir *cuándo* le responderán.
10. **Un seguimiento útil, no insistente**: solo si quedó algo pendiente, dentro de 24 h, y una sola vez.

## Riesgos principales y mitigación

| Riesgo | Por qué importa | Mitigación |
|---|---|---|
| **Alucinar tiendas, direcciones o teléfonos** | Mandar a un cliente a un lugar que no existe destruye la confianza en Mokalú y en la tienda | Tiendas solo vía tool `buscar_tienda`; guardas que comparan cada nombre/teléfono de la respuesta con `tiendas.csv`; evals que lo prueban; "si no hay, dilo" |
| **Alucinar precios o stock** | Los precios varían por tienda; un precio errado genera reclamos a la tienda | `limites.nunca`; regex de `$`/"dólares"/números con decimales; respuesta estándar "lo confirma la tienda" |
| **Bloqueo del número de WhatsApp** | Pérdida del canal principal | Solo API oficial (o coexistencia oficial); nada de Baileys/QR en el número real; sin envíos masivos; vigilar la calidad [S9] |
| **Incumplir política de Meta 2026 (bot de propósito general)** | Meta puede cortar el acceso a la API | Bot acotado: rechaza tareas, política, otros temas; foco en productos y tiendas [S6] |
| **Mensajes fuera de la ventana de 24 h** | Error de API o costo de plantilla | El adaptador valida la ventana; seguimientos ≤ 23 h; plantillas solo `utility` |
| **Costos que se disparan** (LLM + Meta) | Presupuesto del dueño | Haiku por defecto, Sonnet solo para escalar; contexto mínimo; prompt caching; límite de turnos; ojo cobro de servicio > 1.000/mes desde oct-2026 ⚠️ [S10] |
| **Inyección de instrucciones** ("ignora tus reglas…") | Puede hacer decir cosas indebidas o revelar el prompt | Reglas en el núcleo + guardas de salida; evals de red-teaming (Agente 4) |
| **Datos personales** | Teléfonos y nombres de clientes | Minimizar lo que se guarda; nada en el repo; `datos/` anonimizado |
| **Parecer humano y engañar** (enfoque de SellerChat [S11]) | Riesgo reputacional y de política | Transparencia: asistente virtual con nombre, ofrece persona real |
| **Información desactualizada** (tiendas que cierran, promos vencidas) | Redirigir a tiendas cerradas | `tiendas.csv` con fecha de actualización; promos con `vigente_hasta`; botón "¿esta info está mal?" → reporte |

## Propuestas al contrato
Añadidas en `docs/CONTRATO.md` → sección **Propuestas** (ver allí): tools estándar, `OutgoingMessage.location/list/requestLocation`,
idempotencia/`externalId`, modo humano, etiquetas, resumen, reglas de seguimiento, guardas de salida y nuevos campos de eval.

## Lo que queda abierto (en `PENDIENTES.md`)
- URL del repo de SellerChat "correcto" (preg. 1): los tres analizados; si el dueño tiene acceso al código real del bot, conviene repetir el análisis.
- Precios de SellerChat y tarifas exactas de Meta para Ecuador: verificar en fuentes oficiales (la red de la sesión bloquea esas páginas).
