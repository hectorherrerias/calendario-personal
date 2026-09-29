/**
 * Calendario Personal - Core Application State & API Client
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

// UI Toast Notification helper
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const bgColors = {
    success: 'bg-emerald-600/90 border-emerald-500 text-white',
    error: 'bg-rose-600/90 border-rose-500 text-white',
    info: 'bg-indigo-600/90 border-indigo-500 text-white',
    warning: 'bg-amber-600/90 border-amber-500 text-white'
  };

  const icons = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
    warning: '⚠'
  };

  toast.className = `flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border backdrop-blur-md text-sm font-medium transition-all duration-300 transform translate-y-4 opacity-0 ${bgColors[type] || bgColors.info}`;
  toast.innerHTML = `
    <span class="flex items-center justify-center w-6 h-6 rounded-full bg-white/20 text-xs font-bold">${icons[type] || '•'}</span>
    <span class="flex-1">${message}</span>
  `;

  container.appendChild(toast);
  
  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-4', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('translate-y-4', 'opacity-0');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// API Calls
async function apiGet(endpoint) {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  } catch (err) {
    console.error(`Error GET ${endpoint}:`, err);
    showToast(`Error al consultar servidor: ${err.message}`, 'error');
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

// UI State & View Switcher
function switchView(viewName) {
  state.activeView = viewName;

  document.querySelectorAll('.view-btn').forEach(btn => {
    if (btn.dataset.view === viewName) {
      btn.className = 'view-btn px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 transition-all';
    } else {
      btn.className = 'view-btn px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-all';
    }
  });

  const calendarContainer = document.getElementById('view-calendar');
  const listContainer = document.getElementById('view-list');
  const settingsContainer = document.getElementById('view-settings');

  if (calendarContainer) calendarContainer.classList.toggle('hidden', viewName !== 'calendar');
  if (listContainer) listContainer.classList.toggle('hidden', viewName !== 'list');
  if (settingsContainer) settingsContainer.classList.toggle('hidden', viewName !== 'settings');

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
  
  // Update header badges
  const ntfyBadge = document.getElementById('header-ntfy-badge');
  const tgBadge = document.getElementById('header-tg-badge');
  const tzDisplay = document.getElementById('header-tz');

  if (tzDisplay) tzDisplay.textContent = s.timezone || 'Europe/Madrid';

  if (ntfyBadge) {
    if (s.ntfy_configured) {
      ntfyBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-dot"></span> ntfy: <b>${s.ntfy_topic}</b>`;
      ntfyBadge.className = "hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
    } else {
      ntfyBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-400"></span> ntfy no activo`;
      ntfyBadge.className = "hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20";
    }
  }

  if (tgBadge) {
    if (s.telegram_configured) {
      tgBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-cyan-400 animate-pulse-dot"></span> Telegram activo`;
      tgBadge.className = "hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20";
    } else {
      tgBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-slate-500"></span> Telegram inactivo`;
      tgBadge.className = "hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700";
    }
  }

  // Update Settings View Elements
  const stTz = document.getElementById('setting-tz-val');
  const stNtfy = document.getElementById('setting-ntfy-val');
  const stTg = document.getElementById('setting-tg-val');
  const stInterval = document.getElementById('setting-interval-val');

  if (stTz) stTz.textContent = s.timezone;
  if (stNtfy) stNtfy.textContent = s.ntfy_configured ? `🟢 Conectado (${s.ntfy_server}/${s.ntfy_topic})` : '⚪ No configurado (falta NTFY_TOPIC en .env)';
  if (stTg) stTg.textContent = s.telegram_configured ? `🟢 Conectado (Chat ID: ${s.telegram_chat_id})` : '⚪ No configurado (falta TELEGRAM_BOT_TOKEN en .env)';
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

    // Format datetime-local strings
    if (eventData.start_time) {
      const d = new Date(eventData.start_time);
      document.getElementById('event-start').value = formatForDateTimeInput(d);
    }
    if (eventData.end_time) {
      const d = new Date(eventData.end_time);
      document.getElementById('event-end').value = formatForDateTimeInput(d);
    }
  } else {
    modalTitle.textContent = 'Nuevo Evento';
    document.getElementById('event-category').value = 'General';
    document.getElementById('event-color').value = '#6366f1';
    document.getElementById('event-allday').checked = false;

    // Default start time: clicked date or now + 1 hour
    let startDate = new Date();
    if (defaultDateStr) {
      startDate = new Date(defaultDateStr);
      startDate.setHours(10, 0, 0, 0);
    } else {
      startDate.setHours(startDate.getHours() + 1, 0, 0, 0);
    }
    document.getElementById('event-start').value = formatForDateTimeInput(startDate);
  }

  toggleAllDayFields();
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeEventModal() {
  const modal = document.getElementById('event-modal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  state.editingEventId = null;
}

function toggleAllDayFields() {
  const isAllDay = document.getElementById('event-allday').checked;
  const startInput = document.getElementById('event-start');
  const endInput = document.getElementById('event-end');
  
  // If all-day is checked, we can show date only or adjust placeholder
  const timeHint = document.getElementById('allday-hint');
  if (timeHint) {
    timeHint.textContent = isAllDay ? '⏰ La notificación sonará a las 08:00 AM del día del evento.' : '⏰ La notificación sonará a la hora exacta fijada.';
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

// Form Submit Handler
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

  const payload = {
    title,
    description,
    location,
    category,
    color,
    all_day: allDay,
    start_time: new Date(startStr).toISOString(),
    end_time: endStr ? new Date(endStr).toISOString() : null
  };

  try {
    if (state.editingEventId) {
      await apiPut(`/events/${state.editingEventId}`, payload);
      showToast('Evento actualizado correctamente', 'success');
    } else {
      await apiPost('/events', payload);
      showToast('Evento creado exitosamente', 'success');
    }
    closeEventModal();
    await loadEvents();
  } catch (err) {
    // Handled in api wrapper
  }
}

// Quick action: Test Push Notification
async function sendTestPush() {
  const btn = document.getElementById('btn-test-push');
  if (btn) btn.disabled = true;
  showToast('Enviando notificación de prueba a tu iPhone...', 'info');

  try {
    const res = await apiPost('/settings/test-notification');
    showToast('¡Notificación enviada con éxito! Revisa tu iPhone.', 'success');
  } catch (err) {
    // Handled
  } finally {
    if (btn) btn.disabled = false;
  }
}

// Quick action: Force Notify Specific Event
async function triggerEventNotificationNow(eventId) {
  showToast('Enviando alerta del evento a tus dispositivos...', 'info');
  try {
    await apiPost(`/events/${eventId}/trigger-notify`);
    showToast('Aviso enviado correctamente a ntfy/Telegram', 'success');
    await loadEvents();
  } catch (err) {
    // Handled
  }
}

// Delete Event
async function confirmDeleteEvent(eventId, eventTitle) {
  if (!confirm(`¿Estás seguro de que deseas eliminar el evento "${eventTitle}"?`)) return;
  
  try {
    await apiDelete(`/events/${eventId}`);
    showToast('Evento eliminado', 'info');
    await loadEvents();
  } catch (err) {
    // Handled
  }
}

// Live Clock in Header
function startClock() {
  const clockEl = document.getElementById('live-clock');
  if (!clockEl) return;

  function update() {
    const now = new Date();
    const options = {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    };
    clockEl.textContent = now.toLocaleDateString('es-ES', options);
  }
  update();
  setInterval(update, 1000);
}

// Initialize application on DOM ready
document.addEventListener('DOMContentLoaded', async () => {
  startClock();

  // Register Service Worker for PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('PWA ServiceWorker registrado:', reg.scope))
      .catch(err => console.log('SW registration failed:', err));
  }

  // Setup Event Listeners
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  document.getElementById('btn-new-event')?.addEventListener('click', () => openEventModal());
  document.getElementById('btn-close-modal')?.addEventListener('click', closeEventModal);
  document.getElementById('btn-cancel-modal')?.addEventListener('click', closeEventModal);
  document.getElementById('event-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'event-modal') closeEventModal();
  });

  document.getElementById('event-form')?.addEventListener('submit', handleEventFormSubmit);
  document.getElementById('event-allday')?.addEventListener('change', toggleAllDayFields);
  document.getElementById('btn-test-push')?.addEventListener('click', sendTestPush);
  document.getElementById('btn-test-push-settings')?.addEventListener('click', sendTestPush);

  // Category change syncs default color
  document.getElementById('event-category')?.addEventListener('change', (e) => {
    const cat = state.categories.find(c => c.name === e.target.value);
    if (cat) {
      document.getElementById('event-color').value = cat.color;
    }
  });

  // Search input with debounce
  let searchTimeout;
  document.getElementById('search-input')?.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      state.searchQuery = e.target.value.trim();
      loadEvents();
    }, 300);
  });

  // Category filter tabs
  document.querySelectorAll('.category-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.category-filter-btn').forEach(b => {
        b.className = 'category-filter-btn px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 bg-slate-800/60 hover:text-white transition-all';
      });
      btn.className = 'category-filter-btn px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white shadow-sm transition-all';
      state.activeCategory = btn.dataset.category;
      loadEvents();
    });
  });

  // Load initial data
  await loadSettings();
  await loadEvents();
});
