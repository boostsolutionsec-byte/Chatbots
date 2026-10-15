# Workflow de n8n del bot Mokalú (el que se usa en producción)

**En n8n:** [BORRADOR - Bot Mokalú tiendas cercanas (DeepSeek)](https://henrydelgado.app.n8n.cloud/workflow/3PxOLqw5gERwNqut) — **apagado**.
**Tiendas:** Data Table de n8n **"Mokalú tiendas"** (40 filas EJEMPLO + Mokalú Laguna Plaza). Se editan ahí mismo, sin tocar código.

## Flujo
```
Telegram Trigger → Leer tiendas (Data Table) → Responder sin IA (Code)
   ├─ respuesta fija → Enviar por Telegram → ¿pasar a una persona? → Avisar al equipo
   └─ resto          → Sofi (AI Agent + DeepSeek + memoria de 3 turnos) → Enviar por Telegram
```
Sin IA: saludo, "dónde compro en <ciudad/sector>", ubicación GPS, reclamo, distribuidor/mayorista, pedir una persona,
precio, horario. Con IA: preguntas de producto (con 1–2 fragmentos de la guía) y mensajes mezclados.

## Precisión medida (sin IA, 2026-10-14)
- `probar.cjs`: 30/30 casos difíciles (ciudades mal escritas, sectores, reclamos, mayoristas, saludos, "dónde queda Mokalú").
- `probar-personas.cjs`: 48 clientes simulados del validador → todos los de "dónde compro", reclamo y distribuidor van al
  destino correcto; las preguntas de producto y los ataques pasan a DeepSeek.
- **DeepSeek (con n8n, 22 casos que van a la IA):** 20/22 bien, 0 datos inventados; resistió inyección de prompt,
  pedidos de datos privados, spam y temas ajenos. Workflow de prueba reutilizable:
  [PRUEBA - Bot Mokalú lote DeepSeek](https://henrydelgado.app.n8n.cloud/workflow/nf21omxON5pAQdFQ) (ejecutar a mano).
- **Falta medir:** todo con las tiendas reales y el flujo completo por Telegram.
- Memoria: recuerda la ciudad de cada chat 2 días (`$getWorkflowStaticData`, solo funciona con el workflow **activo**).

## Antes de encenderlo
1. Crear un bot **nuevo** en @BotFather para Mokalú y crear su credencial de Telegram en n8n.
2. En los 4 nodos de Telegram cambiar la credencial: n8n puso sola la **"Telegram account" existente** y, si se enciende así,
   el webhook pasaría a este flujo y el bot que hoy use esa credencial dejaría de recibir mensajes.
3. En "Avisar al equipo" poner el ID del chat/grupo de Telegram del equipo.
4. Reemplazar las tiendas EJEMPLO en la Data Table.

## Costo estimado
Llamada a DeepSeek: ~350 tokens de instrucciones (fijas → caché) + ~200 de contexto + ~300 de memoria; ≤200 de salida.
≈ 0,0003–0,0005 USD por respuesta con IA (verificar tarifa vigente de `deepseek-chat`). A 10 mensajes/día con la mitad
resueltos sin IA: **menos de 0,10 USD/mes** en IA. Las ejecuciones cuentan en el plan de n8n que ya pagan.

## Archivos
- `nodo.plantilla.js` — fuente del nodo Code (con `__LUGARES__`/`__FRAG__`); `nodo.js` — versión armada que está en n8n.
- `probar.cjs` — `node framework/n8n/workflow/probar.js` prueba el nodo con 15 mensajes sin n8n.
- `workflow.sdk.js` — definición completa del workflow (n8n Workflow SDK).

## Fotos (2026-10-15)
- `Telegram Trigger → ¿Mandó foto? → Descargar foto → Ver foto (ChatGPT) → Leer tiendas` (sin foto: directo a `Leer tiendas`).
- `Ver foto (ChatGPT)`: OpenAI **gpt-4.1-mini**, detalle **bajo**, máx. 120 tokens, credencial "OpenAi account". Solo corre si el
  cliente manda foto. Costo aproximado: menos de 1 centavo por foto.
- La descripción entra al bot como texto (`[foto: …]`): producto → asesoría/tienda; "comprobante de pago" o "documento con
  datos" → pasa al equipo de Mokalú sin IA. Si la descarga o ChatGPT fallan (`onError: continuar`), el caso pasa al equipo.
- Audios, videos y documentos → al equipo (aún no se transcriben).
