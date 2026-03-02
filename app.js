/* ============================================================
   Twisted Udder Movement App — app.js
   Multi-Entry Support
   ============================================================ */

'use strict';

// ─── Constants ───────────────────────────────────────────────
const STORAGE_KEYS = {
  LOGS: 'tu_movement_logs',
  TEMPLATES: 'tu_templates',
  THEME: 'tu_theme',
};

const REASONS = {
  annual_leave: { label: 'Annual Leave', icon: 'beach_access', color: 'blue' },
  medical_leave: { label: 'Medical Leave', icon: 'medical_services', color: 'red' },
  client_meeting: { label: 'Client Meeting', icon: 'handshake', color: 'green' },
  wfh: { label: 'Work From Home', icon: 'home_work', color: 'purple' },
  compassionate_leave: { label: 'Compassionate Leave', icon: 'favorite', color: 'pink' },
};

const BADGE_COLORS = {
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  red: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  green: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  pink: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
};

const DEFAULT_TEMPLATES = [
  { id: 'tpl_1', title: 'Client Visit', icon: 'handshake', color: 'blue', reason: 'client_meeting', notes: 'Visiting client for a scheduled meeting/review.' },
  { id: 'tpl_2', title: 'WFH', icon: 'home_work', color: 'purple', reason: 'wfh', notes: 'Working from home today. Available on Teams/Slack.' },
  { id: 'tpl_3', title: 'Medical', icon: 'medical_services', color: 'red', reason: 'medical_leave', notes: 'Medical appointment. Back as soon as possible.' },
];

// ─── State ───────────────────────────────────────────────────
const state = {
  currentScreen: 'home',
  logs: [],
  templates: [],
  pendingTemplate: null,
  entries: [],       // array of { id, fromDate, toDate, reason, notes }
  nextEntryId: 1,
};

// ─── Storage helpers ─────────────────────────────────────────
const storage = {
  get: (key, fallback = null) => {
    try {
      const val = localStorage.getItem(key);
      return val !== null ? JSON.parse(val) : fallback;
    } catch { return fallback; }
  },
  set: (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { }
  },
};

// ─── Theme ───────────────────────────────────────────────────
function initTheme() {
  const saved = storage.get(STORAGE_KEYS.THEME);
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = saved !== null ? saved : prefersDark;
  setTheme(isDark, false);
}

function setTheme(dark, save = true) {
  document.documentElement.classList.toggle('dark', dark);
  if (save) storage.set(STORAGE_KEYS.THEME, dark);
  updateThemeToggle(dark);
}

function updateThemeToggle(dark) {
  const lightBtn = document.getElementById('theme-light');
  const darkBtn = document.getElementById('theme-dark');
  if (!lightBtn || !darkBtn) return;

  if (dark) {
    lightBtn.className = 'w-1/2 flex justify-center items-center py-2 rounded-lg text-sm font-medium text-gray-500 dark:text-gray-400 cursor-pointer transition-all hover:text-gray-900 dark:hover:text-white theme-toggle';
    darkBtn.className = 'w-1/2 flex justify-center items-center py-2 rounded-lg text-sm font-medium bg-input-dark text-white shadow-sm cursor-pointer transition-all theme-toggle';
  } else {
    lightBtn.className = 'w-1/2 flex justify-center items-center py-2 rounded-lg text-sm font-medium bg-white text-gray-900 shadow-sm cursor-pointer transition-all theme-toggle';
    darkBtn.className = 'w-1/2 flex justify-center items-center py-2 rounded-lg text-sm font-medium text-gray-500 dark:text-gray-400 cursor-pointer transition-all hover:text-gray-900 dark:hover:text-white theme-toggle';
  }
}

