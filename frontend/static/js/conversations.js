'use strict';

// ── Conversation list ─────────────────────────────────────────────────────────
async function loadConversations() {
  try {
    const convs        = await api('GET', '/conversations');
    state.conversations = convs;
    renderConvList(convs);
  } catch (e) {
    console.error('Could not load conversations', e);
  }
}

function renderConvList(convs) {
  const list = document.getElementById('conv-list');
  if (!convs.length) {
    list.innerHTML = `<div class="empty-state">
      <i class="fa-regular fa-comment-dots"></i>
      <p>No conversations yet.<br>Contact a seller to start one.</p>
    </div>`;
    return;
  }
  list.innerHTML = '';
  convs.forEach(c => list.appendChild(makeConvItem(c)));
}

function makeConvItem(c) {
  const div     = document.createElement('div');
  div.className = 'conv-item';
  div.onclick   = () => openChat(c.id);
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

// ── Navigation ────────────────────────────────────────────────────────────────
function backToConvList() {
  clearInterval(state.chatPoll);
  state.chatPoll     = null;
  state.activeConvId = null;
  state.activeConv   = null;
  document.getElementById('chat-view').style.display      = 'none';
  document.getElementById('conv-list-view').style.display = '';
}
