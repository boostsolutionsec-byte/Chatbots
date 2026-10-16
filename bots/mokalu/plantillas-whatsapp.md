# Plantillas de WhatsApp (para cuando se conecte Meta)

> **No se envían todavía.** El dueño debe enviarlas a aprobación en WhatsApp Manager (ver `PASOS-HUMANOS.md`).
> Reglas de Meta: fuera de la ventana de 24 h desde el último mensaje del cliente **solo** se puede escribir con una
> plantilla aprobada. Variables `{{1}}`, `{{2}}`… en orden; no empezar ni terminar el texto con una variable;
> las de categoría **MARKETING** requieren que el cliente haya aceptado recibir mensajes (opt-in).
> Idioma de todas: `es` (español). Los nombres usan minúsculas y guion bajo, como pide Meta.

## 1. `seguimiento_tienda` — UTILITY
Se usa en `bot.yaml → seguimiento` a las ~23 h si el cliente recibió una tienda y no confirmó.

```
Hola {{1}} 👋 Soy {{2}} de Mokalú. Ayer te recomendamos *{{3}}* para comprar tus productos uni-ball. ¿Pudiste encontrar lo que buscabas?
```
- {{1}} nombre del cliente (o "👋" si no se sabe) · {{2}} nombre del bot · {{3}} nombre de la tienda
- Botones de respuesta rápida: `Sí, gracias` · `No, necesito otra tienda` · `Hablar con un asesor`

## 2. `recordatorio_ciudad` — UTILITY
Si quedó pendiente la ciudad para recomendar tienda.

```
Hola {{1}}, soy {{2}} de Mokalú 🎨 Para decirte dónde comprar uni-ball cerca de ti solo me falta saber tu ciudad o sector. ¿Me la cuentas?
```
- Botón: `Compartir ubicación` (solo si la API lo permite en ese momento) · `Hablar con un asesor`

## 3. `confirmacion_derivacion` — UTILITY
Cuando el bot deriva a una persona y el cliente ya salió de la ventana de 24 h.

```
Hola {{1}}, gracias por escribir a Mokalú. Tu solicitud sobre {{2}} ya está con nuestro equipo y te contactaremos en horario de atención ({{3}}).
```
- {{2}} tema (ej. "ser punto de venta", "tu reclamo") · {{3}} horario (ej. "lun–sáb 10h00–18h00")

## 4. `nuevo_punto_venta` — MARKETING (requiere opt-in)
Aviso cuando abre una tienda en la ciudad del cliente que antes no tenía.

```
¡Buenas noticias, {{1}}! 🎉 Ya puedes encontrar uni-ball en {{2}}: *{{3}}*, {{4}}. Si quieres te paso la ubicación.
```
- {{2}} ciudad · {{3}} tienda · {{4}} dirección
- Botón: `Ver ubicación` · `No recibir más avisos`

## 5. `encuesta_atencion` — UTILITY
Opcional, 2 días después de una derivación a reclamos.

```
Hola {{1}}, soy {{2}} de Mokalú. ¿Se resolvió tu caso? Tu opinión nos ayuda a mejorar 🙏
```
- Botones: `Sí, resuelto` · `Todavía no`

<!-- EJEMPLO: textos propuestos por el Agente 3; el dueño debe aprobarlos (registrado en docs/DATOS-INVENTADOS.md). -->
