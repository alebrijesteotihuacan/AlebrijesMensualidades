# Mensualidad Alebrijes Teotihuacán — TODO List

> **Stack**: Vanilla JS + ES Modules + Tailwind CSS (CDN) + Firebase Firestore
> **Deploy**: GitHub Pages (Actions)
> **Repo**: https://github.com/alebrijesteotihuacan/AlebrijesMensualidad.git

---

## 📁 Fase 0 — Setup del proyecto
- [ ] Mover `DatosDeTransferencia_Mensualidad.png` → `assets/clabe.png`
- [ ] Mover `03_TEOTIHUACAN_-_Fuerzas_Basicas.png` → `assets/logo.png`
- [ ] Crear estructura de carpetas (`js/views`, `js/services`, `js/utils`, `tools`)
- [ ] Crear `index.html` con Tailwind CDN + viewport responsive
- [ ] Crear `js/firebase-config.js` con credenciales

## 🔥 Fase 1 — Firebase
- [ ] Reglas Firestore: `allow read, write: if true`
- [ ] Documentar setup en README

## 🗄️ Fase 2 — Modelo de datos
- [ ] Esquema `players/{id}`: `name, category, phone, notes, paymentDay (1|15), createdAt`
- [ ] Esquema `payments/{id}`: `playerId, year, quincena (1|2), amount, status (paid|pending), paidDate, createdAt`
- [ ] Esquema `categories/{id}`: `name, amount`
- [ ] `tools/seed.js`: 5 categorías + 10 jugadores + pagos de ejemplo

## ⚙️ Fase 3 — Servicios (módulos ES)
- [ ] `utils/dates.js`: `getCurrentQuincena()`, `daysMora(player, today)`, `formatMXN()`
- [ ] `services/firestore.js`: `getAll/add/update/remove/subscribe`
- [ ] `services/mora.js`: clasificador `recordatorio|1d|3d|5d+`
- [ ] `services/messages.js`: 4 plantillas con `render(player, payment, mora)`
- [ ] `services/export.js`: `toCSV(data, filename)`, `toPDF(data, filename, title)`

## 🎨 Fase 4 — UI Shell
- [ ] Header con logo + título
- [ ] Nav con 3 items + hamburguesa en móvil
- [ ] Hash router (`#/dashboard`, `#/players`, `#/payments`)
- [ ] Toast/snackbar para feedback
- [ ] Modal genérico (crear/editar jugador)

## 👥 Fase 5 — Módulo Jugadores
- [ ] Grid responsivo de tarjetas
- [ ] Crear jugador (modal)
- [ ] Editar jugador (modal precargado)
- [ ] Eliminar con confirmación
- [ ] Filtro por categoría
- [ ] Búsqueda por texto
- [ ] Badge visual de días de mora

## 💰 Fase 6 — Módulo Pagos
- [ ] Listado en tabla responsiva
- [ ] Filtros: jugador, año, quincena, status
- [ ] Marcar pagado (fecha = hoy)
- [ ] Crear/editar/eliminar pago manual
- [ ] Preview de mensaje según días de mora
- [ ] Copiar mensaje al portapapeles
- [ ] Ver CLABE desde acción de pago

## 📊 Fase 7 — Dashboard KPIs
- [ ] Total jugadores
- [ ] Jugadores por categoría
- [ ] Pagados período actual
- [ ] Pendientes período actual
- [ ] Morosos
- [ ] Q1 (1-15) pagados/pendientes
- [ ] Q2 (16-31) pagados/pendientes
- [ ] Total $ pendiente
- [ ] Total $ recaudado

## 🏦 Fase 8 — Datos de pago
- [ ] Sección fija con `assets/clabe.png`
- [ ] Banco/Titular/CLABE/Concepto en texto

## 📤 Fase 9 — Exportación
- [ ] Exportar jugadores → CSV
- [ ] Exportar pagos → CSV
- [ ] Exportar jugadores → PDF (jsPDF + AutoTable)
- [ ] Exportar pagos → PDF (jsPDF + AutoTable)

## ✨ Fase 10 — Pulido
- [ ] Pruebas móvil + escritorio
- [ ] Validar rendimiento con 50 jugadores
- [ ] Accesibilidad básica
- [ ] README con instrucciones
- [ ] Verificar Pages desplegado

---

## 📌 Reglas de negocio clave

### Mora
- `paymentDay = 1` → mora desde día 2 (sin gracia)
- `paymentDay = 15` → mora desde día 16 (sin gracia)
- `mora = 0` → Recordatorio
- `mora = 1-2` → Mensaje "Mora 1 día"
- `mora = 3-4` → Mensaje "Mora 3 días"
- `mora ≥ 5` → Mensaje "Ya no podrá entrenar"

### Categorías y montos
| Categoría | Monto |
|---|---|
| Alebrijes Teotihuacan (TDP) | $1,200 MXN |
| Soles Teotihuacan (TDP) | $1,200 MXN |
| Sub-18 | $750 MXN |
| Sub-16 | $750 MXN |
| Sub-14 | $750 MXN |
