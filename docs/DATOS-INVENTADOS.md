# Datos inventados (para reemplazar)

Cada agente añade aquí una fila por cada dato de ejemplo que use. El Agente 4 compila esto en `FORMULARIO-FINAL.md`.

| archivo | campo/fila | valor inventado | qué dato real hace falta | pregunta para el dueño |
|---|---|---|---|---|
| docs/ingenieria-inversa/conversaciones-ejemplo.md | ids esperados `tienda_id_en` (C01–C40) | tiendas EJEMPLO de `bots/mokalu/tiendas.csv` (rama agente/3-bots) | lista real de puntos de venta | ¿Cuál es la lista real de tiendas? Al recibirla, actualizar los ids esperados de cada conversación |
| docs/ingenieria-inversa/conversaciones-ejemplo.md | C05, C06, C12, C26 | el bot ofrece la tienda online `https://mokalu.com.ec/tienda/` con envío nacional | si el bot puede ofrecer venta online además de redirigir | ¿El bot puede ofrecer la tienda online de Mokalú cuando no hay tienda cerca? (FORMULARIO preg. 7) |
| bots/_plantilla/bot.yaml | marca, persona, destinos | "EJEMPLO Distribuidora Andina", "Ana", +593990000000, https://ejemplo.invalid/tienda | Nada: es un bot genérico de prueba del motor; no se usa en producción | — (no requiere respuesta) |
| bots/_plantilla/tiendas.csv | 10 filas `ej-*` | tiendas EJEMPLO en Guayaquil, Quito, Cuenca, Riobamba, Ambato, Manta, Loja | Nada (plantilla de prueba); para Mokalú se usa bots/mokalu/tiendas.csv | — |
| bots/_plantilla/catalogo.csv | 5 productos `EJ-*` | marcadores y bolígrafos EJEMPLO de "MarcaA/MarcaB" | Nada (plantilla de prueba) | — |
| framework/src/locator/ecuador.ts | filas marcadas `'a'` | coordenadas aproximadas (±2 km) de cantones y sectores (Mall del Sol, Urdesa, La Carolina, Cumbayá…) | Ninguno obligatorio; si una tienda sale mal por distancia, corregir la coordenada del lugar | ¿Hay sectores de su ciudad que la gente nombra y el bot no reconoce? |
| bots/mokalu/tiendas.csv | 39 filas con id ≠ `mokalu-laguna-plaza` (nombre `EJEMPLO …`) | 39 tiendas inventadas en 19 provincias (sin tienda: Bolívar, Galápagos, Morona Santiago, Orellana, Zamora Chinchipe) | Lista real de puntos de venta: nombre, ciudad, provincia, dirección, coordenadas o link de Maps, WhatsApp, horario, marcas, ¿vende online? | ¿Me pasas el Excel/Sheets con todos los puntos de venta de uni/POSCA? |
| bots/mokalu/tiendas.csv | columnas `whatsapp` y `telefono` de todas las filas | `+593 99 000 0001` … `+593 99 000 0040` (uno distinto por fila, H-01) | Contacto público de cada tienda | ¿Qué WhatsApp/teléfono público tiene cada tienda (y ellas aceptan que el bot lo comparta)? |
| bots/mokalu/tiendas.csv | columnas `maps_url` y `web` de tiendas EJEMPLO | `https://ejemplo.invalid/...` | Link de Google Maps y web de cada tienda | Link de Maps de cada tienda |
| bots/mokalu/tiendas.csv | columna `horario` de tiendas EJEMPLO | `lun-sáb 09h00-19h00` (igual en todas) | Horario real de cada tienda | ¿Horario de cada tienda? |
| bots/mokalu/tiendas.csv | columna `lat`,`lng` de tiendas EJEMPLO | coordenadas aproximadas del sector nombrado | Coordenadas reales | (sale del link de Maps) |
| bots/mokalu/tiendas.csv | fila `mokalu-laguna-plaza`: lat/lng `-2.1870,-80.0060`, whatsapp, horario días, maps_url | coordenadas aproximadas del km 12,5 vía a la costa; `+593 99 000 0007`; `10h00-18h00` sin días; link de **búsqueda** de Maps (no un punto) | Local exacto, coordenadas, WhatsApp público y días de atención de la tienda propia | ¿Número de local en Laguna Plaza, WhatsApp de la tienda y qué días abre? |
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
| bots/mokalu/tiendas.csv | columna `marcas` de todas las filas | `uni-ball;POSCA` (todas iguales, por H-12) | Qué marcas/líneas tiene cada punto de venta | ¿Todas las tiendas tienen POSCA o algunas solo bolígrafos uni-ball? |
| validacion/simulador/fixtures/tiendas-mock.csv | 12 filas `EJEMPLO …` | tiendas de prueba del validador (solo se usan si no existe `bots/mokalu/tiendas.csv`) | ninguno: es un fixture de pruebas, no va al bot | — |
| `bots/mokalu/tiendas.csv`, n8n Data Table | fila `mokalu-guayaquil`, whatsapp | `+593 99 000 0007` | WhatsApp real de Mokalú (recibe info, consultas y reclamos) | ¿Cuál es el número de WhatsApp de Mokalú? |
| `bots/mokalu/tiendas.csv`, `lugares.csv` | `mokalu-guayaquil` lat/lng y sector San Eduardo | -2.1745, -79.933 (aprox.) | Pin exacto del Edificio 100, Av. del Bombero | ¿Nos pasan el link de Google Maps del local? |
| `framework/n8n/workflow/nodo.plantilla.js`, `bot.yaml` | días de atención | lunes a viernes 9h00–17h30 | Días reales de atención | ¿Atienden también sábados? |
