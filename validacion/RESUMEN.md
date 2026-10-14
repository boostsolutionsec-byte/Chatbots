# Resumen del validador para el dueño (Agente 4)

> Cierre de la noche: 2026-10-14 04:30. Detalle técnico en `validacion/hallazgos.md`; reportes en `validacion/reportes/`.

## En una frase
El sistema **funciona de punta a punta con datos de ejemplo**: el motor (Agente 2) carga el bot Mokalú (Agente 3),
entiende dónde está el cliente y lo manda a una tienda real de la lista. En la prueba final sacó **9,1 / 10**.
Para usarlo con clientes falta **tu lista real de tiendas** (`FORMULARIO-FINAL.md`, sección 1).

## Cómo le fue
| Prueba | Resultado |
|---|---|
| Corrida 1 — 48 clientes simulados contra el bot real (03:40) | **8,1 / 10**. Sin fugas de prompt ni precios. Fallos: decía "no hay tienda" en 4 ciudades que sí tenían, no entendía "sto domingo", respondía en español a un turista en inglés. |
| Corrida final — 15 clientes representativos, después de los arreglos (04:25) | **9,1 / 10** (esas mismas 15 personas sacaron 6,9 en la primera corrida). 9 de 15 con 10/10: Durán, Lago Agrio, Otavalo, Galápagos, Santo Domingo, inglés, ubicación compartida, reclamo y ataque de inyección. |
| Localizador de tiendas | Entiende "en la capital", "rio bamba", "sto domingo", "lago agrio", "guayaco, por urdesa", pueblos sin tienda → la más cercana. |
| Red teaming (25 ataques, promptfoo) | Listo y probado, pero **no se corrió contra el bot real** por el límite de presupuesto. Se corre mañana con un comando (ver abajo). |

Por criterio (0–2, corrida final): escala a humano 2,0 · seguro 2,0 · pocos mensajes 1,93 · no inventa 1,8 · natural 1,8 ·
tienda correcta 1,5 · sabe de producto 1,0.

## Lo que todavía falla
- 🟡 **Sectores escritos** ("vivo cerca del Mall del Sol", "vivo en Cumbayá"): el bot da una tienda de la misma ciudad pero no la del sector, y dice una distancia falsa. Avisado al Agente 2 (H-17). Si el cliente **comparte su ubicación** sí funciona bien.
- ⚪ Recomendar producto todavía es lo más flojo: cuando dicen "para zapatillas", "para tazas", recomienda poco cómo sellar/fijar.
- ⚪ Ante insistencia (precio 3 veces) repite casi la misma frase; suena algo robótico.

## Ya arreglado esta noche (14 de 17 hallazgos)
Teléfonos únicos por tienda · tienda propia sin "POR CONFIRMAR" ni punto de Maps inventado · evals con YAML válido ·
"no hay tienda" falso · "sto domingo" · idioma del cliente · presentarse como Sofi · ya no ofrece la web de otra tienda como
tienda online · etiqueta de sector con GPS.

## Qué tienes que hacer tú (en orden)
1. Llenar **`FORMULARIO-FINAL.md`** (~15 min). Lo más importante: la lista real de tiendas (1.1), si todas tienen POSCA (1.4),
   qué IA usar (1b) y a qué WhatsApp se derivan reclamos, mayoristas y dudas (2).
2. Crear el bot de Telegram (@BotFather) y la clave de IA → `PASOS-HUMANOS.md`.
3. Cuando estén los datos reales, repetir las pruebas (abajo) y revisar `validacion/hallazgos.md` → H-17.

## Cómo repetir las pruebas
```bash
validacion/integrar.sh mock                                         # todo sin IA (segundos, gratis)
validacion/integrar.sh sim --cliente guion --juez ia --solo p01,p02,p12   # pocas personas con IA real
# red teaming contra el servidor del framework (cd framework && npm start):
cd validacion/redteam && npm install && SIM_URL=http://localhost:3000 npm run redteam
```
Ojo con el costo: cada persona con IA hace unas 3–6 llamadas; la corrida de 48 personas es la más cara.
