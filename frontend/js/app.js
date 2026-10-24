/**
 * Calendario Personal - Core Application State & API Client (Mobile-Optimized)
 */

const API_BASE = '/api';

const state = {
  events: [],
  tasks: [],
  journalEntries: [],
  currentJournal: { date: '', content: '', summary: '', mood: '' },
  currentDate: new Date(),
  selectedDate: null,
  activeView: 'calendar', // 'calendar' | 'tasks' | 'journal' | 'list' | 'settings'
  activeCategory: 'Todas',
  searchQuery: '',
  taskFilters: {
    status: 'all',    // 'all' | 'pending' | 'completed'
    priority: 'all',  // 'all' | 'high' | 'medium' | 'low'
    search: ''
  },
  settings: null,
  logs: [],
  editingEventId: null,
  editingTaskId: null,
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

function formatDateToIsoString(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Multi-day Event Helper Functions
function isEventOnDate(event, dateObj) {
  const start = parseDate(event.start_time);
  const startDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  
  const endVal = event.end_date || event.end_time;
  if (!endVal) {
    return startDate.getTime() === dateObj.getTime();
  }
  
  const end = parseDate(endVal);
  const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  
  if (endDate < startDate) {
    return startDate.getTime() === dateObj.getTime();
  }
  
  return dateObj.getTime() >= startDate.getTime() && dateObj.getTime() <= endDate.getTime();
}

function getEventDayStatus(event, dateObj) {
  const start = parseDate(event.start_time);
  const startDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endVal = event.end_date || event.end_time;
  
  if (!endVal) {
    return { isMultiDay: false, isStart: true, isEnd: true, isMiddle: false, dayIndex: 1, totalDays: 1 };
  }
  
  const end = parseDate(endVal);
  const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  
  // Same day, or an end before the start (bad data): treat it as a one-day event
  if (endDate.getTime() <= startDate.getTime()) {
    return { isMultiDay: false, isStart: true, isEnd: true, isMiddle: false, dayIndex: 1, totalDays: 1 };
  }
  
  const oneDayMs = 24 * 60 * 60 * 1000;
  const totalDays = Math.round((endDate.getTime() - startDate.getTime()) / oneDayMs) + 1;
  const currentDiff = Math.round((dateObj.getTime() - startDate.getTime()) / oneDayMs);
  const dayIndex = currentDiff + 1;
  
  const isStart = dateObj.getTime() === startDate.getTime();
  const isEnd = dateObj.getTime() === endDate.getTime();
  const isMiddle = !isStart && !isEnd;
  
  return {
    isMultiDay: true,
    isStart,
    isEnd,
    isMiddle,
    dayIndex,
    totalDays,
    startDate,
    endDate
  };
}

// -------------------------------------------------------------
// GENERIC API CALLS
// -------------------------------------------------------------

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

async function apiPatch(endpoint, data = {}) {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.detail || `Error HTTP ${res.status}`);
    return body;
  } catch (err) {
    console.error(`Error PATCH ${endpoint}:`, err);
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

// -------------------------------------------------------------
// DATA LOADERS
// -------------------------------------------------------------

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

async function loadTasks(preserveScroll = true) {
  try {
    const mainEl = document.getElementById('main-content');
    const savedScrollTop = preserveScroll && mainEl ? mainEl.scrollTop : 0;

    let query = '';
    const params = [];
    if (state.taskFilters.status === 'pending') params.push('completed=false');
    if (state.taskFilters.status === 'completed') params.push('completed=true');
    if (state.taskFilters.priority && state.taskFilters.priority !== 'all') {
      params.push(`priority=${encodeURIComponent(state.taskFilters.priority)}`);
    }
    if (state.taskFilters.search) {
      params.push(`search=${encodeURIComponent(state.taskFilters.search)}`);
    }
    if (params.length > 0) query = '?' + params.join('&');

    state.tasks = await apiGet(`/tasks${query}`);
    updateTaskStats();
    if (state.activeView === 'tasks') {
      renderTasksView();
    }
    // Also re-render day panel if on calendar view so day tasks are synced
    if (state.activeView === 'calendar') {
      renderSelectedDayPanel();
    }

    if (preserveScroll && mainEl && savedScrollTop > 0) {
      mainEl.scrollTop = savedScrollTop;
    }
  } catch (err) {
    console.error("Error cargando tareas:", err);
  }
}

async function loadJournalForDate(dateStr) {
  try {
    const note = await apiGet(`/journal/${dateStr}`);
    state.currentJournal = note;
    
    // Update daily details sidebar journal input
    const dayJournalInput = document.getElementById('day-panel-journal-content');
    if (dayJournalInput) {
      dayJournalInput.value = note.content || '';
    }

    // Update dedicated journal view editor
    const viewJournalDateInput = document.getElementById('journal-date-input');
    const viewJournalContentInput = document.getElementById('journal-content-input');
    const viewJournalSummaryInput = document.getElementById('journal-summary-input');
    const viewJournalMoodInput = document.getElementById('journal-mood-input');
    const viewJournalTitle = document.getElementById('journal-current-date-title');

    if (viewJournalDateInput) viewJournalDateInput.value = dateStr;
    if (viewJournalContentInput) viewJournalContentInput.value = note.content || '';
    if (viewJournalSummaryInput) viewJournalSummaryInput.value = note.summary || '';
    if (viewJournalMoodInput && note.mood) viewJournalMoodInput.value = note.mood;
    
    if (viewJournalTitle) {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
      viewJournalTitle.textContent = `${dias[dt.getDay()]}, ${d} de ${meses[m - 1]} de ${y}`;
    }
  } catch (err) {
    console.error("Error cargando nota del diario:", err);
  }
}

async function loadJournalEntries() {
  try {
    state.journalEntries = await apiGet('/journal?limit=60');
    renderJournalHistoryList();
  } catch (err) {
    console.error("Error cargando historial del diario:", err);
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

// -------------------------------------------------------------
// VIEW SWITCHER
// -------------------------------------------------------------

function switchView(viewName) {
  state.activeView = viewName;

  // Desktop view buttons
  document.querySelectorAll('.view-btn').forEach(btn => {
    if (btn.dataset.view === viewName) {
      btn.className = 'view-btn px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white shadow-sm transition-all';
    } else {
      btn.className = 'view-btn px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white transition-all';
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

  const views = {
    calendar: document.getElementById('view-calendar'),
    tasks: document.getElementById('view-tasks'),
    journal: document.getElementById('view-journal'),
    list: document.getElementById('view-list'),
    settings: document.getElementById('view-settings')
  };

  Object.entries(views).forEach(([name, el]) => {
    if (el) el.classList.toggle('hidden', name !== viewName);
  });

  const mainEl = document.getElementById('main-content');
  if (mainEl) mainEl.scrollTo({ top: 0, behavior: 'smooth' });
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (viewName === 'tasks') {
    loadTasks();
  } else if (viewName === 'journal') {
    const todayStr = formatDateToIsoString(new Date());
    loadJournalForDate(state.selectedDate || todayStr);
    loadJournalEntries();
  } else if (viewName === 'settings') {
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
  if (stNtfy) stNtfy.textContent = s.ntfy_configured ? `🟢 Conectado (${s.ntfy_server}/${s.ntfy_topic})` : '⚪ No configurado';
  if (stTg) stTg.textContent = s.telegram_configured ? `🟢 Conectado (Chat: ${s.telegram_chat_id})` : '⚪ Inactivo';
  if (stInterval) stInterval.textContent = `Cada ${s.scheduler_interval_minutes} minutos`;

  const inputTopic = document.getElementById('input-ntfy-topic');
  if (inputTopic && s.ntfy_topic) {
    inputTopic.value = s.ntfy_topic;
  }

  const guideTopic = document.getElementById('guide-topic-code');
  if (guideTopic && s.ntfy_topic) {
    guideTopic.textContent = s.ntfy_topic;
  }

  const btnNtfyApp = document.getElementById('btn-open-ntfy-app');
  if (btnNtfyApp && s.ntfy_topic) {
    const server = s.ntfy_server || 'https://ntfy.sh';
    btnNtfyApp.href = `${server.replace(/\/$/, '')}/${encodeURIComponent(s.ntfy_topic)}`;
  }
}

async function saveNotificationSettings(e) {
  if (e) e.preventDefault();
  const inputTopic = document.getElementById('input-ntfy-topic');
  if (!inputTopic) return;
  const topic = inputTopic.value.trim();
  if (!topic) {
    showToast('Introduce un nombre de topic para ntfy', 'warning');
    return;
  }

  try {
    const res = await apiPost('/settings', { ntfy_topic: topic });
    state.settings = res.settings;
    updateSettingsUI();
    showToast('Configuración guardada correctamente', 'success');
  } catch (err) {
    console.error('Error guardando configuración:', err);
  }
}

// -------------------------------------------------------------
// EVENT MODAL CONTROLS & HANDLERS
// -------------------------------------------------------------

function openEventModal(eventData = null, defaultDateStr = null) {
  const modal = document.getElementById('event-modal');
  const modalTitle = document.getElementById('modal-title');
  const form = document.getElementById('event-form');
  
  state.editingEventId = eventData ? eventData.id : null;
  form.reset();

  const isMultidayCheckbox = document.getElementById('event-is-multiday');

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
    const endVal = eventData.end_date || eventData.end_time;
    if (endVal) {
      const d = parseDate(endVal);
      document.getElementById('event-end').value = formatForDateTimeInput(d);
      
      const s = parseDate(eventData.start_time);
      const isMulti = d.getFullYear() !== s.getFullYear() || d.getMonth() !== s.getMonth() || d.getDate() !== s.getDate();
      if (isMultidayCheckbox) isMultidayCheckbox.checked = isMulti;
    } else {
      if (isMultidayCheckbox) isMultidayCheckbox.checked = false;
    }
  } else {
    modalTitle.textContent = 'Nuevo Evento';
    document.getElementById('event-category').value = 'General';
    document.getElementById('event-color').value = '#6366f1';
    document.getElementById('event-allday').checked = false;
    if (isMultidayCheckbox) isMultidayCheckbox.checked = false;

    let startDate = new Date();
    if (defaultDateStr) {
      const [y, m, d] = defaultDateStr.split('-').map(Number);
      startDate = new Date(y, m - 1, d, 10, 0, 0);
    } else {
      startDate.setHours(startDate.getHours() + 1, 0, 0, 0);
    }
    document.getElementById('event-start').value = formatForDateTimeInput(startDate);
  }

  updateMultiDayBadge();
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

function updateMultiDayBadge() {
  const startStr = document.getElementById('event-start')?.value;
  const endStr = document.getElementById('event-end')?.value;
  const badge = document.getElementById('multiday-info-badge');
  const badgeText = document.getElementById('multiday-info-text');

  if (!badge || !badgeText) return;

  if (startStr && endStr) {
    const s = parseDate(startStr);
    const e = parseDate(endStr);
    const sDay = new Date(s.getFullYear(), s.getMonth(), s.getDate());
    const eDay = new Date(e.getFullYear(), e.getMonth(), e.getDate());

    if (eDay > sDay) {
      const oneDayMs = 24 * 60 * 60 * 1000;
      const days = Math.round((eDay.getTime() - sDay.getTime()) / oneDayMs) + 1;
      badge.classList.remove('hidden');
      badge.classList.add('flex');
      badgeText.textContent = `Evento multidía: durará ${days} días continuos en el calendario.`;
      const isMulti = document.getElementById('event-is-multiday');
      if (isMulti) isMulti.checked = true;
      return;
    }
  }
  badge.classList.add('hidden');
  badge.classList.remove('flex');
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
    end_time: formatIsoLocal(endStr),
    end_date: formatIsoLocal(endStr)
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

async function triggerEventNotificationNow(eventId) {
  showToast('Enviando recordatorio de evento al iPhone...', 'info');
  try {
    await apiPost(`/events/${eventId}/trigger-notify`);
    showToast('Aviso enviado correctamente', 'success');
    await loadEvents();
  } catch (err) {
    // Handled
  }
}

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

// -------------------------------------------------------------
// TASK MODAL CONTROLS & HANDLERS
// -------------------------------------------------------------

function openTaskModal(taskData = null, defaultDateStr = null) {
  const modal = document.getElementById('task-modal');
  const modalTitle = document.getElementById('task-modal-title');
  const form = document.getElementById('task-form');

  state.editingTaskId = taskData ? taskData.id : null;
  form.reset();

  if (taskData) {
    modalTitle.textContent = 'Editar Tarea';
    document.getElementById('task-title').value = taskData.title || '';
    document.getElementById('task-desc').value = taskData.description || '';
    document.getElementById('task-priority').value = taskData.priority || 'medium';
    document.getElementById('task-category').value = taskData.category_id || 'General';

    if (taskData.due_date) {
      const d = parseDate(taskData.due_date);
      document.getElementById('task-due-date').value = formatForDateTimeInput(d);
    }
  } else {
    modalTitle.textContent = 'Nueva Tarea';
    document.getElementById('task-priority').value = 'medium';
    document.getElementById('task-category').value = 'General';

    if (defaultDateStr) {
      const [y, m, d] = defaultDateStr.split('-').map(Number);
      const dt = new Date(y, m - 1, d, 18, 0, 0);
      document.getElementById('task-due-date').value = formatForDateTimeInput(dt);
    }
  }

  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.body.style.overflow = 'hidden';
}

function closeTaskModal() {
  const modal = document.getElementById('task-modal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  state.editingTaskId = null;
  document.body.style.overflow = '';
}

async function handleTaskFormSubmit(e) {
  e.preventDefault();

  const title = document.getElementById('task-title').value.trim();
  const description = document.getElementById('task-desc').value.trim() || null;
  const priority = document.getElementById('task-priority').value;
  const category_id = document.getElementById('task-category').value;
  const dueDateStr = document.getElementById('task-due-date').value;

  if (!title) {
    showToast('Por favor escribe un título para la tarea', 'warning');
    return;
  }

  const formatIsoLocal = (str) => {
    if (!str) return null;
    return str.length === 16 ? `${str}:00` : str;
  };

  const payload = {
    title,
    description,
    priority,
    category_id,
    due_date: formatIsoLocal(dueDateStr)
  };

  try {
    if (state.editingTaskId) {
      await apiPut(`/tasks/${state.editingTaskId}`, payload);
      showToast('Tarea actualizada', 'success');
    } else {
      await apiPost('/tasks', payload);
      showToast('Tarea creada exitosamente', 'success');
    }
    closeTaskModal();
    await loadTasks();
  } catch (err) {
    // Handled
  }
}

async function handleQuickTaskSubmit(e) {
  e.preventDefault();
  const input = document.getElementById('quick-task-title');
  const priSelect = document.getElementById('quick-task-priority');
  const title = input.value.trim();
  const priority = priSelect ? priSelect.value : 'medium';

  if (!title) return;

  try {
    await apiPost('/tasks', {
      title,
      priority,
      category_id: 'General'
    });
    input.value = '';
    showToast('Tarea añadida', 'success');
    await loadTasks();
  } catch (err) {
    // Handled
  }
}

async function toggleTask(taskId, event) {
  if (event) {
    event.stopPropagation();
  }

  // 1. Find the task in local state for optimistic update
  const task = state.tasks.find(t => t.id === taskId);
  const newCompleted = task ? !task.completed : true;
  if (task) {
    task.completed = newCompleted;
  }

  // 2. Instant DOM updates with animated visual feedback
  const dayChk = document.getElementById(`chk-day-${taskId}`);
  const mainChk = document.getElementById(`chk-main-${taskId}`);
  const dayTitle = document.getElementById(`title-day-${taskId}`);
  const mainTitle = document.getElementById(`title-main-${taskId}`);
  const dayCard = document.getElementById(`day-task-${taskId}`);
  const mainCard = document.getElementById(`task-card-${taskId}`);

  if (dayChk) dayChk.checked = newCompleted;
  if (mainChk) mainChk.checked = newCompleted;

  if (dayTitle) {
    dayTitle.classList.toggle('completed', newCompleted);
    dayTitle.classList.toggle('text-slate-500', newCompleted);
    dayTitle.classList.toggle('text-slate-100', !newCompleted);
  }
  if (mainTitle) {
    mainTitle.classList.toggle('completed', newCompleted);
    mainTitle.classList.toggle('text-slate-400', newCompleted);
  }
  if (dayCard) {
    dayCard.classList.toggle('opacity-60', newCompleted);
    dayCard.classList.toggle('bg-slate-950/40', newCompleted);
  }
  if (mainCard) {
    mainCard.classList.toggle('opacity-60', newCompleted);
    mainCard.classList.toggle('bg-slate-950/40', newCompleted);
  }

  // Update stats counters immediately
  updateTaskStats();

  try {
    const updated = await apiPatch(`/tasks/${taskId}/toggle`);
    const statusMsg = updated.completed ? 'Tarea completada ✓' : 'Tarea reabierta';
    showToast(statusMsg, updated.completed ? 'success' : 'info');

    // If an exclusive status filter is active, reload preserving scroll
    if (state.activeView === 'tasks' && (state.taskFilters.status === 'pending' || state.taskFilters.status === 'completed')) {
      await loadTasks(true);
    } else {
      // Background sync without re-rendering the whole panel
      const query = (state.taskFilters.priority && state.taskFilters.priority !== 'all') ? `?priority=${encodeURIComponent(state.taskFilters.priority)}` : '';
      state.tasks = await apiGet(`/tasks${query}`);
      updateTaskStats();
      if (state.activeView === 'calendar') {
        renderCalendarGrid();
      }
    }
  } catch (err) {
    // Rollback optimistic update on error
    if (task) task.completed = !newCompleted;
    if (dayChk) dayChk.checked = !newCompleted;
    if (mainChk) mainChk.checked = !newCompleted;
    if (dayTitle) dayTitle.classList.toggle('completed', !newCompleted);
    if (mainTitle) mainTitle.classList.toggle('completed', !newCompleted);
    updateTaskStats();
    showToast('Error al actualizar tarea', 'error');
  }
}

async function confirmDeleteTask(taskId, taskTitle) {
  if (!confirm(`¿Eliminar la tarea "${taskTitle}"?`)) return;

  try {
    await apiDelete(`/tasks/${taskId}`);
    showToast('Tarea eliminada', 'info');
    await loadTasks();
  } catch (err) {
    // Handled
  }
}

async function triggerTaskNotificationNow(taskId) {
  showToast('Enviando recordatorio de tarea al iPhone...', 'info');
  try {
    await apiPost(`/tasks/${taskId}/trigger-notify`);
    showToast('Aviso de tarea enviado exitosamente', 'success');
  } catch (err) {
    // Handled
  }
}

function setTaskFilter(type, value) {
  if (type === 'status') {
    state.taskFilters.status = value;
    ['all', 'pending', 'completed'].forEach(s => {
      const btn = document.getElementById(`task-filter-status-${s}`);
      if (btn) {
        if (s === value) {
          btn.className = 'px-3 py-1.5 rounded-lg font-bold bg-indigo-600 text-white transition-all';
        } else {
          btn.className = 'px-3 py-1.5 rounded-lg font-medium text-slate-400 hover:text-white transition-all';
        }
      }
    });
  } else if (type === 'priority') {
    state.taskFilters.priority = value;
    ['all', 'high', 'medium', 'low'].forEach(p => {
      const btn = document.getElementById(`task-filter-pri-${p}`);
      if (btn) {
        if (p === value) {
          btn.className = 'px-2.5 py-1 rounded-lg font-bold bg-slate-800 text-white transition-all';
        } else {
          btn.className = 'px-2.5 py-1 rounded-lg font-medium text-slate-400 hover:text-white bg-slate-900 border border-slate-800 transition-all';
        }
      }
    });
  }
  loadTasks();
}

function updateTaskStats() {
  const totalEl = document.getElementById('task-stat-total');
  const pendingEl = document.getElementById('task-stat-pending');
  const completedEl = document.getElementById('task-stat-completed');
  const highEl = document.getElementById('task-stat-high');

  if (!totalEl) return;

  const total = state.tasks.length;
  const completed = state.tasks.filter(t => t.completed).length;
  const pending = total - completed;
  const high = state.tasks.filter(t => !t.completed && t.priority === 'high').length;

  totalEl.textContent = total;
  pendingEl.textContent = pending;
  completedEl.textContent = completed;
  highEl.textContent = high;
}

// -------------------------------------------------------------
// JOURNAL / BITÁCORA CONTROLS & HANDLERS
// -------------------------------------------------------------

function setJournalToToday() {
  const todayStr = formatDateToIsoString(new Date());
  const input = document.getElementById('journal-date-input');
  if (input) input.value = todayStr;
  loadJournalForDate(todayStr);
}

async function saveJournalEntry() {
  const dateInput = document.getElementById('journal-date-input');
  const contentInput = document.getElementById('journal-content-input');
  const summaryInput = document.getElementById('journal-summary-input');
  const moodInput = document.getElementById('journal-mood-input');
  const saveStatus = document.getElementById('journal-save-status');
  const btn = document.getElementById('btn-save-journal');

  const dateStr = dateInput ? dateInput.value : formatDateToIsoString(new Date());
  const content = contentInput ? contentInput.value.trim() : '';
  const summary = summaryInput ? summaryInput.value.trim() : null;
  const mood = moodInput ? moodInput.value : null;

  if (saveStatus) saveStatus.textContent = 'Guardando...';
  if (btn) btn.disabled = true;

  try {
    await apiPut(`/journal/${dateStr}`, {
      content,
      summary,
      mood
    });
    showToast('Bitácora guardada correctamente', 'success');
    if (saveStatus) saveStatus.textContent = '✓ Guardado ' + new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    loadJournalEntries();
  } catch (err) {
    if (saveStatus) saveStatus.textContent = 'Error al guardar';
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function saveDayPanelJournal() {
  if (!state.selectedDate) return;
  const textarea = document.getElementById('day-panel-journal-content');
  if (!textarea) return;

  const content = textarea.value.trim();
  const btn = document.getElementById('btn-save-day-panel-journal');
  if (btn) btn.textContent = 'Guardando...';

  try {
    await apiPut(`/journal/${state.selectedDate}`, {
      content
    });
    showToast('Bitácora del día guardada', 'success');
    if (btn) btn.textContent = '✓ Guardado';
    setTimeout(() => {
      if (btn) btn.textContent = '💾 Guardar Bitácora';
    }, 2000);
  } catch (err) {
    if (btn) btn.textContent = 'Error';
  }
}

// -------------------------------------------------------------
// QUICK ACTION SHEET (Mobile Center FAB)
// -------------------------------------------------------------

function openQuickActionSheet() {
  const sheet = document.getElementById('quick-action-sheet');
  if (sheet) {
    sheet.classList.remove('hidden');
    sheet.classList.add('flex');
  }
}

function closeQuickActionSheet() {
  const sheet = document.getElementById('quick-action-sheet');
  if (sheet) {
    sheet.classList.add('hidden');
    sheet.classList.remove('flex');
  }
}

// -------------------------------------------------------------
// PUSH TEST & CLOCK
// -------------------------------------------------------------

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

    if (clockEl) {
      clockEl.innerHTML = `
        <span class="font-semibold text-slate-200">${diaSem}, ${diaNum} ${mes}</span>
        <span class="text-slate-500 mx-0.5">•</span>
        <span class="font-mono font-bold text-indigo-400">${hours}:${mins}:${secs}</span>
      `;
    }

    if (todayBadgeEl) {
      const diasCompletos = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const mesesCompletos = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
      todayBadgeEl.textContent = `Hoy es ${diasCompletos[now.getDay()]}, ${diaNum} de ${mesesCompletos[now.getMonth()]}`;
    }
  }
  update();
  setInterval(update, 1000);
}

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

// Force update helper for iPhone / Safari PWA
async function forceAppUpdate() {
  showToast('Limpiando caché y recargando...', 'info');
  if ('caches' in window) {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    } catch (e) {
      console.warn('Error clearing caches:', e);
    }
  }
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.unregister();
      }
    } catch (e) {
      console.warn('Error unregistering SW:', e);
    }
  }
  setTimeout(() => {
    window.location.href = '/?v=' + Date.now();
  }, 400);
}

// -------------------------------------------------------------
// APP INITIALIZATION
// -------------------------------------------------------------

document.addEventListener('DOMContentLoaded', async () => {
  startClock();
  setupTouchGestures();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then(reg => {
      // Force check for updated SW immediately
      reg.update();
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              showToast('¡Nueva versión detectada! Actualizando...', 'info');
              setTimeout(() => {
                window.location.reload();
              }, 1000);
            }
          });
        }
      });
    }).catch(err => console.log('SW registration error:', err));
  }

  // Setup View Switchers
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  // Modal Listeners
  document.getElementById('btn-new-event-top')?.addEventListener('click', () => openEventModal());
  document.getElementById('btn-close-modal')?.addEventListener('click', closeEventModal);
  document.getElementById('btn-cancel-modal')?.addEventListener('click', closeEventModal);
  document.getElementById('event-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'event-modal') closeEventModal();
  });
  document.getElementById('task-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'task-modal') closeTaskModal();
  });

  // Form Submissions
  document.getElementById('event-form')?.addEventListener('submit', handleEventFormSubmit);
  document.getElementById('task-form')?.addEventListener('submit', handleTaskFormSubmit);
  document.getElementById('quick-task-form')?.addEventListener('submit', handleQuickTaskSubmit);

  // Dynamic Multi-day Check on Date change
  document.getElementById('event-start')?.addEventListener('input', updateMultiDayBadge);
  document.getElementById('event-end')?.addEventListener('input', updateMultiDayBadge);
  document.getElementById('event-is-multiday')?.addEventListener('change', (e) => {
    if (e.target.checked) {
      const startStr = document.getElementById('event-start').value;
      if (startStr && !document.getElementById('event-end').value) {
        const s = parseDate(startStr);
        s.setDate(s.getDate() + 2);
        document.getElementById('event-end').value = formatForDateTimeInput(s);
      }
    }
    updateMultiDayBadge();
  });

  // Push Test Buttons
  document.getElementById('btn-test-push')?.addEventListener('click', sendTestPush);
  document.getElementById('btn-test-push-settings')?.addEventListener('click', sendTestPush);

  // Journal Date Input Change
  document.getElementById('journal-date-input')?.addEventListener('change', (e) => {
    if (e.target.value) {
      loadJournalForDate(e.target.value);
    }
  });

  // Category Color picker sync
  document.getElementById('event-category')?.addEventListener('change', (e) => {
    const cat = state.categories.find(c => c.name === e.target.value);
    if (cat) {
      document.getElementById('event-color').value = cat.color;
    }
  });

  // Event search
  let searchTimeout;
  document.getElementById('search-input')?.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      state.searchQuery = e.target.value.trim();
      loadEvents();
    }, 250);
  });

  // Event Category filters
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

  // Mobile keyboard handling via Visual Viewport API
  // Hides bottom navigation when virtual keyboard opens so it doesn't cover content or shift upwards
  if (window.visualViewport) {
    const handleViewportChange = () => {
      const bottomNav = document.getElementById('mobile-bottom-nav');
      if (!bottomNav) return;
      const isKeyboardOpen = window.visualViewport.height < window.innerHeight * 0.78;
      if (isKeyboardOpen) {
        bottomNav.style.transform = 'translateY(100%)';
        bottomNav.style.opacity = '0';
        bottomNav.style.pointerEvents = 'none';
      } else {
        bottomNav.style.transform = '';
        bottomNav.style.opacity = '';
        bottomNav.style.pointerEvents = '';
      }
    };
    window.visualViewport.addEventListener('resize', handleViewportChange);
    window.visualViewport.addEventListener('scroll', handleViewportChange);
  }

  // Initial load
  const todayStr = formatDateToIsoString(new Date());
  state.selectedDate = todayStr;

  await loadSettings();
  await loadEvents();
  await loadTasks();
});
