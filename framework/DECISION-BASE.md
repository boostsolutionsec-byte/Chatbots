# Decisión de base: BuilderBot vs motor propio

**Fecha:** 2026-10-14 · **Agente:** 2 (Arquitecto) · **Decisión:** **motor propio, ligero, siguiendo `docs/CONTRATO.md`**,
tomando ideas (no código) de BuilderBot. Se deja abierta la puerta a usar sus *providers* más adelante vía un `ChannelAdapter` puente.

## Qué se evaluó (npm, 2026-10-14)

| Punto | BuilderBot (`@builderbot/bot` 1.4.4) | Impacto para nosotros |
|---|---|---|
| Licencia | ISC (permisiva) | ✅ se podría usar sin problema |
| Telegram | `@builderbot/provider-telegram` usa `telegram` (GramJS, protocolo MTProto de *cliente*), no la Bot API HTTP simple | ⚠️ más pesado; para un bot de @BotFather basta la Bot API con `fetch` (long polling + webhook) |
| Instagram / Meta | `provider-instagram` y `provider-meta` existen | ✅ útil a futuro, pero Meta **no** se conecta todavía |
| Modelo de flujos | `addKeyword(...).addAnswer(...)`: árboles por palabra clave, el LLM se mete a mano con `addAction` | ❌ nuestro contrato es **configuración por carpeta** (`bot.yaml`) + LLM con herramientas + máquina de estados por campos; habría que pelear contra el modelo de flujos |
| Dependencias del núcleo | `polka`, `body-parser`, `fluent-ffmpeg`, `@ffmpeg-installer/ffmpeg`… | ❌ ffmpeg en el núcleo encarece el despliegue y las pruebas |
| Evals / simulador / juez | No incluye | ❌ hay que construirlo igual |
| Pruebas deterministas | Difícil aislar el LLM y los providers | ❌ necesitamos `MockProvider` + `SimulatorAdapter` para que los Agentes 3 y 4 prueben sin red |

## Por qué motor propio
1. El contrato ya define las piezas (`ChannelAdapter`, `LLMProvider`, `StoreLocator`, `Store`). Implementarlas directo es
   menos código que adaptarlas al modelo de flujos de BuilderBot.
2. Los Agentes 3 y 4 necesitan **en las primeras horas** un `POST /sim/:botId` y `npm run eval` deterministas; eso es
   más rápido sin la capa de BuilderBot.
3. Telegram por Bot API con `fetch` (sin dependencias) cubre lo que pide el brief: long polling sin dominio público,
   webhook, botones inline y fotos.
4. Dependencias mínimas: `hono` (HTTP), `zod` (validación), `yaml`, `@anthropic-ai/sdk`. Nada de ffmpeg.

## Qué tomamos de BuilderBot (ideas, reimplementadas)
- Separar *provider* (canal) del flujo: aquí es `ChannelAdapter`.
- Un servidor HTTP único que expone webhooks por canal.
- Comunidad hispana: si mañana se quiere WhatsApp vía Baileys/Evolution, se puede escribir un `ChannelAdapter`
  que envuelva `@builderbot/provider-*` sin tocar el motor.

## Riesgos y cómo revertir
- Si el dueño prefiere BuilderBot: el motor (`src/engine/`) no depende del canal; se puede llamar `engine.handle()`
  desde un `addAction` de BuilderBot en ~30 líneas. Anotado en `PENDIENTES.md` `[decisión]`.
