# Resumen de la noche — Bot Mokalú (2026-10-13/14)

## Qué quedó hecho
- **Framework propio** (`framework/`, Node + TypeScript): motor, buscador de tiendas de Ecuador sin IA, chat web,
  Telegram, simulador, evaluador de pruebas, esqueletos de WhatsApp/Instagram. 210/210 pruebas pasan.
  Se descartó BuilderBot (motivos en `framework/DECISION-BASE.md`).
- **Bot Mokalú** (`bots/mokalu/`): tiendas de EJEMPLO en las 24 provincias, guía de productos uni-ball/POSCA,
  prompt corto (~550 tokens), conocimiento en 33 fragmentos, 10 respuestas sin IA, 81 pruebas.
- **Investigación** (`docs/ingenieria-inversa/`): SellerChat y competencia, 43 conversaciones de ejemplo,
  guía para conectar WhatsApp/Instagram (`09-guia-conexion-meta.md`), mapa de huecos (`08-cobertura.md`).
- **Validación** (`validacion/`): clientes simulados, red teaming, `validacion/RESUMEN.md`; 14 de 17 hallazgos corregidos.
  Abierto: H-17 (regresión del localizador).

## Notas
- Pruebas con IA (15 casos): 47 → 77/100. Simulador: 8,6–8,8/10. Validador: 8,1/10 (antes de las correcciones).

## Costo
- **Construcción (una sola vez):** ~61,6 USD (agentes 53,7 + supervisión 7,9).
- **Operación estimada:** ~1.900 tokens de entrada por llamada a DeepSeek (~1.170 en caché) y ≤300 de salida;
  saludos y "dónde compro en <ciudad>" no llaman a la IA. Estimado: menos de 1 USD/mes en IA a 10 mensajes/día
  (precios en `framework/precios.yaml`, sin verificar contra la tarifa actual).

## Para mañana
1. Llenar `FORMULARIO-FINAL.md` (sobre todo la lista real de tiendas).
2. Seguir `PASOS-HUMANOS.md`: crear un bot **nuevo** en @BotFather para Mokalú y poner `DEEPSEEK_API_KEY`.
3. Probar: `cd framework && npm install && npm run dev` → abrir `/chat/mokalu`, o `npm run sim -- mokalu`.
4. **Pendiente:** armar el workflow en n8n con el paquete `framework/n8n/` (no se hizo por el tope de presupuesto).
