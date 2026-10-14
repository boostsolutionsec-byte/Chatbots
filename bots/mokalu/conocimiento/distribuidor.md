# Quién es Mokalú

- **Mokalú** es el **distribuidor en Ecuador** de los productos **uni** (Mitsubishi Pencil Co., Japón): POSCA, PIN,
  uni-ball Signo, Jetstream, Kuru Toga. (Confirmado por el dueño; qué líneas exactas: <!-- POR CONFIRMAR -->)
- Además es **tienda de arte** en Guayaquil: **C.C. Laguna Plaza, km 12,5 vía a la costa**. <!-- POR CONFIRMAR local -->
- Instagram: **@mokalu_ec**. Web: **mokalu.com.ec** (tienda online en `/tienda/`).
- Publica **envíos a nivel nacional**. <!-- POR CONFIRMAR -->
- Horario publicado: 10h00–18h00. <!-- POR CONFIRMAR días -->
- No confundir con `@mokalu.oficial` (otra cuenta, artista en Chile).

## Cómo funciona la red de puntos de venta
- Mokalú vende a papelerías y tiendas de arte de todo el país; el cliente final compra en esos puntos de venta.
- La lista de puntos de venta está en `tiendas.csv`. **Esta noche es una lista EJEMPLO** (ver `docs/DATOS-INVENTADOS.md`).
- Si en la ciudad del cliente no hay tienda, se recomienda la más cercana por distancia y, si está lejos, la tienda online.

## A quién derivar

| Caso | Destino (bot.yaml) | Variable de entorno |
|---|---|---|
| Quiere ser punto de venta / distribuidor / revender | `distribuidores` | `WHATSAPP_DISTRIBUIDORES` |
| Mayorista, colegio, empresa, proforma | `distribuidores` | `WHATSAPP_DISTRIBUIDORES` |
| Reclamo, garantía, producto defectuoso, molestia | `reclamos` | `WHATSAPP_RECLAMOS` |
| Pide una persona / el bot no sabe | `asesor_ventas` | `WHATSAPP_ASESOR_VENTAS` |

Los números reales los pone el dueño como variables de entorno; **nunca** van en el repo.
