/* ============================================================
   Twisted Udder Movement App — app.js
   Single-Page Application Logic
   ============================================================ */

'use strict';

// ─── Constants ───────────────────────────────────────────────
const STORAGE_KEYS = {
  LOGS: 'tu_movement_logs',
  TEMPLATES: 'tu_templates',
  THEME: 'tu_theme',
};

const REASONS = {
  annual_leave:       { label: 'Annual Leave',       icon: 'beach_access', color: 'blue' },
  medical_leave:      { label: 'Medical Leave',       icon: 'medical_services', color: 'red' },
  client_meeting:     { label: 'Client Meeting',      icon: 'handshake', color: 'green' },
  wfh:                { label: 'Work From Home',       icon: 'home_work', color: 'purple' },
  compassionate_leave:{ label: 'Compassionate Leave', icon: 'favorite', color: 'pink' },
};

const BADGE_COLORS = {
  blue:   'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  red:    'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  green:  'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  pink:   'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
};

const DEFAULT_TEMPLATES = [
  {
    id: 'tpl_1',
    title: 'Client Visit',
    icon: 'handshake',
    color: 'blue',
    reason: 'client_meeting',
    notes: 'Visiting client for a scheduled meeting/review.',
  },
  {
    id: 'tpl_2',
    title: 'WFH',
    icon: 'home_work',
    color: 'purple',
    reason: 'wfh',
    notes: 'Working from home today. Available on Teams/Slack.',
  },
  {
    id: 'tpl_3',
    title: 'Medical',
    icon: 'medical_services',
    color: 'red',
    reason: 'medical_leave',
    notes: 'Medical appointment. Back as soon as possible.',
  },
];

// ─── State ───────────────────────────────────────────────────
const state = {
  currentScreen: 'home',
  logs: [],
  templates: [],
  pendingTemplate: null, // template to apply when user navigates to home
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
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
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
  const darkBtn  = document.getElementById('theme-dark');
  if (!lightBtn || !darkBtn) return;

  if (dark) {
    lightBtn.className = 'w-1/2 flex justify-center items-center py-2 rounded-lg text-sm font-medium text-gray-500 dark:text-gray-400 cursor-pointer transition-all hover:text-gray-900 dark:hover:text-white theme-toggle';
    darkBtn.className  = 'w-1/2 flex justify-center items-center py-2 rounded-lg text-sm font-medium bg-input-dark text-white shadow-sm cursor-pointer transition-all theme-toggle';
  } else {
    lightBtn.className = 'w-1/2 flex justify-center items-center py-2 rounded-lg text-sm font-medium bg-white text-gray-900 shadow-sm cursor-pointer transition-all theme-toggle';
    darkBtn.className  = 'w-1/2 flex justify-center items-center py-2 rounded-lg text-sm font-medium text-gray-500 dark:text-gray-400 cursor-pointer transition-all hover:text-gray-900 dark:hover:text-white theme-toggle';
  }
}

// ─── Router ──────────────────────────────────────────────────
function navigate(screen) {
  // Hide all screens
  document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));

  // Show target
  const target = document.getElementById(`screen-${screen}`);
  if (target) {
    target.classList.add('active');
    const content = target.querySelector('.page-content');
    if (content) {
      content.classList.remove('page-enter');
      // Force reflow
      void content.offsetWidth;
      content.classList.add('page-enter');
    }
  }

  // Update nav tabs
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

  // Update header back button visibility
  const backBtn = document.getElementById('header-back');
  if (backBtn) backBtn.classList.toggle('invisible', screen === 'home');

  state.currentScreen = screen;

  // Apply pending template now that we're on home
  if (screen === 'home' && state.pendingTemplate) {
    applyTemplateToForm(state.pendingTemplate);
    state.pendingTemplate = null;
  }

  // Refresh dynamic content
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

// ─── Character counter ───────────────────────────────────────
function initCharCounter() {
  const textarea = document.getElementById('notes');
  const counter  = document.getElementById('char-counter');
  if (!textarea || !counter) return;

  textarea.addEventListener('input', () => {
    const len = textarea.value.length;
    if (len > 200) textarea.value = textarea.value.substring(0, 200);
    counter.textContent = `${Math.min(len, 200)}/200 characters`;
    counter.classList.toggle('text-red-400', len >= 190);
    counter.classList.toggle('text-gray-500', len < 190);
  });
}

