# Evals del bot Mokalú

40 conversaciones de prueba con el formato de `docs/CONTRATO.md` §4. Datos de tiendas = `tiendas.csv` (EJEMPLO):
si cambian las tiendas reales, revisar los `contiene` con nombres de tienda.

Claves de `espera` usadas (las del contrato + extensiones pedidas en `PENDIENTES.md` con `[framework]`):

| Clave | Significado |
|---|---|
| `pide_campo: X` | el bot pregunta por el campo X del flujo (contrato) |
| `tienda_en: [ciudades]` | la(s) tienda(s) recomendada(s) son de alguna de esas ciudades (contrato) |
| `no_contiene: [...]` | ninguno de esos textos aparece (contrato; sin distinguir mayúsculas) |
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
