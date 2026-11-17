# Morena Mía — sistema de diseño del panel de administración

Dirección: **admin de comercio** (referencia: Shopify Admin / Polaris), paleta **«carbón y azul»**.
El panel es una herramienta de trabajo: se juzga por lo rápido que se encuentra, se lee y se actúa, no por su decoración.

## Estructura
- **Barra superior** oscura (`#1A1A1A`, 56 px): logo, búsqueda global (Ctrl/⌘K), «Necesita atención» y menú de cuenta (tema, cerrar sesión).
- **Barra lateral** gris clara (240 px): elementos de 32 px; el activo en blanco y negrita; contadores grises; Ajustes fijo abajo.
  En celular: barra inferior con 4 secciones + «Más».
- **Contenido** sobre fondo `#F1F1F1`, máximo 1200 px. **Todo el contenido vive en tarjetas**; nada de párrafos sueltos sobre el gris.

## Patrones de página
| Tipo | Uso | Composición |
|---|---|---|
| Inicio | Resumen | Tarjeta de métricas en fila + cuadrícula de tarjetas con título |
| Índice | Pedidos, Menú, Extras, Inventario, Equipo, Ubicaciones, Reservas | `PageHeader` (título + 1 botón principal) → una tarjeta `DataTable` con `toolbar` (pestañas + búsqueda + filtros dentro de la tarjeta) |
| Configuración | Ajustes | Columna izquierda con título y descripción; derecha, tarjeta con el formulario; barra contextual de guardar |
| Detalle / formulario | Diálogos | `MenuModal`: encabezado gris, cuerpo, pie con acciones a la derecha |

## Reglas
- **Un solo botón principal (carbón) por zona.** Las acciones de tabla son siempre secundarias (botón secundario, icono o menú ⋯).
- **Estados = insignias** (`Badge`/`Status`): fondo suave + texto oscuro del mismo tono. Verde = hecho/activo; ámbar = pendiente/atención; azul = en curso/información; rojo = problema/destructivo; gris = inactivo/archivado. El rojo solo para errores y acciones destructivas.
- **Azul** (`interactive`) solo para enlaces, foco, selección y gráficos. Nada de dorado ni degradados.
- **Tipografía del sistema**, 13 px de cuerpo; títulos de página 20 px; títulos de tarjeta 14 px; cifras con números tabulares.
- Rejilla de **4 px**; radios 8 (controles) y 12 (tarjetas).
- Copia en español, concreta; sin cejas en mayúsculas ni frases de relleno.

## Movimiento
Discreto y funcional: presión de botones (escala 0,98 en 90 ms), aparición de sección (160 ms), indicador de pestañas que se desliza (160 ms),
filas nuevas que destellan en azul y se apagan (1,4 s), diálogos que entran en 180 ms y salen en 120 ms (hoja inferior en celular), temblor ante errores.
Las animaciones se muestran siempre, aunque el sistema tenga activado «reducir movimiento» (decisión del producto).

## Kit (`src/components/admin/ui.js`)
`PageHeader`, `Card` (title/actions/footer), `CardHeader`, `CardSection`, `Button` (primary · secondary · tertiary · plain · danger),
`IconButton`, `ActionMenu`, `Badge`/`Status`, `Banner`, `Tabs`/`Segmented` (pastillas), `SearchField`, `Field`/`Input`, `Checkbox`, `Switch`,
`DataTable` (orden por columna, `toolbar`, `selectable` + `bulkActions`, paginación), `Metric`, `Avatar`, `EmptyState`, `Skeleton`, `useToast`.
Formularios y diálogos: `src/components/MenuUI.js`.

---

# Caja (punto de cobro) — dirección «Comprobante»

La caja tiene identidad propia, distinta del admin y del mesero: **cada cuenta se lee como el comprobante que va a emitirse**.
Kit: `src/components/cashier/kit.js` · diálogos: `src/components/cashier/dialogs.js` · pantallas: `src/modules/CashierWorkspace.js`, `CashierPayments.js`.

## Mundo
- **Papel blanco** `#FFFFFF` (paneles), fondo `#ECEDEF`, segundo neutro `#F6F7F8` (panel de cobro, cabeceras de tabla).
- **Tinta** `#16171A`: barra superior, texto, botón principal y selección (fila elegida en tinta con texto blanco).
- **Rojo de numeración** `#D63B20`: *solo* para números de comprobante. Nunca en botones ni decoración.
- Reglas finas `#CDD0D5` (retículas) y `#E3E4E8` (separadores). Radios pequeños: 4 / 6 / 8.
- Estados: verde `#15703F` = cobrado y cambio; ámbar `#8F5300` = cuenta pedida, faltante y avisos; rojo `#B3261E` = error, anulación y faltante en arqueo.
- Oscuro: grafito `#0C0D0F` / `#16171A`, rojo de numeración `#FF7A5C`.
- Letra **Archivo** (Google Fonts en web) con cifras tabulares en todo número.

## Firma
`Serial`: el número de comprobante con prefijo gris, **ceros a la izquierda tenues y dígitos significativos en rojo** (`TCK-000000012`).
Aparece como «Próximo número» en la cuenta abierta, en los abonos y en el libro de comprobantes; anulado o devuelto va en gris.

## Piezas
- **Celdas rayadas** (`Cells`/`Cell`/`CellInput`): etiqueta pequeña sobre el dato, como el bloque de cliente de una factura.
- **Caja de totales** (`TotalRow`) alineada a la derecha; la fila fuerte (Total, Saldo) con fondo gris y cifra grande.
- **Tablas** con regla superior en tinta de 1 px, cabecera de etiquetas y filas separadas por línea fina.
- **Teclado numérico** (`Keypad`) en retícula; los montos se muestran en «visores» que se tocan para elegir a dónde escribe el teclado.
- `Seg` (segmentado, lo activo en tinta), `Btn` (ink · outline · ghost · danger · dangerSolid · paid), `Kbd` (atajo visible solo en web), `Badge`, `Dialog` (centrado en ancho, hoja inferior en celular), `Empty`, `Skel`.

## Composición
- ≥ 1024 px: tres columnas — cuentas (290–340) · comprobante en curso · panel de cobro (340–380) con pie fijo «Cobrar».
- 760–1023 px: cuentas + columna con comprobante y cobro apilados, barra fija de cobro abajo.
- < 760 px: lista → detalle con barra fija de cobro; barra inferior en tinta con 4 secciones.
- Atajos: F2 buscar · F3 venta directa · F8 cobrar · F9 precuenta · Esc soltar la cuenta · números, coma y retroceso al teclado de cobro · Enter cobra.

## Movimiento
Presión 0,98 en 100 ms; diálogos entran en 200 ms (desplazamiento corto y opacidad). Nada decorativo.
