'use strict';

// ── Modals ────────────────────────────────────────────────────────────────────
function openModal(id) {
  document.getElementById(id).classList.add('open');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

// Called from modal-overlay onclick — closes only when the backdrop is clicked.
function overlayClose(e, id) {
  if (e.target.id === id) closeModal(id);
}

// ── Toast ─────────────────────────────────────────────────────────────────────
let _toastTimer = null;

function toast(msg, type = 'default') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className   = 'toast show' + (type !== 'default' ? ' ' + type : '');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

// ── Profile dropdown ──────────────────────────────────────────────────────────
function toggleProfileMenu() {
  document.getElementById('profile-dropdown').classList.toggle('open');
}

// Close profile dropdown when clicking outside it.
document.addEventListener('click', (e) => {
  const wrap = document.getElementById('profile-wrap');
  if (wrap && !wrap.contains(e.target)) {
    document.getElementById('profile-dropdown').classList.remove('open');
  }
});
