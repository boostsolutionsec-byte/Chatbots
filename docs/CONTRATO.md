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

## Cambios
