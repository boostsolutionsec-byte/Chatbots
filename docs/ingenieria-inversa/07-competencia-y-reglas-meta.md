# 07 · Competencia y reglas de Meta (WhatsApp / Instagram)

> Agente 1 · 2026-10-14. Investigación por búsqueda web. **Limitación:** la red de la sesión bloquea la descarga directa de
> sellerchat.ai y developers.facebook.com (proxy 403), así que los datos vienen de los resúmenes de resultados de búsqueda; cada afirmación lleva su fuente [Sx].
> Lo marcado ⚠️ son cifras de terceros o en conflicto: **verificar en la página oficial antes de decidir**.

## 1. SellerChat (lo que se sabe públicamente)

| Aspecto | Dato | Fuente |
|---|---|---|
| Qué es | "plataforma para gestionar conversaciones con clientes vía WhatsApp", orientada a **eCommerce y Dropshipping**; "asistentes entrenados con toda la información de tu negocio" | [S1] |
| Tecnología | WhatsApp **Cloud API** (oficial) + asistente basado en **ChatGPT**; configuración "sin conocimientos técnicos" | [S1] |
| Multimodal | entiende **imágenes y notas de voz**; envía **notas de voz generadas con IA** | [S1] |
| Casos | confirmación de pedidos, seguimiento post-venta, agendar citas | [S1], [S4] |
| Automatización | disparadores, acciones masivas, condiciones lógicas, **etiquetas**, plantillas, integraciones | [S4], [S5] |
| Integraciones | **Dropi** (subir órdenes), MasterShop, Rocketfy | [S1], [S2], [S3] |
| Posicionamiento | "Un robot que parece humano"; cursos de terceros: "reemplaza al vendedor humano (sin que nadie lo note)" | [S11], [S5] |
| Captación | landing con wizard de 5 pasos → simulación por WhatsApp → sesión 1:1 de implementación | [PA] `src/app/page.tsx` (ver `01`) |
| Formación | "Certificación SellerChat 2025" de pago, con eBook gratis | [S4] |
| Producto hermano | **SellerCall**: agente de voz (Twilio + Ultravox) con re-llamadas automáticas | [SB] (ver `01`) |
| Precios | ⚠️ no encontrados en fuentes públicas | — |

## 2. Competidores

| | **SellerChat** | **Wati** | **Manychat** | **Respond.io** | **Leadsales** |
|---|---|---|---|---|---|
| Foco | IA vendedora en WhatsApp para e-commerce/dropshipping LatAm | WhatsApp (+IG) para pymes, comercio | Automatización de Instagram/Messenger (y WA) por flujos | Bandeja omnicanal + IA para equipos medianos | CRM de WhatsApp con embudo, LatAm (MX) |
| Canales | WhatsApp | WhatsApp, Instagram [S21] | Instagram, Messenger, WhatsApp, SMS | WA, IG, Messenger, TikTok, email, VoIP… [S21] | WA, IG, Facebook en una bandeja [S23] |
| Conexión WA | Cloud API [S1] | API oficial (BSP) | API oficial | API oficial | **QR (no oficial)**, API oficial o **coexistencia** [S23] |
| IA | ChatGPT entrenado con datos del negocio | agentes de IA con Claude o ChatGPT [S21] | "AI Step"; criticado por ser casi palabras clave ⚠️ [S24] | AI Agent con fuentes de conocimiento aprobadas y **acciones** (etiquetar, cambiar etapa, HTTP, cerrar con resumen) [S25] | "Lead Agent": califica, **resume conversaciones antiguas**, sugiere siguiente paso [S23] |
| Embudo/CRM | etiquetas, disparadores | etiquetas, campañas | tags, secuencias | **lifecycle stages** automáticas + handoff con contexto [S25] | **tablero de etapas** (nuevo → seguimiento → propuesta → cerrado) [S23] |
| Fortaleza a copiar | multimodal (voz/imagen), integraciones de pedidos | integración Shopify/WooCommerce | **comentario → DM** en posts e historias de IG [S24] | handoff con contexto, acciones acotadas | resumen para el vendedor, asignación automática |
| Precio | ⚠️ n/d | por plan [S21] | por contactos que interactúan (desde 2-mar-2026): US$17/39/99/199 al mes ⚠️ [S24] | Premium AI US$399/mes (5 usuarios, 1.000 contactos activos) ⚠️ [S25] | Básico ~US$97/mes ⚠️ [S23] (o ~MXN 2.363 [S17]) |

