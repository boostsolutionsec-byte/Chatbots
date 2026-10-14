# Contrato entre agentes

Esta es la interfaz fija que permite que los 3 agentes trabajen en paralelo sin esperarse.
El **Agente 2** implementa el motor que lee esto; el **Agente 3** escribe el bot (`bots/mokalu/`) que cumple esto;
el **Agente 1** propone mejoras (sección "Propuestas") basadas en la ingeniería inversa.

## 1. Un bot = una carpeta de configuración

```
bots/<bot-id>/
  bot.yaml            # identidad, canales, flujos, reglas de derivación
  conocimiento/       # .md con FAQ, catálogo, políticas (lo que el bot "sabe")
  tiendas.csv         # puntos de venta: id,nombre,ciudad,provincia,direccion,lat,lng,maps_url,whatsapp,telefono,horario,marcas,vende_online,web
  catalogo.csv        # (opcional) productos: sku,marca,linea,nombre,punta,superficies,descripcion,imagen_url[,precio_ref]
  prompts/sistema.md  # prompt de sistema del bot (puede usar {{variables}} de bot.yaml)
  evals/*.yaml        # conversaciones de prueba con resultados esperados
```

El framework **no** debe contener nada específico de Mokalú ni de uni-ball. Si un bot necesita algo que el
framework no tiene, el Agente 3 lo pide en `PENDIENTES.md` con la etiqueta `[framework]`.

## 2. Esquema de `bot.yaml` (v1)

```yaml
id: mokalu                      # igual al nombre de la carpeta
marca: "Mokalú × uni-ball"
objetivo: [redireccion, asesoria]   # redireccion = mandar a la tienda más cercana
idioma: es-EC
persona:
  nombre: "Sofi"
  tono: "cercano, tuteo, emojis moderados"
canales: [web, telegram]        # luego: whatsapp, instagram
horario_humano:
  zona: America/Guayaquil
  dias: [lun, mar, mie, jue, vie, sab]
  desde: "10:00"
  hasta: "18:00"
modelo:
  rapido: claude-haiku          # alias; el framework lo resuelve a un id real
  experto: claude-sonnet
destinos:                       # a dónde se puede redirigir/derivar
  - id: asesor_ventas
    tipo: humano                # humano | link | sucursal | bot
    valor: "${WHATSAPP_ASESOR_VENTAS}"   # variable de entorno, nunca el número en claro
    descripcion: "Asesor de ventas"
reglas_derivacion:              # se evalúan en orden; la primera que coincide gana
  - si: "cliente pide hablar con una persona"
    ir_a: asesor_ventas
  - si: "reclamo o cliente molesto"
    ir_a: asesor_ventas
    prioridad: alta
localizador:                    # buscar la tienda más cercana
  archivo: tiendas.csv
  acepta: [ciudad, canton, provincia, sector, ubicacion_compartida]   # ubicación de Telegram/WhatsApp → lat/lng
  max_resultados: 2
  si_no_hay_en_ciudad: mas_cercana_por_distancia   # o: derivar:<destino>
flujos:                         # datos que el bot debe recolectar para completar un objetivo
  donde_comprar:
    campos:
      - {id: ubicacion, pregunta: "¿En qué ciudad o sector estás?", requerido: true}
      - {id: producto_interes, requerido: false}
    al_completar: [buscar_tienda, guardar_lead]
limites:
  nunca: ["inventar tiendas, direcciones o teléfonos", "dar precios o stock de una tienda"]
  max_mensajes_sin_avance: 6
seguimiento:
  - despues_de: 23h            # dentro de la ventana de 24 h de WhatsApp
    si: "pedido incompleto"
    mensaje: "plantilla:recordatorio_pedido"
```

## 3. Interfaces TypeScript (las implementa el Agente 2)

```ts
interface IncomingMessage { channel: 'web'|'telegram'|'whatsapp'|'instagram'|'simulator'; userId: string; text?: string; mediaUrl?: string; location?: {lat:number; lng:number}; timestamp: number; raw?: unknown }
interface StoreLocator { find(q: { text?: string; lat?: number; lng?: number; producto?: string }): Promise<{ tienda: Tienda; distanciaKm?: number; motivo: 'misma_ciudad'|'misma_provincia'|'mas_cercana' }[]> }
interface OutgoingMessage { text?: string; buttons?: {id:string; title:string}[]; mediaUrl?: string; template?: {name:string; vars:string[]} }
interface ChannelAdapter { name: string; parseWebhook(req): IncomingMessage[]; send(userId: string, msg: OutgoingMessage): Promise<void>; verifyWebhook?(req): boolean }
interface LLMProvider { complete(args: { system: string; messages: {role:'user'|'assistant'; content:string}[]; tools?: unknown[]; model: string }): Promise<{ text: string; toolCalls?: unknown[] }> }
interface Store { getConversation(botId: string, userId: string): Promise<Conversation>; saveConversation(c: Conversation): Promise<void>; saveOrder(o: Order): Promise<void>; saveHandoff(h: Handoff): Promise<void> }
```

