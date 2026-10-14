# Repositorios base (no empezamos de cero)

Datos de GitHub al 2026-10-14. Los agentes deben **verificar** versión, licencia y funciones antes de adoptar.

## Para el bot (Agente 2)
| Repo | Para qué | Por qué |
|---|---|---|
| [codigoencasa/builderbot](https://github.com/codigoencasa/builderbot) | **Base candidata del framework** | TypeScript, comunidad hispana (~3k ⭐), flujos + IA, varios *providers* (Meta oficial, Baileys, Evolution, etc.). Verificar si tiene provider de Telegram/Instagram o si hay que escribirlo. |
| [leifermendez/builderbot-openai-assistants](https://github.com/leifermendez/builderbot-openai-assistants) | Ejemplo | BuilderBot + IA + base vectorial; ver cómo conectan la IA (cambiar a Claude). |
| [evolution-foundation/evolution-api](https://github.com/evolution-foundation/evolution-api) | WhatsApp más adelante | API abierta de WhatsApp (~10k ⭐) con integraciones a n8n, Chatwoot, Typebot. Alternativa a Meta oficial. |
| [chatwoot/chatwoot](https://github.com/chatwoot/chatwoot) | Bandeja humana (opcional) | Omnicanal (WhatsApp, Instagram, Telegram, web); útil para el paso a humano. |
| [baptisteArno/typebot.io](https://github.com/baptisteArno/typebot.io) / [botpress/botpress](https://github.com/botpress/botpress) | Referencia | Constructores visuales; ideas de UX, no base. |

**Decisión por defecto:** el Agente 2 evalúa BuilderBot en la primera hora (prueba "hola mundo" con su provider de Telegram o uno propio).
Si encaja → nuestro framework se monta **sobre** BuilderBot (los bots siguen siendo carpetas `bots/<id>/` según `docs/CONTRATO.md`).
Si no encaja (licencia, sin Telegram, demasiado rígido) → motor propio según el brief, y lo anota en `PENDIENTES.md` `[decisión]`.

## Para validar (Agente 4)
| Repo | Para qué |
|---|---|
| [langwatch/scenario](https://github.com/langwatch/scenario) | **Clientes simulados**: un agente hace de cliente (ej. "señora de Riobamba que quiere POSCA para su hija") conversa con el bot y un juez LLM califica. TypeScript y Python. |
| [promptfoo/promptfoo](https://github.com/promptfoo/promptfoo) | Pruebas declarativas, comparación de modelos/prompts y **red teaming** (intentos de romper al bot). |
