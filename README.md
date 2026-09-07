# Alebrijes Teotihuacán — Mensualidades

> Sistema personal de gestión de jugadores y mensualidades para la escuela de fútbol Alebrijes Teotihuacán.
> Construido en **Vanilla JS + Tailwind CSS + Firebase Firestore**, desplegado en **GitHub Pages**.

🔗 **Demo en vivo**: [alebrijesteotihuacan.github.io/AlebrijesMensualidad](https://alebrijesteotihuacan.github.io/AlebrijesMensualidad/)

---

## ✨ Características

- 👥 **Jugadores**: alta, edición, eliminación y búsqueda por texto/categoría.
- 💰 **Pagos quincenales** (Q1: 1–15, Q2: 16–31).
- 📊 **Dashboard** con 9 KPIs en tiempo real.
- 📨 **Mensajes escalonados**: recordatorio → mora 1d → mora 3d → "ya no podrá entrenar" (5d+).
- 🏦 **Datos de transferencia** (CLABE Banorte) con botón "copiar".
- 📤 **Exportación** a CSV y PDF (jsPDF + AutoTable).
- 📱 **Responsive** (móvil y escritorio, sin sidebar).
- ⚡ **Tiempo real** (suscripciones Firestore).

---

## 🧰 Stack

| Capa | Tecnología |
|---|---|
| UI | HTML + Tailwind CSS (CDN) |
| JS | Vanilla ES Modules (sin build step) |
| DB | Firebase Firestore (sin Auth ni Storage) |
| PDF | jsPDF + jsPDF-AutoTable |
| Hosting | GitHub Pages |

---

## 🚀 Setup local

1. Clona el repo:
   ```bash
   git clone https://github.com/alebrijesteotihuacan/AlebrijesMensualidad.git
   cd AlebrijesMensualidad
   ```

2. Sirve los archivos con cualquier static server, por ejemplo:
   ```bash
   # Opción 1: Python
   python -m http.server 8080

   # Opción 2: Node (npx)
   npx serve .
   ```

3. Abre `http://localhost:8080` en el navegador.

> ⚠️ Firebase usa ES modules servidos por CDN, por lo que **debes abrir la app desde un servidor** (no `file://`).

---

## 🔥 Configuración de Firebase

### 1. Crear proyecto (ya hecho)
- **Proyecto**: `alebrijesmensualidad`
- **App web** ya registrada.
- Credenciales en `js/firebase-config.js`.

### 2. Reglas de Firestore (abiertas, sin auth)
En la consola de Firebase → Firestore → Rules, pega:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

> ⚠️ **Solo para uso personal.** En producción, añade Auth + reglas restrictivas.

### 3. Poblar la base con datos de ejemplo
Una vez desplegada la app:

1. Abre la página → espera a que cargue.
2. Abre la **consola del navegador** (F12).
3. Ejecuta:
   ```js
   await import('./tools/seed.js');
   await seedDemo();
   ```
4. Recarga la página. Verás 5 categorías, 10 jugadores y 20 pagos de ejemplo.

Para limpiar TODO (⚠️ irreversible):
```js
await import('./tools/seed.js');
await resetAll();
```

---

## 📁 Estructura del proyecto

```
.
├── index.html                # Shell + router hash
├── assets/
│   ├── clabe.png            # Datos de transferencia
│   └── logo.png             # Logo del club
├── css/
│   └── styles.css           # Tailwind components custom
├── js/
│   ├── app.js               # Entry: router, state, toast, modal
│   ├── firebase-config.js   # Inicializa Firestore
│   ├── services/
│   │   ├── firestore.js     # CRUD genérico
│   │   ├── mora.js          # Clasificador de mora
│   │   ├── messages.js      # Plantillas de mensajes
│   │   └── export.js        # CSV + PDF
│   ├── utils/
│   │   └── dates.js         # Quincenas, días de mora, formatMXN
│   └── views/
│       ├── dashboard.js
│       ├── players.js
│       └── payments.js
├── tools/
│   └── seed.js              # Script de seed (categorías/jugadores/pagos)
└── todolist.md              # Plan de implementación
```

---

## 🗄️ Modelo de datos (Firestore)

### `categories/{id}`
```js
{ name: string, amount: number, createdAt, updatedAt }
```

### `players/{id}`
```js
{
  name: string,
  category: string,         // nombre exacto de una categoría
  phone: string,
  notes: string,
  paymentDay: 1 | 15,       // día de pago del jugador
  createdAt, updatedAt
}
```

### `payments/{id}`
```js
{
  playerId: string,
  year: number,
  quincena: 1 | 2,
  amount: number,
  status: 'paid' | 'pending',
  paidDate: string | null,  // YYYY-MM-DD
  createdAt, updatedAt
}
```

---

## 📅 Reglas de negocio (mora)

- Cada jugador tiene `paymentDay = 1` ó `15`.
- **Sin días de gracia**: si hoy es día 2 (con paymentDay=1), mora = 1.
- Mensajes según días de mora:
  - `mora = 0` → **Recordatorio**
  - `mora = 1-2` → **Mora 1 día**
  - `mora = 3-4` → **Mora 3 días**
  - `mora ≥ 5` → **Ya no podrá entrenar**

Los mensajes se renderizan dinámicamente desde `js/services/messages.js` (4 plantillas con placeholders `{nombre}`, `{monto}`, `{diasAtraso}`).

---

## 🌍 Deploy en GitHub Pages

El repositorio ya tiene configurado GitHub Pages con GitHub Actions.

**Para redeployar**:
```bash
git add -A
git commit -m "feat: ..."
git push origin master
```

El workflow `.github/workflows/` se encarga de publicar automáticamente.

---

## 📜 Scripts útiles

No hay build step. Todo se ejecuta en el navegador.

| Acción | Comando |
|---|---|
| Levantar servidor local | `python -m http.server 8080` |
| Cargar seed (en consola) | `await import('./tools/seed.js'); await seedDemo()` |
| Reset completo (⚠️) | `await import('./tools/seed.js'); await resetAll()` |

---

## 📝 Licencia

Uso personal. © Profesor Haziel Macias.
