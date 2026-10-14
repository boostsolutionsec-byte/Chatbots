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