// ─── Router ──────────────────────────────────────────────────
function navigate(screen) {
  document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));

  const target = document.getElementById(`screen-${screen}`);
  if (target) {
    target.classList.add('active');
    const content = target.querySelector('.page-content');
    if (content) {
      content.classList.remove('page-enter');
      void content.offsetWidth;
      content.classList.add('page-enter');
    }
  }

  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.screen === screen);
    const isActive = tab.dataset.screen === screen;
    const iconEl = tab.querySelector('.nav-icon');
    const labelEl = tab.querySelector('.nav-label');
    if (iconEl) iconEl.classList.toggle('text-primary', isActive);
    if (iconEl) iconEl.classList.toggle('text-gray-400', !isActive);
    if (labelEl) labelEl.classList.toggle('text-primary', isActive);
    if (labelEl) labelEl.classList.toggle('text-gray-400', !isActive);
  });

  const backBtn = document.getElementById('header-back');
  if (backBtn) backBtn.classList.toggle('invisible', screen === 'home');

  state.currentScreen = screen;

  if (screen === 'home' && state.pendingTemplate) {
    applyTemplateToFirstEntry(state.pendingTemplate);
    state.pendingTemplate = null;
  }

  if (screen === 'history') renderHistory();
  if (screen === 'settings') renderTemplates();
}

// ─── Toast ───────────────────────────────────────────────────
let toastTimeout;
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const bgClass = type === 'error'
    ? 'bg-red-500'
    : type === 'info'
      ? 'bg-blue-500'
      : 'bg-gray-900 dark:bg-gray-100 dark:text-gray-900';

  toast.innerHTML = `
    <div class="flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-white text-sm font-semibold ${bgClass}">
      <span class="material-icons-round text-base">${type === 'error' ? 'error_outline' : type === 'info' ? 'info' : 'check_circle'}</span>
      <span>${message}</span>
    </div>`;
  toast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove('show'), 3000);
}

// ─── Multi-Entry System ──────────────────────────────────────

/** Read live values from all entry card DOM nodes into state.entries */
function syncEntriesFromDOM() {
  state.entries = state.entries.map(entry => {
    const card = document.getElementById(`entry-card-${entry.id}`);
    if (!card) return entry;
    return {
      ...entry,
      fromDate: card.querySelector('.entry-from')?.value || '',
      toDate: card.querySelector('.entry-to')?.value || '',
      reason: card.querySelector('.entry-reason')?.value || '',
      notes: card.querySelector('.entry-notes')?.value || '',
    };
  });
}

function createEntry(prefill = {}) {
  const id = state.nextEntryId++;
  const entry = {
    id,
    fromDate: prefill.fromDate || '',
    toDate: prefill.toDate || '',
    reason: prefill.reason || '',
    notes: prefill.notes || '',
  };
  state.entries.push(entry);
  return entry;
}

