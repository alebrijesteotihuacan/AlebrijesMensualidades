import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, Timestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDpZSUeqyUrphkkd5-uExrfPCW8hOXjAng",
  authDomain: "alebrijesmensualidad.firebaseapp.com",
  projectId: "alebrijesmensualidad",
  storageBucket: "alebrijesmensualidad.firebasestorage.app",
  messagingSenderId: "723479445855",
  appId: "1:723479445855:web:462258fa9615f228c736ea"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const players = [
  { name: 'Juan Pérez López', category: 'Alebrijes Teotihuacan', phone: '5551234567', notes: 'Portero titular' },
  { name: 'Carlos Martínez Ruiz', category: 'Alebrijes Teotihuacan', phone: '5552345678', notes: 'Defensa central' },
  { name: 'Miguel Ángel Torres', category: 'Soles Teotihuacan', phone: '5553456789', notes: 'Mediocampista' },
  { name: 'Roberto Hernández García', category: 'Soles Teotihuacan', phone: '5554567890', notes: 'Delantero' },
  { name: 'Diego López Sánchez', category: 'Sub-18', phone: '5555678901', notes: '' },
  { name: 'Andrés Ramírez Flores', category: 'Sub-18', phone: '5556789012', notes: 'Capitán del equipo' },
  { name: 'Luis Fernando Morales', category: 'Sub-16', phone: '5557890123', notes: '' },
  { name: 'José Eduardo Díaz', category: 'Sub-16', phone: '5558901234', notes: 'Nuevo ingreso' },
  { name: 'Santiago Cruz Mendoza', category: 'Sub-14', phone: '5559012345', notes: '' },
  { name: 'Emiliano Vargas Ríos', category: 'Sub-14', phone: '5550123456', notes: 'Lesión de rodilla' },
];

const CATEGORY_AMOUNTS = {
  'Alebrijes Teotihuacan': 1200,
  'Soles Teotihuacan': 1200,
  'Sub-18': 750,
  'Sub-16': 750,
  'Sub-14': 750,
};

async function setup() {
  console.log('Configurando base de datos...\n');

  console.log('Creando jugadores...');
  const playerIds = [];

  for (const player of players) {
    const docRef = doc(collection(db, 'players'));
    await setDoc(docRef, {
      ...player,
      createdAt: Timestamp.now(),
    });
    playerIds.push({ id: docRef.id, ...player });
    console.log(`  ✓ ${player.name} (${player.category})`);
  }

  console.log('\nCreando pagos del período actual...');
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const currentDay = now.getDate();
  const currentPeriod = currentDay <= 15 ? '1-15' : '16-31';

  for (const player of playerIds) {
    const docRef = doc(collection(db, 'payments'));
    await setDoc(docRef, {
      playerId: player.id,
      playerName: player.name,
      category: player.category,
      period: currentPeriod,
      month: currentMonth,
      year: currentYear,
      amount: CATEGORY_AMOUNTS[player.category as keyof typeof CATEGORY_AMOUNTS],
      status: 'pendiente',
      paidDate: null,
      createdAt: Timestamp.now(),
    });
    console.log(`  ✓ Pago pendiente para ${player.name}`);
  }

  console.log('\n¡Configuración completada!');
  console.log(`\nResumen:`);
  console.log(`  - ${players.length} jugadores creados`);
  console.log(`  - ${players.length} pagos del período ${currentPeriod}/${currentMonth}/${currentYear} creados`);
  console.log(`\nCategorías:`);
  console.log(`  - Alebrijes Teotihuacan (TDP): $1,200 MXN`);
  console.log(`  - Soles Teotihuacan (TDP): $1,200 MXN`);
  console.log(`  - Sub-18: $750 MXN`);
  console.log(`  - Sub-16: $750 MXN`);
  console.log(`  - Sub-14: $750 MXN`);
}

setup().catch(console.error);
