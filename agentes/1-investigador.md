# Agente 1 · Investigador — ingeniería inversa de SellerChat

**Rama:** `agente/1-ingenieria-inversa` · **Carpeta:** `docs/ingenieria-inversa/`

## Misión
Entender por completo cómo funciona SellerChat (y bots de venta parecidos) para que nuestro framework
haga lo mismo **y mejor**. Tu producto no es código: son documentos precisos que los Agentes 2 y 3 usan.

## Pasos
1. Lee `CLAUDE.md`, `FORMULARIO.md` (sección A sobre todo) y `docs/CONTRATO.md`.
2. Repositorio de referencia: usa la URL de la pregunta 1 del formulario. Si está vacía, analiza los tres
   candidatos listados ahí. Para clonarlo: `git clone --depth 1 <url> /tmp/ref/<nombre>` (fuera del repo;
   **nunca** lo comitees dentro de este repo). Si la sesión no puede acceder, pide al dueño agregarlo y
   documenta el paso en `PASOS-HUMANOS.md`; mientras tanto sigue con el paso 4.
3. Ingeniería inversa del repositorio. Produce en `docs/ingenieria-inversa/`:
   - `01-mapa-del-codigo.md` — estructura, stack, dependencias, licencia (¡anota si se puede reutilizar!).
   - `02-flujo-de-un-mensaje.md` — desde que llega el webhook hasta que sale la respuesta (diagrama mermaid).
   - `03-prompts-y-personalidad.md` — prompts de sistema, cómo arma el contexto, cómo usa catálogo/FAQ.
   - `04-ventas-y-seguimiento.md` — embudo, recolección de datos, cierre, seguimientos, etiquetas/CRM.
   - `05-canales.md` — cómo se conecta a WhatsApp e Instagram (API oficial, no oficial, proveedor) y qué haría falta
     para conectar el nuestro después (hoy probamos con Telegram y chat web).
   - `06-configuracion-del-cliente.md` — qué le pide al negocio para configurar un agente (formularios, landing).
4. Investigación externa (web): funciones públicas de SellerChat (sellerchat.ai y similares: Wati, Manychat,
   Respond.io, Leadsales), y las reglas actuales de WhatsApp Cloud API e Instagram Messaging API
   (ventana de 24 h, plantillas, límites, requisitos de verificación). Resultado: `07-competencia-y-reglas-meta.md`
   con fuentes enlazadas.
5. Síntesis: `00-RESUMEN.md` con
   - tabla "Funcionalidad | SellerChat | Nuestro framework (propuesta) | Prioridad (P0/P1/P2)";
   - las 10 mejores prácticas de conversación de venta por chat que debemos copiar;
   - los riesgos (bloqueo de número, políticas Meta, alucinaciones de precios).
6. Añade tus propuestas concretas a `docs/CONTRATO.md` → sección "Propuestas" (no cambies el resto del contrato).
7. Si terminas antes, escribe 30+ conversaciones realistas de ejemplo (clientes ecuatorianos, con errores de
   ortografía, audios descritos, preguntas cortadas) en `docs/ingenieria-inversa/conversaciones-ejemplo.md`
   para que el Agente 3 las convierta en evals. Tema: clientes que preguntan por productos **uni-ball / POSCA** a una
   tienda de arte (Mokalú, Guayaquil) — ver `docs/marcas.md`.

## Criterio de terminado
`00-RESUMEN.md` existe, cada afirmación sobre el repo cita archivo y línea, y todo está empujado.