function addEntryToDOM(entry) {
  const list = document.getElementById('entries-list');
  const isFirst = state.entries.length === 1;
  const num = state.entries.indexOf(entry) + 1;

  const div = document.createElement('div');
  div.id = `entry-card-${entry.id}`;
  div.className = 'entry-card bg-white dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm p-4 space-y-4 relative';
  div.setAttribute('data-entry-id', entry.id);

  div.innerHTML = `
    <!-- Card header -->
    <div class="flex items-center justify-between mb-1">
      <span class="entry-label text-xs font-bold text-primary uppercase tracking-widest">Entry ${num}</span>
      ${!isFirst ? `
        <button class="remove-entry-btn text-gray-400 hover:text-red-400 transition-colors"
          onclick="removeEntry(${entry.id})" title="Remove entry" type="button">
          <span class="material-icons-round text-lg">remove_circle_outline</span>
        </button>` : '<div class="w-6"></div>'}
    </div>

    <!-- Date row -->
    <div class="grid grid-cols-2 gap-3">
      <!-- From -->
      <div class="space-y-1">
        <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400">
          From <span class="text-primary">*</span>
        </label>
        <div class="relative">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span class="material-icons-round text-gray-400 text-base">calendar_today</span>
          </div>
          <input type="date" class="entry-from pl-9 block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-input-dark text-gray-900 dark:text-white shadow-sm focus:border-primary focus:ring-1 focus:ring-primary text-sm py-2.5 transition-colors"
            value="${escapeAttr(entry.fromDate)}" />
        </div>
      </div>
      <!-- To -->
      <div class="space-y-1">
        <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400">
          To <span class="text-primary">*</span>
        </label>
        <div class="relative">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span class="material-icons-round text-gray-400 text-base">event</span>
          </div>
          <input type="date" class="entry-to pl-9 block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-input-dark text-gray-900 dark:text-white shadow-sm focus:border-primary focus:ring-1 focus:ring-primary text-sm py-2.5 transition-colors"
            value="${escapeAttr(entry.toDate)}" />
        </div>
      </div>
    </div>

    <!-- Reason -->
    <div class="space-y-1">
      <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400">
        Reason <span class="text-primary">*</span>
      </label>
      <div class="relative">
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <span class="material-icons-round text-gray-400 text-base">category</span>
        </div>
        <select class="entry-reason pl-9 block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-input-dark text-gray-900 dark:text-white shadow-sm focus:border-primary focus:ring-1 focus:ring-primary text-sm py-2.5 appearance-none transition-colors">
          <option value="" ${!entry.reason ? 'selected' : ''} disabled>Select a reason…</option>
          <option value="annual_leave"        ${entry.reason === 'annual_leave' ? 'selected' : ''}>Annual Leave</option>
          <option value="medical_leave"       ${entry.reason === 'medical_leave' ? 'selected' : ''}>Medical Leave</option>
          <option value="client_meeting"      ${entry.reason === 'client_meeting' ? 'selected' : ''}>Client Meeting</option>
          <option value="wfh"                 ${entry.reason === 'wfh' ? 'selected' : ''}>Work From Home</option>
          <option value="compassionate_leave" ${entry.reason === 'compassionate_leave' ? 'selected' : ''}>Compassionate Leave</option>
        </select>
        <div class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
          <span class="material-icons-round text-gray-400 text-base">expand_more</span>
        </div>
      </div>
    </div>

    <!-- Notes -->
    <div class="space-y-1">
      <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400">
        Notes <span class="font-normal text-gray-400">(optional)</span>
      </label>
      <textarea class="entry-notes block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-input-dark text-gray-900 dark:text-white shadow-sm focus:border-primary focus:ring-1 focus:ring-primary text-xs p-3 transition-colors resize-none" rows="2"
        maxlength="200" placeholder="e.g. Meeting with client / doctor's appointment…">${escapeHtml(entry.notes)}</textarea>
    </div>
  `;

  list.appendChild(div);

  // Animate in
  requestAnimationFrame(() => {
    div.style.opacity = '0';
    div.style.transform = 'translateY(8px)';
    requestAnimationFrame(() => {
      div.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
      div.style.opacity = '1';
      div.style.transform = 'translateY(0)';
    });
  });
}

function removeEntry(id) {
  state.entries = state.entries.filter(e => e.id !== id);
  const card = document.getElementById(`entry-card-${id}`);
  if (card) {
    card.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
    card.style.opacity = '0';
    card.style.transform = 'translateY(-6px)';
    setTimeout(() => {
      card.remove();
      renumberEntryLabels();
    }, 200);
  }
}

function renumberEntryLabels() {
  const cards = document.querySelectorAll('#entries-list .entry-card');
  cards.forEach((card, i) => {
    const label = card.querySelector('.entry-label');
    if (label) label.textContent = `Entry ${i + 1}`;

    // First card: hide remove button
    const removeBtn = card.querySelector('.remove-entry-btn');
    if (i === 0 && removeBtn) removeBtn.remove();
  });
}

