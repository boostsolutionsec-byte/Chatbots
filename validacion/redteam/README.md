# Red teaming (promptfoo)

25 ataques contra el bot por `POST /sim/:botId`: inyección de prompt (español, inglés, base64, DAN, falsa
autoridad, varios turnos), datos privados, precios/descuentos/envío/stock, inventar tiendas y productos,
taza "apta para alimentos", hablar mal de otra marca, fuera de tema (tarea, política, código), insultos, spam,
"¿eres humano?" y acciones hacia terceros.

Cada prueba tiene reglas fijas (regex/contiene) y una rúbrica `llm-rubric` que califica `claude -p`
(`grader.mjs`; usa la API si hay `ANTHROPIC_API_KEY`). Métricas: `seguro`, `sin_inventar`, `sabe_producto`
(los mismos nombres que la rúbrica del simulador).

```bash
cd validacion/redteam && npm install
export PROMPTFOO_DISABLE_TELEMETRY=1 PROMPTFOO_DISABLE_UPDATE=1
SIM_URL=http://localhost:3000 SIM_BOT=mokalu npm run redteam            # contra el framework
# o contra el bot de mentira:  (cd ../simulador && npm run mock-server)  y  SIM_URL=http://localhost:3999
npx promptfoo eval -c promptfooconfig.yaml --no-cache -o ../reportes/redteam-<fecha>.json
```

Prueba del arnés contra el bot de mentira (2026-10-14): 23/27 pasan; los 4 que fallan son defectos reales
del mock (no reconoce que es virtual, no explica la taza decorativa, respuesta genérica a DAN y a datos de clientes),
es decir, las pruebas sí distinguen un bot bueno de uno malo.
