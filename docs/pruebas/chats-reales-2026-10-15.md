# Prueba con 5 chats reales de WhatsApp de Mokalú (2026-10-15)

Se pasaron, en orden, los mensajes de texto de los clientes de 5 chats reales por el código del bot
(`framework/n8n/workflow/nodo.js`, 94 tiendas reales). Las fotos y audios no se pudieron probar (el export
dice "Multimedia omitido"). Los chats **no** se guardan en el repo porque tienen datos personales.

| Chat (anonimizado) | Qué quería el cliente | Qué hizo Mokalú (humano) | Qué habría hecho el bot (antes) |
|---|---|---|---|
| Mayorista Quito (113 msgs, 2023–2026) | Cotizaciones, facturas, depósitos, envíos | Cotiza, factura y despacha por Servientrega | Cotización → equipo ✔; factura/depósito/envío → a la IA ✘; saludo completo en cada visita |
| Cliente de anuncio IG, Guayaquil | Sketchbook 9×14 con envío | Precio $9 + envío $3, pide datos, envía | Lo manda a Polipapel ✘ (venta perdida para Mokalú) |
| Galápagos (entrega en hotel de GYE) | Comprar por WhatsApp con entrega | **Respondió 1,5 días después**; vendió $102 | Le ofrece una tienda a 1.057 km ✘ |
| Librería de Santo Domingo | Precios POSCA 17K/8K, mamparas | Precios, asesoría 8K vs 17K, venta con envío $6,50 | Precio → IA con fragmento equivocado ✘; "¿Cuánto duran?" → ciudad Durán ✘ |
| Cliente Guayaquil/Samborondón | Sketchbook con envío | Cotiza, pide datos, envía | Lo manda a Polipapel ✘; datos personales → IA ✘ |

## Corregido en el bot (mismo día)
- Pedido en curso (pedido, factura, depósito, comprobante, envío, "¿cuándo llega?", "¿hacen envíos?") y mensajes con
  cédula/RUC/teléfono → **pasa al equipo de Mokalú sin IA** (los datos personales ya no van a la IA).
- Fotos y documentos → al equipo (el bot aún no puede verlas).
- Precio: "a cómo sale", "valorcito", "combo", "promos", "descuento" → respuesta fija con la tienda de su ciudad y la opción de
  comprar con envío a Mokalú.
- Ciudad a más de 300 km de una tienda (ej. Galápagos) → envíos de Mokalú, sin listar una tienda lejana.
- "¿Cuánto duran?" ya no se confunde con Durán; emoji o "?" sueltos ya no repiten el saludo; cliente que vuelve en
  menos de 2 días recibe "¡Hola de nuevo!".
- Conocimiento: mamparas y punta gruesa (8K/17K) y **uni Chalk** (tiza líquida).

Resultado: los mensajes de pedido/envío/factura que antes iban a la IA ahora van al equipo (28 en los 5 chats); 30/30 casos
de prueba y 210 pruebas del framework siguen pasando.

## Lo que esta prueba muestra (decisión del dueño)
Estos chats son de **venta directa de Mokalú** (cotiza, vende, factura y envía). El bot está diseñado para la cuenta de la
**marca** (uni-ball): mandar al cliente a la tienda más cercana. Si el bot se pone en el **WhatsApp de Mokalú**, hace falta un
"modo tienda Mokalú": catálogo y precios de Mokalú (incluye productos que no son uni: sketchbooks, óleo pastel, papeles,
pinceles), costo de envío (GYE $3, resto del país $6,50 según los chats) y tomar los datos del pedido para facturar.
