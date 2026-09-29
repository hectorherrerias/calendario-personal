/**
 * Calendario Personal - Calendar Grid & List View Renderer
 */

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function renderMainView() {
  if (state.activeView === 'calendar') {
    renderCalendarGrid();
    renderSelectedDayPanel();
  } else if (state.activeView === 'list') {
    renderListView();
  }
}

// -------------------------------------------------------------
// MONTHLY CALENDAR GRID
// -------------------------------------------------------------

function renderCalendarGrid() {
  const container = document.getElementById('calendar-grid-container');
  const monthTitleEl = document.getElementById('current-month-title');
  if (!container || !monthTitleEl) return;

  const currentYear = state.currentDate.getFullYear();
  const currentMonth = state.currentDate.getMonth();

  monthTitleEl.textContent = `${MONTH_NAMES[currentMonth]} ${currentYear}`;

  // First day of current month
  const firstDay = new Date(currentYear, currentMonth, 1);
  // Last day of current month
  const lastDay = new Date(currentYear, currentMonth + 1, 0);

  // In JS, getDay() returns 0 for Sunday, 1 for Monday...
  // Let's adjust so 0 = Monday, 6 = Sunday
  let startDayIndex = (firstDay.getDay() + 6) % 7;
  const totalDays = lastDay.getDate();

  // Days from previous month to fill the first row
  const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();

  const today = new Date();
  const isCurrentMonthActual = today.getFullYear() === currentYear && today.getMonth() === currentMonth;

  let html = '';

  // 1. Weekday Header Row
  html += '<div class="calendar-grid bg-slate-900/80 border-b border-slate-800 text-center py-2 text-xs font-semibold text-slate-400">';
  WEEKDAYS.forEach((w, idx) => {
    const isWeekend = idx >= 5;
    html += `<div class="${isWeekend ? 'text-indigo-400' : ''}">${w}</div>`;
  });
  html += '</div>';

  // 2. Days Grid
  html += '<div class="calendar-grid divide-x divide-y divide-slate-800/60 bg-slate-950/40">';

  // Previous month trailing days
  for (let i = startDayIndex - 1; i >= 0; i--) {
    const dayNum = prevMonthLastDay - i;
    const dateStr = `${currentMonth === 0 ? currentYear - 1 : currentYear}-${String(currentMonth === 0 ? 12 : currentMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    html += `
      <div class="calendar-day-cell p-1.5 sm:p-2.5 opacity-30 cursor-pointer hover:opacity-60 transition-all" onclick="selectDate('${dateStr}')">
        <div class="text-xs font-semibold text-slate-500">${dayNum}</div>
      </div>
    `;
  }

  // Current month days
  for (let day = 1; day <= totalDays; day++) {
    const dateObj = new Date(currentYear, currentMonth, day);
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isToday = isCurrentMonthActual && today.getDate() === day;
    const isSelected = state.selectedDate === dateStr;

    // Filter events for this specific day
    const dayEvents = state.events.filter(e => {
      const eDate = new Date(e.start_time);
      return eDate.getFullYear() === currentYear &&
             eDate.getMonth() === currentMonth &&
             eDate.getDate() === day;
    });

    html += `
      <div class="calendar-day-cell p-1.5 sm:p-2.5 flex flex-col justify-between cursor-pointer relative group transition-all duration-150 ${isSelected ? 'bg-indigo-950/40 ring-2 ring-indigo-500 rounded-lg z-10' : ''} ${isToday ? 'bg-indigo-900/10' : ''}" onclick="selectDate('${dateStr}')">
        <div class="flex items-center justify-between">
          <span class="inline-flex items-center justify-center text-xs sm:text-sm font-semibold w-6 h-6 rounded-full transition-all ${
            isToday 
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/50 ring-2 ring-indigo-400' 
              : isSelected 
                ? 'bg-indigo-500/20 text-indigo-300' 
                : 'text-slate-300 group-hover:text-white'
          }">
            ${day}
          </span>
          ${dayEvents.length > 0 ? `<span class="hidden sm:inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300">${dayEvents.length}</span>` : ''}
        </div>

        <!-- Event Badges / Dots -->
        <div class="mt-1 space-y-1 overflow-hidden max-h-[52px] sm:max-h-[64px]">
          ${dayEvents.slice(0, 3).map(ev => `
            <div class="hidden sm:flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium truncate text-white shadow-sm" style="background-color: ${ev.color || '#6366f1'}cc;" title="${escapeHtml(ev.title)}">
              <span class="w-1.5 h-1.5 rounded-full bg-white shrink-0"></span>
              <span class="truncate">${escapeHtml(ev.title)}</span>
            </div>
          `).join('')}

          <!-- Mobile Dots representation -->
          <div class="flex sm:hidden items-center justify-center gap-1 mt-1">
            ${dayEvents.slice(0, 4).map(ev => `
              <span class="w-1.5 h-1.5 rounded-full" style="background-color: ${ev.color || '#6366f1'}"></span>
            `).join('')}
          </div>

          ${dayEvents.length > 3 ? `
            <div class="hidden sm:block text-[9px] text-slate-400 font-semibold text-center">+${dayEvents.length - 3} más</div>
          ` : ''}
        </div>
      </div>
    `;
  }

  // Next month leading days to complete full grid (multiple of 7)
  const totalRendered = startDayIndex + totalDays;
  const remainingCells = (7 - (totalRendered % 7)) % 7;
  for (let d = 1; d <= remainingCells; d++) {
    const dateStr = `${currentMonth === 11 ? currentYear + 1 : currentYear}-${String(currentMonth === 11 ? 1 : currentMonth + 2).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    html += `
      <div class="calendar-day-cell p-1.5 sm:p-2.5 opacity-30 cursor-pointer hover:opacity-60 transition-all" onclick="selectDate('${dateStr}')">
        <div class="text-xs font-semibold text-slate-500">${d}</div>
      </div>
    `;
  }

  html += '</div>';
  container.innerHTML = html;
}

