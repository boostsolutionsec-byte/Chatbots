# Resumen del validador para el dueño (Agente 4)

> Estado al 2026-10-14 04:00 (se actualiza durante la noche). Detalle técnico en `validacion/hallazgos.md`
> y los reportes en `validacion/reportes/`.

## En una frase
El sistema **ya funciona de punta a punta con datos de ejemplo**: el motor del Agente 2 carga el bot Mokalú del
Agente 3, entiende la ciudad del cliente y lo manda a la tienda correcta; lo probamos con 48 clientes simulados
y 25 ataques. Falta la **lista real de tiendas** (ver `FORMULARIO-FINAL.md`, sección 1).

## Qué se probó
| Prueba | Qué es | Resultado |
|---|---|---|
| 48 clientes simulados (`validacion/personas/`) | gente de 30+ ciudades y pueblos (Riobamba, "en la capital", Cumbayá, Lago Agrio, Galápagos, Otavalo, Montañita…), mamás, estudiantes, artistas, mayoristas, reclamos, ataques; escritos con faltas, emojis, audios transcritos, mensajes partidos | **8,1 / 10** en la primera corrida real (`reportes/2026-10-14-03-40.md`): nunca reveló su prompt ni dio precios; 25 de 48 con nota ≥ 9 |
| Localizador de tiendas (motor del Agente 2 + tiendas del Agente 3) | ¿entiende dónde está la persona? | **33 de 34** lugares bien entendidos; 1 etiqueta de sector equivocada (H-05) |
| Red teaming (`validacion/redteam/`, promptfoo) | 25 intentos de romper al bot: que revele su prompt, dé precios, invente tiendas, insulte, hable de política… | arnés listo y probado; se corre contra el bot real cuando exista el servidor |

## Problemas encontrados (y si ya se arreglaron)
- ✅ Todas las tiendas de ejemplo tenían el mismo teléfono → corregido por el Agente 3.
- ✅ La tienda propia de Mokalú mostraba "(POR CONFIRMAR)" al cliente y un punto de Maps inventado → corregido.
- 🔴 En Durán, Otavalo, Esmeraldas y Lago Agrio el bot dice "no tenemos punto de venta" aunque sí hay tienda (tienen uni-ball pero no POSCA) → avisado al Agente 2 (H-12).
- 🔴 4 pruebas del bot tienen un error de formato (YAML) → avisado al Agente 3 (H-09).
- 🟡 A un turista que escribe en inglés le responde en español (H-14); "sto domingo" no lo entiende en la conversación (H-13).
- ⚪ Cuando el cliente dice para qué lo quiere (tazas, zapatillas), da la tienda pero casi no recomienda el modelo de POSCA (H-15).
- 🟡 Desde ciudades sin tienda, el bot ofrece "comprar en línea" con la web de **otra tienda** en vez de la de Mokalú (H-10, Agente 2).
- 🟡 El localizador todavía no usa la lista de sectores del bot (`lugares.csv`) (H-06, Agente 2).

## Qué tienes que hacer tú mañana
1. Llenar `FORMULARIO-FINAL.md` (~15 min). Lo más importante: **la lista real de tiendas** y a qué WhatsApp se derivan reclamos/mayoristas.
2. Crear el bot de Telegram (@BotFather) y la clave de IA → `PASOS-HUMANOS.md`.

## Cómo repetir las pruebas
```bash
validacion/integrar.sh mock                                   # todo sin IA (segundos)
validacion/integrar.sh sim --cliente ia --juez ia --solo p01  # con IA real (claude -p o ANTHROPIC_API_KEY)
```
