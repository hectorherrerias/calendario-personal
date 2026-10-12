/**
 * Calendario Personal - Calendar Grid, Tasks, Journal & List View Renderer
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
  } else if (state.activeView === 'tasks') {
    renderTasksView();
  } else if (state.activeView === 'journal') {
    renderJournalView();
  } else if (state.activeView === 'list') {
    renderListView();
  }
}

// -------------------------------------------------------------
// 1. MONTHLY CALENDAR GRID (Con soporte de Eventos Multidía)
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
    const pad = (n) => String(n).padStart(2, '0');
    const prevM = currentMonth === 0 ? 12 : currentMonth;
    const prevY = currentMonth === 0 ? currentYear - 1 : currentYear;
    const dateStr = `${prevY}-${pad(prevM)}-${pad(dayNum)}`;
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
    const cellDate = new Date(currentYear, currentMonth, day);
    const isToday = isCurrentMonthActual && today.getDate() === day;
    const isSelected = state.selectedDate === dateStr;

    // Filter events occurring on this specific day (single-day and multi-day spans)
    const dayEvents = state.events.filter(e => isEventOnDate(e, cellDate));

    // Also count pending tasks due on this date
    const dayTasks = state.tasks.filter(t => {
      if (!t.due_date) return false;
      const tDate = parseDate(t.due_date);
      return tDate.getFullYear() === currentYear &&
             tDate.getMonth() === currentMonth &&
             tDate.getDate() === day;
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
          <div class="flex items-center gap-1">
            ${dayTasks.length > 0 ? `<span title="${dayTasks.length} tarea(s)" class="hidden sm:inline-block text-[9px] font-bold px-1 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-500/30">✓${dayTasks.length}</span>` : ''}
            ${dayEvents.length > 0 ? `<span class="hidden sm:inline-block text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-slate-800/90 text-slate-300 border border-slate-700">${dayEvents.length}</span>` : ''}
          </div>
        </div>

        <!-- Desktop Event Pills with Multi-day Support (Hidden on small mobile) -->
        <div class="hidden sm:block mt-1 space-y-1 overflow-hidden px-1.5 max-h-[56px]">
          ${dayEvents.slice(0, 2).map(ev => {
            const status = getEventDayStatus(ev, cellDate);
            const pad = (n) => String(n).padStart(2, '0');
            const evDate = parseDate(ev.start_time);
            
            let label = escapeHtml(ev.title);
            let pillClass = 'rounded';
            let prefix = '';

            if (status.isMultiDay) {
              if (status.isStart) {
                prefix = `(1/${status.totalDays}) `;
                label = `${prefix}${label} ➔`;
                pillClass = 'start-pill';
              } else if (status.isEnd) {
                prefix = `(${status.dayIndex}/${status.totalDays}) `;
                label = `← ${prefix}${label}`;
                pillClass = 'end-pill';
              } else {
                prefix = `(${status.dayIndex}/${status.totalDays}) `;
                label = `↔ ${prefix}${label}`;
                pillClass = 'middle-pill';
              }
            } else if (!ev.all_day) {
              label = `(${pad(evDate.getHours())}:${pad(evDate.getMinutes())}) ${label}`;
            }

            return `
              <div class="multiday-pill ${pillClass} flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium truncate text-white shadow-sm" style="background-color: ${ev.color || '#6366f1'}cc;" title="${escapeHtml(ev.title)} ${status.isMultiDay ? `(Multidía día ${status.dayIndex} de ${status.totalDays})` : ''}">
                <span class="w-1.5 h-1.5 rounded-full bg-white shrink-0"></span>
                <span class="truncate">${label}</span>
              </div>
            `;
          }).join('')}
          ${dayEvents.length > 2 ? `
            <div class="text-[9px] text-slate-400 font-bold text-center">+${dayEvents.length - 2} más</div>
          ` : ''}
        </div>

        <!-- Mobile Dots Indicator (Visible on mobile) -->
        <div class="flex sm:hidden items-center justify-center gap-1 pb-1 w-full min-h-[14px]">
          ${dayEvents.slice(0, 3).map(ev => `
            <span class="w-1.5 h-1.5 rounded-full shadow-sm" style="background-color: ${ev.color || '#6366f1'};"></span>
          `).join('')}
          ${dayTasks.length > 0 ? `<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-sm" title="Tareas"></span>` : ''}
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
    const nextM = currentMonth === 11 ? 1 : currentMonth + 2;
    const nextY = currentMonth === 11 ? currentYear + 1 : currentYear;
    const dateStr = `${nextY}-${pad(nextM)}-${pad(d)}`;
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
  state.selectedDate = formatDateToIsoString(state.currentDate);
  renderCalendarGrid();
  renderSelectedDayPanel();
}

function selectDate(dateStr) {
  state.selectedDate = dateStr;
  renderCalendarGrid();
  renderSelectedDayPanel();
}

// -------------------------------------------------------------
// 2. SELECTED DAY DETAILS PANEL (Eventos, Tareas y Bitácora)
// -------------------------------------------------------------

function renderSelectedDayPanel() {
  const panel = document.getElementById('selected-day-details');
  if (!panel) return;

  const now = new Date();
  const todayStr = formatDateToIsoString(now);

  if (!state.selectedDate) {
    state.selectedDate = todayStr;
  }

  const [y, m, d] = state.selectedDate.split('-').map(Number);
  const cellDate = new Date(y, m - 1, d);
  const isSelectedToday = state.selectedDate === todayStr;

  const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  
  const diaSem = diasSemana[cellDate.getDay()];
  const mesNombre = meses[m - 1];
  const dateTitle = `${diaSem}, ${d} de ${mesNombre} de ${y}`;

  // Filter events on this date (single & multi-day)
  const dayEvents = state.events.filter(e => isEventOnDate(e, cellDate));

  // Filter tasks due on this date
  const dayTasks = state.tasks.filter(t => {
    if (!t.due_date) return false;
    const tDate = parseDate(t.due_date);
    return tDate.getFullYear() === y &&
           tDate.getMonth() === m - 1 &&
           tDate.getDate() === d;
  });

  const pad = (n) => String(n).padStart(2, '0');

  let html = `
    <!-- Day Header -->
    <div class="flex items-center justify-between border-b border-slate-800 pb-3">
      <div>
        <div class="flex items-center gap-1.5">
          <h3 class="text-xs sm:text-sm font-bold text-white capitalize">${dateTitle}</h3>
          ${isSelectedToday ? '<span class="text-[9px] font-black px-1.5 py-0.5 rounded bg-indigo-500 text-white shadow-sm">HOY</span>' : ''}
        </div>
        <p class="text-[11px] text-slate-400 mt-0.5">${dayEvents.length} evento(s) • ${dayTasks.length} tarea(s)</p>
      </div>

      <div class="flex items-center gap-1.5">
        <button onclick="openTaskModal(null, '${state.selectedDate}')" title="Añadir tarea a este día" class="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 transition-all active:scale-95">
          <span>+ Tarea</span>
        </button>
        <button onclick="openEventModal(null, '${state.selectedDate}')" title="Añadir evento a este día" class="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition-all active:scale-95">
          <span>+ Evento</span>
        </button>
      </div>
    </div>
  `;

  // -----------------------------------------------------------
  // SECTION A: EVENTOS DEL DÍA
  // -----------------------------------------------------------
  html += `
    <div class="space-y-2">
      <div class="flex items-center justify-between text-xs font-bold text-slate-300">
        <span class="flex items-center gap-1">🗓️ Eventos del Día (${dayEvents.length})</span>
      </div>
  `;

  if (dayEvents.length === 0) {
    html += `
      <div class="text-center py-4 text-slate-500 text-xs bg-slate-900/40 rounded-xl border border-slate-800/60">
        <p class="font-medium">Sin eventos programados este día</p>
      </div>
    `;
  } else {
    html += '<div class="space-y-2 max-h-[220px] overflow-y-auto pr-0.5 no-scrollbar">';
    dayEvents.forEach(ev => {
      const status = getEventDayStatus(ev, cellDate);
      const evStart = parseDate(ev.start_time);
      const hours = pad(evStart.getHours());
      const mins = pad(evStart.getMinutes());
      
      let timeStr = '🌞 Todo el día';
      if (!ev.all_day) {
        timeStr = `⏰ ${hours}:${mins} hs`;
        const endVal = ev.end_date || ev.end_time;
        if (endVal) {
          const evEnd = parseDate(endVal);
          if (evEnd.getDate() === evStart.getDate()) {
            timeStr += ` - ${pad(evEnd.getHours())}:${pad(evEnd.getMinutes())} hs`;
          }
        }
      }

      html += `
        <div class="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all flex flex-col gap-1.5 relative overflow-hidden shadow-sm">
          <div class="absolute left-0 top-0 bottom-0 w-1.5" style="background-color: ${ev.color || '#6366f1'};"></div>
          
          <div class="flex items-start justify-between gap-2 pl-1">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5 flex-wrap">
                <h4 class="text-xs sm:text-sm font-bold text-white truncate">${escapeHtml(ev.title)}</h4>
                <span class="text-[9px] px-2 py-0.5 rounded-full font-bold" style="background-color: ${ev.color || '#6366f1'}22; color: ${ev.color || '#6366f1'};">
                  ${escapeHtml(ev.category || 'General')}
                </span>
                ${status.isMultiDay ? `<span class="text-[9px] px-1.5 py-0.5 rounded font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">Día ${status.dayIndex}/${status.totalDays}</span>` : ''}
              </div>
              <p class="text-[11px] font-semibold text-indigo-400 mt-0.5">${timeStr} ${ev.location ? `• 📍 ${escapeHtml(ev.location)}` : ''}</p>
            </div>
            
            <div class="flex items-center gap-1 shrink-0">
              <button onclick="triggerEventNotificationNow(${ev.id})" title="Enviar alerta push" class="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 bg-slate-950/60 border border-slate-800 transition-all active:scale-90 text-xs">
                🔔
              </button>
              <button onclick='openEventModal(${JSON.stringify(ev).replace(/'/g, "&#39;")})' title="Editar" class="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 bg-slate-950/60 border border-slate-800 transition-all active:scale-90 text-xs">
                ✏️
              </button>
              <button onclick="confirmDeleteEvent(${ev.id}, '${escapeHtml(ev.title)}')" title="Eliminar" class="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 bg-slate-950/60 border border-slate-800 transition-all active:scale-90 text-xs">
                🗑️
              </button>
            </div>
          </div>

          ${ev.description ? `<p class="text-[11px] text-slate-400 pl-1 line-clamp-2">${escapeHtml(ev.description)}</p>` : ''}
        </div>
      `;
    });
    html += '</div>';
  }
  html += '</div>';

  // -----------------------------------------------------------
  // SECTION B: TAREAS DEL DÍA
  // -----------------------------------------------------------
  html += `
    <div class="space-y-2 pt-2 border-t border-slate-800/80">
      <div class="flex items-center justify-between text-xs font-bold text-slate-300">
        <span class="flex items-center gap-1">📋 Tareas para este día (${dayTasks.length})</span>
        <button onclick="openTaskModal(null, '${state.selectedDate}')" class="text-[11px] text-emerald-400 hover:underline font-semibold">+ Tarea</button>
      </div>
  `;

  if (dayTasks.length === 0) {
    html += `
      <div class="text-center py-3 text-slate-500 text-xs bg-slate-900/40 rounded-xl border border-slate-800/60">
        <p class="font-medium">Sin tareas asignadas a este día</p>
      </div>
    `;
  } else {
    html += '<div class="space-y-1.5 max-h-[160px] overflow-y-auto pr-0.5 no-scrollbar">';
    dayTasks.forEach(task => {
      const priorityColors = {
        high: 'text-rose-400 bg-rose-500/15 border-rose-500/30',
        medium: 'text-amber-400 bg-amber-500/15 border-amber-500/30',
        low: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30'
      };
      const priClass = priorityColors[task.priority] || priorityColors.medium;

      html += `
        <div class="p-2 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-2 transition-all">
          <div class="flex items-center gap-2 min-w-0 flex-1">
            <input type="checkbox" ${task.completed ? 'checked' : ''} onchange="toggleTask(${task.id})" class="task-checkbox" title="Marcar como completada">
            <span class="task-title text-xs font-medium truncate ${task.completed ? 'completed' : 'text-slate-200'}">
              ${escapeHtml(task.title)}
            </span>
            <span class="text-[9px] px-1.5 py-0.2 rounded font-bold uppercase border ${priClass}">
              ${task.priority}
            </span>
          </div>

          <div class="flex items-center gap-1 shrink-0">
            <button onclick='openTaskModal(${JSON.stringify(task).replace(/'/g, "&#39;")})' title="Editar" class="p-1 rounded text-slate-400 hover:text-indigo-400 text-xs">
              ✏️
            </button>
            <button onclick="confirmDeleteTask(${task.id}, '${escapeHtml(task.title)}')" title="Eliminar" class="p-1 rounded text-slate-400 hover:text-rose-400 text-xs">
              🗑️
            </button>
          </div>
        </div>
      `;
    });
    html += '</div>';
  }
  html += '</div>';

  // -----------------------------------------------------------
  // SECTION C: BITÁCORA DEL DÍA ("Cosas que he hecho")
  // -----------------------------------------------------------
  html += `
    <div class="space-y-2 pt-2 border-t border-slate-800/80">
      <div class="flex items-center justify-between text-xs font-bold text-slate-300">
        <span class="flex items-center gap-1">📖 Bitácora / ¿Qué has hecho hoy?</span>
        <button onclick="saveDayPanelJournal()" id="btn-save-day-panel-journal" class="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-all active:scale-95">
          💾 Guardar Bitácora
        </button>
      </div>
      <textarea id="day-panel-journal-content" rows="3" placeholder="Anota un resumen de actividades realizadas hoy..." class="w-full p-2.5 bg-slate-900/90 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 leading-relaxed"></textarea>
    </div>
  `;

  panel.innerHTML = html;

  // Load current journal content into the day panel textarea
  loadJournalForDate(state.selectedDate);
}

// -------------------------------------------------------------
// 3. TASKS VIEW ("TODAS LAS TAREAS / CHECKLIST")
// -------------------------------------------------------------

function renderTasksView() {
  const container = document.getElementById('tasks-list-container');
  if (!container) return;

  if (state.tasks.length === 0) {
    container.innerHTML = `
      <div class="glass-panel rounded-2xl p-8 sm:p-12 text-center text-slate-400 shadow-xl">
        <p class="text-4xl mb-2">📋</p>
        <h3 class="text-sm sm:text-base font-bold text-white mb-1">Sin tareas encontradas</h3>
        <p class="text-xs text-slate-400 mb-4">No hay tareas pendientes con los filtros actuales.</p>
        <button onclick="openTaskModal()" class="px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg transition-all active:scale-95">
          + Crear primera tarea
        </button>
      </div>
    `;
    return;
  }

  const pad = (n) => String(n).padStart(2, '0');
  const now = new Date();
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let html = '';

  state.tasks.forEach(task => {
    let dueBadge = '';
    if (task.due_date) {
      const d = parseDate(task.due_date);
      const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const isOverdue = !task.completed && dDay < todayDate;
      const isDueToday = dDay.getTime() === todayDate.getTime();

      const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
      const dateText = `${dias[d.getDay()]} ${d.getDate()} ${meses[d.getMonth()]} (${pad(d.getHours())}:${pad(d.getMinutes())})`;

      if (isOverdue) {
        dueBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">⚠️ Vencida: ${dateText}</span>`;
      } else if (isDueToday) {
        dueBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">⏰ Hoy: ${pad(d.getHours())}:${pad(d.getMinutes())} hs</span>`;
      } else {
        dueBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-300">📅 ${dateText}</span>`;
      }
    }

    const priorityBadge = {
      high: '<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">🔴 Alta</span>',
      medium: '<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">🟡 Media</span>',
      low: '<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">🟢 Baja</span>'
    }[task.priority] || '<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 text-slate-400">Media</span>';

    html += `
      <div class="glass-card rounded-2xl p-3.5 sm:p-4 border border-slate-800/80 hover:border-slate-700/80 transition-all flex items-start justify-between gap-3 shadow-md ${task.completed ? 'opacity-60 bg-slate-950/40' : ''}">
        
        <div class="flex items-start gap-3 min-w-0 flex-1">
          <input type="checkbox" ${task.completed ? 'checked' : ''} onchange="toggleTask(${task.id})" class="task-checkbox mt-0.5" title="Marcar como completada">
          
          <div class="min-w-0 flex-1 space-y-1">
            <div class="flex items-center gap-2 flex-wrap">
              <h4 class="task-title text-sm sm:text-base font-bold text-white break-words ${task.completed ? 'completed' : ''}">
                ${escapeHtml(task.title)}
              </h4>
              ${priorityBadge}
              ${task.category_id ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800/80 text-indigo-300 border border-slate-700/60">${escapeHtml(task.category_id)}</span>` : ''}
              ${dueBadge}
            </div>

            ${task.description ? `<p class="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">${escapeHtml(task.description)}</p>` : ''}
          </div>
        </div>

        <div class="flex items-center gap-1 shrink-0">
          <button onclick="triggerTaskNotificationNow(${task.id})" title="Enviar aviso al iPhone ahora" class="p-2 rounded-xl text-slate-400 hover:text-amber-400 bg-slate-900/80 border border-slate-800 transition-all active:scale-90 text-xs">
            🔔
          </button>
          <button onclick='openTaskModal(${JSON.stringify(task).replace(/'/g, "&#39;")})' title="Editar" class="p-2 rounded-xl text-slate-400 hover:text-indigo-400 bg-slate-900/80 border border-slate-800 transition-all active:scale-90 text-xs">
            ✏️
          </button>
          <button onclick="confirmDeleteTask(${task.id}, '${escapeHtml(task.title)}')" title="Eliminar" class="p-2 rounded-xl text-slate-400 hover:text-rose-400 bg-slate-900/80 border border-slate-800 transition-all active:scale-90 text-xs">
            🗑️
          </button>
        </div>

      </div>
    `;
  });

  container.innerHTML = html;
}

// -------------------------------------------------------------
// 4. JOURNAL VIEW ("BITÁCORA / REGISTRO DIARIO")
// -------------------------------------------------------------

function renderJournalView() {
  const todayStr = formatDateToIsoString(new Date());
  loadJournalForDate(state.selectedDate || todayStr);
  loadJournalEntries();
}

function renderJournalHistoryList() {
  const container = document.getElementById('journal-history-list');
  if (!container) return;

  if (state.journalEntries.length === 0) {
    container.innerHTML = `
      <div class="text-center py-6 text-slate-500 text-xs">
        No hay registros en la bitácora todavía.
      </div>
    `;
    return;
  }

  let html = '';
  const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  state.journalEntries.forEach(entry => {
    const [y, m, d] = entry.date.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const dateTitle = `${dias[dt.getDay()]}, ${d} ${meses[m - 1]} ${y}`;

    html += `
      <div class="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all space-y-1.5 cursor-pointer" onclick="selectJournalDate('${entry.date}')">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-indigo-300 capitalize">${dateTitle}</span>
          ${entry.mood ? `<span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-semibold">${escapeHtml(entry.mood)}</span>` : ''}
        </div>
        ${entry.summary ? `<p class="text-xs font-semibold text-slate-200 line-clamp-1">${escapeHtml(entry.summary)}</p>` : ''}
        <p class="text-[11px] text-slate-400 line-clamp-3 leading-relaxed whitespace-pre-line">${escapeHtml(entry.content || 'Sin contenido')}</p>
      </div>
    `;
  });

  container.innerHTML = html;
}

function selectJournalDate(dateStr) {
  state.selectedDate = dateStr;
  loadJournalForDate(dateStr);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// -------------------------------------------------------------
// 5. LIST VIEW ("PRÓXIMOS EVENTOS")
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
    const evDate = parseDate(ev.start_time);
    const evDay = new Date(evDate.getFullYear(), evDate.getMonth(), evDate.getDate());

    if (isEventOnDate(ev, todayDate)) {
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

  html += renderSection('Hoy / En Curso', '🔴', groups.today, 'bg-rose-500/20 text-rose-400');
  html += renderSection('Próximos 7 Días', '⚡', groups.thisWeek, 'bg-amber-500/20 text-amber-400');
  html += renderSection('Este Mes', '🗓️', groups.thisMonth, 'bg-indigo-500/20 text-indigo-400');
  html += renderSection('Más Adelante', '🚀', groups.future, 'bg-slate-800 text-slate-300');
  html += renderSection('Eventos Anteriores', '📁', groups.past, 'bg-slate-900 text-slate-500');

  container.innerHTML = html;
}

function renderEventCard(ev) {
  const pad = (n) => String(n).padStart(2, '0');
  const evStart = parseDate(ev.start_time);

  const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  let dateFormatted = `${diasSemana[evStart.getDay()]}, ${evStart.getDate()} de ${meses[evStart.getMonth()]} de ${evStart.getFullYear()}`;
  
  const endVal = ev.end_date || ev.end_time;
  let isMulti = false;
  if (endVal) {
    const evEnd = parseDate(endVal);
    if (evEnd.getDate() !== evStart.getDate() || evEnd.getMonth() !== evStart.getMonth() || evEnd.getFullYear() !== evStart.getFullYear()) {
      isMulti = true;
      dateFormatted = `Del ${evStart.getDate()} de ${meses[evStart.getMonth()]} al ${evEnd.getDate()} de ${meses[evEnd.getMonth()]} de ${evEnd.getFullYear()}`;
    }
  }

  let timeFormatted = '🌞 Todo el día';
  if (!ev.all_day) {
    timeFormatted = `⏰ ${pad(evStart.getHours())}:${pad(evStart.getMinutes())} hs`;
    if (endVal && !isMulti) {
      const evEnd = parseDate(endVal);
      timeFormatted += ` - ${pad(evEnd.getHours())}:${pad(evEnd.getMinutes())} hs`;
    }
  }

  return `
    <div class="glass-card rounded-2xl p-4 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between relative group shadow-md">
      <div class="absolute top-0 left-0 right-0 h-1 rounded-t-2xl" style="background-color: ${ev.color || '#6366f1'};"></div>
      
      <div>
        <div class="flex items-start justify-between gap-2 mb-2">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-bold" style="background-color: ${ev.color || '#6366f1'}20; color: ${ev.color || '#6366f1'};">
              ${escapeHtml(ev.category || 'General')}
            </span>
            ${isMulti ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">🗓️ Multidía</span>' : ''}
          </div>
          
          <div class="flex items-center gap-1">
            <button onclick="triggerEventNotificationNow(${ev.id})" title="Enviar alerta push" class="p-2 rounded-xl text-slate-400 hover:text-amber-400 bg-slate-900/80 border border-slate-800 transition-all active:scale-90 text-xs">
              🔔
            </button>
            <button onclick='openEventModal(${JSON.stringify(ev).replace(/'/g, "&#39;")})' title="Editar" class="p-2 rounded-xl text-slate-400 hover:text-indigo-400 bg-slate-900/80 border border-slate-800 transition-all active:scale-90 text-xs">
              ✏️
            </button>
            <button onclick="confirmDeleteEvent(${ev.id}, '${escapeHtml(ev.title)}')" title="Eliminar" class="p-2 rounded-xl text-slate-400 hover:text-rose-400 bg-slate-900/80 border border-slate-800 transition-all active:scale-90 text-xs">
              🗑️
            </button>
          </div>
        </div>

        <h4 class="text-sm sm:text-base font-bold text-white mb-1">${escapeHtml(ev.title)}</h4>
        
        <div class="flex flex-col gap-0.5 text-xs text-slate-400 mb-2.5">
          <span class="flex items-center gap-1 text-slate-300 font-semibold text-[11px] sm:text-xs">
            🗓️ ${dateFormatted} • ${timeFormatted}
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
// 6. NOTIFICATION LOGS LIST
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
    const d = parseDate(log.sent_at);
    const pad = (n) => String(n).padStart(2, '0');
    const dateStr = `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
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
