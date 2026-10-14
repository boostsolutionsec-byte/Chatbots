# Cómo lanzar los 3 agentes en Claude Code (nube)

**Antes:** llena `FORMULARIO.md`, haz commit y push (o pídeselo a Claude en esta sesión).

## Opción A — desde claude.ai/code (manual)
Abre 3 sesiones nuevas sobre el repo `boostsolutionsec-byte/Chatbots`, rama base
`claude/mocalu-uniwell-chatbot-agents-lp0vn0`, y pega en cada una el prompt correspondiente de abajo.

## Opción B — que Claude las cree por ti
En la sesión donde se preparó esto, escribe: **"Formulario listo, lanza los agentes"**.
Claude crea las 3 sesiones con los prompts de abajo.

---

### Prompt Agente 1
```
Eres el Agente 1 (Investigador). Haz `git checkout -b agente/1-ingenieria-inversa` desde
claude/mocalu-uniwell-chatbot-agents-lp0vn0. Lee CLAUDE.md y sigue al pie de la letra
agentes/1-investigador.md. Trabaja de forma autónoma toda la noche sin pedirme confirmación:
cuando dudes, toma la opción prudente y anótala en PENDIENTES.md. Commit + push frecuente a
agente/1-ingenieria-inversa. No abras pull requests. Al terminar los criterios, sigue mejorando
la calidad de los documentos y ejemplos hasta que no quede nada útil por hacer.
```

### Prompt Agente 2
```
Eres el Agente 2 (Arquitecto). Haz `git checkout -b agente/2-framework` desde
claude/mocalu-uniwell-chatbot-agents-lp0vn0. Lee CLAUDE.md y sigue al pie de la letra
agentes/2-arquitecto.md. Trabaja de forma autónoma toda la noche sin pedirme confirmación:
cuando dudes, toma la opción prudente y anótala en PENDIENTES.md. Commit + push frecuente a
agente/2-framework. No abras pull requests. Nunca llames APIs de Meta reales ni envíes mensajes.
Al cumplir los criterios, revisa propuestas del Agente 1 (git fetch origin agente/1-ingenieria-inversa)
y de PENDIENTES.md [framework] e impleméntalas.
```

### Prompt Agente 3
```
Eres el Agente 3 (Diseñador de bots). Haz `git checkout -b agente/3-bots` desde
claude/mocalu-uniwell-chatbot-agents-lp0vn0. Lee CLAUDE.md y sigue al pie de la letra
agentes/3-disenador-bots.md. Trabaja de forma autónoma toda la noche sin pedirme confirmación:
cuando dudes, toma la opción prudente y anótala en PENDIENTES.md. Nunca inventes precios ni datos
de contacto. Commit + push frecuente a agente/3-bots. No abras pull requests. Al terminar los
criterios, itera sobre los evals con el framework del Agente 2 hasta subir la nota.
```

### (Opcional) Integrador — por la mañana
```
Une agente/1-ingenieria-inversa, agente/2-framework y agente/3-bots en
claude/mocalu-uniwell-chatbot-agents-lp0vn0, resuelve conflictos, corre npm test y las evals
de ambos bots, y deja en RESUMEN-DE-LA-NOCHE.md: qué se hizo, notas de evals, y la lista
final ordenada de PASOS-HUMANOS.md.
```
