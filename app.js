// CONFIGURACIÓN DE FIREBASE (Reemplaza con tus llaves copiadas de la consola)
  const firebaseConfig = {
    apiKey: "AIzaSyB0T2RY--VY_Fvs2e7kCWNvdeBX8ozHxtc",
    authDomain: "agenda-sgd.firebaseapp.com",
    projectId: "agenda-sgd",
    storageBucket: "agenda-sgd.firebasestorage.app",
    messagingSenderId: "768664840437",
    appId: "1:768664840437:web:34295f2d604aaabd42fdbc",
    measurementId: "G-RVG1691LDG"
  };

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// DÍAS Y BLOQUES DE LA SEMANA OBJETIVO
const daysList = [
  { name: "Lunes 05 Oct", date: "2026-10-05" },
  { name: "Martes 06 Oct", date: "2026-10-06" },
  { name: "Miércoles 07 Oct", date: "2026-10-07" },
  { name: "Jueves 08 Oct", date: "2026-10-08" },
  { name: "Viernes 09 Oct", date: "2026-10-09" }
];

const timeSlots = [
  "08:00 am - 10:00 am",
  "10:00 am - 12:00 pm",
  "02:00 pm - 04:00 pm",
  "04:00 pm - 06:00 pm"
];

let selectedSlotData = null;

// ==========================================
// VISTA PÚBLICA (INDEX.HTML)
// ==========================================
if (document.getElementById('weeklyGrid')) {
  // Escuchar la base de datos en TIEMPO REAL
  db.collection("appointments").onSnapshot((snapshot) => {
    const bookedMap = {};
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.status !== 'cancelled') {
        const key = `${data.date}_${data.time}`;
        bookedMap[key] = data;
      }
    });
    renderGrid(bookedMap);
  });

  function renderGrid(bookedMap) {
    const gridContainer = document.getElementById('weeklyGrid');
    gridContainer.innerHTML = '';

    daysList.forEach(day => {
      const col = document.createElement('div');
      col.className = 'day-column';
      col.innerHTML = `<div class="day-header">${day.name}</div>`;

      timeSlots.forEach(time => {
        const key = `${day.date}_${time}`;
        const slotEl = document.createElement('div');
        const booking = bookedMap[key];

        if (booking) {
          slotEl.className = 'time-slot occupied';
          slotEl.innerHTML = `
            <span class="slot-time">${time}</span>
            <span class="slot-owner">Ocupado - ${booking.area}</span>
          `;
        } else {
          const isSelected = selectedSlotData && selectedSlotData.date === day.date && selectedSlotData.time === time;
          slotEl.className = `time-slot available ${isSelected ? 'selected' : ''}`;
          slotEl.innerHTML = `
            <span class="slot-time">${time}</span>
            <span class="slot-owner">Disponible</span>
          `;
          slotEl.onclick = () => selectSlot(day.date, day.name, time);
        }

        col.appendChild(slotEl);
      });

      gridContainer.appendChild(col);
    });
  }

  function selectSlot(date, dayName, time) {
    selectedSlotData = { date, time, dayName };
    document.getElementById('selectedDate').value = date;
    document.getElementById('selectedTime').value = time;
    
    document.getElementById('slotInfo').innerHTML = `
      <strong>Selección actual:</strong> ${dayName} de <strong>${time}</strong>
    `;
    document.getElementById('btnSubmit').disabled = false;
    
    // Forzar renderizado para marcar la casilla seleccionada en azul
    db.collection("appointments").get().then((snapshot) => {
      const bookedMap = {};
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.status !== 'cancelled') {
          bookedMap[`${data.date}_${data.time}`] = data;
        }
      });
      renderGrid(bookedMap);
    });
  }

  // Guardar formulario
  document.getElementById('bookingForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!selectedSlotData) return;

    const btn = document.getElementById('btnSubmit');
    btn.disabled = true;
    btn.innerText = "Guardando...";

    const docId = `${selectedSlotData.date}_${selectedSlotData.time}`;

    try {
      // Verificar en Firebase que el horario no haya sido tomado en el último segundo
      const docRef = db.collection("appointments").doc(docId);
      const docSnap = await docRef.get();

      if (docSnap.exists && docSnap.data().status !== 'cancelled') {
        alert("Lo sentimos, este horario acaba de ser reservado por otro líder.");
        selectedSlotData = null;
        document.getElementById('btnSubmit').innerText = "Confirmar Agendamiento";
        return;
      }

      await docRef.set({
        date: selectedSlotData.date,
        dayName: selectedSlotData.dayName,
        time: selectedSlotData.time,
        leaderName: document.getElementById('leaderName').value,
        area: document.getElementById('areaSelect').value,
        email: document.getElementById('leaderEmail').value,
        notes: document.getElementById('notes').value || "Sin observaciones",
        status: "confirmed",
        createdAt: new Date().toISOString()
      });

      alert("¡Agendamiento exitoso! Tu acompañamiento ha sido reservado.");
      document.getElementById('bookingForm').reset();
      document.getElementById('slotInfo').innerHTML = '👈 Haz clic en un bloque <strong>VERDE</strong> de la agenda para comenzar.';
      selectedSlotData = null;

    } catch (error) {
      console.error("Error al agendar:", error);
      alert("Hubo un error al guardar la reserva. Intenta de nuevo.");
    } finally {
      btn.innerText = "Confirmar Agendamiento";
    }
  });
}

