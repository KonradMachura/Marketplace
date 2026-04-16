'use strict';

// ── Auth ──────────────────────────────────────────────────────────────────────
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('currentUser');
  window.location.href = '/';
}

// ── Tab switching ─────────────────────────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === name);
  });
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.style.display = panel.id === 'tab-' + name ? 'block' : 'none';
  });
}

// ── Account tab ───────────────────────────────────────────────────────────────
function populateAccountForm(user) {
  document.getElementById('member-since').textContent = fmtDateFull(user.created_at);
  document.getElementById('p-username').value         = user.username  || '';
  document.getElementById('p-email').value            = user.email     || '';
  document.getElementById('p-city').value             = user.city      || '';
}

async function submitProfileForm(e) {
  e.preventDefault();
  const errEl  = document.getElementById('profile-form-error');
  const okEl   = document.getElementById('profile-form-success');
  const username = document.getElementById('p-username').value.trim();
  const email    = document.getElementById('p-email').value.trim();
  const city     = document.getElementById('p-city').value.trim();

  errEl.style.display = 'none';
  okEl.style.display  = 'none';

  const emailRe = /^[\w\-\.]+@([\w-]+\.)+[\w-]{2,}$/;
  if (!username || !email) {
    errEl.textContent = 'Username and email are required.';
    errEl.style.display = 'block'; return;
  }
  if (!emailRe.test(email)) {
    errEl.textContent = 'Please enter a valid email address.';
    errEl.style.display = 'block'; return;
  }

  try {
    const user = await api('PUT', '/auth/profile', { username, email, city });
    state.currentUser = user;
    populateAccountForm(user);
    okEl.textContent = 'Profile updated successfully.';
    okEl.style.display = 'block';
  } catch (err) {
    errEl.textContent   = err.message;
    errEl.style.display = 'block';
  }
}

async function submitPasswordForm(e) {
  e.preventDefault();
  const errEl    = document.getElementById('password-form-error');
  const okEl     = document.getElementById('password-form-success');
  const current  = document.getElementById('p-current-pw').value;
  const newPw    = document.getElementById('p-new-pw').value;
  const confirm  = document.getElementById('p-confirm-pw').value;

  errEl.style.display = 'none';
  okEl.style.display  = 'none';

  if (!current || !newPw || !confirm) {
    errEl.textContent = 'All password fields are required.';
    errEl.style.display = 'block'; return;
  }
  if (newPw !== confirm) {
    errEl.textContent = 'New passwords do not match.';
    errEl.style.display = 'block'; return;
  }
  if (newPw.length < 6) {
    errEl.textContent = 'New password must be at least 6 characters.';
    errEl.style.display = 'block'; return;
  }

  try {
    await api('PUT', '/auth/password', { current_password: current, new_password: newPw });
    document.getElementById('p-current-pw').value = '';
    document.getElementById('p-new-pw').value     = '';
    document.getElementById('p-confirm-pw').value = '';
    okEl.textContent   = 'Password changed successfully.';
    okEl.style.display = 'block';
  } catch (err) {
    errEl.textContent   = err.message;
    errEl.style.display = 'block';
  }
}

// ── Purchases tab ─────────────────────────────────────────────────────────────
async function loadPurchases() {
  try {
    state.purchases = await api('GET', '/purchases');
    renderPurchaseList(state.purchases);
  } catch {
    document.getElementById('purchases-list').innerHTML =
      '<p style="padding:1rem;color:var(--text-muted)">Could not load purchases.</p>';
  }
}

function renderPurchaseList(purchases) {
  const list    = document.getElementById('purchases-list');
  const countEl = document.getElementById('purchases-count');
  countEl.textContent = purchases.length ? purchases.length + ' purchase' + (purchases.length > 1 ? 's' : '') : '';
  list.innerHTML = '';

  if (!purchases.length) {
    list.innerHTML = `<div class="purchases-empty">
      <i class="fa-solid fa-bag-shopping"></i>
      <p>No purchases yet.</p>
    </div>`;
    return;
  }

  purchases.forEach(p => {
    const row = document.createElement('div');
    row.className = 'purchase-row';
    row.onclick   = () => openPurchaseDetail(p.id);
    row.innerHTML = `
      <div class="purchase-row-icon"><i class="fa-solid fa-bag-shopping"></i></div>
      <div class="purchase-row-body">
        <div class="purchase-row-title">${escHtml(p.offer_title)}</div>
        <div class="purchase-row-meta">
          <span>Seller: ${escHtml(p.seller_username)}</span>
          <span>${fmtDate(p.created_at)}</span>
          <span>${escHtml(p.delivery_method)}</span>
        </div>
      </div>
      <div class="purchase-row-right">
        <span class="purchase-row-price">$${fmtPrice(p.price_paid)}</span>
        <span class="badge badge-completed">${escHtml(p.status)}</span>
      </div>`;
    list.appendChild(row);
  });
}

