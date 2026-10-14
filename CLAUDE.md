# Chatbots — reglas para todos los agentes

Este repo contiene un **framework para crear chatbots de venta y atención** (WhatsApp + Instagram)
y los dos primeros bots construidos con él: **Mocalu** (redireccionamiento) y **Uniwell** (compras).
Lo trabajan 3 agentes en sesiones de Claude Code en la nube, en paralelo, durante la noche.

## Antes de empezar (todos los agentes)

1. Lee `FORMULARIO.md` (respuestas del dueño). Lo que esté vacío → usa el valor por defecto que ahí se indica.
2. Lee tu brief en `agentes/` y **solo** trabaja en las carpetas que tu brief te asigna.
3. Lee `PENDIENTES.md` y `docs/CONTRATO.md` (la interfaz común entre agentes).

## Reglas duras

- Idioma: código y nombres técnicos en inglés; documentación, prompts del bot y commits en **español**.
- **Nunca** escribas secretos (tokens, claves, números privados) en el repo. Usa variables de entorno y documenta su nombre en `.env.example`.
- **Nunca** envíes mensajes reales a clientes, ni llames APIs de Meta/WhatsApp/Instagram en producción. Todo se prueba con el simulador y mocks.
- No copies código del repositorio de referencia literalmente si su licencia no lo permite: documenta el comportamiento y **reimplementa**.
- Todo lo que requiera una persona (crear cuentas, aprobar plantillas, verificar número, pegar tokens) se anota en `PASOS-HUMANOS.md` con el formato de ese archivo. No lo intentes resolver tú.
- Toda duda que el formulario no responda → decide con el valor más prudente, sigue, y anótala en `PENDIENTES.md`.
- Commits pequeños y frecuentes (cada ~30–60 min de trabajo) y `git push` tras cada commit: la sesión en la nube puede terminar en cualquier momento y lo no empujado se pierde.
- No modifiques el `docs/CONTRATO.md` sin anotar el cambio al final del archivo (sección "Cambios") para que los otros agentes lo vean al hacer `git pull`.
- Antes de cada push: `git pull --rebase` de tu rama y, si existe, corre `npm test` en `framework/`.

## Ramas

| Agente | Rama | Carpetas que le pertenecen |
|---|---|---|
| 1 · Investigador (ingeniería inversa) | `agente/1-ingenieria-inversa` | `docs/ingenieria-inversa/` |
| 2 · Arquitecto (framework) | `agente/2-framework` | `framework/`, `.env.example` |
| 3 · Diseñador de bots | `agente/3-bots` | `bots/`, `datos/` |

Si la sesión en la nube te asigna otra rama (ej. `claude/...`) y rechaza el push a la de la tabla, usa la asignada
y escribe su nombre en `PENDIENTES.md` con la etiqueta `[decisión]` para que los demás la encuentren.

Archivos compartidos (`PENDIENTES.md`, `PASOS-HUMANOS.md`, `docs/CONTRATO.md`): solo **añadir** líneas, nunca borrar las de otro agente.
Al final de la noche el dueño (o un agente integrador) une las tres ramas en `claude/mocalu-uniwell-chatbot-agents-lp0vn0`.

## Stack por defecto (si el formulario no dice otra cosa)

- Node.js 20 + TypeScript, pruebas con Vitest.
- LLM: API de Anthropic (Claude Haiku para conversación, Sonnet para escalar casos difíciles), detrás de una interfaz `LLMProvider` para poder cambiar a DeepSeek u otro.
- Canales: WhatsApp Cloud API de Meta e Instagram Messaging API (Graph API), detrás de una interfaz `ChannelAdapter`. Periskope como adaptador alternativo de WhatsApp.
- Persistencia: Supabase (Postgres) detrás de una interfaz `Store`; en pruebas, memoria.
- Orquestación externa opcional: n8n (el dueño ya lo usa) llamando al servicio por webhook.
