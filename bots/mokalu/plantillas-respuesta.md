# Plantillas de respuesta sin IA (para n8n)

Respuestas fijas para los casos frecuentes: **no gastan IA**. El flujo de n8n detecta la intención con palabras clave
(o con el localizador) y responde con la plantilla; solo lo que no encaja va al LLM (DeepSeek).
Variables entre `{llaves}`: las de tienda salen de una fila de `tiendas.csv` (o del resultado de `buscar_tienda`).

> Normalizar el texto antes de comparar: minúsculas, sin tildes, sin signos. Probar las reglas **en este orden**;
> la primera que coincide gana. Si el mensaje tiene más de una intención (ej. "soy de Loja, qué posca para tazas"),
> mandarlo al LLM.

| # | Intención | Se activa si el mensaje… | Plantilla |
|---|---|---|---|
| 1 | reclamo | contiene: reclamo, defectuoso, dañado, vino seco, vinieron secos, no sirve, estafa, devolución, garantía, queja | R1 |
| 2 | distribuidor | contiene: distribuidor + (tengo / mi negocio / mi papelería / mi tienda), ser punto de venta, revender, vender posca, al por mayor, mayorista, proforma, cotización, colegio, empresa | R2 |
| 3 | humano | contiene: hablar con una persona, asesor, humano, persona real | R3 |
| 4 | dónde queda Mokalú | contiene: mokalu + (donde, dirección, queda, ubicados) | R4 |
| 5 | horario | contiene: horario, a qué hora, atienden, abren | R5 |
| 6 | dónde compro + lugar | el localizador encuentra un lugar **y** la tienda es `misma_ciudad` | R6 |
| 7 | dónde compro + lugar sin tienda | el localizador encuentra un lugar y la tienda es `mas_cercana` | R7 (≤ 60 km) / R8 (> 60 km) |
| 8 | precio | contiene: precio, cuánto cuesta, cuánto vale, valor, dólares | R9 |
| 9 | saludo / vacío | solo saludo ("hola", "buenas", "buenos días"), solo emojis o "?" | R10 |
| — | todo lo demás | — | → LLM |

## R1 · Reclamo → humano (derivar: reclamos)
```
Lamento mucho lo que pasó 🙏 Te paso ahora con el equipo de Mokalú que ve reclamos para resolverlo directamente. {aviso_horario}
```

## R2 · Quiere ser distribuidor / mayorista (derivar: distribuidores)
```
¡Qué buena noticia! 🙌 Te conecto con el equipo comercial de Mokalú. Si quieres, déjame el nombre de tu negocio y tu ciudad para pasárselos. {aviso_horario}
```

## R3 · Pide una persona (derivar: asesor_ventas)
```
Claro 🙂 Te paso con una persona del equipo de Mokalú. {aviso_horario}
```

## R4 · Dónde queda Mokalú
```
La tienda de Mokalú está en el *C.C. Laguna Plaza*, km 12,5 vía a la costa, Guayaquil 📍 Horario: {horario_mokalu}. Si estás en otra ciudad, dime cuál y te paso el punto de venta más cercano.
```

## R5 · Horario
```
Nuestro equipo atiende {horario_humano} 🕒 Yo te respondo a cualquier hora: ¿en qué ciudad estás para pasarte la tienda más cercana?
```

## R6 · Tienda en su ciudad
```
En {ciudad_cliente} puedes comprar en:
📍 *{tienda.nombre}* — {tienda.direccion}
🗺️ {tienda.maps_url} · 📲 {tienda.whatsapp} · 🕒 {tienda.horario}
Te recomiendo escribirles antes para confirmar colores. ¿Te ayudo a elegir qué POSCA llevar?
```

## R7 · Sin tienda en su ciudad, la más cercana a ≤ 60 km
```
En {ciudad_cliente} aún no tenemos punto de venta 😕 La más cercana está en {tienda.ciudad}, a ~{distancia_km} km:
📍 *{tienda.nombre}* — {tienda.direccion}
🗺️ {tienda.maps_url} · 📲 {tienda.whatsapp} · 🕒 {tienda.horario}
```

## R8 · Sin tienda, la más cercana a > 60 km (ofrecer online)
```
En {ciudad_cliente} aún no tenemos punto de venta 😕 Puedes pedir en la tienda online de Mokalú, con envíos a todo el país: {web_tienda}
La tienda física más cercana está en {tienda.ciudad} (~{distancia_km} km): *{tienda.nombre}*, 📲 {tienda.whatsapp}.
```
<!-- POR CONFIRMAR: que el bot pueda ofrecer la tienda online (FORMULARIO 7). -->

## R9 · Precio
```
El precio lo pone cada tienda, así que no te quiero dar un dato equivocado 🙏 Dime tu ciudad y te paso el WhatsApp de la tienda más cercana para que te lo confirmen.
```
(Si el cliente insiste por segunda vez → R3.)

## R10 · Saludo, emojis o "?"
```
¡Hola! Soy {nombre_bot}, asesora de Mokalú 🎨 Te ayudo a encontrar dónde comprar uni/POSCA o a elegir cuál te sirve. ¿En qué ciudad estás?
```

## Variables
| Variable | De dónde sale |
|---|---|
| `{nombre_bot}` | `bot.yaml → variables.nombre_bot` |
| `{web_tienda}` | `bot.yaml → variables.web_tienda` |
| `{horario_humano}` | `bot.yaml → variables.horario_humano` |
| `{horario_mokalu}` | fila `mokalu-laguna-plaza` de `tiendas.csv` |
| `{aviso_horario}` | vacío si el equipo está en horario; si no: "Te responden en horario de atención ({horario_humano})." |
| `{ciudad_cliente}` | lugar que entendió el localizador |
| `{tienda.*}`, `{distancia_km}` | primera tienda del localizador (`buscar_tienda`) |

## Cuánto ahorra
Con 10 mensajes/día, saludo + "dónde compro en X" + precio + horario son la mayoría de los primeros mensajes:
se estima que **la mitad o más** no necesita IA. Solo la asesoría de producto, preguntas mezcladas y casos raros van al LLM.
