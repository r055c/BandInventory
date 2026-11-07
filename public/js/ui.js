import { esc } from './util.js';
import { STATUS_LABEL } from './store.js';

const svg = (d, extra = '') =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;

export const ICON = {
  note: svg('<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>'),
  shirt: svg('<path d="M8 3L3 6l2 4 3-1v12h8V9l3 1 2-4-5-3a4 4 0 0 1-8 0z"/>'),
  sheet: svg('<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h7"/>'),
  box: svg('<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8M12 13v8"/>'),
  scan: svg('<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M4 12h16"/>'),
  home: svg('<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'),
  users: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.5-3.5 3-5.5 6.5-5.5s6 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c2 .6 3.2 2.4 3.5 5.2"/>'),
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>'),
  back: svg('<path d="M15 5l-7 7 7 7"/>'),
  chev: svg('<path d="M9 5l7 7-7 7"/>', 'width="20" height="20"'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>'),
  warn: svg('<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', 'width="16" height="16" stroke-width="2.6"'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  bolt: svg('<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>'),
  print: svg('<path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2"/><path d="M6 14h12v7H6z"/>')
};
export const KIND_ICON = { instrument: ICON.note, uniform: ICON.shirt, accessory: ICON.box, piece: ICON.sheet };

export const chip = (status, text) => `<span class="chip ${status}">${esc(text || STATUS_LABEL[status] || status)}</span>`;

export const backBtn = (href = '#/') =>
  `<a class="icon-btn" href="${href}" aria-label="Back">${ICON.back}</a>`;

export const tabs = (active) => `
<nav class="tabs" aria-label="Main">
  <a href="#/" ${active === 'home' ? 'aria-current="page"' : ''}>${ICON.home}Home</a>
  <a href="#/members" ${active === 'members' ? 'aria-current="page"' : ''}>${ICON.users}Members</a>
  <a href="#/settings" ${active === 'settings' ? 'aria-current="page"' : ''}>${ICON.gear}Settings</a>
</nav>`;

export const switchBtn = (name, on, label) =>
  `<button type="button" class="switch" role="switch" aria-checked="${on}" aria-label="${esc(label)}" data-switch="${esc(name)}"><span class="track"><span class="knob"></span></span></button>`;

// Modal forms. Resolves with the entered values, or null if cancelled.
export function formDialog({ title, message = '', fields = [], confirm = 'Save', danger = false }) {
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    const inputs = fields.map((f, i) => {
      const id = `dlg-${i}`;
      const common = `id="${id}" name="${esc(f.name)}" ${f.required ? 'required' : ''}`;
      let control;
      if (f.type === 'textarea') control = `<textarea class="textarea" ${common} placeholder="${esc(f.placeholder || '')}">${esc(f.value || '')}</textarea>`;
      else if (f.type === 'select') control = `<select class="select" ${common}>${f.options.map((o) => `<option ${o === f.value ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
      else control = `<input class="input" ${common} type="${f.type || 'text'}" ${f.min != null ? `min="${f.min}"` : ''} ${f.step ? `step="${f.step}"` : ''} inputmode="${f.inputmode || ''}" value="${esc(f.value ?? '')}" placeholder="${esc(f.placeholder || '')}">`;
      return `<div class="field"><label class="label" for="${id}">${esc(f.label)}</label>${control}</div>`;
    }).join('');
    dlg.innerHTML = `<form method="dialog">
      <h2>${esc(title)}</h2>
      ${message ? `<p class="muted" style="margin:0;font-size:15px;line-height:1.45">${esc(message)}</p>` : ''}
      ${inputs}
      <div class="btns">
        <button type="button" class="btn btn-secondary" data-cancel>Cancel</button>
        <button type="submit" class="btn ${danger ? 'btn-danger' : 'btn-primary'}">${esc(confirm)}</button>
      </div></form>`;
    document.body.appendChild(dlg);
    let result = null;
    const form = dlg.querySelector('form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      result = Object.fromEntries(new FormData(form).entries());
      dlg.close();
    });
    dlg.querySelector('[data-cancel]').addEventListener('click', () => dlg.close());
    dlg.addEventListener('close', () => { dlg.remove(); resolve(result); });
    dlg.showModal();
    dlg.querySelector('input, textarea, select')?.focus();
  });
}

export const confirmDialog = (title, message, confirm = 'Confirm', danger = false) =>
  formDialog({ title, message, confirm, danger }).then((r) => r !== null);

export function qrSvg(text, cell = 4) {
  const qr = window.qrcode(0, 'M');
  qr.addData(String(text));
  qr.make();
  return qr.createSvgTag({ cellSize: cell, margin: 2, scalable: true });
}
