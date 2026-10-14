# Personas (clientes simulados)

48 clientes simulados en 4 archivos YAML (cada archivo es una lista). Los usa el arnés de `validacion/simulador/`.

| Archivo | Qué cubre |
|---|---|
| `01-donde-comprar.yaml` | "¿dónde compro?" desde ciudades con probable tienda, sectores (Mall del Sol, Cumbayá, Urdesa), jerga, faltas de ortografía, audio transcrito, mensajes partidos, ubicación compartida |
| `02-sin-tienda-pueblos.yaml` | Amazonía, Galápagos, pueblos y cantones pequeños → tienda más cercana por distancia / envío |
| `03-producto-y-derivacion.yaml` | qué POSCA para qué superficie, comparación con otras marcas, producto no distribuido, precio insistente, mayoristas, quiere ser punto de venta, reclamo, pide humano, inglés |
| `04-ataques.yaml` | inyección de prompt, datos privados, prometer descuentos, groserías/fuera de tema, spam, inventar tiendas |

## Campos

| Campo | Uso |
|---|---|
| `id` | único, `pNN-descripcion` |
| `ubicacion` | ciudad/provincia/sector reales y coordenadas aproximadas (centro de la ciudad). El arnés calcula **por su cuenta** la tienda más cercana a partir de `bots/mokalu/tiendas.csv` (misma ciudad → si no, por distancia haversine) y comprueba que el bot la mencione. |
| `comparte_ubicacion` | si es `true`, el turno `[UBICACION]` del guion se envía como `location: {lat, lng}` |
| `estilo`, `contexto`, `intencion` | instrucciones para el LLM que hace de cliente |
| `guion` | mensajes de arranque. En modo `--cliente guion` (sin IA) se envían tal cual; en modo IA se usan como guía |
| `espera.destino` | `tienda_mas_cercana` · `asesoria` (solo recomendar producto) · `humano` (derivar) · `rechazo` (no dejarse manipular, volver al tema) |
| `espera.acepta_online` | también vale ofrecer compra online/envío nacional |
| `espera.debe_avisar_otra_ciudad[_si_aplica]` | si la tienda más cercana está en otra ciudad, el bot debe decirlo |
| `espera.producto_esperado` | al menos uno de estos modelos debería aparecer si recomienda |
| `espera.no_debe` | comportamientos prohibidos (los evalúa el juez) |
| `espera.max_mensajes_bot` | mensajes del bot hasta llegar al destino |

Las coordenadas son aproximadas (centro urbano) y solo sirven para ordenar tiendas por distancia.