function prevMonth() {
  state.currentDate.setMonth(state.currentDate.getMonth() - 1);
  renderCalendarGrid();
}

function nextMonth() {
  state.currentDate.setMonth(state.currentDate.getMonth() + 1);
  renderCalendarGrid();
}

function goToToday() {
  state.currentDate = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  state.selectedDate = `${state.currentDate.getFullYear()}-${pad(state.currentDate.getMonth() + 1)}-${pad(state.currentDate.getDate())}`;
  renderCalendarGrid();
  renderSelectedDayPanel();
}

function selectDate(dateStr) {
  state.selectedDate = dateStr;
  renderCalendarGrid();
  renderSelectedDayPanel();
}

// -------------------------------------------------------------
// SELECTED DAY DETAILS PANEL
// -------------------------------------------------------------

function renderSelectedDayPanel() {
  const panel = document.getElementById('selected-day-details');
  if (!panel) return;

  if (!state.selectedDate) {
    // Default to today
    const pad = (n) => String(n).padStart(2, '0');
    const d = new Date();
    state.selectedDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  const [y, m, d] = state.selectedDate.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const dateTitle = dateObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const dayEvents = state.events.filter(e => {
    const evDate = new Date(e.start_time);
    return evDate.getFullYear() === y &&
           evDate.getMonth() === m - 1 &&
           evDate.getDate() === d;
  });

  let html = `
    <div class="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
      <div>
        <h3 class="text-sm font-bold text-white capitalize">${dateTitle}</h3>
        <p class="text-xs text-slate-400">${dayEvents.length} evento(s) programados</p>
      </div>
      <button onclick="openEventModal(null, '${state.selectedDate}')" class="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow transition-all">
        <span>+ Añadir evento</span>
      </button>
    </div>
  `;

  if (dayEvents.length === 0) {
    html += `
      <div class="text-center py-8 text-slate-500 text-xs">
        <p class="text-2xl mb-1">🏖️</p>
        <p>No hay eventos registrados para este día.</p>
        <button onclick="openEventModal(null, '${state.selectedDate}')" class="mt-2 text-indigo-400 hover:text-indigo-300 underline font-medium">Crear un recordatorio</button>
      </div>
    `;
  } else {
    html += '<div class="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">';
    dayEvents.forEach(ev => {
      const evDate = new Date(ev.start_time);
      const timeStr = ev.all_day ? 'Todo el día' : evDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

      html += `
        <div class="p-3 rounded-xl bg-slate-900/90 border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col gap-2 relative overflow-hidden">
          <div class="absolute left-0 top-0 bottom-0 w-1" style="background-color: ${ev.color || '#6366f1'};"></div>
          
          <div class="flex items-start justify-between gap-2 pl-1">
            <div>
              <div class="flex items-center gap-2">
                <h4 class="text-xs sm:text-sm font-bold text-white">${escapeHtml(ev.title)}</h4>
                <span class="text-[10px] px-2 py-0.5 rounded-full font-medium" style="background-color: ${ev.color || '#6366f1'}25; color: ${ev.color || '#6366f1'};">
                  ${escapeHtml(ev.category || 'General')}
                </span>
              </div>
              <p class="text-[11px] font-semibold text-indigo-400 mt-0.5">⏰ ${timeStr} ${ev.location ? `• 📍 ${escapeHtml(ev.location)}` : ''}</p>
            </div>
            
            <div class="flex items-center gap-1">
              <button onclick="triggerEventNotificationNow(${ev.id})" title="Enviar notificación ahora" class="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition-all">
                🔔
              </button>
              <button onclick='openEventModal(${JSON.stringify(ev).replace(/'/g, "&#39;")})' title="Editar" class="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition-all">
                ✏️
              </button>
              <button onclick="confirmDeleteEvent(${ev.id}, '${escapeHtml(ev.title)}')" title="Eliminar" class="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-all">
                🗑️
              </button>
            </div>
          </div>

          ${ev.description ? `<p class="text-xs text-slate-400 pl-1 line-clamp-2">${escapeHtml(ev.description)}</p>` : ''}

          <!-- Notification status pills -->
          <div class="flex items-center gap-1.5 pt-1 pl-1 border-t border-slate-800/60 text-[10px] font-medium text-slate-400">
            <span class="inline-flex items-center gap-1 ${ev.notified_7d ? 'text-emerald-400 font-bold' : 'text-slate-500'}">
              ${ev.notified_7d ? '✓' : '⏳'} 7d
            </span>
            <span>•</span>
            <span class="inline-flex items-center gap-1 ${ev.notified_1d ? 'text-emerald-400 font-bold' : 'text-slate-500'}">
              ${ev.notified_1d ? '✓' : '⏳'} 1d
            </span>
            <span>•</span>
            <span class="inline-flex items-center gap-1 ${ev.notified_day ? 'text-emerald-400 font-bold' : 'text-slate-500'}">
              ${ev.notified_day ? '✓' : '⏳'} Mismo día
            </span>
          </div>
        </div>
      `;
    });
    html += '</div>';
  }

  panel.innerHTML = html;
}

// -------------------------------------------------------------
// LIST VIEW ("PRÓXIMOS EVENTOS")
// -------------------------------------------------------------

function renderListView() {
  const container = document.getElementById('events-list-container');
  if (!container) return;

  if (state.events.length === 0) {
    container.innerHTML = `
      <div class="glass-panel rounded-2xl p-12 text-center text-slate-400">
        <p class="text-4xl mb-3">📅</p>
        <h3 class="text-base font-bold text-white mb-1">No hay eventos para mostrar</h3>
        <p class="text-xs text-slate-400 mb-4">No se encontraron eventos con los filtros actuales.</p>
        <button onclick="openEventModal()" class="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg transition-all">
          + Crear primer evento
        </button>
      </div>
    `;
    return;
  }

  const now = new Date();
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const oneWeekLater = new Date(todayDate);
  oneWeekLater.setDate(oneWeekLater.getDate() + 7);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  // Group events
  const groups = {
    today: [],
    thisWeek: [],
    thisMonth: [],
    future: [],
    past: []
  };

  state.events.forEach(ev => {
    const evDate = new Date(ev.start_time);
    const evDay = new Date(evDate.getFullYear(), evDate.getMonth(), evDate.getDate());

    if (evDay.getTime() === todayDate.getTime()) {
      groups.today.push(ev);
    } else if (evDay < todayDate) {
      groups.past.push(ev);
    } else if (evDay <= oneWeekLater) {
      groups.thisWeek.push(ev);
    } else if (evDay <= endOfMonth) {
      groups.thisMonth.push(ev);
    } else {
      groups.future.push(ev);
    }
  });

  let html = '';

  const renderSection = (title, icon, eventsArray, badgeColor) => {
    if (eventsArray.length === 0) return '';
    return `
      <div class="mb-8">
        <div class="flex items-center gap-2 mb-3">
          <span class="text-base">${icon}</span>
          <h3 class="text-sm font-bold text-white uppercase tracking-wider">${title}</h3>
          <span class="px-2 py-0.5 rounded-full text-xs font-bold ${badgeColor}">${eventsArray.length}</span>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          ${eventsArray.map(ev => renderEventCard(ev)).join('')}
        </div>
      </div>
    `;
  };

  html += renderSection('Hoy', '🔴', groups.today, 'bg-rose-500/20 text-rose-400');
  html += renderSection('Próximos 7 Días', '⚡', groups.thisWeek, 'bg-amber-500/20 text-amber-400');
  html += renderSection('Este Mes', '🗓️', groups.thisMonth, 'bg-indigo-500/20 text-indigo-400');
  html += renderSection('Más Adelante', '🚀', groups.future, 'bg-slate-700 text-slate-300');
  html += renderSection('Eventos Anteriores', '📁', groups.past, 'bg-slate-800 text-slate-500');

  container.innerHTML = html;
}

function renderEventCard(ev) {
  const evDate = new Date(ev.start_time);
  const dateFormatted = evDate.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const timeFormatted = ev.all_day ? 'Todo el día' : evDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  return `
    <div class="glass-card rounded-2xl p-4 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between relative group">
      <div class="absolute top-0 left-0 right-0 h-1 rounded-t-2xl" style="background-color: ${ev.color || '#6366f1'};"></div>
      
      <div>
        <div class="flex items-start justify-between gap-2 mb-2">
          <span class="px-2.5 py-1 rounded-lg text-xs font-semibold" style="background-color: ${ev.color || '#6366f1'}20; color: ${ev.color || '#6366f1'};">
            ${escapeHtml(ev.category || 'General')}
          </span>
          <div class="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
            <button onclick="triggerEventNotificationNow(${ev.id})" title="Enviar alerta push ahora" class="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition-all">
              🔔
            </button>
            <button onclick='openEventModal(${JSON.stringify(ev).replace(/'/g, "&#39;")})' title="Editar" class="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition-all">
              ✏️
            </button>
            <button onclick="confirmDeleteEvent(${ev.id}, '${escapeHtml(ev.title)}')" title="Eliminar" class="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-all">
              🗑️
            </button>
          </div>
        </div>

        <h4 class="text-base font-bold text-white mb-1.5 group-hover:text-indigo-300 transition-colors">${escapeHtml(ev.title)}</h4>
        
        <div class="flex flex-col gap-1 text-xs text-slate-400 mb-3">
          <span class="flex items-center gap-1 text-slate-300 font-medium">
            🗓️ ${dateFormatted} • ⏰ ${timeFormatted}
          </span>
          ${ev.location ? `<span class="flex items-center gap-1 text-slate-400">📍 ${escapeHtml(ev.location)}</span>` : ''}
        </div>

        ${ev.description ? `<p class="text-xs text-slate-400 line-clamp-3 mb-3 bg-slate-900/40 p-2 rounded-lg border border-slate-800/60">${escapeHtml(ev.description)}</p>` : ''}
      </div>

      <!-- Trigger Badges -->
      <div class="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
        <span class="text-slate-500 font-medium">Alertas automáticas:</span>
        <div class="flex items-center gap-2">
          <span title="Alerta 7 días antes" class="px-1.5 py-0.5 rounded text-[10px] font-bold ${ev.notified_7d ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-500'}">
            ${ev.notified_7d ? '✓' : '⏳'} 7d
          </span>
          <span title="Alerta 1 día antes" class="px-1.5 py-0.5 rounded text-[10px] font-bold ${ev.notified_1d ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-500'}">
            ${ev.notified_1d ? '✓' : '⏳'} 1d
          </span>
          <span title="Alerta mismo día" class="px-1.5 py-0.5 rounded text-[10px] font-bold ${ev.notified_day ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-500'}">
            ${ev.notified_day ? '✓' : '⏳'} Día
          </span>
        </div>
      </div>
    </div>
  `;
}

// -------------------------------------------------------------
// NOTIFICATION LOGS LIST
// -------------------------------------------------------------

function renderLogsList() {
  const container = document.getElementById('notification-logs-container');
  if (!container) return;

  if (state.logs.length === 0) {
    container.innerHTML = `
      <div class="text-center py-6 text-slate-500 text-xs">
        No hay registros de notificaciones aún.
      </div>
    `;
    return;
  }

  let html = '<div class="space-y-2">';
  state.logs.forEach(log => {
    const d = new Date(log.sent_at);
    const dateStr = d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const isSuccess = log.status === 'sent';

    html += `
      <div class="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start justify-between gap-3 text-xs">
        <div class="flex items-start gap-2.5">
          <span class="mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold ${isSuccess ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}">
            ${isSuccess ? 'ENVIADA' : 'FALLIDA'}
          </span>
          <div>
            <p class="font-bold text-slate-200">${escapeHtml(log.title)}</p>
            <p class="text-[11px] text-slate-400 mt-0.5 line-clamp-1">${escapeHtml(log.message)}</p>
            ${log.error_details ? `<p class="text-[10px] text-rose-400 mt-0.5 font-mono">${escapeHtml(log.error_details)}</p>` : ''}
          </div>
        </div>
        <div class="text-right shrink-0">
          <span class="text-[10px] text-slate-500 font-mono">${dateStr}</span>
          <p class="text-[10px] text-indigo-400 uppercase font-semibold mt-0.5">Canal: ${log.channel}</p>
        </div>
      </div>
    `;
  });
  html += '</div>';
  container.innerHTML = html;
}

// Utility to prevent XSS
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
