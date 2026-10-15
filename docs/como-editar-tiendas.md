# Cómo añadir, cambiar o quitar un punto de venta

La "base de datos" de tiendas es la **Data Table de n8n `uni-ball puntos de venta`**.
El bot la lee **en cada mensaje**, así que cualquier cambio vale al instante: no hay que tocar el flujo ni el código.

**Dónde:** n8n → menú izquierdo **Overview → Data tables** → `uni-ball puntos de venta`.

## Añadir una tienda nueva (1 minuto)
Botón **+ Add row** y llena:

| Columna | ¿Obligatoria? | Ejemplo |
|---|---|---|
| `nombre` | sí | Papelería La Unión |
| `ciudad` | sí (si no pones lat/lng) | Riobamba |
| `direccion` | recomendado | Av. Daniel León Borja y Duchicela |
| `whatsapp` | recomendado | +593 99 123 4567 |
| `horario` | opcional | lun-sáb 09h00-19h00 |
| `provincia`, `marcas`, `tienda_id` | opcional | Chimborazo · POSCA, uni-ball |
| `lat`, `lng` | opcional | -1.6710 · -78.6470 |
| `maps_url` | opcional (se arma solo) | https://maps.app.goo.gl/… |
| `activo` | opcional (vacío = activa) | ✔ |

- **Sin `lat`/`lng`:** el bot ubica la tienda en el centro de su `ciudad`. Sirve para empezar; para que la distancia
  sea exacta, en Google Maps haz clic derecho sobre el local → clic en los números (se copian) → pégalos en `lat` y `lng`.
- La ciudad debe ser una de las que el bot conoce (las 87 de `framework/n8n/lugares.json`: capitales de provincia y
  ciudades principales). Si es un pueblo que no está, pon `lat`/`lng`.

## Quitar una tienda
Desmarca `activo` (queda en `false`). La tienda deja de aparecer pero no se pierde el dato, por si vuelve.
También puedes borrar la fila (icono de papelera) si es definitivo.

## Cambiar un dato (teléfono, horario, dirección)
Clic en la celda, edita y listo.

## Cargar muchas a la vez
Prepara un CSV con las mismas columnas (como `bots/mokalu/tiendas.csv`) e impórtalo en la Data Table,
o pásalo a Claude: `framework/n8n/importar_tiendas.py` lo geolocaliza y genera las filas.

## Mokalú
La fila `tienda_id = mokalu-guayaquil` es la tienda propia (el bot la usa para "¿dónde queda Mokalú?"). No le cambies el `tienda_id`.