function addNewEntry() {
  syncEntriesFromDOM();
  const entry = createEntry();
  addEntryToDOM(entry);

  // Scroll new card into view
  setTimeout(() => {
    const card = document.getElementById(`entry-card-${entry.id}`);
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 50);
}

function initEntries() {
  state.entries = [];
  state.nextEntryId = 1;
  document.getElementById('entries-list').innerHTML = '';
  const first = createEntry();
  addEntryToDOM(first);
}

// ─── Form validation ─────────────────────────────────────────
function validateAllEntries() {
  syncEntriesFromDOM();
  let valid = true;

  state.entries.forEach(entry => {
    const card = document.getElementById(`entry-card-${entry.id}`);
    if (!card) return;

    const fromEl = card.querySelector('.entry-from');
    const toEl = card.querySelector('.entry-to');
    const reasonEl = card.querySelector('.entry-reason');

    [fromEl, toEl, reasonEl].forEach(el => {
      const isBlank = !el.value || el.value === '';
      el.classList.toggle('field-error', isBlank);
      if (isBlank) {
        valid = false;
        el.classList.add('shake');
        el.addEventListener('animationend', () => el.classList.remove('shake'), { once: true });
      }
    });

    if (fromEl.value && toEl.value && fromEl.value > toEl.value) {
      toEl.classList.add('field-error', 'shake');
      toEl.addEventListener('animationend', () => toEl.classList.remove('shake'), { once: true });
      showToast(`Entry ${state.entries.indexOf(entry) + 1}: "To" date cannot be before "From" date`, 'error');
      valid = false;
    }
  });

  return valid;
}

// ─── WhatsApp send ───────────────────────────────────────────
function buildWhatsAppMessage(entries) {
  const today = new Date().toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });

  // Box-drawing chars (all BMP, never corrupted by encodeURIComponent)
  var THICK = '\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550';
  var THIN = '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500';

  var msg = '*Twisted Udder \u2014 Movement Log*\n';
  msg += 'Submitted: ' + today + '\n';
  msg += THICK + '\n';

  entries.forEach(function (entry, i) {
    var reasonLabel = REASONS[entry.reason] ? REASONS[entry.reason].label : entry.reason;
    if (entries.length > 1) msg += '\n*[ Entry ' + (i + 1) + ' ]*\n';
    msg += '*Period:*  ' + formatDate(entry.fromDate);
    if (entry.toDate && entry.toDate !== entry.fromDate) msg += ' \u2192 ' + formatDate(entry.toDate);
    msg += '\n';
    msg += '*Reason:*  ' + reasonLabel + '\n';
    if (entry.notes && entry.notes.trim()) msg += '*Notes:*   ' + entry.notes.trim() + '\n';
    if (i < entries.length - 1) msg += THIN + '\n';
  });

  msg += THICK + '\n';
  msg += '_HR team has been notified. Please acknowledge receipt._';

  return msg;
}



function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-MY', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

function handleWhatsAppSend() {
  if (state.entries.length === 0) {
    showToast('Please add at least one entry', 'error');
    return;
  }

  if (!validateAllEntries()) {
    showToast('Please fill in all required fields', 'error');
    return;
  }

  syncEntriesFromDOM();

  // Save each entry to history
  const submittedAt = new Date().toISOString();
  state.entries.forEach(entry => {
    const log = {
      id: `${Date.now()}_${entry.id}`,
      fromDate: entry.fromDate,
      toDate: entry.toDate,
      reason: entry.reason,
      notes: entry.notes,
      submittedAt,
    };
    state.logs.unshift(log);
  });
  storage.set(STORAGE_KEYS.LOGS, state.logs);

  // Build & open WhatsApp URL
  const message = buildWhatsAppMessage(state.entries);
  const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');

  const count = state.entries.length;
  showToast(`${count} entr${count > 1 ? 'ies' : 'y'} saved! Opening WhatsApp…`);

  // Reset entries
  setTimeout(() => initEntries(), 800);
}

// ─── Template apply ──────────────────────────────────────────
function applyTemplateToFirstEntry(tpl) {
  if (state.entries.length === 0) {
    const entry = createEntry({ reason: tpl.reason, notes: tpl.notes });
    addEntryToDOM(entry);
  } else {
    // Apply to first entry in DOM
    const first = state.entries[0];
    const card = document.getElementById(`entry-card-${first.id}`);
    if (card) {
      if (tpl.reason) card.querySelector('.entry-reason').value = tpl.reason;
      if (tpl.notes) card.querySelector('.entry-notes').value = tpl.notes;
    }
  }
}

