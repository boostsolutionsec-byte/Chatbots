# Evals del bot Mokalú

81 conversaciones de prueba (40 propias + 41 importadas del Agente 1 como `a1-c*.yaml`) con el formato de `docs/CONTRATO.md` §4. Datos de tiendas = `tiendas.csv` (EJEMPLO):
al cambiar a tiendas reales, actualizar los `tienda_id_en` (ids de `tiendas.csv`).

Claves de `espera` usadas (las del contrato + extensiones pedidas en `PENDIENTES.md` con `[framework]`):

| Clave | Significado |
|---|---|
| `pide_campo: X` | el bot pregunta por el campo X del flujo (contrato) |
| `tienda_en: [ciudades]` | la(s) tienda(s) recomendada(s) son de alguna de esas ciudades (contrato) |
| `no_contiene: [...]` | ninguno de esos textos aparece (contrato; sin distinguir mayúsculas) |
| `tienda_id_en: [ids]` | la tienda recomendada es una de esas filas de `tiendas.csv` (propuesta P-9) |
| `no_inventa_tiendas: true` | toda tienda/teléfono citado existe en `tiendas.csv` (P-9) |
| `contiene: [...]` | todos esos textos aparecen |
| `contiene_alguno: [...]` | al menos uno aparece |
| `no_pide_campo: X` | no vuelve a preguntar un dato ya dado |
| `motivo: misma_ciudad\|misma_provincia\|mas_cercana` | motivo devuelto por el `StoreLocator` |
| `deriva_a: destino` | se creó un handoff a ese destino de `bot.yaml` |
| `max_palabras: N` | la respuesta tiene como máximo N palabras |
| `idioma: en` | responde en ese idioma |

Un turno puede traer `ubicacion: {lat, lng}` en lugar de `usuario:` (ubicación compartida de Telegram/WhatsApp).
`resultado_final.destino` acompaña a `accion: derivar`.

Cobertura: ciudades con tienda (Riobamba, Quito, Cuenca, Ambato, Ibarra, Esmeraldas), sin tienda (Guaranda, Zamora,
Macas, El Coca, Galápagos), sectores (Mall del Sol, Cumbayá, sur de Guayaquil), ubicación compartida, provincia sola,
asesoría (zapatillas, tazas, mural, lettering, zurdos, POSCA vs alcohol), precio, stock, envíos, distribuidor,
colegio/mayorista, reclamos, pide humano, marca no distribuida, faltas de ortografía, emojis, "?", spam,
prompt injection, inglés, presión para inventar una tienda, ¿eres un bot?, datos privados, tienda no registrada, precio insistente y fuera de tema.

Las evals `a1-*` usan además: `max_burbujas`, `max_tiendas`, `respuestas_totales`, `ofrece_humano`, `no_inventa_productos`,
`prioridad`, `seguimientos_enviados`, `seguimientos_pendientes`; turnos con `usuario: [lista]` (ráfaga),
`usuario: {audio_transcrito|imagen_descrita|ubicacion}`, `esperar: 23h` y `hora_simulada` a nivel de eval
(ver `docs/CONTRATO.md` → Propuestas P-9). Si el runner no soporta una clave, que la pase al juez como criterio.
