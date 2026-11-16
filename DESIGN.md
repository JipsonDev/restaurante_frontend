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
Todo se desactiva con «reducir movimiento».

## Kit (`src/components/admin/ui.js`)
`PageHeader`, `Card` (title/actions/footer), `CardHeader`, `CardSection`, `Button` (primary · secondary · tertiary · plain · danger),
`IconButton`, `ActionMenu`, `Badge`/`Status`, `Banner`, `Tabs`/`Segmented` (pastillas), `SearchField`, `Field`/`Input`, `Checkbox`, `Switch`,
`DataTable` (orden por columna, `toolbar`, `selectable` + `bulkActions`, paginación), `Metric`, `Avatar`, `EmptyState`, `Skeleton`, `useToast`.
Formularios y diálogos: `src/components/MenuUI.js`.
