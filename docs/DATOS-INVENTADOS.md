# Datos inventados (para reemplazar)

Cada agente añade aquí una fila por cada dato de ejemplo que use. El Agente 4 compila esto en `FORMULARIO-FINAL.md`.

| archivo | campo/fila | valor inventado | qué dato real hace falta | pregunta para el dueño |
|---|---|---|---|---|
| bots/mokalu/tiendas.csv | 39 filas con id ≠ `mokalu-laguna-plaza` (nombre `EJEMPLO …`) | 39 tiendas inventadas en 19 provincias (sin tienda: Bolívar, Galápagos, Morona Santiago, Orellana, Zamora Chinchipe) | Lista real de puntos de venta: nombre, ciudad, provincia, dirección, coordenadas o link de Maps, WhatsApp, horario, marcas, ¿vende online? | ¿Me pasas el Excel/Sheets con todos los puntos de venta de uni/POSCA? |
| bots/mokalu/tiendas.csv | columnas `whatsapp` y `telefono` de todas las filas | `+593 99 000 0000` | Contacto público de cada tienda | ¿Qué WhatsApp/teléfono público tiene cada tienda (y ellas aceptan que el bot lo comparta)? |
| bots/mokalu/tiendas.csv | columnas `maps_url` y `web` de tiendas EJEMPLO | `https://ejemplo.invalid/...` | Link de Google Maps y web de cada tienda | Link de Maps de cada tienda |
| bots/mokalu/tiendas.csv | columna `horario` de tiendas EJEMPLO | `EJEMPLO lun-sáb 09h00-19h00` | Horario real de cada tienda | ¿Horario de cada tienda? |
| bots/mokalu/tiendas.csv | columna `lat`,`lng` de tiendas EJEMPLO | coordenadas aproximadas del sector nombrado | Coordenadas reales | (sale del link de Maps) |
| bots/mokalu/tiendas.csv | fila `mokalu-laguna-plaza`: lat/lng `-2.1870,-80.0060`, whatsapp, horario días | coordenadas aproximadas del km 12,5 vía a la costa; `+593 99 000 0000`; días sin confirmar | Local exacto, coordenadas, WhatsApp público y días de atención de la tienda propia | ¿Número de local en Laguna Plaza, WhatsApp de la tienda y qué días abre? |
| bots/mokalu/bot.yaml | `persona.nombre` | `Sofi` | Nombre del bot | ¿Cómo quieres que se llame el bot? |
| bots/mokalu/bot.yaml | `horario_humano.dias` | lun–sáb 10h00–18h00 | Días y horas de atención humana | ¿Qué días y horas responde una persona? |
| bots/mokalu/bot.yaml | `destinos` → `WHATSAPP_ASESOR_VENTAS`, `WHATSAPP_DISTRIBUIDORES`, `WHATSAPP_RECLAMOS` | variables sin valor (en `.env.example` irán `+593 99 000 0000`) | Números de WhatsApp del asesor, del comercial y de reclamos | ¿A qué WhatsApp mando a: clientes con dudas, quienes quieren ser distribuidores/mayoristas, y reclamos? |
| bots/mokalu/bot.yaml | `localizador.ofrecer_ademas: tienda_online`, `distancia_lejana_km: 60` | ofrecer la web si la tienda más cercana está a > 60 km | Si el bot puede ofrecer la venta online de Mokalú | ¿El bot puede ofrecer la tienda online/envío o solo redirigir a tiendas? |
| bots/mokalu/bot.yaml | regla "pedido grande (más de ~24 unidades)" | 24 unidades | Umbral real de pedido mayorista | ¿Desde cuántas unidades es mayorista? |
| bots/mokalu/conocimiento/faq.md | todo el archivo | FAQ escrita por el agente | Las 10 preguntas reales más frecuentes | ¿Cuáles son las 10 preguntas que más les hacen y su respuesta? |
| bots/mokalu/conocimiento/politicas.md | todo el archivo | políticas prudentes por defecto (sin precios, sin stock, sin promesas de envío) | Políticas reales de precios, envíos, reclamos | ¿El bot puede dar PVP sugerido? ¿Hay promociones? ¿Cómo se manejan reclamos? |
| bots/mokalu/catalogo.csv | lista de 13 productos | modelos reales de uni/POSCA, sin confirmar que Mokalú los distribuya | Catálogo real distribuido | ¿Qué modelos y colores de uni/POSCA distribuyen? |
| bots/mokalu/plantillas-whatsapp.md | 5 plantillas | textos propuestos por el agente | Textos aprobados por el dueño | ¿Apruebas estos textos de seguimiento o quieres otros? ¿Quieres seguimiento automático a las 23 h? |
| bots/mokalu/prompts/sistema.md | ejemplos de respuestas | ejemplos con tiendas EJEMPLO | — (se actualizan solos al cambiar tiendas.csv; revisar tono) | ¿Te gusta este tono? ¿tuteo o "usted"? |
