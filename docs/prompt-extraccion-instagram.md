# Prompt para extraer datos de Instagram (Claude in Chrome)

Copiar todo el bloque de abajo en Claude in Chrome, con la sesión de Instagram ya iniciada.
Lo que devuelva se pega en la sesión del bot para cargarlo en `bots/mokalu/tiendas.csv` y en n8n.

```text
Necesito que saques datos de Instagram para cargarlos en un bot que manda a cada cliente a la tienda más cercana en Ecuador.
Solo LEE: no escribas mensajes, no comentes, no des like, no sigas cuentas ni toques nada de configuración.

CUENTAS
1. https://www.instagram.com/uniball_ecuador/
2. https://www.instagram.com/mokalu_ec/

TAREA 1 — Puntos de venta (lo más importante)
- En cada cuenta, abre el PRIMER destacado (el círculo debajo de la biografía) y también cualquier otro destacado cuyo nombre hable de tiendas, puntos de venta, distribuidores o "dónde comprar".
- Pasa TODAS las historias del destacado, una por una (usa la flecha o haz clic a la derecha; si una historia avanza sola, páusala para leerla).
- De cada punto de venta anota: nombre de la tienda, ciudad, provincia, dirección, teléfono o WhatsApp, horario, @ de Instagram de la tienda y qué marcas o líneas vende si lo dice.
- Si una historia tiene un sticker de ubicación o un link, ábrelo para leer la dirección completa y vuelve.
- Copia los datos EXACTOS como aparecen. Si un dato no aparece, deja la celda vacía. No inventes nada ni completes con suposiciones.

TAREA 2 — Líneas de producto (catálogo)
- En @uniball_ecuador (y en @mokalu_ec si tiene), abre "Ver tienda" / catálogo / la pestaña de productos, y los destacados de productos si existen.
- Anota cada línea o familia de producto uni que aparezca (ej. POSCA, Unipin, Emott, Signo, Jetstream, Kuru Toga, Eye, Zento, Shalaku, Unipaint…), con los modelos o puntas que se mencionen y una frase de para qué sirve si la publicación lo dice.

TAREA 3 — Datos de contacto de Mokalú
- En @mokalu_ec: texto completo de la biografía, link de la biografía, número del botón de WhatsApp o "Contactar" (si hay botón, ábrelo y copia el número sin escribir ningún mensaje), dirección y días y horario de atención si aparecen en la biografía o en algún destacado.
- Lo mismo para @uniball_ecuador.

FORMATO DE RESPUESTA (exactamente así, sin texto extra antes)

### PUNTOS DE VENTA (CSV)
nombre,ciudad,provincia,direccion,whatsapp,telefono,horario,instagram,marcas,fuente
(una fila por tienda; en "fuente" pon la cuenta y el destacado, ej. "@uniball_ecuador · destacado Puntos de venta · historia 3"; si un campo tiene comas, ponlo entre comillas)

### LÍNEAS DE PRODUCTO
- Línea — modelos/puntas — para qué sirve (fuente)

### CONTACTO
- @mokalu_ec — bio: … | link: … | WhatsApp: … | dirección: … | días y horario: …
- @uniball_ecuador — bio: … | link: … | WhatsApp: … | otros datos: …

### NO PUDE LEER
- Lista de historias o datos que no se veían bien (borrosos, vencidos, en video sin texto), para revisarlos a mano.

Al terminar, revisa que no falte ninguna historia del destacado de puntos de venta y di cuántas tiendas encontraste en total.
```