// ─── Form validation ─────────────────────────────────────────
function validateForm() {
  const fromDate = document.getElementById('from_date');
  const toDate   = document.getElementById('to_date');
  const reason   = document.getElementById('reason');
  let valid = true;

  [fromDate, toDate, reason].forEach(el => {
    const isBlank = !el.value || el.value === '';
    el.classList.toggle('field-error', isBlank);
    if (isBlank) {
      valid = false;
      el.classList.add('shake');
      el.addEventListener('animationend', () => el.classList.remove('shake'), { once: true });
    }
  });

  if (fromDate.value && toDate.value && fromDate.value > toDate.value) {
    toDate.classList.add('field-error', 'shake');
    toDate.addEventListener('animationend', () => toDate.classList.remove('shake'), { once: true });
    showToast('"To" date cannot be before "From" date', 'error');
    valid = false;
  }

  return valid;
}

// ─── WhatsApp send ───────────────────────────────────────────
function buildWhatsAppMessage(fromDate, toDate, reason, notes) {
  const reasonLabel = REASONS[reason]?.label || reason;
  const today = new Date().toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });

  let msg = `🐄 *Twisted Udder — Movement Log*\n`;
  msg += `📅 Submitted: ${today}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `📆 *Period:* ${formatDate(fromDate)}`;
  if (toDate && toDate !== fromDate) msg += ` → ${formatDate(toDate)}`;
  msg += `\n`;
  msg += `📌 *Reason:* ${reasonLabel}\n`;
  if (notes && notes.trim()) msg += `📝 *Notes:* ${notes.trim()}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `_HR team has been notified. Please acknowledge receipt._`;

  return msg;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-MY', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

function handleWhatsAppSend() {
  if (!validateForm()) {
    showToast('Please fill in all required fields', 'error');
    return;
  }

  const fromDate = document.getElementById('from_date').value;
  const toDate   = document.getElementById('to_date').value;
  const reason   = document.getElementById('reason').value;
  const notes    = document.getElementById('notes').value;

  // Save to history
  const log = {
    id: Date.now().toString(),
    fromDate,
    toDate,
    reason,
    notes,
    submittedAt: new Date().toISOString(),
  };
  state.logs.unshift(log);
  storage.set(STORAGE_KEYS.LOGS, state.logs);

  // Build & open WhatsApp URL
  const message = buildWhatsAppMessage(fromDate, toDate, reason, notes);
  const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');

  showToast('Log saved! Opening WhatsApp…');

  // Reset form after short delay
  setTimeout(() => clearForm(), 800);
}

function clearForm() {
  document.getElementById('from_date').value = '';
  document.getElementById('to_date').value   = '';
  document.getElementById('reason').value    = '';
  document.getElementById('notes').value     = '';
  document.getElementById('char-counter').textContent = '0/200 characters';
  ['from_date', 'to_date', 'reason'].forEach(id =>
    document.getElementById(id).classList.remove('field-error')
  );
}

// ─── Template apply ──────────────────────────────────────────
function applyTemplateToForm(tpl) {
  if (tpl.reason) document.getElementById('reason').value = tpl.reason;
  if (tpl.notes)  {
    const ta = document.getElementById('notes');
    ta.value = tpl.notes;
    const counter = document.getElementById('char-counter');
    if (counter) counter.textContent = `${tpl.notes.length}/200 characters`;
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
  document.getElementById('modal-tpl-title').value  = '';
  document.getElementById('modal-tpl-notes').value  = '';
  document.getElementById('modal-tpl-reason').value = '';
  document.getElementById('add-template-modal').classList.remove('hidden');
}

function closeAddTemplateModal() {
  document.getElementById('add-template-modal').classList.add('hidden');
}

function saveNewTemplate() {
  const title  = document.getElementById('modal-tpl-title').value.trim();
  const notes  = document.getElementById('modal-tpl-notes').value.trim();
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
    const dateRange  = log.fromDate === log.toDate || !log.toDate
      ? formatDate(log.fromDate)
      : `${formatDate(log.fromDate)} → ${formatDate(log.toDate)}`;
    const submitted  = new Date(log.submittedAt).toLocaleDateString('en-MY', {
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

// ─── Init ────────────────────────────────────────────────────
function init() {
  initTheme();
  loadLogs();
  loadTemplates();
  initCharCounter();

  // Clear field-error on input
  ['from_date', 'to_date', 'reason', 'notes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => el.classList.remove('field-error'));
    if (el) el.addEventListener('change', () => el.classList.remove('field-error'));
  });

  // Nav tabs
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => navigate(tab.dataset.screen));
  });

  // Header back button
  document.getElementById('header-back')?.addEventListener('click', () => navigate('home'));

  // Theme toggles
  document.getElementById('theme-light')?.addEventListener('click', () => setTheme(false));
  document.getElementById('theme-dark')?.addEventListener('click',  () => setTheme(true));

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
