'use strict';

// ── Category loader ───────────────────────────────────────────────────────────
async function loadCategories() {
  try {
    const cats = await api('GET', '/categories');
    ['#cat-filter', '#of-category', '#f-category'].forEach(sel => {
      const el = document.querySelector(sel);
      if (!el) return;
      const isAll = el.id === 'cat-filter' || el.id === 'f-category';
      el.innerHTML = isAll
        ? '<option value="">All categories</option>'
        : '<option value="">Select…</option>';
      cats.forEach(c => {
        const opt = document.createElement('option');
        opt.value = opt.textContent = c;
        el.appendChild(opt);
      });
    });
  } catch (e) {
    console.error('Could not load categories', e);
  }
}

// ── Filter modal ──────────────────────────────────────────────────────────────
function applyFilters() {
  state.filters = {
    category:  document.getElementById('f-category').value,
    condition: document.getElementById('f-condition').value,
    status:    document.getElementById('f-status').value,
    minPrice:  document.getElementById('f-min').value,
    maxPrice:  document.getElementById('f-max').value,
    city:      document.getElementById('f-city').value.trim(),
  };
  closeModal('filter-modal');
  loadOffers();
}

function clearFilters() {
  state.filters = {};
  ['f-category', 'f-condition', 'f-status', 'f-min', 'f-max', 'f-city'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  closeModal('filter-modal');
  loadOffers();
}

// ── "My Offers" shortcut in profile menu ──────────────────────────────────────
function filterMyOffers() {
  document.getElementById('profile-dropdown').classList.remove('open');
  if (!state.currentUser) return;
  loadOffers().then(() => {
    const mine = state.offers.filter(o => o.owner_id === state.currentUser.id);
    renderOffers(mine);
    document.getElementById('offers-title').textContent = 'My Offers';
  });
}
