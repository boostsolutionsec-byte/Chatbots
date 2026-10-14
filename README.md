# Chatbots — framework de bots de venta (WhatsApp + Instagram)

Framework para crear chatbots de atención y ventas configurables por carpeta, inspirado en la
ingeniería inversa de SellerChat. Primer bot: **Mokalú** — distribuidor de uni-ball/POSCA en Ecuador.
El bot **redirige a cada cliente a la tienda más cercana** ("soy de Riobamba" → "puedes comprar aquí").

Primero se prueba en **chat web** y **Telegram**; WhatsApp e Instagram (Meta) se conectan después.

## Cómo se construye
Cuatro agentes de Claude Code en la nube trabajan en paralelo durante la noche:

| Agente | Qué hace | Brief |
|---|---|---|
| 1 · Investigador | Ingeniería inversa de SellerChat + reglas de Meta | `agentes/1-investigador.md` |
| 2 · Arquitecto | Motor reutilizable (base BuilderBot): canales, IA, localizador de tiendas, derivación, evals | `agentes/2-arquitecto.md` |
| 3 · Diseñador del bot | Investigación de marcas, tiendas, conocimiento y pruebas del bot Mokalú | `agentes/3-disenador-bots.md` |
| 4 · Validador | Revisa el trabajo de los otros y prueba el bot con clientes simulados | `agentes/4-validador.md` |

## Orden
1. Llenar `FORMULARIO.md`.
2. Lanzar los agentes → `agentes/LANZAR.md`.
3. Por la mañana: integrar ramas y hacer `PASOS-HUMANOS.md`.

## Archivos clave
- `CLAUDE.md` — reglas para todos los agentes.
- `docs/CONTRATO.md` — interfaz común (formato de bots, interfaces, evals).
- `docs/marcas.md` — lo que sabemos de Mokalú y uni-ball.
- `docs/repos-base.md` — repos de GitHub sobre los que construimos (BuilderBot, LangWatch Scenario, promptfoo).
- `PENDIENTES.md` — supuestos y datos por confirmar.
- `PASOS-HUMANOS.md` — lo que debe hacer una persona (token de Telegram, clave de IA, despliegue; Meta más adelante).
- `datos/` — chats exportados para pruebas (anonimizados; no subir datos personales).
