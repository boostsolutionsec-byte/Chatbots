# Bot en n8n + DeepSeek (modo bajo costo)

Objetivo: ~10 mensajes/día por **centavos**. La mayoría de mensajes ("hola", "¿dónde compro en Riobamba?", ubicación
compartida) se responden **sin IA** con el localizador; solo lo demás va a DeepSeek con poco contexto.

## Archivos (generados con `cd framework && npm run n8n:build -- mokalu`; no editar a mano)
| Archivo | Para qué |
|---|---|
| `localizador.js` | Pegar entero en un nodo **Code** (modo *Run Once for Each Item*). Un solo archivo, sin dependencias; ya trae las tiendas, lugares y config del bot. |
| `sistema.md` | System prompt del bot (corto y estable → aprovecha el caché de contexto de DeepSeek). |
| `tiendas.json`, `lugares.json` | Copia de los datos (referencia / por si se quieren cargar desde otro nodo). |

Al cambiar `bots/mokalu/tiendas.csv`: volver a correr `npm run n8n:build -- mokalu` y pegar de nuevo `localizador.js`.

## Flujo
```
Telegram Trigger ──▶ Code "Localizador" (localizador.js) ──▶ IF {{$json.atajo}}
                                                           ├─ true  ─▶ Telegram: enviar {{$json.respuesta}} a {{$json.chatId}}
                                                           └─ false ─▶ HTTP Request DeepSeek ─▶ Telegram: enviar respuesta
```
1. **Telegram Trigger** (credencial con el token de @BotFather), updates: `message`.
2. **Code "Localizador"**: pegar `localizador.js`. Devuelve `{ atajo, respuesta, contexto, tiendas, lugar, chatId, texto }`.
3. **IF** `{{$json.atajo}}` es `true`.
4. **Rama true → Telegram "Send Message"**: Chat ID `{{$json.chatId}}`, texto `{{$json.respuesta}}`, *Parse Mode* Markdown (legacy).
5. **Rama false → HTTP Request** `POST https://api.deepseek.com/chat/completions`, header `Authorization: Bearer <DEEPSEEK_API_KEY>` (credencial), body JSON:
   ```json
   {
     "model": "deepseek-chat",
     "max_tokens": 200,
     "temperature": 0.3,
     "messages": [
       { "role": "system", "content": "<pegar sistema.md>" },
       { "role": "system", "content": "{{ $json.contexto || 'Si no sabes la ciudad del cliente, pregúntala.' }}" },
       { "role": "user", "content": "{{ $json.texto }}" }
     ]
   }
   ```
   Luego **Telegram "Send Message"** con `{{$json.choices[0].message.content}}` al `{{ $('Localizador').item.json.chatId }}`.
6. (Opcional) memoria corta: guardar los últimos 4–6 mensajes por `chatId` en una tabla de n8n (Data Table) y añadirlos a `messages` antes del `user`.
7. (Opcional) derivación: si el texto trae "reclamo", "distribuidor", "hablar con una persona"… (ver `bots/mokalu/plantillas-respuesta.md`),
   responder con la plantilla y avisar al asesor (Telegram al grupo de asesores o tarea en ClickUp).

## Costo estimado (DeepSeek `deepseek-chat`, revisar precios vigentes)
Mensaje que va a la IA: ~600–1.200 tokens de entrada (prompt ~550 + contexto de 2–3 tiendas + mensaje) y ≤200 de salida.
Con 10 mensajes/día y ~la mitad resueltos sin IA → ~150 llamadas/mes ≈ 0,2 M tokens → **centavos de dólar al mes**.
Telegram y n8n (si ya lo tienen) no suman costo. El motor completo (`framework/`) da la misma lógica con más funciones
(flujos, guardas anti-alucinación, evals) si luego se despliega aparte.
