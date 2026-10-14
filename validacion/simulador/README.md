# Simulador de clientes (Agente 4)

Un LLM hace de cliente según cada persona de `validacion/personas/`, conversa con el bot y un **juez** califica
con la rúbrica de `agentes/4-validador.md` (7 criterios, 0–2). Además hay **chequeos deterministas** (sin IA)
que calculan por su cuenta la tienda correcta a partir de `bots/<bot>/tiendas.csv` y detectan teléfonos/URLs
inventados, precios, mensajes repetidos y fugas de prompt. Para cada criterio se toma la nota **más baja**
entre regla y juez.

## Por qué un simulador propio y no langwatch/scenario
`scenario` espera un modelo vía Vercel AI SDK/OpenAI-compatible con clave de API. Esta noche no hay `ANTHROPIC_API_KEY`
y la IA disponible es `claude -p` (CLI). El simulador propio implementa lo mismo (cliente simulado + juez + criterios)
en ~600 líneas, sin depender del framework del Agente 2. Si mañana hay clave, se puede migrar a `scenario` sin cambiar
las personas (`[decisión]` en `PENDIENTES.md`).

## Uso
```bash
cd validacion/simulador && npm install
npm test                                   # pruebas del arnés (sin IA)
npm run sim -- --target mock               # 48 personas contra un bot de reglas de mentira (sin IA, ~1 s)
npm run sim -- --target mock --cliente ia --juez ia --solo p01,p40   # prueba con IA (claude -p)

# Contra el bot real (framework del Agente 2 corriendo con bots/mokalu):
npm run sim -- --target http --url http://localhost:3000 --bot mokalu --cliente ia --juez ia --concurrencia 3
```

| Opción | Valores | Por defecto |
|---|---|---|
| `--target` | `mock` (bot de reglas interno) · `http` (`POST <url>/sim/<bot>`) | `mock` |
| `--cliente` | `guion` (envía `guion` tal cual) · `ia` (LLM hace de cliente) | `guion` |
| `--juez` | `reglas` · `ia` | `reglas` con mock, `ia` con http |
| `--solo` | ids o prefijos separados por coma (`p01,p19`) | todas |
| `--max-turnos` | turnos del cliente | 6 |
| `--concurrencia` | conversaciones en paralelo | 3 |
| `--tiendas` | ruta a otro CSV | `bots/<bot>/tiendas.csv`, si no existe el fixture |
| `--permitidos` | teléfonos/URLs válidos fuera de tiendas.csv | `https://mokalu.com.ec` |

IA: si hay `ANTHROPIC_API_KEY` usa la API (`SIM_MODELO_RAPIDO`, por defecto Haiku); si no, `claude -p --model haiku`
sin herramientas. Úsalo con moderación: una corrida completa con IA ≈ 48 × (≤5 cliente + 1 juez) llamadas.

## Contrato que asume de `POST /sim/:botId`
Envía `{channel:"simulator", userId, text?, location?:{lat,lng}, timestamp}` (forma de `IncomingMessage`).
Acepta como respuesta: `string`, `string[]`, `OutgoingMessage`, `OutgoingMessage[]` o un objeto con
`replies|messages|respuestas|outgoing`. Cada conversación usa un `userId` nuevo (`sim-<run>-<persona>`).

`npm run mock-server` levanta un `/sim/:botId` de mentira en el puerto 3999 (para probar `--target http` y promptfoo).

## Salida
`validacion/reportes/<fecha-hora>.md` (+ `.json` para la tendencia): nota global, promedio por criterio, tabla por
persona, las 5 peores conversaciones completas y la tendencia contra la corrida anterior. Las corridas contra el
mock se guardan como `mock-*.md` y no cuentan para la tendencia.
