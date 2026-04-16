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

// ── Custom attribute rows ─────────────────────────────────────────────────────
function addAttributeRow() {
  const rows = document.querySelectorAll('#attr-rows .attr-row');
  if (rows.length >= 10) return;

  const idx       = Date.now();
  const row       = document.createElement('div');
  row.className   = 'form-row attr-row';
  row.dataset.idx = idx;
  row.innerHTML   = `
    <div class="form-group" style="flex:1">
      <input type="text" class="attr-key"   placeholder="Name (e.g. RAM)"    maxlength="50">
    </div>
    <div class="form-group" style="flex:1">
      <input type="text" class="attr-value" placeholder="Value (e.g. 16 GB)" maxlength="100">
    </div>
    <button type="button" class="btn-icon" onclick="removeAttributeRow('${idx}')"
            title="Remove" style="align-self:flex-end;margin-bottom:.4rem">
      <i class="fa-solid fa-xmark"></i>
    </button>`;
  document.getElementById('attr-rows').appendChild(row);
  document.getElementById('attr-add-btn').disabled =
    document.querySelectorAll('#attr-rows .attr-row').length >= 10;
}

function removeAttributeRow(idx) {
  const row = document.querySelector(`#attr-rows .attr-row[data-idx="${idx}"]`);
  if (row) row.remove();
  document.getElementById('attr-add-btn').disabled =
    document.querySelectorAll('#attr-rows .attr-row').length >= 10;
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

  const attrObj = {};
  document.querySelectorAll('#attr-rows .attr-row').forEach(row => {
    const key   = row.querySelector('.attr-key').value.trim();
    const value = row.querySelector('.attr-value').value.trim();
    if (key && value) attrObj[key] = value;
  });
  fd.append('attributes', JSON.stringify(attrObj));

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
  document.getElementById('attr-rows').innerHTML = '';
  document.getElementById('attr-add-btn').disabled = false;
}
