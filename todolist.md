# Todolist - Panel de Control Alebrijes Teotihuacán

## Resumen del Proyecto
Panel de control para administrar pagos y mensualidades de los jugadores locales de Alebrijes de Oaxaca Teotihuacán.

## Stack Tecnológico
- **Frontend**: React + Vite + TypeScript
- **Estilos**: Tailwind CSS + shadcn/ui
- **Base de Datos**: Firebase (Firestore)
- **Exportación**: jsPDF + xlsx

---

## Fase 1: Configuración del Proyecto
- [ ] 1. Inicializar proyecto React + Vite + TypeScript
- [ ] 2. Instalar y configurar Tailwind CSS
- [ ] 3. Instalar y configurar shadcn/ui
- [ ] 4. Configurar Firebase (configuración inicial)
- [ ] 5. Crear estructura de carpetas

## Fase 2: Tipos y Servicios
- [ ] 6. Definir tipos TypeScript (Player, Payment, KPI)
- [ ] 7. Crear servicio de Firebase (CRUD players)
- [ ] 8. Crear servicio de Firebase (CRUD payments)
- [ ] 9. Crear hooks personalizados (usePlayers, usePayments)

## Fase 3: Layout y Navegación
- [ ] 10. Crear componente Header
- [ ] 11. Crear componente Sidebar
- [ ] 12. Crear componente Layout principal
- [ ] 13. Configurar React Router (Dashboard, Jugadores, Pagos, Links)

## Fase 4: Dashboard y KPIs
- [ ] 14. Crear componente KPICards (todos los KPIs requeridos)
- [ ] 15. Crear hook useKPIs para cálculos
- [ ] 16. Crear componente PaymentsChart (opcional)
- [ ] 17. Crear componente RecentPayments

## Fase 5: Gestión de Jugadores
- [ ] 18. Crear componente PlayerCard (tarjeta de perfil)
- [ ] 19. Crear componente PlayerGrid (vista grid)
- [ ] 20. Crear componente PlayerForm (agregar/editar)
- [ ] 21. Crear componente PlayerFilters (filtros avanzados)
- [ ] 22. Implementar eliminación de jugadores

## Fase 6: Gestión de Pagos
- [ ] 23. Crear componente PaymentForm (registrar pago)
- [ ] 24. Crear componente PaymentHistory (historial)
- [ ] 25. Implementar cambio de estados (pagado/pendiente/moroso)
- [ ] 26. Crear lógica de cálculo de morosidad automática

## Fase 7: Links de Pago
- [ ] 27. Crear componente PaymentLink (almacén de links)
- [ ] 28. Implementar copia de mensaje al portapapeles
- [ ] 29. Mostrar imagen CLABE

## Fase 8: Funciones Adicionales
- [ ] 30. Implementar exportación a PDF
- [ ] 31. Implementar exportación a Excel/CSV
- [ ] 32. Crear función de filtrado general

## Fase 9: Datos Iniciales
- [ ] 33. Crear script o función para cargar jugadores iniciales
- [ ] 34. Configurar montos por categoría
- [ ] 35. Probar flujos completos

## Fase 10: Ajustes Finales
- [ ] 36. Diseño responsive (móvil)
- [ ] 37. Pruebas generales
- [ ] 38. Documentación básica

---

## Información del Negocio

### Categorías y Montos
| Categoría | Tipo | Monto |
|-----------|------|-------|
| Alebrijes Teotihuacan | TDP | $1,200 MXN |
| Soles Teotihuacan | TDP | $1,200 MXN |
| Sub-18 | Fuerzas Básicas | $750 MXN |
| Sub-16 | Fuerzas Básicas | $750 MXN |
| Sub-14 | Fuerzas Básicas | $750 MXN |

### Período de Pago
- **Tipo**: Quincenal
- **Fechas de corte**: Día 1 y día 15 de cada mes
- **Días de gracia**: Ninguno

### Estados de Pago
| Estado | Descripción |
|--------|-------------|
| Pagado | El jugador pagó su mensualidad |
| Pendiente | Aún no vence la fecha de pago |
| Moroso | Pasó la fecha límite sin pagar |

### KPIs Requeridos
1. Total de Jugadores
2. Jugadores TDP (Alebrijes + Soles)
3. Jugadores Sub-18
4. Jugadores Sub-16
5. Jugadores Sub-14
6. Pagados (período actual)
7. Pendientes (período actual)
8. Morosos
9. Corte del 15 (pagados/pendientes)
10. Corte del 30 (pagados/pendientes)
11. Total Pendiente ($)
12. Total Recaudado ($)

### Datos del Jugador
- Nombre Completo
- Categoría
- Número de Teléfono
- Notas

### Funcionalidades
- CRUD completo de jugadores
- CRUD completo de pagos
- Dashboard con KPIs
- Tarjetas de perfil (vista grid)
- Filtros avanzados (categoría, estado, fecha)
- Exportar datos (PDF/Excel)
- Almacén de links de pago (imagen CLABE + mensaje)
