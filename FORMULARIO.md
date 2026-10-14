# Formulario previo — Bot Mokalú (distribuidor) → tiendas más cercanas

> **Esta noche los agentes trabajan sin este formulario** (con datos de ejemplo). Mañana usa `FORMULARIO-FINAL.md`, que lo reemplaza.

Llena este archivo cuando puedas. Escribe tu respuesta debajo de cada pregunta (después de `R:`).
Si dejas algo vacío, los agentes usan el **valor por defecto** indicado y lo anotan en `PENDIENTES.md`; nada se bloquea.
Lo que ya investigamos está en `docs/marcas.md`.

> No pongas aquí contraseñas, tokens ni claves de API. Esos van como secretos (ver `PASOS-HUMANOS.md`).

---

## A. Referencia a copiar (ingeniería inversa)

1. **URL exacta del repositorio de "SellerChat" que quieres que analicemos.**
   Candidatos que encontré en GitHub (marca el correcto o pega otro):
   - `Keyner9/Code-de-SellerChat` — "Backup/Apoyo para SellerCall"
   - `funnellersinfo-maker/probaragente` — "SellerChat - Landing page para configurar agente de WhatsApp personalizado"
   - `nelperecas-it/sellerchat-backend-demo` — backend demo en C#
   R:

2. **¿Qué es lo que más te gusta de SellerChat (o de lo que usan hoy)?** (ej.: tono humano, seguimiento automático, catálogo, cierra ventas, etiquetas en CRM…)
   R:

3. **¿Qué es lo que NO te gusta / lo que quieres hacer mejor?**
   R:

## B. El bot — "¿dónde compro?"

**Objetivo principal (confirmado):** Mokalú es el **distribuidor** en Ecuador. El bot recibe a quien pregunta por los
productos y lo **redirige a la tienda/punto de venta más cercano**. Ej.: "soy de Riobamba" → "puedes comprar en *Papelería X*, Av. Y, este es su WhatsApp/ubicación".

4. **¿Qué marcas distribuye Mokalú?** (por defecto: uni-ball y POSCA; ¿hay otras? lista completa)
   R:

5. **Lista de puntos de venta** — lo más importante de todo el formulario. Pega el link (Sheets/Excel/Drive) o la lista.
   Para cada tienda idealmente: nombre · ciudad · provincia · dirección · link de Google Maps (o coordenadas) ·
   WhatsApp/teléfono público · horario · qué marcas/productos tiene · ¿vende online?
   (Si no está hoy, el bot queda listo con un archivo de ejemplo y lo llenas mañana.)
   R:

6. **Si en la ciudad del cliente NO hay tienda**, ¿qué hace el bot? (por defecto: le da la tienda más cercana por distancia y, si existe, la opción de compra online/envío)
   R:

7. **¿Mokalú también vende directo al público?** (tienda propia en C.C. Laguna Plaza, web `mokalu.com.ec`) ¿El bot puede ofrecer eso además de la tienda cercana, o solo redirigir?
   R:

8. **Otros casos y a dónde van:**
   - Tiendas/papelerías que quieren **ser distribuidores o puntos de venta**: →
   - Mayoristas, colegios, empresas: →
   - Reclamos de producto / garantía: →
   R:

9. **¿En qué cuenta(s) vivirá el bot?** (Instagram/WhatsApp de Mokalú, de uni-ball Ecuador, ambos…)
   R:

10. **Las 10 preguntas más frecuentes que reciben hoy** (con su respuesta correcta si la sabes).
    R:

## C. Productos

11. **Catálogo:** ¿hay lista de productos (sin precios está bien)? (link o pégalo aquí). Sirve para que el bot sepa qué existe y recomiende.
    R:

12. **¿El bot puede dar precios referenciales (PVP sugerido) o nunca habla de precios?** (por defecto: **no** da precios; dice que varían por tienda)
    R:

13. **¿Promociones o campañas activas que el bot deba mencionar?**
    R:

## D. Comportamiento

14. **Nombre y personalidad del bot** (por defecto: asistente cercano que sabe de arte y conoce las tiendas del país; nombre por definir).
    R:

15. **Tono:** ¿tutear o "usted"? (por defecto: tuteo cordial, español de Ecuador, emojis moderados 🎨)
    R:

16. **¿Cuándo debe pasar a un humano sí o sí?** (por defecto: reclamos, enojo, pedidos grandes/mayoristas, pregunta sin respuesta 2 veces, el cliente lo pide)
    R:

17. **Horario de atención humana** (por defecto: 10h00–18h00 según la web; ¿qué días?)
    R:

18. **Cosas que el bot NUNCA debe decir o prometer** (por defecto: precios, stock de una tienda, hablar mal de otras marcas o de una tienda).
    R:

19. **¿Seguimiento automático?** (ej.: escribir de nuevo a las 24 h si no compró)
    R:

## E. Infraestructura (para probar sin Meta)

20. **Canal de prueba** (por defecto: **Telegram** — gratis, se crea en 2 minutos con @BotFather, sin verificar empresa — más un **chat web** local para probar en el navegador). WhatsApp e Instagram quedan preparados para conectarse después.
    R:

21. **Modelo de IA** (por defecto: Claude Haiku para conversar y Claude Sonnet para casos difíciles; alternativa: DeepSeek, que ya usan en n8n).
    R:

22. **¿Dónde guardar conversaciones y clientes interesados?** (por defecto: Supabase; alternativas: ClickUp, Google Sheets)
    R:

23. **¿Hay chats reales exportados para probar?** (súbelos a `datos/` sin nombres ni teléfonos)
    R:
