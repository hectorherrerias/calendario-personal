/**
 * Calendario Personal - Core Application State & API Client (Mobile-Optimized)
 */

const API_BASE = '/api';

const state = {
  events: [],
  currentDate: new Date(),
  selectedDate: null,
  activeView: 'calendar', // 'calendar' | 'list' | 'settings'
  activeCategory: 'Todas',
  searchQuery: '',
  settings: null,
  logs: [],
  editingEventId: null,
  categories: [
    { name: 'Trabajo', color: '#3b82f6', icon: '💼' },
    { name: 'Personal', color: '#10b981', icon: '👤' },
    { name: 'Salud', color: '#ef4444', icon: '🏥' },
    { name: 'Cumpleaños', color: '#f59e0b', icon: '🎂' },
    { name: 'Finanzas', color: '#8b5cf6', icon: '💳' },
    { name: 'Ocio', color: '#ec4899', icon: '🎉' },
    { name: 'General', color: '#6366f1', icon: '📌' }
  ]
};

// UI Toast Notification helper (Top on mobile, bottom-right on desktop)
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const bgColors = {
    success: 'bg-emerald-600/95 border-emerald-400/50 text-white',
    error: 'bg-rose-600/95 border-rose-400/50 text-white',
    info: 'bg-indigo-600/95 border-indigo-400/50 text-white',
    warning: 'bg-amber-600/95 border-amber-400/50 text-white'
  };

  const icons = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
    warning: '⚠'
  };

  toast.className = `flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl shadow-2xl border backdrop-blur-xl text-xs sm:text-sm font-semibold transition-all duration-300 transform -translate-y-2 opacity-0 pointer-events-auto ${bgColors[type] || bgColors.info}`;
  toast.innerHTML = `
    <span class="flex items-center justify-center w-5 h-5 rounded-full bg-white/20 text-[11px] font-bold shrink-0">${icons[type] || '•'}</span>
    <span class="flex-1">${message}</span>
  `;

  container.appendChild(toast);
  
  requestAnimationFrame(() => {
    toast.classList.remove('-translate-y-2', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('-translate-y-2', 'opacity-0');
    setTimeout(() => toast.remove(), 280);
  }, 3500);
}

// Universal Date Parser Helper (prevents timezone shifts across browsers)
function parseDate(dateInput) {
  if (!dateInput) return new Date();
  if (dateInput instanceof Date) return dateInput;

  if (typeof dateInput === 'string') {
    let s = dateInput.trim();
    if (s.length === 10) {
      const [y, m, d] = s.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    // "YYYY-MM-DDTHH:MM:SS" or "YYYY-MM-DDTHH:MM" without Z or offset
    if (!s.endsWith('Z') && !s.includes('+') && !/[0-9]-[0-9]{2}:[0-9]{2}$/.test(s)) {
      const parts = s.split(/[-T:]/);
      if (parts.length >= 5) {
        return new Date(
          parseInt(parts[0], 10),
          parseInt(parts[1], 10) - 1,
          parseInt(parts[2], 10),
          parseInt(parts[3], 10),
          parseInt(parts[4], 10),
          parts[5] ? parseInt(parts[5], 10) : 0
        );
      }
    }
  }
  return new Date(dateInput);
}

// API Calls
async function apiGet(endpoint) {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  } catch (err) {
    console.error(`Error GET ${endpoint}:`, err);
    showToast(`Error de conexión: ${err.message}`, 'error');
    throw err;
  }
}

async function apiPost(endpoint, data = {}) {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.detail || `Error HTTP ${res.status}`);
    return body;
  } catch (err) {
    console.error(`Error POST ${endpoint}:`, err);
    showToast(err.message, 'error');
    throw err;
  }
}

async function apiPut(endpoint, data = {}) {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.detail || `Error HTTP ${res.status}`);
    return body;
  } catch (err) {
    console.error(`Error PUT ${endpoint}:`, err);
    showToast(err.message, 'error');
    throw err;
  }
}

async function apiDelete(endpoint) {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || `Error HTTP ${res.status}`);
    }
    return true;
  } catch (err) {
    console.error(`Error DELETE ${endpoint}:`, err);
    showToast(err.message, 'error');
    throw err;
  }
}

// Data loading functions
async function loadEvents() {
  try {
    let query = '';
    const params = [];
    if (state.activeCategory && state.activeCategory !== 'Todas') {
      params.push(`category=${encodeURIComponent(state.activeCategory)}`);
    }
    if (state.searchQuery) {
      params.push(`search=${encodeURIComponent(state.searchQuery)}`);
    }
    if (params.length > 0) {
      query = '?' + params.join('&');
    }

    state.events = await apiGet(`/events${query}`);
    renderMainView();
  } catch (err) {
    console.error("Error cargando eventos:", err);
  }
}

async function loadSettings() {
  try {
    state.settings = await apiGet('/settings');
    updateSettingsUI();
  } catch (err) {
    console.error("Error cargando configuración:", err);
  }
}

async function loadLogs() {
  try {
    state.logs = await apiGet('/logs?limit=50');
    renderLogsList();
  } catch (err) {
    console.error("Error cargando logs:", err);
  }
}

// UI State & View Switcher (Syncs desktop & mobile navs)
function switchView(viewName) {
  state.activeView = viewName;

  // Desktop view buttons
  document.querySelectorAll('.view-btn').forEach(btn => {
    if (btn.dataset.view === viewName) {
      btn.className = 'view-btn px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white shadow-sm transition-all';
    } else {
      btn.className = 'view-btn px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white transition-all';
    }
  });

  // Mobile bottom tab bar buttons
  document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
    if (btn.dataset.view === viewName) {
      btn.className = 'mobile-nav-btn flex flex-col items-center justify-center gap-0.5 py-1 text-indigo-400 font-bold';
    } else {
      btn.className = 'mobile-nav-btn flex flex-col items-center justify-center gap-0.5 py-1 text-slate-400 hover:text-white';
    }
  });

  const calendarContainer = document.getElementById('view-calendar');
  const listContainer = document.getElementById('view-list');
  const settingsContainer = document.getElementById('view-settings');

  if (calendarContainer) calendarContainer.classList.toggle('hidden', viewName !== 'calendar');
  if (listContainer) listContainer.classList.toggle('hidden', viewName !== 'list');
  if (settingsContainer) settingsContainer.classList.toggle('hidden', viewName !== 'settings');

  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (viewName === 'settings') {
    loadSettings();
    loadLogs();
  } else {
    renderMainView();
  }
}

function updateSettingsUI() {
  if (!state.settings) return;
  const s = state.settings;

  const stTz = document.getElementById('setting-tz-val');
  const stNtfy = document.getElementById('setting-ntfy-val');
  const stTg = document.getElementById('setting-tg-val');
  const stInterval = document.getElementById('setting-interval-val');

  if (stTz) stTz.textContent = s.timezone;
  if (stNtfy) stNtfy.textContent = s.ntfy_configured ? `🟢 Conectado (${s.ntfy_server}/${s.ntfy_topic})` : '⚪ No configurado (falta NTFY_TOPIC en .env)';
  if (stTg) stTg.textContent = s.telegram_configured ? `🟢 Conectado (Chat: ${s.telegram_chat_id})` : '⚪ Inactivo';
  if (stInterval) stInterval.textContent = `Cada ${s.scheduler_interval_minutes} minutos`;
}

// Modal open/close
function openEventModal(eventData = null, defaultDateStr = null) {
  const modal = document.getElementById('event-modal');
  const modalTitle = document.getElementById('modal-title');
  const form = document.getElementById('event-form');
  
  state.editingEventId = eventData ? eventData.id : null;
  form.reset();

  if (eventData) {
    modalTitle.textContent = 'Editar Evento';
    document.getElementById('event-title').value = eventData.title || '';
    document.getElementById('event-desc').value = eventData.description || '';
    document.getElementById('event-location').value = eventData.location || '';
    document.getElementById('event-category').value = eventData.category || 'General';
    document.getElementById('event-color').value = eventData.color || '#6366f1';
    document.getElementById('event-allday').checked = eventData.all_day || false;

    if (eventData.start_time) {
      const d = parseDate(eventData.start_time);
      document.getElementById('event-start').value = formatForDateTimeInput(d);
    }
    if (eventData.end_time) {
      const d = parseDate(eventData.end_time);
      document.getElementById('event-end').value = formatForDateTimeInput(d);
    }
  } else {
    modalTitle.textContent = 'Nuevo Evento';
    document.getElementById('event-category').value = 'General';
    document.getElementById('event-color').value = '#6366f1';
    document.getElementById('event-allday').checked = false;

    let startDate = new Date();
    if (defaultDateStr) {
      const [y, m, d] = defaultDateStr.split('-').map(Number);
      startDate = new Date(y, m - 1, d, 10, 0, 0);
    } else {
      startDate.setHours(startDate.getHours() + 1, 0, 0, 0);
    }
    document.getElementById('event-start').value = formatForDateTimeInput(startDate);
  }

  toggleAllDayFields();
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.body.style.overflow = 'hidden';
}

function closeEventModal() {
  const modal = document.getElementById('event-modal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  state.editingEventId = null;
  document.body.style.overflow = '';
}

function toggleAllDayFields() {
  const isAllDay = document.getElementById('event-allday').checked;
  const timeHint = document.getElementById('allday-hint');
  if (timeHint) {
    timeHint.textContent = isAllDay ? 'Aviso a las 08:00 AM del día del evento.' : 'Aviso a la hora exacta fijada.';
  }
}

function formatForDateTimeInput(date) {
  const pad = (n) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// Form Submit Handler (Sends clean local ISO without timezone degradation)
async function handleEventFormSubmit(e) {
  e.preventDefault();
  
  const title = document.getElementById('event-title').value.trim();
  const description = document.getElementById('event-desc').value.trim() || null;
  const location = document.getElementById('event-location').value.trim() || null;
  const category = document.getElementById('event-category').value;
  const color = document.getElementById('event-color').value;
  const allDay = document.getElementById('event-allday').checked;
  const startStr = document.getElementById('event-start').value;
  const endStr = document.getElementById('event-end').value;

  if (!title) {
    showToast('Por favor escribe un título para el evento', 'warning');
    return;
  }
  if (!startStr) {
    showToast('Por favor selecciona una fecha y hora de inicio', 'warning');
    return;
  }

  // Preserve exact local time (e.g. 2026-09-29T20:00:00)
  const formatIsoLocal = (str) => {
    if (!str) return null;
    return str.length === 16 ? `${str}:00` : str;
  };

  const payload = {
    title,
    description,
    location,
    category,
    color,
    all_day: allDay,
    start_time: formatIsoLocal(startStr),
    end_time: formatIsoLocal(endStr)
  };

  try {
    if (state.editingEventId) {
      await apiPut(`/events/${state.editingEventId}`, payload);
      showToast('Evento actualizado correctamente', 'success');
    } else {
      await apiPost('/events', payload);
      showToast('Evento creado y alertas programadas', 'success');
    }
    closeEventModal();
    await loadEvents();
  } catch (err) {
    // Handled
  }
}

// Quick action: Test Push Notification
async function sendTestPush() {
  const btns = [document.getElementById('btn-test-push'), document.getElementById('btn-test-push-settings')];
  btns.forEach(b => { if (b) b.disabled = true; });
  showToast('Enviando notificación push a tu iPhone...', 'info');

  try {
    await apiPost('/settings/test-notification');
    showToast('¡Notificación enviada! Revisa tu iPhone.', 'success');
  } catch (err) {
    // Handled
  } finally {
    btns.forEach(b => { if (b) b.disabled = false; });
  }
}

// Quick action: Force Notify Specific Event
async function triggerEventNotificationNow(eventId) {
  showToast('Enviando recordatorio al iPhone...', 'info');
  try {
    await apiPost(`/events/${eventId}/trigger-notify`);
    showToast('Aviso enviado correctamente', 'success');
    await loadEvents();
  } catch (err) {
    // Handled
  }
}

// Delete Event
async function confirmDeleteEvent(eventId, eventTitle) {
  if (!confirm(`¿Eliminar "${eventTitle}"?`)) return;
  
  try {
    await apiDelete(`/events/${eventId}`);
    showToast('Evento eliminado', 'info');
    await loadEvents();
  } catch (err) {
    // Handled
  }
}

// Live Clock & Current Day Widget (Formatted cleanly in Spanish)
function startClock() {
  const clockEl = document.getElementById('live-clock');
  const todayBadgeEl = document.getElementById('today-badge-text');

  function update() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const hours = pad(now.getHours());
    const mins = pad(now.getMinutes());
    const secs = pad(now.getSeconds());

    const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    const diaSem = dias[now.getDay()];
    const diaNum = now.getDate();
    const mes = meses[now.getMonth()];

    // Header Live Clock: e.g. "Mar, 29 Sep • 20:04:15"
    if (clockEl) {
      clockEl.innerHTML = `
        <span class="font-semibold text-slate-200">${diaSem}, ${diaNum} ${mes}</span>
        <span class="text-slate-500 mx-0.5">•</span>
        <span class="font-mono font-bold text-indigo-400">${hours}:${mins}:${secs}</span>
      `;
    }

    // Today Banner in Calendar: e.g. "Hoy es Martes, 29 de septiembre de 2026"
    if (todayBadgeEl) {
      const diasCompletos = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const mesesCompletos = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
      todayBadgeEl.textContent = `Hoy es ${diasCompletos[now.getDay()]}, ${diaNum} de ${mesesCompletos[now.getMonth()]}`;
    }
  }
  update();
  setInterval(update, 1000);
}

// Touch swipe gesture for calendar navigation on mobile
function setupTouchGestures() {
  const grid = document.getElementById('calendar-grid-container');
  if (!grid) return;

  let touchStartX = 0;
  let touchStartY = 0;

  grid.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
  }, { passive: true });

  grid.addEventListener('touchend', (e) => {
    const touchEndX = e.changedTouches[0].screenX;
    const touchEndY = e.changedTouches[0].screenY;
    const diffX = touchEndX - touchStartX;
    const diffY = touchEndY - touchStartY;

    if (Math.abs(diffX) > 45 && Math.abs(diffX) > Math.abs(diffY) * 1.5) {
      if (diffX < 0) {
        nextMonth();
      } else {
        prevMonth();
      }
    }
  }, { passive: true });
}

// Initialize application on DOM ready
document.addEventListener('DOMContentLoaded', async () => {
  startClock();
  setupTouchGestures();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('PWA ServiceWorker registrado:', reg.scope))
      .catch(err => console.log('SW registration failed:', err));
  }

  // Setup Event Listeners
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  document.getElementById('btn-new-event-top')?.addEventListener('click', () => openEventModal());
  document.getElementById('btn-close-modal')?.addEventListener('click', closeEventModal);
  document.getElementById('btn-cancel-modal')?.addEventListener('click', closeEventModal);
  document.getElementById('event-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'event-modal') closeEventModal();
  });

  document.getElementById('event-form')?.addEventListener('submit', handleEventFormSubmit);
  document.getElementById('event-allday')?.addEventListener('change', toggleAllDayFields);
  document.getElementById('btn-test-push')?.addEventListener('click', sendTestPush);
  document.getElementById('btn-test-push-settings')?.addEventListener('click', sendTestPush);

  document.getElementById('event-category')?.addEventListener('change', (e) => {
    const cat = state.categories.find(c => c.name === e.target.value);
    if (cat) {
      document.getElementById('event-color').value = cat.color;
    }
  });

  let searchTimeout;
  document.getElementById('search-input')?.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      state.searchQuery = e.target.value.trim();
      loadEvents();
    }, 250);
  });

  document.querySelectorAll('.category-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.category-filter-btn').forEach(b => {
        b.className = 'category-filter-btn shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 bg-slate-900 hover:text-white border border-slate-800 transition-all active:scale-95';
      });
      btn.className = 'category-filter-btn shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white shadow-sm transition-all active:scale-95';
      state.activeCategory = btn.dataset.category;
      loadEvents();
    });
  });

  await loadSettings();
  await loadEvents();
});
