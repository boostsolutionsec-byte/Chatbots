# Formulario final — de datos de ejemplo a datos reales (~15 minutos)

> Lo compila el Agente 4 (validador) a partir de `docs/DATOS-INVENTADOS.md` de **todas** las ramas.
> Esta noche el bot funciona con datos **inventados** (todo lo que dice `EJEMPLO`). Responde aquí y un agente
> reemplaza los datos en los archivos. Ordenado por importancia: si solo tienes 5 minutos, llena la sección 1.
> **No** pongas aquí tokens ni claves (van como secretos, ver sección 6).
>
> Última actualización (cierre de la noche): 2026-10-14 04:30 · fuentes: `docs/DATOS-INVENTADOS.md` de `agente/3-bots` (19 filas), `agente/1-ingenieria-inversa` (2), `agente/2-framework` (4, solo plantilla de prueba: no hay que llenar nada) y `.env.example` del Agente 2.

---

## 1. Puntos de venta — lo más importante (5 min)

Hoy `bots/mokalu/tiendas.csv` tiene **39 tiendas inventadas** (`EJEMPLO …`) + la tienda propia de Mokalú sin confirmar.
El bot **solo** recomienda tiendas de esta lista, así que sin la lista real no se puede usar con clientes.

**1.1** Pega el link del Excel/Google Sheets con los puntos de venta, o llena la tabla:

| nombre | ciudad | provincia | dirección | link de Google Maps | WhatsApp público | horario | marcas (uni-ball/POSCA/otras) | ¿vende online? (web) |
|---|---|---|---|---|---|---|---|---|
| | | | | | | | | |
| | | | | | | | | |
| | | | | | | | | |

R (link):

**1.2** ¿Las tiendas aceptan que el bot comparta su WhatsApp/teléfono con los clientes? (sí / no / solo algunas)
R:

**1.3** Tienda propia de Mokalú en C.C. Laguna Plaza: número de local, link de Maps, WhatsApp de la tienda y **días** que abre (hoy supuesto: 10h00–18h00, lun–sáb).
R:

**1.4** Hoy **todas** las tiendas de ejemplo dicen tener `uni-ball;POSCA`. ¿Hay tiendas que solo tienen bolígrafos uni-ball y no POSCA? (según el Agente 2, el motor ya responde "aquí hay uni-ball; POSCA está en…")
R:

**1.5** Si en la ciudad del cliente no hay tienda: ¿le damos la más cercana por distancia **y** la tienda online `mokalu.com.ec/tienda/` con envío? (hoy: la web solo si la tienda más cercana está a > 60 km o si el cliente la pide)
R:

## 1b. Inteligencia artificial (1 min)

**1b.1** ¿Qué IA usamos en producción? El Agente 2 dejó por defecto **DeepSeek** (más barato, ya lo usan en n8n) y Claude como alternativa. (DeepSeek / Claude / la que cueste menos)
R:

## 2. A dónde manda el bot a cada persona (2 min)

| Caso | Hoy (inventado) | Tu respuesta (WhatsApp o correo) |
|---|---|---|
| Cliente con dudas / pide una persona | `WHATSAPP_ASESOR_VENTAS` sin valor | |
| Servicio al cliente general (si es distinto) | `WHATSAPP_SERVICIO_CLIENTE` sin valor | |
| Papelería que quiere ser punto de venta, mayoristas, colegios, empresas | `WHATSAPP_DISTRIBUIDORES` sin valor | |
| Reclamos y garantía | `WHATSAPP_RECLAMOS` sin valor | |

**2.1** ¿Desde cuántas unidades un pedido es "mayorista"? (hoy: ~24) R:
**2.2** Horario de atención humana: días y horas (hoy: lun–sáb 10h00–18h00) R:

## 3. Lo que el bot puede decir (3 min)

