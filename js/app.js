
const API_BASE = 'https://crime-tracking-information-system.onrender.com/api';

function getToken() { return localStorage.getItem('ctis_token'); }
function getUser() {
  try { return JSON.parse(localStorage.getItem('ctis_user')); } catch { return null; }
}
function setSession(token, user) {
  localStorage.setItem('ctis_token', token);
  localStorage.setItem('ctis_user', JSON.stringify(user));
}
function clearSession() {
  localStorage.removeItem('ctis_token');
  localStorage.removeItem('ctis_user');
}

// Redirect to login if not authenticated. Call at top of every protected page.
function requireAuth() {
  if (!getToken()) { window.location.href = '/pages/login.html'; return false; }
  return true;
}

// Wrapper around fetch that attaches the JWT and handles 401s
async function apiRequest(path, { method = 'GET', body = null } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  if (res.status === 401) {
    clearSession();
    window.location.href = '/pages/login.html';
    throw new Error('Session expired');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

function stampHtml(value) {
  const label = (value || '').replace(/_/g, ' ');
  return `<span class="stamp ${value}">${escapeHtml(label)}</span>`;
}

function showToast(message, variant = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.position = 'fixed';
    container.style.top = '1rem';
    container.style.right = '1rem';
    container.style.zIndex = 2000;
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = `alert alert-${variant === 'success' ? 'success' : 'danger'} shadow-sm`;
  el.style.minWidth = '260px';
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ---------------------------------------------------------------------
// Sidebar navigation — injected into any page with <div id="sidebar-root">
// ---------------------------------------------------------------------
const NAV_ITEMS = [
  { href: '/pages/dashboard.html', label: 'Dashboard', icon: '&#9635;' },
  { href: '/pages/crimes.html', label: 'Crime Records', icon: '&#128196;' },
  { href: '/pages/suspects.html', label: 'Suspects', icon: '&#128100;' },
  { href: '/pages/cases.html', label: 'Case Tracking', icon: '&#9878;' },
  { href: '/pages/search.html', label: 'Search Records', icon: '&#128269;' },
  { href: '/pages/reports.html', label: 'Reports', icon: '&#128202;' },
  { href: '/pages/officers.html', label: 'Officer Accounts', icon: '&#128081;', adminOnly: true }
];

function renderSidebar(activeHref) {
  const root = document.getElementById('sidebar-root');
  if (!root) return;
  const user = getUser();
  const items = NAV_ITEMS.filter(i => !i.adminOnly || (user && user.role === 'admin'));

  root.innerHTML = `
    <div class="sidebar" id="sidebarEl">
      <div class="brand">
        <small>Nigerian Police Force</small>
        Crime Tracking System
      </div>
      <nav class="nav flex-column">
        ${items.map(i => `
          <a class="nav-link ${i.href === activeHref ? 'active' : ''}" href="${i.href}">
            <span>${i.icon}</span><span>${i.label}</span>
          </a>`).join('')}
      </nav>
      <div class="mt-4 pt-3 border-top border-light border-opacity-25">
        <a class="nav-link" href="#" id="logoutBtn"><span>&#8630;</span><span>Log out</span></a>
      </div>
    </div>`;

  document.getElementById('logoutBtn').addEventListener('click', (e) => {
    e.preventDefault();
    clearSession();
    window.location.href = '/pages/login.html';
  });
}

function renderTopbar(title) {
  const root = document.getElementById('topbar-root');
  if (!root) return;
  const user = getUser();
  root.innerHTML = `
    <div class="topbar">
      <div>
        <button class="btn btn-sm btn-outline-secondary d-md-none me-2" id="sidebarToggle">&#9776;</button>
        <span class="h5 mb-0 display-font">${escapeHtml(title)}</span>
      </div>
      <div class="text-end">
        <div class="fw-semibold small">${escapeHtml(user ? user.full_name : '')}</div>
        <div class="text-muted" style="font-size:0.72rem;">${escapeHtml(user ? user.role.toUpperCase() : '')} · ${escapeHtml(user ? user.badge_number : '')}</div>
      </div>
    </div>`;

  const toggleBtn = document.getElementById('sidebarToggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      document.getElementById('sidebarEl').classList.toggle('open');
    });
  }
}
