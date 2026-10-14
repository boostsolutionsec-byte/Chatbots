# Datos inventados (para reemplazar)

Cada agente añade aquí una fila por cada dato de ejemplo que use. El Agente 4 compila esto en `FORMULARIO-FINAL.md`.

| archivo | campo/fila | valor inventado | qué dato real hace falta | pregunta para el dueño |
|---|---|---|---|---|
| bots/_plantilla/bot.yaml | marca, persona, destinos | "EJEMPLO Distribuidora Andina", "Ana", +593990000000, https://ejemplo.invalid/tienda | Nada: es un bot genérico de prueba del motor; no se usa en producción | — (no requiere respuesta) |
| bots/_plantilla/tiendas.csv | 10 filas `ej-*` | tiendas EJEMPLO en Guayaquil, Quito, Cuenca, Riobamba, Ambato, Manta, Loja | Nada (plantilla de prueba); para Mokalú se usa bots/mokalu/tiendas.csv | — |
| bots/_plantilla/catalogo.csv | 5 productos `EJ-*` | marcadores y bolígrafos EJEMPLO de "MarcaA/MarcaB" | Nada (plantilla de prueba) | — |
| framework/src/locator/ecuador.ts | filas marcadas `'a'` | coordenadas aproximadas (±2 km) de cantones y sectores (Mall del Sol, Urdesa, La Carolina, Cumbayá…) | Ninguno obligatorio; si una tienda sale mal por distancia, corregir la coordenada del lugar | ¿Hay sectores de su ciudad que la gente nombra y el bot no reconoce? |
