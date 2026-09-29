/**
 * Calendario Personal - Calendar Grid & List View Renderer (Mobile-Optimized)
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

  const firstDay = new Date(currentYear, currentMonth, 1);
  const lastDay = new Date(currentYear, currentMonth + 1, 0);

  // In JS getDay(): 0 is Sunday, 1 is Monday...
  let startDayIndex = (firstDay.getDay() + 6) % 7;
  const totalDays = lastDay.getDate();
  const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();

  const today = new Date();
  const isCurrentMonthActual = today.getFullYear() === currentYear && today.getMonth() === currentMonth;

  let html = '';

  // 1. Weekday Header Row
  html += '<div class="calendar-grid-header bg-slate-900/90 border-b border-slate-800 text-center py-2 text-[11px] sm:text-xs font-bold text-slate-400 select-none">';
  WEEKDAYS.forEach((w, idx) => {
    const isWeekend = idx >= 5;
    html += `<div class="${isWeekend ? 'text-indigo-400' : ''}">${w}</div>`;
  });
  html += '</div>';

  // 2. Days Grid
  html += '<div class="calendar-grid-body divide-x divide-y divide-slate-800/50 bg-slate-950/60">';

  // Previous month trailing days
  for (let i = startDayIndex - 1; i >= 0; i--) {
    const dayNum = prevMonthLastDay - i;
    const dateStr = `${currentMonth === 0 ? currentYear - 1 : currentYear}-${String(currentMonth === 0 ? 12 : currentMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    html += `
      <div class="calendar-day-cell opacity-25 cursor-pointer flex flex-col items-center justify-start pt-1.5" onclick="selectDate('${dateStr}')">
        <span class="text-[11px] font-semibold text-slate-500">${dayNum}</span>
      </div>
    `;
  }

  // Current month days
  for (let day = 1; day <= totalDays; day++) {
    const pad = (n) => String(n).padStart(2, '0');
    const dateStr = `${currentYear}-${pad(currentMonth + 1)}-${pad(day)}`;
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
      <div class="calendar-day-cell flex flex-col items-center sm:items-stretch justify-between cursor-pointer relative group transition-all duration-150 ${isSelected ? 'bg-indigo-950/60 ring-2 ring-indigo-500 z-10' : ''} ${isToday && !isSelected ? 'bg-indigo-900/15' : ''}" onclick="selectDate('${dateStr}')">
        
        <!-- Day Number Header -->
        <div class="flex items-center justify-between w-full px-1 sm:px-2 pt-1">
          <span class="inline-flex items-center justify-center text-xs sm:text-sm font-bold w-6 h-6 rounded-full transition-all ${
            isToday 
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/50 ring-2 ring-indigo-400/80' 
              : isSelected 
                ? 'bg-indigo-500 text-white font-black' 
                : 'text-slate-300 group-hover:text-white'
          }">
            ${day}
          </span>
          ${dayEvents.length > 0 ? `<span class="hidden sm:inline-block text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-slate-800/90 text-slate-300 border border-slate-700">${dayEvents.length}</span>` : ''}
        </div>

        <!-- Desktop Event Pills (Hidden on small mobile) -->
        <div class="hidden sm:block mt-1 space-y-1 overflow-hidden px-1.5 max-h-[52px]">
          ${dayEvents.slice(0, 2).map(ev => `
            <div class="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium truncate text-white shadow-sm" style="background-color: ${ev.color || '#6366f1'}cc;" title="${escapeHtml(ev.title)}">
              <span class="w-1.5 h-1.5 rounded-full bg-white shrink-0"></span>
              <span class="truncate">${escapeHtml(ev.title)}</span>
            </div>
          `).join('')}
          ${dayEvents.length > 2 ? `
            <div class="text-[9px] text-slate-400 font-bold text-center">+${dayEvents.length - 2} más</div>
          ` : ''}
        </div>

        <!-- Mobile Dots Indicator (Visible on mobile) -->
        <div class="flex sm:hidden items-center justify-center gap-1 pb-1 w-full min-h-[14px]">
          ${dayEvents.slice(0, 3).map(ev => `
            <span class="w-1.5 h-1.5 rounded-full shadow-sm" style="background-color: ${ev.color || '#6366f1'};"></span>
          `).join('')}
          ${dayEvents.length > 3 ? `
            <span class="w-1 h-1 rounded-full bg-slate-400"></span>
          ` : ''}
        </div>

      </div>
    `;
  }

  // Next month leading days
  const totalRendered = startDayIndex + totalDays;
  const remainingCells = (7 - (totalRendered % 7)) % 7;
  for (let d = 1; d <= remainingCells; d++) {
    const pad = (n) => String(n).padStart(2, '0');
    const dateStr = `${currentMonth === 11 ? currentYear + 1 : currentYear}-${pad(currentMonth === 11 ? 1 : currentMonth + 2)}-${pad(d)}`;
    html += `
      <div class="calendar-day-cell opacity-25 cursor-pointer flex flex-col items-center justify-start pt-1.5" onclick="selectDate('${dateStr}')">
        <span class="text-[11px] font-semibold text-slate-500">${d}</span>
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
    const pad = (n) => String(n).padStart(2, '0');
    const d = new Date();
    state.selectedDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  const [y, m, d] = state.selectedDate.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const dateTitle = dateObj.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });

  const dayEvents = state.events.filter(e => {
    const evDate = new Date(e.start_time);
    return evDate.getFullYear() === y &&
           evDate.getMonth() === m - 1 &&
           evDate.getDate() === d;
  });

  let html = `
    <div class="flex items-center justify-between mb-3 border-b border-slate-800/80 pb-2.5">
      <div>
        <h3 class="text-xs sm:text-sm font-bold text-white capitalize">${dateTitle}</h3>
        <p class="text-[11px] text-slate-400">${dayEvents.length} evento(s) este día</p>
      </div>
      <button onclick="openEventModal(null, '${state.selectedDate}')" class="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition-all active:scale-95">
        <span>+ Añadir</span>
      </button>
    </div>
  `;

  if (dayEvents.length === 0) {
    html += `
      <div class="text-center py-6 text-slate-500 text-xs">
        <p class="text-2xl mb-1">✨</p>
        <p class="font-medium">Sin eventos programados</p>
        <button onclick="openEventModal(null, '${state.selectedDate}')" class="mt-2 inline-block text-indigo-400 hover:text-indigo-300 font-semibold underline text-xs">
          Toca aquí para crear uno
        </button>
      </div>
    `;
  } else {
    html += '<div class="space-y-2.5 max-h-[320px] sm:max-h-[380px] overflow-y-auto pr-0.5 no-scrollbar">';
    dayEvents.forEach(ev => {
      const evDate = new Date(ev.start_time);
      const timeStr = ev.all_day ? 'Todo el día' : evDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

      html += `
        <div class="p-3 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all flex flex-col gap-2 relative overflow-hidden shadow-sm">
          <div class="absolute left-0 top-0 bottom-0 w-1.5" style="background-color: ${ev.color || '#6366f1'};"></div>
          
          <div class="flex items-start justify-between gap-2 pl-1.5">
            <div>
              <div class="flex items-center gap-1.5 flex-wrap">
                <h4 class="text-xs sm:text-sm font-bold text-white">${escapeHtml(ev.title)}</h4>
                <span class="text-[9px] px-2 py-0.5 rounded-full font-bold" style="background-color: ${ev.color || '#6366f1'}22; color: ${ev.color || '#6366f1'};">
                  ${escapeHtml(ev.category || 'General')}
                </span>
              </div>
              <p class="text-[11px] font-semibold text-indigo-400 mt-0.5">⏰ ${timeStr} ${ev.location ? `• 📍 ${escapeHtml(ev.location)}` : ''}</p>
            </div>
            
            <div class="flex items-center gap-1 shrink-0">
              <button onclick="triggerEventNotificationNow(${ev.id})" title="Enviar alerta ahora" class="p-2 rounded-xl text-slate-400 hover:text-amber-400 bg-slate-950/60 border border-slate-800 transition-all active:scale-90">
                🔔
              </button>
              <button onclick='openEventModal(${JSON.stringify(ev).replace(/'/g, "&#39;")})' title="Editar" class="p-2 rounded-xl text-slate-400 hover:text-indigo-400 bg-slate-950/60 border border-slate-800 transition-all active:scale-90">
                ✏️
              </button>
              <button onclick="confirmDeleteEvent(${ev.id}, '${escapeHtml(ev.title)}')" title="Eliminar" class="p-2 rounded-xl text-slate-400 hover:text-rose-400 bg-slate-950/60 border border-slate-800 transition-all active:scale-90">
                🗑️
              </button>
            </div>
          </div>

          ${ev.description ? `<p class="text-[11px] text-slate-400 pl-1.5 line-clamp-2">${escapeHtml(ev.description)}</p>` : ''}

          <!-- Notification trigger status -->
          <div class="flex items-center gap-2 pt-1 pl-1.5 border-t border-slate-800/80 text-[10px] font-medium text-slate-400">
            <span class="inline-flex items-center gap-0.5 ${ev.notified_7d ? 'text-emerald-400 font-bold' : 'text-slate-500'}">
              ${ev.notified_7d ? '✓' : '⏳'} 7d
            </span>
            <span>•</span>
            <span class="inline-flex items-center gap-0.5 ${ev.notified_1d ? 'text-emerald-400 font-bold' : 'text-slate-500'}">
              ${ev.notified_1d ? '✓' : '⏳'} 1d
            </span>
            <span>•</span>
            <span class="inline-flex items-center gap-0.5 ${ev.notified_day ? 'text-emerald-400 font-bold' : 'text-slate-500'}">
              ${ev.notified_day ? '✓' : '⏳'} Día
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
      <div class="glass-panel rounded-2xl p-8 sm:p-12 text-center text-slate-400 shadow-xl">
        <p class="text-4xl mb-2">📅</p>
        <h3 class="text-sm sm:text-base font-bold text-white mb-1">Sin eventos</h3>
        <p class="text-xs text-slate-400 mb-4">No hay eventos con los filtros seleccionados.</p>
        <button onclick="openEventModal()" class="px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg transition-all active:scale-95">
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
      <div class="mb-6">
        <div class="flex items-center gap-2 mb-2.5 px-1">
          <span class="text-sm sm:text-base">${icon}</span>
          <h3 class="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">${title}</h3>
          <span class="px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold ${badgeColor}">${eventsArray.length}</span>
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
  html += renderSection('Más Adelante', '🚀', groups.future, 'bg-slate-800 text-slate-300');
  html += renderSection('Eventos Anteriores', '📁', groups.past, 'bg-slate-900 text-slate-500');

  container.innerHTML = html;
}

function renderEventCard(ev) {
  const evDate = new Date(ev.start_time);
  const dateFormatted = evDate.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const timeFormatted = ev.all_day ? 'Todo el día' : evDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  return `
    <div class="glass-card rounded-2xl p-4 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between relative group shadow-md">
      <div class="absolute top-0 left-0 right-0 h-1 rounded-t-2xl" style="background-color: ${ev.color || '#6366f1'};"></div>
      
      <div>
        <div class="flex items-start justify-between gap-2 mb-2">
          <span class="px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-bold" style="background-color: ${ev.color || '#6366f1'}20; color: ${ev.color || '#6366f1'};">
            ${escapeHtml(ev.category || 'General')}
          </span>
          
          <div class="flex items-center gap-1">
            <button onclick="triggerEventNotificationNow(${ev.id})" title="Enviar alerta push" class="p-2 rounded-xl text-slate-400 hover:text-amber-400 bg-slate-900/80 border border-slate-800 transition-all active:scale-90">
              🔔
            </button>
            <button onclick='openEventModal(${JSON.stringify(ev).replace(/'/g, "&#39;")})' title="Editar" class="p-2 rounded-xl text-slate-400 hover:text-indigo-400 bg-slate-900/80 border border-slate-800 transition-all active:scale-90">
              ✏️
            </button>
            <button onclick="confirmDeleteEvent(${ev.id}, '${escapeHtml(ev.title)}')" title="Eliminar" class="p-2 rounded-xl text-slate-400 hover:text-rose-400 bg-slate-900/80 border border-slate-800 transition-all active:scale-90">
              🗑️
            </button>
          </div>
        </div>

        <h4 class="text-sm sm:text-base font-bold text-white mb-1">${escapeHtml(ev.title)}</h4>
        
        <div class="flex flex-col gap-0.5 text-xs text-slate-400 mb-2.5">
          <span class="flex items-center gap-1 text-slate-300 font-semibold text-[11px] sm:text-xs">
            🗓️ ${dateFormatted} • ⏰ ${timeFormatted}
          </span>
          ${ev.location ? `<span class="flex items-center gap-1 text-slate-400 text-[11px]">📍 ${escapeHtml(ev.location)}</span>` : ''}
        </div>

        ${ev.description ? `<p class="text-[11px] text-slate-400 line-clamp-2 mb-2.5 bg-slate-900/50 p-2 rounded-xl border border-slate-800/60">${escapeHtml(ev.description)}</p>` : ''}
      </div>

      <!-- Trigger Badges -->
      <div class="pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
        <span class="text-slate-500 font-medium">Alertas automáticas:</span>
        <div class="flex items-center gap-1.5">
          <span title="Alerta 7 días antes" class="px-1.5 py-0.5 rounded text-[10px] font-bold ${ev.notified_7d ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800/80 text-slate-500'}">
            ${ev.notified_7d ? '✓' : '⏳'} 7d
          </span>
          <span title="Alerta 1 día antes" class="px-1.5 py-0.5 rounded text-[10px] font-bold ${ev.notified_1d ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800/80 text-slate-500'}">
            ${ev.notified_1d ? '✓' : '⏳'} 1d
          </span>
          <span title="Alerta mismo día" class="px-1.5 py-0.5 rounded text-[10px] font-bold ${ev.notified_day ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800/80 text-slate-500'}">
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
        No hay registros de notificaciones todavía.
      </div>
    `;
    return;
  }

  let html = '<div class="space-y-2">';
  state.logs.forEach(log => {
    const d = new Date(log.sent_at);
    const dateStr = d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    const isSuccess = log.status === 'sent';

    html += `
      <div class="p-3 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-start justify-between gap-2.5 text-xs">
        <div class="flex items-start gap-2">
          <span class="mt-0.5 px-2 py-0.5 rounded text-[9px] font-bold ${isSuccess ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}">
            ${isSuccess ? 'ENVIADO' : 'ERROR'}
          </span>
          <div>
            <p class="font-bold text-slate-200 text-xs">${escapeHtml(log.title)}</p>
            <p class="text-[11px] text-slate-400 mt-0.5 line-clamp-1">${escapeHtml(log.message)}</p>
            ${log.error_details ? `<p class="text-[10px] text-rose-400 mt-0.5 font-mono">${escapeHtml(log.error_details)}</p>` : ''}
          </div>
        </div>
        <div class="text-right shrink-0">
          <span class="text-[10px] text-slate-500 font-mono">${dateStr}</span>
          <p class="text-[9px] text-indigo-400 uppercase font-semibold mt-0.5">${log.channel}</p>
        </div>
      </div>
    `;
  });
  html += '</div>';
  container.innerHTML = html;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
