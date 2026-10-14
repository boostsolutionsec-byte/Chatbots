# Formulario previo — Bots Mocalu y Uniwell

Llena este archivo **antes** de lanzar los agentes. Escribe tu respuesta debajo de cada pregunta (después de `R:`).
Si dejas algo vacío, los agentes usan el **valor por defecto** indicado y lo anotan en `PENDIENTES.md`; nada se bloquea.

> No pongas aquí contraseñas, tokens ni claves de API. Esos van mañana como secretos (ver `PASOS-HUMANOS.md`).

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

## B. Mocalu (bot de redireccionamiento)

4. **¿Qué es Mocalu en una frase?** (qué vende/ofrece, ciudad/país)
   R:

5. **"Redireccionar" significa enviar al cliente a…** (marca/escribe)
   - [ ] un asesor humano por WhatsApp (¿qué número/s?)
   - [ ] la tienda web / link de compra (¿URL?)
   - [ ] una sucursal física (¿cuáles y horarios?)
   - [ ] otra marca/cuenta (¿Uniwell?)
   - [ ] otro:
   R:

6. **Reglas de redirección:** ¿a quién mandas qué? (ej.: "mayoristas → Juan", "Quito → sucursal Norte", "reclamos → soporte")
   R:

7. **Las 10 preguntas más frecuentes de los clientes de Mocalu** (con su respuesta correcta si la sabes).
   R:

## C. Uniwell (bot de compras)

8. **¿Qué es Uniwell en una frase?** (productos, ciudad/país)
   R:

9. **Catálogo:** ¿dónde está la lista de productos con precios? (link a Drive/Sheets/web/Shopify/WooCommerce, o pégalo aquí)
   R:

10. **¿Cómo se completa una compra hoy?** (paso a paso: elige producto → ¿pago por transferencia / link de pago / contraentrega? → ¿envío o retiro?)
    R:

11. **Datos que el bot debe pedir para cerrar un pedido** (por defecto: nombre, cédula/RUC, ciudad, dirección, teléfono, producto, cantidad, forma de pago).
    R:

12. **Costos y tiempos de envío, cobertura, políticas de cambio/devolución.**
    R:

13. **¿Promociones, descuentos o combos vigentes?**
    R:

## D. Comportamiento de ambos bots

14. **Nombre y personalidad del bot** (ej.: "Sofi, cercana, usa emojis con moderación"). ¿Uno por marca?
    R:

15. **Tono:** ¿tutear o usar "usted"? ¿Ecuatorianismos? (por defecto: tuteo cordial, español de Ecuador, emojis moderados)
    R:

16. **¿Cuándo debe pasar a un humano sí o sí?** (por defecto: reclamos, enojo, pedidos > cierto monto, pregunta sin respuesta 2 veces, el cliente lo pide)
    R:

17. **Horario de atención humana** (fuera de horario el bot avisa y toma datos).
    R:

18. **Cosas que el bot NUNCA debe decir o prometer** (ej.: precios no confirmados, tiempos de entrega exactos, temas médicos).
    R:

19. **¿Seguimiento automático?** (ej.: escribir de nuevo a las 24 h si no compró). Ojo: WhatsApp solo permite mensajes libres dentro de 24 h; después hace falta plantilla aprobada.
    R:

## E. Canales e infraestructura

20. **WhatsApp:** ¿qué usan hoy? (marca)
    - [ ] WhatsApp Business App (celular)
    - [ ] WhatsApp Cloud API de Meta
    - [ ] Periskope (ya hay flujos en n8n con Periskope)
    - [ ] SellerChat / otro proveedor:
    R:

21. **Instagram:** ¿las cuentas de Mocalu y Uniwell son profesionales y están vinculadas a una página de Facebook / Meta Business?
    R:

22. **¿Dónde se va a ejecutar el bot?** (por defecto: **n8n** que ya usan + un servicio pequeño en Node/TypeScript; alternativa: Supabase Edge Functions, Railway, Render, VPS)
    R:

23. **Modelo de IA para responder** (por defecto: Claude Haiku para conversación y Claude Sonnet para casos difíciles; alternativa: DeepSeek, que ya usan en n8n).
    R:

24. **¿Dónde se guardan conversaciones y pedidos?** (por defecto: Supabase; alternativas: ClickUp, Google Sheets, CRM)
    R:

25. **¿Hay chats reales exportados que podamos usar para entrenar/probar?** (exporta chats de WhatsApp como .txt y súbelos a `datos/` — anonimizados — o di dónde están)
    R:

## F. Prioridad

26. **Si solo hubiera tiempo para una cosa esta noche, ¿cuál?**
    - [ ] Que Uniwell venda
    - [ ] Que Mocalu redireccione bien
    - [ ] El framework reutilizable para futuros clientes
    R:
