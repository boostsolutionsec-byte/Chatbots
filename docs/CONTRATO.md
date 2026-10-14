# Contrato entre agentes

Esta es la interfaz fija que permite que los 3 agentes trabajen en paralelo sin esperarse.
El **Agente 2** implementa el motor que lee esto; el **Agente 3** escribe bots que cumplen esto;
el **Agente 1** propone mejoras (sección "Propuestas") basadas en la ingeniería inversa.

## 1. Un bot = una carpeta de configuración

```
bots/<bot-id>/
  bot.yaml            # identidad, canales, flujos, reglas de derivación
  conocimiento/       # .md con FAQ, catálogo, políticas (lo que el bot "sabe")
  catalogo.csv        # (opcional) productos: sku,nombre,precio,stock,descripcion,imagen_url
  prompts/sistema.md  # prompt de sistema del bot (puede usar {{variables}} de bot.yaml)
  evals/*.yaml        # conversaciones de prueba con resultados esperados
```

El framework **no** debe contener nada específico de Mocalu o Uniwell. Si un bot necesita algo que el
framework no tiene, el Agente 3 lo pide en `PENDIENTES.md` con la etiqueta `[framework]`.

## 2. Esquema de `bot.yaml` (v1)

```yaml
id: uniwell                     # igual al nombre de la carpeta
marca: Uniwell
objetivo: ventas                # ventas | redireccion | soporte
idioma: es-EC
persona:
  nombre: "Sofi"
  tono: "cercano, tuteo, emojis moderados"
canales: [whatsapp, instagram]
horario_humano:
  zona: America/Guayaquil
  dias: [lun, mar, mie, jue, vie, sab]
  desde: "09:00"
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
flujos:                         # datos que el bot debe recolectar para completar un objetivo
  pedido:
    campos:
      - {id: nombre, pregunta: "¿A nombre de quién va el pedido?", requerido: true}
      - {id: ciudad, requerido: true}
      - {id: direccion, requerido: true}
      - {id: forma_pago, opciones: [transferencia, link_pago, contraentrega], requerido: true}
    al_completar: [guardar_pedido, derivar:asesor_ventas]
limites:
  nunca: ["prometer fechas exactas de entrega", "inventar precios"]
  max_mensajes_sin_avance: 6
seguimiento:
  - despues_de: 23h            # dentro de la ventana de 24 h de WhatsApp
    si: "pedido incompleto"
    mensaje: "plantilla:recordatorio_pedido"
```

## 3. Interfaces TypeScript (las implementa el Agente 2)

```ts
interface IncomingMessage { channel: 'whatsapp'|'instagram'|'simulator'; userId: string; text?: string; mediaUrl?: string; timestamp: number; raw?: unknown }
interface OutgoingMessage { text?: string; buttons?: {id:string; title:string}[]; mediaUrl?: string; template?: {name:string; vars:string[]} }
interface ChannelAdapter { name: string; parseWebhook(req): IncomingMessage[]; send(userId: string, msg: OutgoingMessage): Promise<void>; verifyWebhook?(req): boolean }
interface LLMProvider { complete(args: { system: string; messages: {role:'user'|'assistant'; content:string}[]; tools?: unknown[]; model: string }): Promise<{ text: string; toolCalls?: unknown[] }> }
interface Store { getConversation(botId: string, userId: string): Promise<Conversation>; saveConversation(c: Conversation): Promise<void>; saveOrder(o: Order): Promise<void>; saveHandoff(h: Handoff): Promise<void> }
```

## 4. Formato de evals (`bots/<id>/evals/*.yaml`)

```yaml
nombre: compra completa por transferencia
canal: whatsapp
turnos:
  - usuario: "Hola, cuánto cuesta <producto del catálogo>?"
    espera:
      contiene_alguno: ["$", "precio"]
      no_contiene: ["no sé"]
  - usuario: "lo quiero, pago por transferencia"
    espera:
      pide_campo: nombre
resultado_final:
  accion: guardar_pedido          # o derivar:<destino>
juez: "El bot fue amable, no inventó datos y cerró la venta."   # criterio para LLM-juez
```

El runner de evals (`framework`) debe dar una nota por eval y un resumen en `reportes/evals-<fecha>.md`.

## Propuestas (Agente 1 añade aquí)

## Cambios
