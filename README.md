# Chatbots — framework de bots de venta (WhatsApp + Instagram)

Framework para crear chatbots de atención y ventas configurables por carpeta, inspirado en la
ingeniería inversa de SellerChat. Primeros bots: **Mocalu** (redireccionamiento) y **Uniwell** (compras).

## Cómo se construye
Tres agentes de Claude Code en la nube trabajan en paralelo durante la noche:

| Agente | Qué hace | Brief |
|---|---|---|
| 1 · Investigador | Ingeniería inversa de SellerChat + reglas de Meta | `agentes/1-investigador.md` |
| 2 · Arquitecto | Motor reutilizable: canales, LLM, flujos, derivación, evals | `agentes/2-arquitecto.md` |
| 3 · Diseñador de bots | Configuración, conocimiento y pruebas de Mocalu y Uniwell | `agentes/3-disenador-bots.md` |

## Orden
1. Llenar `FORMULARIO.md`.
2. Lanzar los agentes → `agentes/LANZAR.md`.
3. Por la mañana: integrar ramas y hacer `PASOS-HUMANOS.md`.

## Archivos clave
- `CLAUDE.md` — reglas para todos los agentes.
- `docs/CONTRATO.md` — interfaz común (formato de bots, interfaces, evals).
- `PENDIENTES.md` — supuestos y datos por confirmar.
- `PASOS-HUMANOS.md` — lo que debe hacer una persona (cuentas Meta, tokens, despliegue).
- `datos/` — chats exportados para pruebas (anonimizados; no subir datos personales).