**Lecciones para nuestro framework**
1. Todos convergen en: **bandeja humana + IA acotada + etiquetas/etapas + resumen para el humano**. Eso es P0/P1 para nosotros.
2. El diferenciador de Manychat (comentario de IG → DM) es muy relevante para Mokalú (Instagram es su canal fuerte) → P2.
3. Respond.io modela la IA como **acciones con alcance** (tools), no como texto libre — igual que nuestra propuesta de `buscar_tienda`.
4. Leadsales ofrece QR no oficial: barato pero **riesgo de bloqueo**; no lo copiamos.
5. Nadie (público) resuelve "**redirigir a la tienda más cercana de un distribuidor**": es nuestro diferenciador.

## 3. Reglas actuales de WhatsApp (Business Platform / Cloud API)

| Regla | Detalle | Fuente |
|---|---|---|
| Ventana de servicio | 24 h desde el **último mensaje del cliente**; dentro se puede responder libre (texto, interactivos). Fuera: **solo plantillas** aprobadas | [S8], [S18] |
| Cobro | **Por mensaje** desde 1-jul-2025; solo se cobran **plantillas entregadas**; tarifa según categoría (marketing, utility, authentication) y país del destinatario | [S8] |
| Gratis | mensajes no-plantilla (dentro de ventana) y **plantillas utility dentro de la ventana** | [S8] |
| Cambio oct-2026 ⚠️ | según respond.io, desde 1-oct-2026 los mensajes de servicio también se cobran pasados **1.000/mes por número** | [S10] |
| Ventana de entrada gratis | **72 h** gratis (incl. plantillas) si el cliente llegó por anuncio Click-to-WhatsApp o botón de página de Facebook y se responde en 24 h | [S8], [S10] |
| Límites de envío (business-initiated) | por **portafolio** (desde oct-2025). Arranque 250 usuarios únicos/24 h sin verificar; escalones superiores al verificar el negocio y mantener calidad. ⚠️ las fuentes difieren (1K vs 2K vs salto directo a 100K en 2026) | [S9] |
| Calidad | calificación alta/media/baja según bloqueos/reportes; baja calidad impide subir de nivel o lo baja | [S9] |
| Interactivos | reply buttons **máx. 3** (título ≤ 20 car.), listas hasta **10** opciones, **location request** | [S18] |
| Indicador de escritura | disponible en Cloud API, dura hasta 25 s o hasta responder ⚠️ | [S19] |
| **Política de IA 2026** | desde **15-ene-2026** se prohíben en la Business API los **chatbots de IA de propósito general** (tipo ChatGPT/Perplexity); **permitidos** bots de soporte/FAQ/pedidos/citas acotados a un negocio | [S6], [S7] |
| Coexistencia | mismo número en la app WhatsApp Business y la Cloud API (app ≥ 2.24.17); no comparten ventana ni facturación; ~20 msg/s | [S13] |
| Clientes no oficiales (Baileys, WA Web) | contra los términos; riesgo de bloqueo del número (no hay fuente oficial en los resultados; práctica conocida) | — |

## 4. Reglas actuales de Instagram Messaging API

| Regla | Detalle | Fuente |
|---|---|---|
| Cuenta | profesional (empresa/creador) | [S14] |
| Login | API con inicio de sesión de Instagram **o** vía Facebook Login, no ambos en la misma app | [S14] |
| Permiso | `instagram_business_manage_messages`; **App Review** si no se otorga acceso avanzado automático | [S14] |
| Ventana | 24 h desde el último mensaje del usuario | [S12], [S16] |
| `HUMAN_AGENT` | extiende a **7 días**, solo para respuestas **manuales de una persona**; no para bots ni promociones; requiere revisión | [S12] |
| Límites | "Business Use Case rate limiting"; cifra exacta ⚠️ (200/h según un tercero, fórmula por impresiones según otro) | [S15], [S12] |
| Texto | ⚠️ 1.000 caracteres según documentación de un integrador | [S16] |

## 5. Implicaciones para el diseño (resumen)
- Bot **acotado al negocio** y que rechace temas ajenos → cumple la política 2026.
- **Responder siempre dentro de 24 h**; seguimientos a ≤ 23 h; plantillas solo para casos `utility` reales.
- **No usar** clientes no oficiales con el número de Mokalú.
- Diseñar respuestas con ≤ 3 botones y degradar a texto numerado.
- Verificar el negocio en Meta pronto (sube límites y habilita funciones).

