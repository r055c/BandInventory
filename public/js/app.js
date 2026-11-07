import * as V from './views.js';
import { tabs } from './ui.js';
import * as S from './store.js';
import { showGate } from './gate.js';

const app = document.getElementById('app');
let cleanup = null;

function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const [head, ...rest] = parts;
  switch (head) {
    case 'items': return V.itemList(rest);
    case 'item': return V.itemDetail(rest);
    case 'new': return rest[0] === 'piece' ? V.pieceForm([], 'new') : V.itemForm(rest, 'new');
    case 'edit': return V.itemForm(rest, 'edit');
    case 'issue': return V.issueView(rest);
    case 'members': return V.membersView();
    case 'member': return V.memberDetail(rest);
    case 'music': return V.musicList();
    case 'piece': return V.pieceDetail(rest);
    case 'edit-piece': return V.pieceForm(rest, 'edit');
    case 'settings': return V.settingsView();
    case 'scan': return V.scanView();
    case 'labels': return V.labelsView(rest, 'all');
    case 'label': return V.labelsView(rest, 'single');
    default: return V.home();
  }
}

function render(keepScroll = false) {
  const prev = keepScroll ? app.querySelector('.page')?.scrollTop || 0 : 0;
  if (cleanup) { cleanup(); cleanup = null; }
  const view = route();
  app.className = 'shell' + (view.className ? ' ' + view.className : '');
  const root = document.createElement('div');
  root.className = 'view';
  root.innerHTML = `<main class="page">${view.html}</main>${view.bar ?? (view.nav ? tabs(view.nav) : '')}`;
  app.replaceChildren(root);
  const c = view.mount?.(root);
  if (typeof c === 'function') cleanup = c;
  const page = root.querySelector('.page');
  if (page) page.scrollTop = prev;
}

window.addEventListener('hashchange', () => render(false));
window.addEventListener('bk:refresh', () => render(true));

// Changes made on another device: refresh lists, but never while someone is typing in a form.
const EDITING = /^#\/(new|edit|edit-piece|issue|settings|scan)/;
window.addEventListener('bk:auth', async () => {
  const info = await fetch('api/status').then((r) => r.json()).catch(() => null);
  await showGate(app, { stage: 'login', info });
  render();
});
let pollRefresh = null;
S.subscribe(() => {
  // Local edits re-render through views themselves; this only handles remote updates.
  if (!S.mode || S.mode === 'local') return;
  clearTimeout(pollRefresh);
  pollRefresh = setTimeout(() => { if (!EDITING.test(location.hash) && !document.querySelector('dialog[open]')) render(true); }, 50);
});
window.addEventListener('bk:sync', () => {
  document.documentElement.classList.toggle('is-offline', S.syncState === 'offline');
});

(async function boot() {
  const start = await S.init();
  if (start.mode === 'cloud' && start.stage !== 'ready') await showGate(app, start);
  render();
})();

if ('serviceWorker' in navigator && location.protocol.startsWith('http') && location.hostname !== 'localhost-nosw') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
navigator.storage?.persist?.().catch(() => {});
