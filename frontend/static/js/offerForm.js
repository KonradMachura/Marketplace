'use strict';

// ── Photo selection & preview ─────────────────────────────────────────────────
function onPhotosSelected(e) {
  const remaining = 5 - state.selectedPhotos.length;
  Array.from(e.target.files).slice(0, remaining).forEach(f => state.selectedPhotos.push(f));
  renderPhotoPreviews();
  e.target.value = '';
}

function renderPhotoPreviews() {
  const wrap = document.getElementById('photo-previews');
  wrap.innerHTML = '';
  state.selectedPhotos.forEach((file, i) => {
    const url = URL.createObjectURL(file);
    const div = document.createElement('div');
    div.className = 'photo-preview-wrap';
    div.innerHTML = `
      <img src="${url}" alt="preview ${i + 1}">
      <button class="photo-remove" onclick="removePhoto(${i})">
        <i class="fa-solid fa-xmark"></i>
      </button>`;
    wrap.appendChild(div);
  });
}

function removePhoto(i) {
  state.selectedPhotos.splice(i, 1);
  renderPhotoPreviews();
}

// ── Add offer form submission ──────────────────────────────────────────────────
async function submitOffer(e) {
  e.preventDefault();
  const errEl    = document.getElementById('offer-form-error');
  const title    = document.getElementById('of-title').value.trim();
  const category = document.getElementById('of-category').value;
  const price    = document.getElementById('of-price').value;

  errEl.style.display = 'none';

  if (!title || !category || !price) {
    errEl.textContent   = 'Title, category and price are required.';
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

  const btn     = document.getElementById('offer-submit-btn');
  btn.disabled  = true;
  btn.textContent = 'Posting…';

  try {
    await api('POST', '/offers', fd, true);
    closeModal('offer-modal');
    resetOfferForm();
    toast('Offer posted!', 'success');
    loadOffers();
  } catch (err) {
    errEl.textContent   = err.message;
    errEl.style.display = 'block';
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Post Offer';
  }
}

function resetOfferForm() {
  document.getElementById('offer-form').reset();
  state.selectedPhotos = [];
  document.getElementById('photo-previews').innerHTML    = '';
  document.getElementById('offer-form-error').style.display = 'none';
}