## Fuentes
- [S1] SellerChat, sitio oficial — https://sellerchat.ai/ (y https://www.intro.sellerchat.ai/)
- [S2] YouTube, "Cómo VENDER MÁS con DROPi y SELLERCHAT" — https://www.youtube.com/watch?v=LT1NtU3xpF4 ; "Conectar Dropi con SellerChat y subir órdenes" — https://www.youtube.com/watch?v=m8YA6cVO1KQ
- [S3] YouTube, "SellerChat + MasterShop" — https://www.youtube.com/watch?v=0Bs9KCT56Vs
- [S4] Certificación SellerChat — https://certificacion.sellerchat.ai/ y https://certificacion.sellerchat.ai/apertura
- [S5] Alex Bit, curso introducción a SellerChat — https://estadobit.unloquer.org/domina-las-ventas-con-ia-curso-sellerchat/ y https://estadobit.unloquer.org/inteligencia-artificial-2/
- [S6] respond.io, "Not All Chatbots Are Banned: WhatsApp's 2026 AI Policy" — https://respond.io/blog/whatsapp-general-purpose-chatbots-ban
- [S7] Alibaba Cloud, "WhatsApp AI chatbot policy 2026" — https://www.alibabacloud.com/help/en/chatapp/use-cases/whatsapp-ai-policy-2026-guide
- [S8] Meta, "Pricing on the WhatsApp Business Platform" — https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing
- [S9] Límites de mensajería: Infobip — https://www.infobip.com/docs/whatsapp/manage-integration ; Webex Connect changelog — https://help.webexconnect.io/changelog/whatsapp-supports-business-portfolio-pacing-relaxing-messaging-limit-tiers-and-text-truncation-on-marketing-messages ; AiSensy — https://m.aisensy.com/blog/whatsapp-message-limits-guide/
- [S10] respond.io, "WhatsApp pricing change 2026" — https://respond.io/blog/whatsapp-pricing-change-2026
- [S11] YouTube, lista "SellerChat - Un Robot que parece Humano" — https://www.youtube.com/playlist?list=PLmv__FOdROowpxppbZAbOnayeHAUsILvI
- [S12] Ventana 24 h y Human Agent en Instagram: inro.social — https://www.inro.social/glossary/24-hour-messaging-window ; Blotato — https://www.blotato.com/blog/instagram-messaging-api
- [S13] Coexistencia: Telnyx — https://developers.telnyx.com/docs/messaging/whatsapp/coexistence ; Saysimple — https://www.saysimple.com/blog/whatsapp-coexistence-keep-app-add-automation
- [S14] Meta, "App Review for Instagram API" — https://developers.facebook.com/docs/instagram-platform/app-review
- [S15] Meta, Instagram API overview — https://developers.secure.facebook.com/docs/instagram/platform/instagram-api/overview
- [S16] Integración Instagram (WATI vía withone.ai) — https://www.withone.ai/knowledge/wati/conn_mod_def%3A%3AGNV__RPmf-k%3A%3A97M-sK15QQ2pTbVbIboXig ; CM.com — https://www.cm.com/app/docs/api/business-messaging-api/1.0/instagram/
- [S17] Leadsales, "Alternativas a Respond.io" — https://leadsales.io/blog/alternativas-respond-io/
- [S18] Mensajes interactivos: Meta — https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages ; 360dialog — https://docs.360dialog.com/partner/messaging/interactive-messages ; Exotel — https://developer.exotel.com/docs/whatsapp-support/interactive-messages
- [S19] Botsailor, indicadores de escritura en Cloud API — https://botsailor.com/blog/new-typing-indicators-in-whatsapp-cloud-api
- [S20] Telegram `setWebhook`/`secret_token`: aiogram — https://docs.aiogram.dev/en/latest/dispatcher/webhook.html ; teledart — https://pub.dev/documentation/teledart/latest/telegram/Telegram/setWebhook.html ; oficial: https://core.telegram.org/bots/api#setwebhook
- [S21] Comparativas Wati/Respond.io: https://www.wati.io/geo-mexico-es/criterios-para-comparar-plataformas-de-ventas-por-whatsapp-en ; https://respond.io/es/alternatives/wati
- [S23] Leadsales, "qué es y cómo funciona" — https://leadsales.io/blog/leadsales-que-es-como-funciona/
- [S24] Manychat 2026: Featurebase — https://www.featurebase.app/blog/manychat-review ; DEV — https://dev.to/sakthivel_instantdm/manychat-pricing-2026-real-costs-5-honest-alternatives-with-math-4d74 ; Blotato — https://www.blotato.com/blog/manychat-pricing
- [S25] respond.io, "Best AI agents for B2C customer conversations" — https://respond.io/blog/best-ai-agents-b2c-customer-conversations
