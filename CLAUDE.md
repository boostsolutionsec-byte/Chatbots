# Chatbots — reglas para todos los agentes

Este repo contiene un **framework para crear chatbots de venta y atención** (WhatsApp + Instagram)
y el primer bot construido con él: **Mokalú** (`bots/mokalu/`). Mokalú es el **distribuidor** en Ecuador de uni-ball/POSCA
(y otras marcas); el bot **redirige a cada cliente a la tienda/punto de venta más cercano** y le ayuda a elegir producto.
Ver `docs/marcas.md` y `docs/repos-base.md` (repos de GitHub sobre los que construimos).
Lo trabajan 4 agentes en sesiones de Claude Code en la nube, en paralelo, durante la noche.

## MODO SIN DUEÑO (léelo primero)

El dueño **no tiene tiempo esta noche**: `FORMULARIO.md` está vacío a propósito y **nadie va a responder preguntas**.
Avanza lo más rápido posible sin intervención humana:
- **Nunca esperes ni pidas confirmación.** Si falta un dato, usa un **dato inventado** y sigue.
- Todo dato inventado debe ser obvio y fácil de reemplazar:
  - nombres con prefijo `EJEMPLO` (ej. `EJEMPLO Papelería Central Riobamba`), teléfonos `+593 99 000 0000`,
    URLs `https://ejemplo.invalid/...`, y la marca `# EJEMPLO` / `<!-- EJEMPLO -->` en el archivo;
  - concentrados en archivos de datos (`tiendas.csv`, `catalogo.csv`, `conocimiento/*.md`, `bot.yaml`, `.env.example`),
    **nunca** escondidos en el código.
- Cada vez que inventes algo, añade una fila a `docs/DATOS-INVENTADOS.md`:
  `| archivo | campo/fila | valor inventado | qué dato real hace falta | pregunta para el dueño |`
- Objetivo de la noche: que todo el sistema **funcione de punta a punta con datos de ejemplo**. Mañana el dueño llena
  `FORMULARIO-FINAL.md` (lo compila el Agente 4 a partir de `docs/DATOS-INVENTADOS.md`), se reemplazan los datos y listo.

## Antes de empezar (todos los agentes)

1. Lee `FORMULARIO.md` (probablemente vacío → usa los valores por defecto que indica) y `docs/marcas.md`.
2. Lee tu brief en `agentes/` y **solo** trabaja en las carpetas que tu brief te asigna.
3. Lee `PENDIENTES.md` (incluye hallazgos `[validador→agente N]` que debes atender primero) y `docs/CONTRATO.md`.

## Reglas duras

- Idioma: código y nombres técnicos en inglés; documentación, prompts del bot y commits en **español**.
- **Nunca** escribas secretos (tokens, claves, números privados) en el repo. Usa variables de entorno y documenta su nombre en `.env.example`.
- **Nunca** envíes mensajes reales a clientes, ni llames APIs de Meta/WhatsApp/Instagram. Por ahora **no se conecta Meta**: se prueba con el simulador, el chat web local y Telegram (solo cuando el dueño ponga el token).
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
| 3 · Diseñador del bot | `agente/3-bots` | `bots/`, `datos/`, `docs/marcas.md` |
| 4 · Validador | `agente/4-validador` | `validacion/` |

Si la sesión en la nube te asigna otra rama (ej. `claude/...`) y rechaza el push a la de la tabla, usa la asignada
y escribe su nombre en `PENDIENTES.md` con la etiqueta `[decisión]` para que los demás la encuentren.

Archivos compartidos (`PENDIENTES.md`, `PASOS-HUMANOS.md`, `docs/CONTRATO.md`): solo **añadir** líneas, nunca borrar las de otro agente.
Al final de la noche el dueño (o un agente integrador) une las cuatro ramas en `claude/mocalu-uniwell-chatbot-agents-lp0vn0`.

## Stack por defecto (si el formulario no dice otra cosa)

- Node.js 20 + TypeScript, pruebas con Vitest. Base candidata: **BuilderBot** (ver `docs/repos-base.md`).
- LLM: API de Anthropic (Claude Haiku para conversación, Sonnet para escalar casos difíciles), detrás de una interfaz `LLMProvider` para poder cambiar a DeepSeek u otro.
- Canales, detrás de una interfaz `ChannelAdapter`:
  - **Ahora (prioridad):** chat web local + **Telegram** (Bot API, token de @BotFather).
  - **Después (solo esqueleto + pruebas con mocks):** WhatsApp Cloud API, Instagram Messaging API, Periskope.
- Persistencia: Supabase (Postgres) detrás de una interfaz `Store`; en pruebas, memoria.
- Orquestación externa opcional: n8n (el dueño ya lo usa) llamando al servicio por webhook.