## 4. Formato de evals (`bots/<id>/evals/*.yaml`)

```yaml
nombre: compra completa por transferencia
canal: telegram
turnos:
  - usuario: "hola donde consigo posca"
    espera:
      pide_campo: ubicacion
  - usuario: "soy de riobamba"
    espera:
      tienda_en: [riobamba]           # la(s) tienda(s) recomendada(s) deben ser de esta ciudad
      no_contiene: ["$"]
resultado_final:
  accion: buscar_tienda
juez: "El bot fue breve, no inventó tiendas y mandó al cliente a una tienda real de Riobamba."   # criterio para LLM-juez
```

El runner de evals (`framework`) debe dar una nota por eval y un resumen en `reportes/evals-<fecha>.md`.

## Propuestas (Agente 1 añade aquí)

> Agente 1 · 2026-10-14 · Base: `docs/ingenieria-inversa/00-RESUMEN.md`. Son **propuestas**; el Agente 2 decide y, si adopta alguna, la anota en "Cambios".

- **P-1 · Tools estándar del motor** (el LLM nunca recibe `tiendas.csv` entero): `buscar_tienda({texto?, lat?, lng?, producto?})` → usa `StoreLocator.find`;
  `buscar_producto({texto})` → filas de `catalogo.csv`; `derivar_humano({destino, motivo, prioridad?})`; `guardar_dato({campo, valor})`; `etiquetar({tag})`.
  Motivo: impedir que el modelo invente tiendas/teléfonos (`02` etapa 9).
- **P-2 · `OutgoingMessage` ampliado**: `location?: {lat:number; lng:number; name?:string; address?:string}`, `list?: {title:string; rows:{id:string; title:string; description?:string}[]}`,
  `requestLocation?: boolean`. Cada adaptador degrada (lista→botones→texto numerado). Límites WhatsApp: botones ≤ 3 (título ≤ 20 car.), lista ≤ 10 filas (`05` §2).
- **P-3 · `IncomingMessage.externalId: string`** (wamid / mid / update_id) para **idempotencia**, y `media?: {type:'audio'|'image'|'video'|'document'; url?:string; id?:string; mime?:string}`
  en lugar de solo `mediaUrl`, para distinguir audio de imagen (`02` etapas 3 y 5).
- **P-4 · Debounce por usuario**: agrupar mensajes del mismo usuario recibidos en una ventana configurable (`bot.yaml → entrada.agrupar_segundos`, defecto 3) antes de llamar al LLM.
- **P-5 · Modo de conversación**: `Conversation.modo: 'bot'|'humano'|'pausado'` con `modo_hasta` (expira, defecto 12 h). En `humano` el bot no responde (`02` etapa 6).
- **P-6 · Guardas de salida** (en el motor, configurables desde `limites`): (a) cada nombre de tienda/teléfono/dirección en la respuesta debe venir de un resultado de tool del mismo turno;
  (b) bloquear precios si `limites.nunca` contiene precios (regex `\$|USD|dólar|\d+[.,]\d{2}`); (c) `max_palabras_por_mensaje`. Si falla: regenerar 1 vez, luego respuesta segura.
- **P-7 · Etiquetas y resumen**: `Conversation.tags: string[]` y `Conversation.resumen_corto?: string` (2–3 líneas, generado al derivar o cerrar). `Handoff` incluye `resumen_corto`.
  Convención de tags: `intencion:*`, `ciudad:*`, `producto:*`, `resultado:*`, `canal:*` (`04` §3).
- **P-8 · Reglas de seguimiento en el motor**: máx. 1 seguimiento sin respuesta por conversación; se cancela si el cliente escribe; clave única `(bot, usuario, regla)`;
  en WhatsApp/Instagram `despues_de` ≤ 23h (validación al cargar `bot.yaml`); no enviar fuera de 08h00–20h00 de `horario_humano.zona`.
  Nota: dentro de la ventana de 24 h no hace falta plantilla; `plantilla:` solo es obligatoria fuera de ventana.
- **P-9 · Evals**: añadir a `espera`: `tienda_id_en: [...]` (más preciso que ciudad), `no_inventa_tiendas: true` (todas las tiendas citadas existen en el CSV),
  `deriva_a: <destino>`, `max_burbujas: n`, `pregunta_unica: true`. `docs/ingenieria-inversa/conversaciones-ejemplo.md` trae 30+ casos listos para convertir.
- **P-10 · Respuesta fuera de alcance** (política WhatsApp 2026 contra bots de propósito general): `bot.yaml → limites.fuera_de_tema: "<mensaje>"` y el núcleo del prompt
  obliga a usarlo para temas ajenos al negocio (`07` §3).
- **P-11 · Transparencia**: el núcleo del prompt del framework obliga a reconocer que es un asistente virtual si se lo preguntan (no configurable a "ocultar").

## Cambios

