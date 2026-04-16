'use strict';

// ── Open / load chat ──────────────────────────────────────────────────────────
async function openChat(convId) {
  state.activeConvId = convId;
  document.getElementById('conv-list-view').style.display = 'none';
  document.getElementById('chat-view').style.display      = 'flex';
  await loadChat(convId);

  clearInterval(state.chatPoll);
  state.chatPoll = setInterval(() => loadChat(convId), 5000);
}

async function loadChat(convId) {
  try {
    const data       = await api('GET', `/conversations/${convId}/messages`);
    state.activeConv = data.conversation;

    document.getElementById('chat-offer-title').textContent = data.conversation.offer_title;
    document.getElementById('chat-other-user').textContent  = data.conversation.other_user || '';

    renderMessages(data.messages, data.conversation);
  } catch (e) {
    toast('Could not load messages.', 'error');
  }
}

// ── Render messages ───────────────────────────────────────────────────────────
function renderMessages(msgs, conv) {
  const wrap        = document.getElementById('messages-wrap');
  const wasAtBottom = wrap.scrollHeight - wrap.scrollTop <= wrap.clientHeight + 40;

  wrap.innerHTML = '';
  if (!msgs.length) {
    wrap.innerHTML = `<div class="empty-state" style="padding:2rem">
      <i class="fa-regular fa-comment"></i>
      <p>No messages yet. Say hello!</p>
    </div>`;
    return;
  }
  msgs.forEach(m => wrap.appendChild(makeMessageEl(m, conv)));
  renderFinalizePurchaseBar(msgs, conv);

  if (wasAtBottom || wrap.scrollTop === 0) wrap.scrollTop = wrap.scrollHeight;
}

function makeMessageEl(m, conv) {
  const isOwn = m.sender_id === state.currentUser.id;
  if (m.message_type === 'price_offer') return makePriceBubble(m, isOwn);

  const row     = document.createElement('div');
  row.className = 'msg-row ' + (isOwn ? 'own' : 'other');
  row.innerHTML = `
    <div class="bubble">
      ${escHtml(m.content)}
      <div class="bubble-time">${fmtTime(m.created_at)}</div>
    </div>`;
  return row;
}

function makePriceBubble(m, isOwn) {
  const wrap     = document.createElement('div');
  wrap.className = 'msg-row ' + (isOwn ? 'own' : 'other');

  let actionsHtml = '';
  if (m.price_status === 'pending') {
    actionsHtml = isOwn
      ? `<div style="margin-top:.4rem">
           <span class="pb-status pending"><i class="fa-solid fa-clock"></i> Pending…</span>
         </div>`
      : `<div class="pb-actions">
           <button class="pb-accept"  onclick="respondPrice(${m.id},'accept')">
             <i class="fa-solid fa-check"></i> Accept
           </button>
           <button class="pb-decline" onclick="respondPrice(${m.id},'decline')">
             <i class="fa-solid fa-xmark"></i> Decline
           </button>
         </div>`;
  } else {
    const icon = m.price_status === 'accepted' ? 'fa-check-circle' : 'fa-times-circle';
    actionsHtml = `<div style="margin-top:.4rem">
      <span class="pb-status ${m.price_status}">
        <i class="fa-solid ${icon}"></i>
        ${m.price_status.charAt(0).toUpperCase() + m.price_status.slice(1)}
      </span>
    </div>`;
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

// ── Send messages ─────────────────────────────────────────────────────────────
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
    errEl.textContent   = 'Enter a valid price.';
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
    errEl.textContent   = e.message;
    errEl.style.display = 'block';
  }
}

// ── Finalize Purchase ─────────────────────────────────────────────────────────
function renderFinalizePurchaseBar(msgs, conv) {
  const bar = document.getElementById('finalize-bar');
  if (!state.currentUser || state.currentUser.id !== conv.buyer_id) {
    bar.style.display = 'none'; return;
  }
  if (conv.has_purchase) { bar.style.display = 'none'; return; }

  const accepted = msgs.find(m => m.message_type === 'price_offer' && m.price_status === 'accepted');
  if (!accepted) { bar.style.display = 'none'; return; }

  document.getElementById('finalize-bar-price').textContent = '$' + fmtPrice(accepted.price_amount);
  bar.style.display = 'flex';
}

function openFinalizePurchaseModal() {
  document.getElementById('fp-payment').value               = '';
  document.getElementById('fp-delivery').value              = '';
  document.getElementById('fp-address').value               = '';
  document.getElementById('fp-notes').value                 = '';
  document.getElementById('fp-address-group').style.display = 'none';
  document.getElementById('finalize-modal-error').style.display = 'none';
  openModal('finalize-modal');
}

function onFpDeliveryChange() {
  const isShipping = document.getElementById('fp-delivery').value === 'Shipping';
  document.getElementById('fp-address-group').style.display = isShipping ? '' : 'none';
}

async function submitFinalizePurchase() {
  const errEl    = document.getElementById('finalize-modal-error');
  const payment  = document.getElementById('fp-payment').value;
  const delivery = document.getElementById('fp-delivery').value;
  const address  = document.getElementById('fp-address').value.trim();
  const notes    = document.getElementById('fp-notes').value.trim();
  const btn      = document.getElementById('finalize-submit-btn');

  errEl.style.display = 'none';
  if (!payment)  { errEl.textContent = 'Please select a payment method.';  errEl.style.display = 'block'; return; }
  if (!delivery) { errEl.textContent = 'Please select a delivery method.'; errEl.style.display = 'block'; return; }
  if (delivery === 'Shipping' && !address) {
    errEl.textContent = 'Delivery address is required for Shipping.';
    errEl.style.display = 'block'; return;
  }

  btn.disabled = true; btn.textContent = 'Processing…';
  try {
    await api('POST', '/purchases', {
      conversation_id:  state.activeConvId,
      payment_method:   payment,
      delivery_method:  delivery,
      delivery_address: address,
      notes,
    });
    closeModal('finalize-modal');
    await loadChat(state.activeConvId);
    toast('Purchase finalized! View it in your Profile.', 'success');
  } catch (e) {
    errEl.textContent   = e.message;
    errEl.style.display = 'block';
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Confirm Purchase';
  }
}

// ── Price offer response (called from inline onclick in chat bubbles) ──────────
function respondPrice(msgId, action) {
  api('PUT', `/messages/${msgId}/respond`, { action })
    .then(() => {
      loadChat(state.activeConvId);
      toast(action === 'accept' ? 'Price offer accepted!' : 'Price offer declined.',
            action === 'accept' ? 'success' : 'default');
    })
    .catch(e => toast(e.message, 'error'));
}
