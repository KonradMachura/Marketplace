'use strict';

// ── Auth ──────────────────────────────────────────────────────────────────────
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('currentUser');
  window.location.href = '/';
}

function goToProfile() {
  document.getElementById('profile-dropdown').classList.remove('open');
  window.location.href = '/profile';
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
async function init() {
  const token = localStorage.getItem('token');
  if (!token) { window.location.href = '/'; return; }
  state.token = token;

  try {
    const user       = await api('GET', '/auth/me');
    state.currentUser = user;
    document.getElementById('nav-username').textContent = user.username;
    document.getElementById('dd-username').textContent  = user.username;
    document.getElementById('dd-email').textContent     = user.email;
    document.getElementById('dd-city').textContent      = user.city ? '📍 ' + user.city : '';
  } catch (e) {
    localStorage.removeItem('token');
    window.location.href = '/';
    return;
  }

  await loadCategories();
  await loadOffers();
  await loadConversations();

  // Refresh conversation list every 30 s in the background.
  setInterval(loadConversations, 30000);
}

window.addEventListener('DOMContentLoaded', init);