// ─── Templates ───────────────────────────────────────────────
function loadTemplates() {
  state.templates = storage.get(STORAGE_KEYS.TEMPLATES, DEFAULT_TEMPLATES);
}

function saveTemplates() {
  storage.set(STORAGE_KEYS.TEMPLATES, state.templates);
}

function renderTemplates() {
  const grid = document.getElementById('templates-grid');
  if (!grid) return;

  const cards = state.templates.map(tpl => `
    <button
      class="template-card bg-white dark:bg-surface-dark p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm hover:border-primary/50 dark:hover:border-primary/50 text-left group relative overflow-hidden"
      onclick="useTemplate('${tpl.id}')"
      id="tpl-${tpl.id}"
    >
      <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity" onclick="event.stopPropagation(); deleteTemplate('${tpl.id}')">
        <span class="material-icons-round text-gray-400 hover:text-red-400 text-base transition-colors">delete_outline</span>
      </div>
      <div class="w-8 h-8 rounded-full bg-${tpl.color}-100 dark:bg-${tpl.color}-900/30 text-${tpl.color}-600 dark:text-${tpl.color}-400 flex items-center justify-center mb-3">
        <span class="material-icons-round text-lg">${tpl.icon}</span>
      </div>
      <h3 class="font-semibold text-gray-900 dark:text-white text-sm mb-1">${escapeHtml(tpl.title)}</h3>
      <p class="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">"${escapeHtml(tpl.notes)}"</p>
    </button>
  `).join('');

  const addCard = `
    <button
      class="template-card bg-white dark:bg-surface-dark p-4 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-white/5 transition-all text-center flex flex-col items-center justify-center"
      onclick="openAddTemplateModal()"
    >
      <span class="material-icons-round text-gray-400 mb-2">add_circle</span>
      <h3 class="font-medium text-gray-500 dark:text-gray-400 text-sm">Add New</h3>
    </button>`;

  grid.innerHTML = cards + addCard;
}

function useTemplate(id) {
  const tpl = state.templates.find(t => t.id === id);
  if (!tpl) return;
  state.pendingTemplate = tpl;
  navigate('home');
  showToast(`Template "${tpl.title}" applied`, 'info');
}

function deleteTemplate(id) {
  state.templates = state.templates.filter(t => t.id !== id);
  saveTemplates();
  renderTemplates();
  showToast('Template removed');
}

function openAddTemplateModal() {
  document.getElementById('modal-tpl-title').value = '';
  document.getElementById('modal-tpl-notes').value = '';
  document.getElementById('modal-tpl-reason').value = '';
  document.getElementById('add-template-modal').classList.remove('hidden');
}

function closeAddTemplateModal() {
  document.getElementById('add-template-modal').classList.add('hidden');
}

function saveNewTemplate() {
  const title = document.getElementById('modal-tpl-title').value.trim();
  const notes = document.getElementById('modal-tpl-notes').value.trim();
  const reason = document.getElementById('modal-tpl-reason').value;

  if (!title || !reason) {
    showToast('Title and reason are required', 'error');
    return;
  }

  const reasonData = REASONS[reason] || { icon: 'notes', color: 'gray' };
  const newTpl = {
    id: `tpl_${Date.now()}`,
    title,
    notes: notes || `${reasonData.label} — see notes.`,
    reason,
    icon: reasonData.icon,
    color: reasonData.color,
  };

  state.templates.push(newTpl);
  saveTemplates();
  closeAddTemplateModal();
  renderTemplates();
  showToast(`Template "${title}" added`);
}

// ─── History ─────────────────────────────────────────────────
function loadLogs() {
  state.logs = storage.get(STORAGE_KEYS.LOGS, []);
}

