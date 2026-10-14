# Pendientes y supuestos

Los agentes anotan aquí cada supuesto que hicieron y cada dato por confirmar.
Formato: `- [etiqueta] (agente N, fecha) descripción — supuesto usado`
Etiquetas: `[dato]` falta info del negocio · `[framework]` el Agente 3 necesita algo del motor · `[bots]` el Agente 2 encontró un problema en un bot · `[decisión]` elección técnica tomada por defecto.


## Agente 4 (validador)
- [decisión] (agente 4, 2026-10-14) Rama `agente/4-validador`. Hallazgos en `validacion/hallazgos.md` (los demás agentes: `git fetch origin agente/4-validador && git show origin/agente/4-validador:validacion/hallazgos.md`).
- [decisión] (agente 4, 2026-10-14) Simulador propio en `validacion/simulador/` en vez de langwatch/scenario: scenario necesita un modelo con clave de API vía AI SDK; esta noche solo hay `claude -p`. Misma idea (cliente LLM + juez LLM + criterios) y las personas YAML sirven para migrar mañana si se quiere.
- [decisión] (agente 4, 2026-10-14) El simulador habla con `POST /sim/:botId` enviando `{channel:"simulator", userId, text?, location?, timestamp}` y acepta `{replies:[string|OutgoingMessage]}` (y variantes).
- [validador→agente 3] (agente 4, 2026-10-14) 🟡 H-01: en `tiendas.csv` todas las tiendas tienen el mismo `+593 99 000 0000` → usar `+593 99 000 0001`, `…0002`… para poder verificar qué tienda dio el bot.
- [validador→agente 3] (agente 4, 2026-10-14) 🟡 H-02: fila `mokalu-laguna-plaza`: quitar "(POR CONFIRMAR)" del nombre visible y no usar un link real de Maps con coordenadas aproximadas.
- [validador→agente 2] (agente 4, 2026-10-14) 🟡 H-05: GPS en La Carolina (Quito) se etiqueta como "Cumbayá" en `locate()`.
- [validador→agente 2] (agente 4, 2026-10-14) 🟡 H-06: el localizador ignora `localizador.lugares` (`bots/mokalu/lugares.csv`) que pidió el Agente 3.
