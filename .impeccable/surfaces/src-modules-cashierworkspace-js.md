---
version: 1
slug: "src-modules-cashierworkspace-js"
primary_target: "src/modules/CashierWorkspace.js"
related_targets: ["src/modules/CashierPayments.js","src/modules/CashierApp.js"]
---

# Caja (punto de cobro)

Modo: Operate. Usuarios: cajera o administrador en el mostrador, con computadora (teclado y ratón) o tablet táctil, a plena luz del local. Tarea: cobrar cuentas de mesa, para llevar y delivery (total, por partes, mixto, ticket o factura con cédula/RUC), vender directo, revisar y anular comprobantes, y abrir y cerrar el turno con arqueo. Debe quedar intacto todo el flujo de cobro actual (idempotencia, cobro pendiente, permisos y autorizaciones).

## Direction contract

THESIS: La caja es un talonario de comprobantes vivo: cada cuenta se lee como la factura que va a emitirse, con su número en tinta roja. Rechaza el tablero SaaS de tarjetas y métricas.
OWN-WORLD: Papel blanco puro, tinta negra #16171A en barra y textos, rojo de numeración #D63B20 solo para números de comprobante, regla fina gris. Bloques con celdas rayadas (etiqueta pequeña sobre el dato) y caja de totales alineada a la derecha. Archivo con cifras tabulares. Verde = cobrado/cambio, ámbar = cuenta pedida.
STORY: La cajera ve qué mesa pidió la cuenta, la abre, comprueba el detalle y el número que saldrá, teclea el efectivo, ve el cambio y cobra.
FIRST VIEWPORT: Barra negra (logo, Cobrar · Venta directa · Comprobantes · Turno, estado del turno, conexión, usuario). Tres columnas: cuentas abiertas con búsqueda (F2) y filtros; el comprobante en curso al centro; el panel de cobro con saldo, métodos, teclado numérico, cambio y «Cobrar» (F8).
FORM: Comprobante SRI, candidato 2 de 7 (elegido por el usuario sobre el asignado 3). seed:95ea819f734c8115. Firma: número de comprobante con ceros a la izquierda tenues y dígitos en rojo, en el documento y en el libro de comprobantes.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
