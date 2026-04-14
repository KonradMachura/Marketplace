'use strict';

// ── State ────────────────────────────────────────────────────────────────────
const state = {
  token:          null,
  currentUser:    null,
  offers:         [],
  conversations:  [],
  activeConvId:   null,
  activeConv:     null,
  filters:        {},
  chatPoll:       null,
  selectedPhotos: [],
};

// ── API helpers ──────────────────────────────────────────────────────────────
async function api(method, path, body = null, isForm = false) {
  const headers = {};
  if (state.token) headers['Authorization'] = 'Bearer ' + state.token;
  if (body && !isForm) headers['Content-Type'] = 'application/json';

  const opts = { method, headers };
  if (body) opts.body = isForm ? body : JSON.stringify(body);

  const res  = await fetch('/api' + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ── Auth ─────────────────────────────────────────────────────────────────────
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('currentUser');
  window.location.href = '/';
}

// ── Modal helpers ────────────────────────────────────────────────────────────
function openModal(id) {
  document.getElementById(id).classList.add('open');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}
function overlayClose(e, id) {
  if (e.target.id === id) closeModal(id);
}

// ── Toast ────────────────────────────────────────────────────────────────────
let toastTimer = null;
function toast(msg, type = 'default') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show' + (type !== 'default' ? ' ' + type : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.remove('show'); }, 3000);
}

// ── Profile dropdown ─────────────────────────────────────────────────────────
function toggleProfileMenu() {
  document.getElementById('profile-dropdown').classList.toggle('open');
}
document.addEventListener('click', (e) => {
  const wrap = document.getElementById('profile-wrap');
  if (wrap && !wrap.contains(e.target)) {
    document.getElementById('profile-dropdown').classList.remove('open');
  }
});