- (agente 2, 2026-10-14) **Extensiones compatibles del contrato** (todo lo anterior sigue igual):
  - `bot.yaml`: `reglas_derivacion[].palabras: [..]` (frases que derivan sin pasar por el LLM); `localizador.alias: {"mall x": "guayaquil" | "-2.1,-79.9"}`;
    `destinos[].tipo` admite también `webhook`; `limites.max_caracteres_respuesta` (opcional); `seguimiento[].texto` (texto para canales sin plantillas);
    `${VAR:-valor}` = valor por defecto si la variable no existe.
  - `tiendas.csv`: `marcas` separadas por `;` (también `|` o `/`); `vende_online`: `sí/si/true/1`; si faltan `lat,lng` se intenta sacarlos de `maps_url`
    (`@lat,lng` o `q=lat,lng`) y si no, se usan las coordenadas de la ciudad. Columnas extra se conservan. Líneas que empiezan con `#` se ignoran.
  - `IncomingMessage` añade `messageId?` (idempotencia) y `buttonId?`; `OutgoingMessage` añade `location?` (pin de la tienda). `ChannelName` añade `periskope`.
  - `StoreLocator.find` igual; además `Locator.locate()` devuelve `{lugar, ambiguo, resultados, online, aviso, derivar}`.
  - Evals: además de `pide_campo`, `tienda_en`, `no_contiene`, se aceptan en `espera`: `contiene: [..]`, `tienda_id: [..]`, `deriva_a: <destino>`,
    `accion: <herramienta>`, `no_accion: <herramienta>`, `max_caracteres: N`; un turno puede ser `ubicacion: {lat, lng}` en lugar de `usuario`.
    `resultado_final.accion` se cumple si esa herramienta se usó en cualquier turno. `juez` se evalúa con LLM solo si hay IA real.

- (agente 2, 2026-10-14 — segunda tanda) **Simulador fijado en el contrato (H-07)**: `POST /sim/:botId` body `{userId, text?, location?: {lat,lng}, buttonId?, messageId?, channel?, reset?: true}`
  → `{replies: OutgoingMessage[], toolCalls: [{name,input,result}], actions: string[], tiendas: Tienda[], motivos: string[], prioridad?, state: {fields, activeFlow?, paused, pendingField?, turnsWithoutProgress}, skipped?: 'duplicate'|'paused'|'empty', model?}`.
  `POST /sim/:botId/reset {userId}` también reinicia. Mensajes del mismo `userId` se procesan en orden.
- **Propuestas del Agente 1 adoptadas**: P-1 (herramientas con nuestros nombres: `buscar_tienda`, `buscar_producto`, `registrar_campo`, `guardar_lead`, `derivar`, `consultar_horario`);
  P-2 parcial (`OutgoingMessage.location`; listas/`requestLocation` pendientes); P-3 como `messageId` (idempotencia); P-4 (`DEBOUNCE_SECONDS`, defecto 3, en webhooks y Telegram);
  P-5 como `paused` + `pausedAt` que vence a las `HANDOFF_PAUSE_HOURS` (defecto 12); P-6 (teléfonos/links no verificados se borran; precios y largo → 1 reintento);
  P-8 parcial (una vez por regla, no si está en pausa, ventana de 24 h); P-9 (claves de evals, ver arriba); P-10 (`limites.fuera_de_tema`); P-11 (regla fija de transparencia).
- **Campos de `bot.yaml` del Agente 3 soportados**: `variables`, `reglas_derivacion[].mensaje`, `horario_humano.fuera_de_horario`, `localizador.lugares`, `localizador.ofrecer_ademas`,
  `localizador.distancia_lejana_km` (defecto 60) y `distancia_muy_lejana_km` (defecto 300), `limites.max_palabras_por_mensaje`, `limites.fuera_de_tema`.
  `localizador.filtro_producto` se acepta (el filtro por `marcas` está siempre activo cuando se pide un producto que coincide con una marca).
- `LocatorResult.nota?` (aclaración, p. ej. "no declara POSCA; tiene: uni-ball"). Si hay tienda en la ciudad pero sin la marca pedida, se muestra igual (H-12).
- Evals: `tienda_en` se cumple si la **primera** tienda recomendada está en una de las ciudades.
- (agente 2, 2026-10-14 — tercera tanda) `IncomingMessage.media?: {type: audio|image|video|document|sticker, id?, url?, mime?}`; `OutgoingMessage.requestLocation?` y `list?`;
  `template.language?`; `Conversation.tags?` (`canal:*`, `ciudad:*`, `producto:*`, `intencion:*`, `resultado:*`, `sin_cobertura:*`) y `lastFollowupAt?`;
  `registrar_campo` acepta `flujo`; `al_completar` acepta `derivar:<destino>` y `recomendar_producto`; destinos `sucursal` se muestran como tienda;
  `seguimiento[].texto` (texto libre dentro de 24 h) e `idioma_plantilla`. Endpoints admin nuevos: `POST /admin/:botId/reload`, `GET /admin/:botId/metricas`.