function openPurchaseDetail(pid) {
  const p = state.purchases.find(x => x.id === pid);
  if (!p) return;

  document.getElementById('purchases-list-view').style.display  = 'none';
  document.getElementById('purchase-detail-view').style.display = 'block';

  const o = p.offer;
  const photosHtml = o && o.photos && o.photos.length
    ? `<div class="detail-photos">${o.photos.map(src => `<img src="${escHtml(src)}" alt="">`).join('')}</div>`
    : '';

  document.getElementById('purchase-detail-content').innerHTML = `
    <div class="purchase-detail-section">
      <h4>Offer</h4>
      ${photosHtml}
      <dl class="detail-grid">
        <dt>Title</dt>       <dd>${escHtml(p.offer_title)}</dd>
        <dt>Category</dt>    <dd>${escHtml(o ? o.category  : '—')}</dd>
        <dt>Condition</dt>   <dd>${escHtml(o ? o.condition : '—')}</dd>
        <dt>Seller</dt>      <dd>${escHtml(p.seller_username)}</dd>
        ${o && o.description ? `<dt>Description</dt><dd style="grid-column:span 1">${escHtml(o.description)}</dd>` : ''}
      </dl>
    </div>

    <div class="purchase-detail-section">
      <h4>Payment</h4>
      <dl class="detail-grid">
        <dt>Amount paid</dt>    <dd>$${fmtPrice(p.price_paid)}</dd>
        <dt>Payment method</dt> <dd>${escHtml(p.payment_method)}</dd>
      </dl>
    </div>

    <div class="purchase-detail-section">
      <h4>Delivery</h4>
      <dl class="detail-grid">
        <dt>Method</dt>  <dd>${escHtml(p.delivery_method)}</dd>
        ${p.delivery_address ? `<dt>Address</dt><dd>${escHtml(p.delivery_address)}</dd>` : ''}
        ${p.notes ? `<dt>Notes</dt><dd>${escHtml(p.notes)}</dd>` : ''}
      </dl>
    </div>

    <div class="purchase-detail-section">
      <h4>Status</h4>
      <span class="badge badge-completed">${escHtml(p.status)}</span>
      <span style="font-size:.8rem;color:var(--text-muted);margin-left:.5rem">${fmtDateFull(p.created_at)}</span>
    </div>`;
}

function showPurchaseList() {
  document.getElementById('purchase-detail-view').style.display = 'none';
  document.getElementById('purchases-list-view').style.display  = 'block';
}

// ── Complaints tab ────────────────────────────────────────────────────────────
async function loadComplaints() {
  try {
    state.complaints = await api('GET', '/complaints');
    renderComplaintList(state.complaints);
  } catch {
    document.getElementById('complaints-list').innerHTML =
      '<p style="padding:1rem;color:var(--text-muted)">Could not load complaints.</p>';
  }
}

function renderComplaintList(complaints) {
  const list = document.getElementById('complaints-list');
  list.innerHTML = '';

  if (!complaints.length) {
    list.innerHTML = `<div class="complaints-empty">
      <i class="fa-solid fa-triangle-exclamation"></i>
      <p>No complaints or returns filed.</p>
    </div>`;
    return;
  }

  const statusClass = { 'Open': 'badge-open', 'In Progress': 'badge-inprogress', 'Resolved': 'badge-resolved' };
  const typeClass   = { 'Complaint': 'badge-complaint', 'Return': 'badge-return' };

  complaints.forEach(c => {
    const row = document.createElement('div');
    row.className = 'complaint-row';
    row.innerHTML = `
      <div class="complaint-row-body">
        <div class="complaint-row-title">${escHtml(c.offer_title)}</div>
        <div class="complaint-row-meta">${fmtDate(c.created_at)}</div>
      </div>
      <div style="display:flex;gap:.4rem;flex-shrink:0;align-items:center">
        <span class="badge ${typeClass[c.type] || ''}">${escHtml(c.type)}</span>
        <span class="badge ${statusClass[c.status] || ''}">${escHtml(c.status)}</span>
      </div>`;
    list.appendChild(row);
  });
}

function openComplaintModal() {
  const sel = document.getElementById('c-purchase-id');
  sel.innerHTML = '<option value="">Select a purchase…</option>';
  (state.purchases || []).forEach(p => {
    const opt = document.createElement('option');
    opt.value       = p.id;
    opt.textContent = p.offer_title + ' — $' + fmtPrice(p.price_paid) + ' (' + fmtDate(p.created_at) + ')';
    sel.appendChild(opt);
  });

  document.getElementById('c-type').value        = '';
  document.getElementById('c-description').value = '';
  document.getElementById('complaint-form-error').style.display = 'none';
  openModal('complaint-modal');
}

async function submitComplaintForm(e) {
  e.preventDefault();
  const errEl      = document.getElementById('complaint-form-error');
  const purchaseId = parseInt(document.getElementById('c-purchase-id').value, 10);
  const type       = document.getElementById('c-type').value;
  const description = document.getElementById('c-description').value.trim();

  errEl.style.display = 'none';

  if (!purchaseId) { errEl.textContent = 'Please select a purchase.'; errEl.style.display = 'block'; return; }
  if (!type)       { errEl.textContent = 'Please select a type.';     errEl.style.display = 'block'; return; }
  if (description.length < 10) {
    errEl.textContent = 'Description must be at least 10 characters.';
    errEl.style.display = 'block'; return;
  }

  try {
    await api('POST', '/complaints', { purchase_id: purchaseId, type, description });
    closeModal('complaint-modal');
    toast('Complaint submitted.', 'success');
    await loadComplaints();
  } catch (err) {
    errEl.textContent   = err.message;
    errEl.style.display = 'block';
  }
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
async function init() {
  const token = localStorage.getItem('token');
  if (!token) { window.location.href = '/'; return; }
  state.token = token;

  try {
    const user        = await api('GET', '/auth/me');
    state.currentUser = user;
    populateAccountForm(user);
  } catch {
    localStorage.removeItem('token');
    window.location.href = '/';
    return;
  }

  await Promise.all([loadPurchases(), loadComplaints()]);

  // Tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Forms
  document.getElementById('profile-form').addEventListener('submit',  submitProfileForm);
  document.getElementById('password-form').addEventListener('submit', submitPasswordForm);
  document.getElementById('complaint-form').addEventListener('submit', submitComplaintForm);
}

window.addEventListener('DOMContentLoaded', init);
