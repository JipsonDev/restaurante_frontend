# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
- Dueño/a o gerente de Morena Mía: revisa ventas, menú, equipo y caja fuera del servicio.
- Administrador en el local: usa el mismo panel durante el servicio para pedidos, mesas y caja en vivo.
Ambos usos pesan igual. El panel se abre en computadora, tablet (mostrador/caja) y celular.

## Product Purpose
Morena Mía POS centraliza la operación de un restaurante y cafetería en Chone, Manabí (Ecuador): mesas, pedidos, cocina, caja, menú, inventario y equipo, sincronizados en tiempo real entre sala, cocina y caja. El panel de administración es donde se supervisa el negocio y se configura todo lo demás.

## Operating Context
- Módulos por rol: admin (este panel), mesero (móvil), cocina (tablet KDS), caja/supervisor (punto de cobro).
- Datos vivos por Socket.IO: pedidos, mesas, pagos y caja cambian mientras el admin mira.
- Moneda en dólares (USD); IVA y porcentaje de servicio configurables.

## Capabilities and Constraints
- Stack: Expo 56 + React Native + react-native-web (se publica como PWA en Vercel), backend Express + MySQL en Render.
- Secciones del admin, todas importantes: Resumen, Reportes, Pedidos, Caja, Mesas, Menú, Extras, Inventario, Ubicaciones, Equipo, Auditoría, Ajustes.
- Debe funcionar igual con ratón/teclado y con dedo (tablet y celular).
- Tema claro y oscuro.

## Brand Commitments
- Nombre: Morena Mía, "Restaurante & Cafetería"; logotipo caligráfico existente (assets/logo-wide.png).
- Paleta elegida por el dueño para la marca: azul noche y dorado (la del inicio de sesión).
- Tipografía ya en uso: Manrope.

## Evidence on Hand
- Datos de demostración en la base local (pedidos, mesas, trabajadores, auditoría). No inventar métricas reales del negocio.

## Product Principles
1. La operación en vivo primero: lo que necesita atención ahora se ve sin buscarlo.
2. Lo mismo se ve igual en todas las secciones: un solo vocabulario de botones, tablas, estados y formularios.
3. Cada número de dinero es exacto y comparable de un vistazo.
4. Rápido con el dedo y con el ratón: objetivos táctiles amplios, atajos para quien usa teclado.

## Accessibility & Inclusion
WCAG 2.1 AA: contraste de texto ≥ 4.5:1, estados que no dependan solo del color, foco visible y respeto a "reducir movimiento".
