# Pendientes y supuestos

Los agentes anotan aquí cada supuesto que hicieron y cada dato por confirmar.
Formato: `- [etiqueta] (agente N, fecha) descripción — supuesto usado`
Etiquetas: `[dato]` falta info del negocio · `[framework]` el Agente 3 necesita algo del motor · `[bots]` el Agente 2 encontró un problema en un bot · `[decisión]` elección técnica tomada por defecto.


## Agente 3 (bots)
- [decisión] (agente 3, 2026-10-14) Rama `agente/3-bots`. El bot vive en `bots/mokalu/`.
- [dato] (agente 3, 2026-10-14) Lista de puntos de venta → `tiendas.csv` es EJEMPLO (39 tiendas inventadas + tienda propia POR CONFIRMAR) — ver `docs/DATOS-INVENTADOS.md`.
- [dato] (agente 3, 2026-10-14) POR CONFIRMAR: local exacto, coordenadas, WhatsApp y días de la tienda Mokalú en C.C. Laguna Plaza (km 12,5 vía a la costa).
- [dato] (agente 3, 2026-10-14) POR CONFIRMAR: horario humano (supuesto lun–sáb 10h00–18h00) y nombre del bot (supuesto "Sofi").
- [dato] (agente 3, 2026-10-14) POR CONFIRMAR: qué líneas uni distribuye Mokalú (supuesto: POSCA, PIN, Signo, Jetstream, Kuru Toga) → `catalogo.csv`.
- [dato] (agente 3, 2026-10-14) POR CONFIRMAR: si el bot puede ofrecer la tienda online/envíos nacionales (supuesto: solo si la tienda más cercana está a > 60 km o el cliente lo pide; sin prometer costos ni tiempos).
- [dato] (agente 3, 2026-10-14) POR CONFIRMAR: el bot no da precios ni promociones (supuesto por defecto FORMULARIO 12–13).
- [dato] (agente 3, 2026-10-14) POR CONFIRMAR: no afirmar "no tóxico"/certificaciones de POSCA sin ficha local; tazas solo decorativas.
- [dato] (agente 3, 2026-10-14) POR CONFIRMAR: destinos de derivación (`WHATSAPP_ASESOR_VENTAS`, `WHATSAPP_DISTRIBUIDORES`, `WHATSAPP_RECLAMOS`) y umbral mayorista (~24 u).
- [dato] (agente 3, 2026-10-14) No se pudo abrir `mokalu.com.ec` ni sitios de uni desde la sesión (red bloqueada); investigación hecha con buscador, fuentes en `docs/marcas.md`.
- [framework] (agente 3, 2026-10-14) El localizador necesita resolver ciudades/sectores **sin tienda** a coordenadas para dar "la más cercana por distancia" (ej. Guaranda → Riobamba). Propuesta: `bot.yaml` → `localizador.lugares: lugares.csv` con columnas `nombre,alias,tipo,ciudad,provincia,lat,lng` (alias separados por `;`). Ya está en `bots/mokalu/lugares.csv`.
- [framework] (agente 3, 2026-10-14) Campos extra opcionales en `bot.yaml` que el bot usa: `variables` (para `{{...}}` del prompt), `reglas_derivacion[].mensaje`, `localizador.ofrecer_ademas`, `localizador.distancia_lejana_km`, `localizador.filtro_producto`, `limites.max_palabras_por_mensaje`, `horario_humano.fuera_de_horario`. Si el motor no los soporta, que los ignore sin fallar.
- [framework] (agente 3, 2026-10-14) Variables de entorno que debe listar `.env.example`: `WHATSAPP_ASESOR_VENTAS`, `WHATSAPP_DISTRIBUIDORES`, `WHATSAPP_RECLAMOS`.
- [framework] (agente 3, 2026-10-14) Las evals de `bots/mokalu/evals/` usan claves de `espera` además de las del contrato: `contiene`, `contiene_alguno`, `no_pide_campo`, `motivo`, `deriva_a`, `max_palabras`, `idioma`; y turnos con `ubicacion: {lat, lng}` en vez de `usuario`. Documentado en `bots/mokalu/evals/README.md`. Si el runner no las soporta, que las pase al juez LLM como criterio.
- [framework] (agente 3, 2026-10-14) Resolución de lugares: si el texto coincide con una **ciudad** y con un **sector de otra ciudad** (ej. "malecón de Salinas"), gana la ciudad. Normalizar tildes/mayúsculas y tolerar errores ("kito", "gayakil", "rio bamba" ya están como alias en `lugares.csv`).
- [decisión] (agente 3, 2026-10-14) Mientras llega `npm run eval`, el Agente 3 itera el prompt con `bots/mokalu/herramientas/prueba_rapida.py` (Python + `claude -p --model haiku`); reportes en `bots/mokalu/reportes/`.
- [agente 3→validador] (agente 3, 2026-10-14) H-01 (teléfonos distintos `+593 99 000 00NN`), H-02 (nombre limpio "Mokalú — C.C. Laguna Plaza" + link de búsqueda de Maps), H-03 (horario sin "EJEMPLO") y H-04 (evals con `tienda_id_en` + `no_inventa_tiendas`) atendidos en `agente/3-bots`.
- [framework] (agente 3, 2026-10-14) Probé el `Locator` de `agente/2-framework` (7868066) con `bots/mokalu`: 21/22 consultas correctas. Falla: "gayakil x el sur" → `gye-centro` primero (se espera `gye-sur`): cuando el texto trae ciudad + "sur/norte/centro", combinar ambos (eval `23-faltas-ortografia`).
- [agente 3→agente 4] (agente 3, 2026-10-14) Simulador (`judge.ts`): el juez solo recibe `nombre · direccion · ciudad · whatsapp` de las tiendas, así que penaliza en `sin_inventar` el **horario**, el **maps_url**, la **distancia** (que sí vienen en `tiendas.csv`/del localizador) y los datos de producto de `conocimiento/` y `catalogo.csv` (PC-1M, PIN resistente al agua, tienda online). En la corrida 03:37 `sin_inventar` = 1.15 casi solo por eso. Propuesta: pasar al juez todas las columnas de la tienda esperada, la `distanciaKm` y un resumen de `conocimiento/productos-uni.md` + `faq.md` (la tienda online `mokalu.com.ec/tienda` es dato de `bot.yaml → destinos.tienda_online`).
- [decisión] (agente 3, 2026-10-14) Papelería que quiere ser punto de venta: si ya dio la ciudad se deriva **de inmediato** (nombre del negocio opcional), por la observación del juez en p38. Eval `18` actualizada.
- [decisión] (agente 3, 2026-10-14) El motor resuelve `{{a.b}}` desde la raíz de `bot.yaml`; el prompt de Mokalú usa `{{variables.nombre_bot}}`, `{{variables.web_tienda}}`, etc. (bloque `variables:` de `bot.yaml`). Verificado con `loadBot`: 0 variables sin resolver.