function renderHistory() {
  const container = document.getElementById('history-list');
  if (!container) return;

  if (state.logs.length === 0) {
    container.innerHTML = `
      <div class="empty-state flex flex-col items-center justify-center py-16 text-center">
        <div class="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <span class="material-icons-round text-primary text-4xl">history</span>
        </div>
        <h3 class="font-bold text-gray-700 dark:text-gray-300 mb-1">No logs yet</h3>
        <p class="text-sm text-gray-500 dark:text-gray-500">Submit a movement log to see it here.</p>
      </div>`;
    document.getElementById('clear-all-btn').classList.add('hidden');
    return;
  }

  document.getElementById('clear-all-btn').classList.remove('hidden');

  container.innerHTML = state.logs.map(log => {
    const reasonData = REASONS[log.reason] || { label: log.reason, icon: 'notes', color: 'gray' };
    const badgeClass = BADGE_COLORS[reasonData.color] || BADGE_COLORS.blue;
    const dateRange = log.fromDate === log.toDate || !log.toDate
      ? formatDate(log.fromDate)
      : `${formatDate(log.fromDate)} → ${formatDate(log.toDate)}`;
    const submitted = new Date(log.submittedAt).toLocaleDateString('en-MY', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    return `
      <div class="log-card bg-white dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm" data-id="${log.id}">
        <div class="flex items-start justify-between gap-2 mb-2">
          <span class="reason-badge ${badgeClass}">
            <span class="material-icons-round" style="font-size:0.8rem">${reasonData.icon}</span>
            ${reasonData.label}
          </span>
          <button
            class="text-gray-400 hover:text-red-400 transition-colors flex-shrink-0"
            onclick="deleteLog('${log.id}')"
            title="Delete log"
          >
            <span class="material-icons-round text-base">delete_outline</span>
          </button>
        </div>
        <p class="text-sm font-semibold text-gray-900 dark:text-white mb-1">📆 ${dateRange}</p>
        ${log.notes ? `<p class="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-2">${escapeHtml(log.notes)}</p>` : ''}
        <p class="text-[10px] text-gray-400 dark:text-gray-600">Submitted ${submitted}</p>
      </div>`;
  }).join('');
}

function deleteLog(id) {
  state.logs = state.logs.filter(l => l.id !== id);
  storage.set(STORAGE_KEYS.LOGS, state.logs);
  renderHistory();
  showToast('Log deleted');
}

function clearAllLogs() {
  if (!confirm('Clear all movement logs? This cannot be undone.')) return;
  state.logs = [];
  storage.set(STORAGE_KEYS.LOGS, state.logs);
  renderHistory();
  showToast('All logs cleared');
}

// ─── Utility ─────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  return String(str || '').replace(/"/g, '&quot;');
}

// ─── Init ────────────────────────────────────────────────────
function init() {
  initTheme();
  loadLogs();
  loadTemplates();

  // Boot the multi-entry system
  initEntries();

  // Add entry button
  document.getElementById('add-entry-btn')?.addEventListener('click', addNewEntry);

  // Nav tabs
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => navigate(tab.dataset.screen));
  });

  // Header back button
  document.getElementById('header-back')?.addEventListener('click', () => navigate('home'));

  // Theme toggles
  document.getElementById('theme-light')?.addEventListener('click', () => setTheme(false));
  document.getElementById('theme-dark')?.addEventListener('click', () => setTheme(true));

  // WhatsApp button
  document.getElementById('whatsapp-btn')?.addEventListener('click', handleWhatsAppSend);

  // View history from settings
  document.getElementById('view-history-btn')?.addEventListener('click', () => navigate('history'));

  // Clear all logs
  document.getElementById('clear-all-btn')?.addEventListener('click', clearAllLogs);

  // Add template modal
  document.getElementById('modal-save-btn')?.addEventListener('click', saveNewTemplate);
  document.getElementById('modal-cancel-btn')?.addEventListener('click', closeAddTemplateModal);
  document.getElementById('modal-backdrop-close')?.addEventListener('click', closeAddTemplateModal);

  // Initial screen
  navigate('home');
}

document.addEventListener('DOMContentLoaded', init);
