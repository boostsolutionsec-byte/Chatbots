# Guía del dueño — cambiar el bot sin programar

Todo lo que el bot "sabe" está en archivos de texto dentro de `bots/mokalu/`. Puedes editarlos en GitHub
(botón ✏️ del archivo → "Commit changes") o pedírselo a Claude: *"cambia la tienda X por…"*.

## 1. Tiendas / puntos de venta → `tiendas.csv` (lo más importante)

Hoy tiene **tiendas de EJEMPLO** (nombres que empiezan con `EJEMPLO`). Hay que reemplazarlas por las reales.

**Lo más fácil:** abre `tiendas.csv` en Excel o Google Sheets (Archivo → Importar → CSV), borra las filas EJEMPLO,
pega tus tiendas y descárgalo como **CSV (UTF-8)** con el mismo nombre.

Columnas (una fila por tienda, no cambies los títulos):

| Columna | Qué poner | Ejemplo |
|---|---|---|
| `id` | código corto único, sin espacios | `rio-centro` |
| `nombre` | nombre de la tienda como la conoce la gente | `Papelería Central` |
| `ciudad` | ciudad o cantón | `Riobamba` |
| `provincia` | provincia | `Chimborazo` |
| `direccion` | dirección corta + referencia | `10 de Agosto y España, frente al parque` |
| `lat`, `lng` | coordenadas (ver abajo) | `-1.6710`, `-78.6470` |
| `maps_url` | link de Google Maps de la tienda | `https://maps.app.goo.gl/...` |
| `whatsapp` | WhatsApp público de la tienda (con +593) | `+593 99 123 4567` |
| `telefono` | teléfono fijo (opcional) | |
| `horario` | texto libre | `lun-sáb 09h00-19h00` |
| `marcas` | marcas que tiene, separadas por `;` | `uni-ball;POSCA` |
| `vende_online` | `si` o `no` | `no` |
| `web` | página o Instagram (opcional) | |

**Coordenadas:** en Google Maps, clic derecho sobre la tienda → el primer renglón son los números (`-1.6710, -78.6470`):
el primero va en `lat` y el segundo en `lng`. Sin coordenadas el bot igual encuentra la tienda por ciudad, pero no
puede calcular "la más cercana" desde otra ciudad.

⚠️ Pide permiso a cada tienda antes de publicar su WhatsApp.

**Tienda propia de Mokalú:** fila `mokalu-laguna-plaza`. Confirma local, coordenadas, WhatsApp y días.

## 2. Ciudades y sectores → `lugares.csv`
Sirve para que el bot entienda "estoy en Guaranda" o "cerca del Mall del Sol" aunque ahí no haya tienda.
Si un cliente escribe un sector que el bot no entiende, añade una fila: `nombre, alias (separados por ;), tipo, ciudad, provincia, lat, lng`.

## 3. Preguntas frecuentes → `conocimiento/faq.md`
Escribe la pregunta en **negrita** y la respuesta debajo. Corto y claro, como lo dirías por chat.

## 4. Productos → `catalogo.csv` y `conocimiento/productos-uni.md`
- `catalogo.csv`: una fila por producto que distribuyes (sin precios).
- `productos-uni.md`: la guía "qué punta para qué". Si un cliente recibe una mala recomendación, corrígela aquí.

## 5. Reglas y a quién se deriva → `conocimiento/politicas.md` y `bot.yaml`
- Precios, envíos, reclamos: `politicas.md` (texto normal).
- Nombre del bot, horario de atención, a quién se deriva: `bot.yaml` (cambia solo lo que está entre comillas).
- Los **números de WhatsApp de tu equipo NO se escriben aquí**: se ponen como secretos
  (`WHATSAPP_ASESOR_VENTAS`, `WHATSAPP_DISTRIBUIDORES`, `WHATSAPP_RECLAMOS`) — ver `PASOS-HUMANOS.md`.

## 6. Personalidad → `prompts/sistema.md`
Cómo habla el bot y ejemplos de buenas respuestas. Si quieres que suene distinto, cambia los ejemplos del final.

## 7. Comprobar que no rompiste nada
Pide a Claude: *"corre las pruebas del bot mokalu"* (`npm run eval -- mokalu` en `framework/`).
Las pruebas están en `evals/` y el resultado se guarda en `reportes/`.

## Datos de ejemplo que debes reemplazar
La lista completa está en `docs/DATOS-INVENTADOS.md` (y en `FORMULARIO-FINAL.md` cuando el Agente 4 lo compile).