// ── Categories ────────────────────────────────────────────────────────────────
async function loadCategories() {
  try {
    const cats = await api('GET', '/categories');
    const selectors = ['#cat-filter', '#of-category', '#f-category'];
    selectors.forEach(sel => {
      const el = document.querySelector(sel);
      if (!el) return;
      const hasAll = el.id === 'cat-filter' || el.id === 'f-category';
      if (hasAll) el.innerHTML = '<option value="">All categories</option>';
      else        el.innerHTML = '<option value="">Select…</option>';
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

// ── Offers ────────────────────────────────────────────────────────────────────
let searchDebounce = null;
function onSearchInput() {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(loadOffers, 300);
}

async function loadOffers() {
  const grid = document.getElementById('offers-grid');
  grid.innerHTML = '<div class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i><p>Loading…</p></div>';

  const params = new URLSearchParams();
  const search = document.getElementById('search-input').value.trim();
  const cat    = document.getElementById('cat-filter').value;

  if (search)  params.set('search', search);
  if (cat)     params.set('category', cat);

  // From filter modal
  if (state.filters.category)  params.set('category',  state.filters.category);
  if (state.filters.condition) params.set('condition', state.filters.condition);
  if (state.filters.status)    params.set('status',    state.filters.status);
  if (state.filters.city)      params.set('city',      state.filters.city);
  if (state.filters.minPrice)  params.set('min_price', state.filters.minPrice);
  if (state.filters.maxPrice)  params.set('max_price', state.filters.maxPrice);

  try {
    const offers = await api('GET', '/offers?' + params.toString());
    state.offers = offers;
    renderOffers(offers);
  } catch (e) {
    grid.innerHTML = '<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>Failed to load offers.</p></div>';
  }
}

function renderOffers(offers) {
  const grid  = document.getElementById('offers-grid');
  const count = document.getElementById('offers-count');
  count.textContent = offers.length + (offers.length === 1 ? ' offer' : ' offers');

  if (!offers.length) {
    grid.innerHTML = '<div class="empty-state"><i class="fa-solid fa-box-open"></i><p>No offers found.</p></div>';
    return;
  }
  grid.innerHTML = '';
  offers.forEach(o => grid.appendChild(makeOfferCard(o)));
}

function makeOfferCard(o) {
  const card = document.createElement('div');
  card.className = 'offer-card';
  card.onclick = () => openOfferDetail(o);

  const photo = (o.photos && o.photos.length)
    ? `<img class="card-photo" src="${o.photos[0]}" alt="${escHtml(o.title)}" loading="lazy">`
    : `<div class="card-photo-placeholder"><i class="fa-regular fa-image"></i></div>`;

  const statusClass = o.status ? o.status.toLowerCase() : '';

  card.innerHTML = `
    ${photo}
    <div class="card-body">
      <div class="card-title">${escHtml(o.title)}</div>
      <div class="card-price">$${fmtPrice(o.price)}</div>
      <div class="card-meta">
        <span class="badge badge-cat">${escHtml(o.category)}</span>
        <span class="badge badge-cond">${escHtml(o.condition)}</span>
        <span class="badge badge-status ${statusClass}">${escHtml(o.status)}</span>
      </div>
      <div class="card-footer">
        <span><i class="fa-solid fa-location-dot fa-xs"></i> ${escHtml(o.city || '—')}</span>
        <span>${fmtDate(o.created_at)}</span>
      </div>
    </div>`;
  return card;
}

function openOfferDetail(o) {
  const isOwner = state.currentUser && state.currentUser.id === o.owner_id;
  const photos  = o.photos || [];

  let galleryHtml;
  if (photos.length) {
    const thumbs = photos.map((p, i) =>
      `<img class="detail-thumb${i === 0 ? ' active' : ''}" src="${p}" alt="photo ${i+1}"
            onclick="switchGallery(${i})" data-idx="${i}">`
    ).join('');
    galleryHtml = `
      <div class="detail-gallery">
        <img id="detail-main-img" class="detail-main-photo" src="${photos[0]}" alt="main photo">
        <div class="detail-thumbs">${thumbs}</div>
      </div>`;
  } else {
    galleryHtml = `<div class="detail-placeholder"><i class="fa-regular fa-image"></i></div>`;
  }

  const actionBtn = isOwner
    ? `<button class="btn-secondary btn-icon" onclick="deleteOffer(${o.id})" style="width:auto;padding:.55rem 1rem;gap:.4rem;color:var(--danger)">
         <i class="fa-solid fa-trash"></i> Delete offer
       </button>`
    : `<button class="btn-primary contact-btn" onclick="contactSeller(${o.id})">
         <i class="fa-regular fa-comment-dots"></i> Contact Seller
       </button>`;

  document.getElementById('detail-content').innerHTML = `
    ${galleryHtml}
    <div class="detail-title">${escHtml(o.title)}</div>
    <div class="detail-price">$${fmtPrice(o.price)}</div>
    <div class="detail-badges">
      <span class="badge badge-cat">${escHtml(o.category)}</span>
      <span class="badge badge-cond">${escHtml(o.condition)}</span>
      <span class="badge badge-status ${(o.status||'').toLowerCase()}">${escHtml(o.status)}</span>
    </div>
    <dl class="detail-meta">
      <dt>Seller</dt><dd>${escHtml(o.owner)}</dd>
      <dt>City</dt><dd>${escHtml(o.city || '—')}</dd>
      <dt>Posted</dt><dd>${fmtDateFull(o.created_at)}</dd>
      <dt>Condition</dt><dd>${escHtml(o.condition)}</dd>
    </dl>
    ${o.description ? `<div class="detail-desc">${escHtml(o.description)}</div>` : ''}
    <div class="modal-footer" style="margin-top:.75rem">${actionBtn}</div>`;

  openModal('detail-modal');
}

// Photo gallery switcher (used by inline onclick)
window.switchGallery = function(idx) {
  const photos = state.offers.find(o =>
    document.getElementById('detail-main-img') &&
    document.getElementById('detail-main-img').src.includes(o.photos && o.photos[0] ? o.photos[0].split('/').pop() : '__none__')
  );
  const allThumbs = document.querySelectorAll('.detail-thumb');
  const mainImg   = document.getElementById('detail-main-img');
  if (!mainImg) return;
  mainImg.src = allThumbs[idx].src;
  allThumbs.forEach(t => t.classList.remove('active'));
  allThumbs[idx].classList.add('active');
};

async function deleteOffer(id) {
  if (!confirm('Delete this offer?')) return;
  try {
    await api('DELETE', `/offers/${id}`);
    closeModal('detail-modal');
    toast('Offer deleted.', 'success');
    loadOffers();
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function contactSeller(offerId) {
  try {
    const conv = await api('POST', '/conversations', { offer_id: offerId });
    closeModal('detail-modal');
    await loadConversations();
    openChat(conv.id);
  } catch (e) {
    toast(e.message, 'error');
  }
}

// ── Add offer form ────────────────────────────────────────────────────────────
function onPhotosSelected(e) {
  const files = Array.from(e.target.files);
  const remaining = 5 - state.selectedPhotos.length;
  const toAdd = files.slice(0, remaining);
  toAdd.forEach(f => state.selectedPhotos.push(f));
  renderPhotoPreviews();
  e.target.value = '';
}

function renderPhotoPreviews() {
  const wrap = document.getElementById('photo-previews');
  wrap.innerHTML = '';
  state.selectedPhotos.forEach((file, i) => {
    const url  = URL.createObjectURL(file);
    const div  = document.createElement('div');
    div.className = 'photo-preview-wrap';
    div.innerHTML  = `<img src="${url}">
      <button class="photo-remove" onclick="removePhoto(${i})"><i class="fa-solid fa-xmark"></i></button>`;
    wrap.appendChild(div);
  });
}

window.removePhoto = function(i) {
  state.selectedPhotos.splice(i, 1);
  renderPhotoPreviews();
};

async function submitOffer(e) {
  e.preventDefault();
  const errEl = document.getElementById('offer-form-error');
  errEl.style.display = 'none';

  const title    = document.getElementById('of-title').value.trim();
  const category = document.getElementById('of-category').value;
  const price    = document.getElementById('of-price').value;

  if (!title || !category || !price) {
    errEl.textContent = 'Title, category and price are required.';
    errEl.style.display = 'block';
    return;
  }

  const fd = new FormData();
  fd.append('title',       title);
  fd.append('category',    category);
  fd.append('price',       price);
  fd.append('description', document.getElementById('of-description').value.trim());
  fd.append('condition',   document.getElementById('of-condition').value);
  fd.append('status',      document.getElementById('of-status').value);
  fd.append('city',        document.getElementById('of-city').value.trim());
  state.selectedPhotos.forEach(f => fd.append('photos', f));

  const btn = document.getElementById('offer-submit-btn');
  btn.disabled = true;
  btn.textContent = 'Posting…';

  try {
    await api('POST', '/offers', fd, true);
    closeModal('offer-modal');
    resetOfferForm();
    toast('Offer posted!', 'success');
    loadOffers();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Post Offer';
  }
}

function resetOfferForm() {
  document.getElementById('offer-form').reset();
  state.selectedPhotos = [];
  document.getElementById('photo-previews').innerHTML = '';
  document.getElementById('offer-form-error').style.display = 'none';
}

// ── Filters ───────────────────────────────────────────────────────────────────
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
  ['f-category','f-condition','f-status','f-min','f-max','f-city'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  closeModal('filter-modal');
  loadOffers();
}

function filterMyOffers() {
  document.getElementById('profile-dropdown').classList.remove('open');
  if (!state.currentUser) return;
  // Clear search, set a flag — simplest: search by username not supported, so just show user's offers via owner_id filter trick
  // We'll reload and filter client-side temporarily
  loadOffers().then(() => {
    const myOffers = state.offers.filter(o => o.owner_id === state.currentUser.id);
    renderOffers(myOffers);
    document.getElementById('offers-title').textContent = 'My Offers';
  });
}

// ── Conversations ─────────────────────────────────────────────────────────────
async function loadConversations() {
  try {
    const convs = await api('GET', '/conversations');
    state.conversations = convs;
    renderConvList(convs);
  } catch (e) {
    console.error('Could not load conversations', e);
  }
}

function renderConvList(convs) {
  const list = document.getElementById('conv-list');
  if (!convs.length) {
    list.innerHTML = '<div class="empty-state"><i class="fa-regular fa-comment-dots"></i><p>No conversations yet.<br>Contact a seller to start one.</p></div>';
    return;
  }
  list.innerHTML = '';
  convs.forEach(c => list.appendChild(makeConvItem(c)));
}

function makeConvItem(c) {
  const div = document.createElement('div');
  div.className = 'conv-item';
  div.onclick = () => openChat(c.id);
  const initial = (c.other_user || '?')[0].toUpperCase();
  div.innerHTML = `
    <div class="conv-avatar">${initial}</div>
    <div class="conv-info">
      <div class="conv-name">${escHtml(c.other_user || 'Unknown')}</div>
      <div class="conv-offer"><i class="fa-solid fa-tag fa-xs"></i> ${escHtml(c.offer_title)}</div>
      ${c.last_message ? `<div class="conv-preview">${escHtml(c.last_message)}</div>` : ''}
    </div>`;
  return div;
}

function backToConvList() {
  clearInterval(state.chatPoll);
  state.chatPoll      = null;
  state.activeConvId  = null;
  state.activeConv    = null;
  document.getElementById('chat-view').style.display  = 'none';
  document.getElementById('conv-list-view').style.display = '';
}

// ── Chat ──────────────────────────────────────────────────────────────────────
async function openChat(convId) {
  state.activeConvId = convId;
  document.getElementById('conv-list-view').style.display = 'none';
  document.getElementById('chat-view').style.display = 'flex';
  await loadChat(convId);

  // Poll for new messages every 5 s
  clearInterval(state.chatPoll);
  state.chatPoll = setInterval(() => loadChat(convId), 5000);
}

async function loadChat(convId) {
  try {
    const data = await api('GET', `/conversations/${convId}/messages`);
    state.activeConv = data.conversation;

    document.getElementById('chat-offer-title').textContent = data.conversation.offer_title;
    document.getElementById('chat-other-user').textContent  = data.conversation.other_user || '';

    renderMessages(data.messages, data.conversation);
  } catch (e) {
    toast('Could not load messages.', 'error');
  }
}

function renderMessages(msgs, conv) {
  const wrap = document.getElementById('messages-wrap');
  const wasAtBottom = wrap.scrollHeight - wrap.scrollTop <= wrap.clientHeight + 40;

  wrap.innerHTML = '';
  if (!msgs.length) {
    wrap.innerHTML = '<div class="empty-state" style="padding:2rem"><i class="fa-regular fa-comment"></i><p>No messages yet. Say hello!</p></div>';
    return;
  }
  msgs.forEach(m => wrap.appendChild(makeMessageEl(m, conv)));

  if (wasAtBottom || wrap.scrollTop === 0) {
    wrap.scrollTop = wrap.scrollHeight;
  }
}

function makeMessageEl(m, conv) {
  const isOwn = m.sender_id === state.currentUser.id;

  if (m.message_type === 'price_offer') {
    return makePriceBubble(m, isOwn, conv);
  }

  const row = document.createElement('div');
  row.className = 'msg-row ' + (isOwn ? 'own' : 'other');
  row.innerHTML = `
    <div class="bubble">
      ${escHtml(m.content)}
      <div class="bubble-time">${fmtTime(m.created_at)}</div>
    </div>`;
  return row;
}

function makePriceBubble(m, isOwn, conv) {
  const wrap = document.createElement('div');
  wrap.className = 'msg-row ' + (isOwn ? 'own' : 'other');

  let actionsHtml = '';
  if (m.price_status === 'pending') {
    if (!isOwn) {
      // The recipient can accept or decline
      actionsHtml = `
        <div class="pb-actions">
          <button class="pb-accept"  onclick="respondPrice(${m.id},'accept')">
            <i class="fa-solid fa-check"></i> Accept
          </button>
          <button class="pb-decline" onclick="respondPrice(${m.id},'decline')">
            <i class="fa-solid fa-xmark"></i> Decline
          </button>
        </div>`;
    } else {
      actionsHtml = `<div style="margin-top:.4rem"><span class="pb-status pending"><i class="fa-solid fa-clock"></i> Pending…</span></div>`;
    }
  } else {
    const icon  = m.price_status === 'accepted' ? 'fa-check-circle' : 'fa-times-circle';
    actionsHtml = `<div style="margin-top:.4rem">
      <span class="pb-status ${m.price_status}">
        <i class="fa-solid ${icon}"></i>
        ${m.price_status.charAt(0).toUpperCase() + m.price_status.slice(1)}
      </span></div>`;
  }

  wrap.innerHTML = `
    <div class="price-bubble">
      <div class="pb-label"><i class="fa-solid fa-tag"></i> Price offer from ${escHtml(m.sender_username)}</div>
      <div class="pb-amount">$${fmtPrice(m.price_amount)}</div>
      ${actionsHtml}
      <div class="bubble-time" style="margin-top:.35rem">${fmtTime(m.created_at)}</div>
    </div>`;
  return wrap;
}

async function sendMessage() {
  const input = document.getElementById('msg-input');
  const text  = input.value.trim();
  if (!text || !state.activeConvId) return;

  input.value = '';
  try {
    await api('POST', `/conversations/${state.activeConvId}/messages`, { type: 'text', content: text });
    await loadChat(state.activeConvId);
  } catch (e) {
    toast(e.message, 'error');
    input.value = text;
  }
}

async function sendPriceOffer() {
  const errEl  = document.getElementById('price-offer-error');
  const amount = parseFloat(document.getElementById('price-offer-input').value);
  errEl.style.display = 'none';

  if (!amount || amount <= 0) {
    errEl.textContent = 'Enter a valid price.';
    errEl.style.display = 'block';
    return;
  }
  if (!state.activeConvId) return;

  try {
    await api('POST', `/conversations/${state.activeConvId}/messages`, {
      type: 'price_offer', price_amount: amount,
    });
    closeModal('price-modal');
    document.getElementById('price-offer-input').value = '';
    await loadChat(state.activeConvId);
  } catch (e) {
    errEl.textContent = e.message;
    errEl.style.display = 'block';
  }
}

// Make respondPrice accessible to inline onclick
window.respondPrice = async function(msgId, action) {
  try {
    await api('PUT', `/messages/${msgId}/respond`, { action });
    await loadChat(state.activeConvId);
    if (action === 'accept') toast('Price offer accepted!', 'success');
    else                     toast('Price offer declined.');
  } catch (e) {
    toast(e.message, 'error');
  }
};

// ── Utility ───────────────────────────────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function fmtPrice(n) {
  return Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtDateFull(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

function fmtTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  const token = localStorage.getItem('token');
  if (!token) { window.location.href = '/'; return; }
  state.token = token;

  try {
    const user = await api('GET', '/auth/me');
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

  // Refresh conversations every 30 s in background
  setInterval(loadConversations, 30000);
}

window.addEventListener('DOMContentLoaded', init);