**3.1** ¿Puede dar precio referencial (PVP sugerido) o nunca habla de precios? (hoy: **nunca**) R:
**3.2** ¿Promociones activas que deba mencionar? (hoy: ninguna) R:
**3.3** ¿Qué líneas/modelos distribuye Mokalú? Hoy el catálogo tiene 13 productos reales de uni (POSCA PC-1MR, PC-1M, PC-3M, PC-5M, PC-7M, PC-8K, PC-17K, PCF-350, PIN, Signo, Jetstream, Kuru Toga…) sin confirmar. ¿Quitar o añadir alguno? ¿Otras marcas?
R:
**3.4** Las 10 preguntas que más les hacen hoy (con su respuesta). Hoy `conocimiento/faq.md` es una FAQ escrita por el agente.
R:
**3.5** Políticas de reclamos (cambios, devoluciones) y envíos (¿costos/tiempos que el bot pueda decir?). Hoy: el bot no promete nada y deriva.
R:

## 4. Personalidad (1 min)

**4.1** Nombre del bot (hoy: **Sofi**) R:
**4.2** ¿Tuteo o "usted"? (hoy: tuteo cordial, emojis moderados 🎨) R:
**4.3** ¿Te gustan los textos de seguimiento de `bots/mokalu/plantillas-whatsapp.md`? ¿Quieres seguimiento automático a las 23 h? R:

## 5. Referencia SellerChat (1 min, opcional)

**5.1** Los tres repos candidatos **no** contienen el motor del bot de SellerChat (solo landing, backend de llamadas y un esqueleto). ¿Tienes acceso al código real? R:

## 6. Cuentas y claves que debes crear (no las pegues aquí)

Pégalas como **secretos** (archivo `.env` local o variables del entorno en la nube). Lista completa en `.env.example` (rama `agente/2-framework`).

| Variable | Qué es | Dónde se saca | Obligatoria para |
|---|---|---|---|
| `DEEPSEEK_API_KEY` **o** `ANTHROPIC_API_KEY` | clave de IA (según 1b.1) | platform.deepseek.com / console.anthropic.com → API Keys | bot con IA real |
| `TELEGRAM_BOT_TOKEN` (y opcional `TELEGRAM_ADMIN_CHAT_ID` para recibir avisos de derivación) | bot de prueba | Telegram → @BotFather → `/newbot` | probar en el celular |
| `ADMIN_TOKEN`, `SIM_TOKEN` | contraseñas que inventas tú (largas) | — | proteger el panel y el simulador si el servicio queda público |
| `WHATSAPP_ASESOR_VENTAS`, `WHATSAPP_DISTRIBUIDORES`, `WHATSAPP_RECLAMOS` | números a donde se deriva | sección 2 de este formulario | derivar a humanos |
| (opcional) `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | guardar conversaciones | supabase.com → proyecto → Settings → API | historial y leads |
| Fase 2: Meta Business verificado, app de WhatsApp/Instagram, token permanente | WhatsApp e Instagram | ver `PASOS-HUMANOS.md` | más adelante |

---

### Detalle (para el agente que reemplace los datos)

Cada respuesta corresponde a filas de `docs/DATOS-INVENTADOS.md`:

| Pregunta | Archivo(s) a cambiar |
|---|---|
| 1.1, 1.2 | `bots/mokalu/tiendas.csv` (todas las filas `EJEMPLO`), `bots/mokalu/evals/*` que citan tiendas |
| 1.3 | `tiendas.csv` fila `mokalu-laguna-plaza`, `bot.yaml` destino `tienda_mokalu` |
| 1.4 | `tiendas.csv` columna `marcas` |
| 1.5 | `bot.yaml` → `localizador.ofrecer_ademas`, `distancia_lejana_km`; `conocimiento/politicas.md` |
| 1b.1 | `.env` → `LLM_PROVIDER` |
| 2 | `.env` (secretos), `bot.yaml` → `destinos`, `reglas_derivacion` (umbral mayorista) |
| 2.2 | `bot.yaml` → `horario_humano` |
| 3.1–3.5 | `conocimiento/politicas.md`, `conocimiento/faq.md`, `catalogo.csv` |
| 4.1–4.3 | `bot.yaml` → `persona.nombre`, `variables.nombre_bot`; `prompts/sistema.md`; `plantillas-whatsapp.md` |
