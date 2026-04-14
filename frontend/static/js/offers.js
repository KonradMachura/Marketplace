'use strict';

// ── Offer list ────────────────────────────────────────────────────────────────
let _searchDebounce = null;

function onSearchInput() {
  clearTimeout(_searchDebounce);
  _searchDebounce = setTimeout(loadOffers, 300);
}

async function loadOffers() {
  const grid = document.getElementById('offers-grid');
  grid.innerHTML = '<div class="empty-state"><i class="fa-solid fa-spinner fa-spin"></i><p>Loading…</p></div>';

  const params = new URLSearchParams();
  const search = document.getElementById('search-input').value.trim();
  const cat    = document.getElementById('cat-filter').value;

  if (search) params.set('search', search);
  if (cat)    params.set('category', cat);

  if (state.filters.category)  params.set('category',  state.filters.category);
  if (state.filters.condition) params.set('condition', state.filters.condition);
  if (state.filters.status)    params.set('status',    state.filters.status);
  if (state.filters.city)      params.set('city',      state.filters.city);
  if (state.filters.minPrice)  params.set('min_price', state.filters.minPrice);
  if (state.filters.maxPrice)  params.set('max_price', state.filters.maxPrice);

  try {
    const offers  = await api('GET', '/offers?' + params.toString());
    state.offers  = offers;
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
  const card        = document.createElement('div');
  card.className    = 'offer-card';
  card.onclick      = () => openOfferDetail(o);
  const statusClass = o.status ? o.status.toLowerCase() : '';

  const photo = (o.photos && o.photos.length)
    ? `<img class="card-photo" src="${o.photos[0]}" alt="${escHtml(o.title)}" loading="lazy">`
    : `<div class="card-photo-placeholder"><i class="fa-regular fa-image"></i></div>`;

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

// ── Offer detail ──────────────────────────────────────────────────────────────
function openOfferDetail(o) {
  const isOwner = state.currentUser && state.currentUser.id === o.owner_id;
  const photos  = o.photos || [];

  let galleryHtml;
  if (photos.length) {
    const thumbs = photos.map((p, i) =>
      `<img class="detail-thumb${i === 0 ? ' active' : ''}" src="${p}"
            alt="photo ${i + 1}" onclick="switchGallery(${i})" data-idx="${i}">`
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
    ? `<button class="btn-secondary" onclick="deleteOffer(${o.id})"
              style="border-color:var(--danger);color:var(--danger)">
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
      <span class="badge badge-status ${(o.status || '').toLowerCase()}">${escHtml(o.status)}</span>
    </div>
    <dl class="detail-meta">
      <dt>Seller</dt>  <dd>${escHtml(o.owner)}</dd>
      <dt>City</dt>    <dd>${escHtml(o.city || '—')}</dd>
      <dt>Posted</dt>  <dd>${fmtDateFull(o.created_at)}</dd>
      <dt>Condition</dt><dd>${escHtml(o.condition)}</dd>
    </dl>
    ${o.description ? `<div class="detail-desc">${escHtml(o.description)}</div>` : ''}
    <div class="modal-footer" style="margin-top:.75rem">${actionBtn}</div>`;

  openModal('detail-modal');
}

// Switch the main gallery image — called from inline onclick in detail modal.
function switchGallery(idx) {
  const allThumbs = document.querySelectorAll('.detail-thumb');
  const mainImg   = document.getElementById('detail-main-img');
  if (!mainImg || !allThumbs[idx]) return;
  mainImg.src = allThumbs[idx].src;
  allThumbs.forEach(t => t.classList.remove('active'));
  allThumbs[idx].classList.add('active');
}

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