// ==========================================
// VISTA PANEL ADMIN (ADMIN.HTML)
// ==========================================
const ADMIN_PASSWORD = "admin123sgd"; // Puedes cambiar esta contraseña por la que prefieras

function loginAdmin() {
  const pass = document.getElementById('adminPassword').value;
  if (pass === ADMIN_PASSWORD) {
    document.getElementById('loginCard').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'block';
    loadAdminData();
  } else {
    alert("Contraseña incorrecta.");
  }
}

function loadAdminData() {
  db.collection("appointments").onSnapshot((snapshot) => {
    const tbody = document.getElementById('adminTableBody');
    tbody.innerHTML = '';

    const list = [];
    snapshot.forEach(doc => {
      list.push({ id: doc.id, ...doc.data() });
    });

    // Ordenar por fecha y hora
    list.sort((a, b) => (a.date + a.time) > (b.date + b.time) ? 1 : -1);

    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">No hay reservas registradas aún.</td></tr>';
      return;
    }

    list.forEach(item => {
      const tr = document.createElement('tr');
      const isCompleted = item.status === 'completed';
      const isCancelled = item.status === 'cancelled';

      if (isCancelled) return; // No mostrar cancelados o mostrarlos si se prefiere

      tr.innerHTML = `
        <td>${item.dayName || item.date}</td>
        <td><strong>${item.time}</strong></td>
        <td><strong>${item.area}</strong></td>
        <td>${item.leaderName}</td>
        <td><a href="mailto:${item.email}">${item.email}</a></td>
        <td>${item.notes}</td>
        <td>
          ${isCompleted ? '<span class="badge-completed">Completado</span>' : '<span>Programado</span>'}
        </td>
        <td>
          ${!isCompleted ? `<button class="btn-success" onclick="markCompleted('${item.id}')">✓ Completar</button>` : ''}
          <button class="btn-danger" onclick="cancelAppointment('${item.id}')">✕ Cancelar/Liberar</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  });
}

async function markCompleted(docId) {
  if (confirm("¿Deseas marcar esta cita como completada?")) {
    await db.collection("appointments").doc(docId).update({ status: 'completed' });
  }
}

async function cancelAppointment(docId) {
  if (confirm("¿Seguro que deseas cancelar esta reserva? El horario quedará libre inmediatamente para que otro líder lo reserve.")) {
    await db.collection("appointments").doc(docId).delete();
  }
}
