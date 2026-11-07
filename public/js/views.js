import * as S from './store.js';
import { esc, fmtDate, fmtShort, initials, plural, toast, download, readFileText, resizeImage } from './util.js';
import { ICON, KIND_ICON, chip, backBtn, tabs, switchBtn, formDialog, confirmDialog, qrSvg } from './ui.js';

const go = (hash) => { location.hash = hash; };
const refresh = () => window.dispatchEvent(new Event('bk:refresh'));
const pageOf = (root) => root.querySelector('.page');

const logoHtml = (cls = 'logo') => {
  const { logo } = S.get().settings;
  return logo
    ? `<img class="${cls}" src="${esc(logo)}" alt="">`
    : `<span class="${cls}" style="display:flex;align-items:center;justify-content:center;color:var(--amber)">${ICON.note}</span>`;
};

const notFound = (what = 'That page') => ({
  html: `<div class="topbar">${backBtn('#/')}<h1>Not found</h1></div><div class="card muted">${esc(what)} could not be found. It may have been deleted.</div>`,
  nav: 'home'
});

// ---------- shared pieces ----------
const sectionCard = (href, icon, name, sub) => `
<a class="card row" href="${href}" style="min-height:44px">
  <div class="tile">${icon}</div>
  <div class="grow"><div class="strong" style="font-size:16px">${esc(name)}</div><div class="small muted" style="margin-top:2px">${esc(sub)}</div></div>
  <span class="muted">${ICON.chev}</span>
</a>`;

const timeline = (history = [], only = 'all') => {
  const rows = history.filter((h) => only === 'all' || h.type === only);
  if (!rows.length) return `<div class="empty">Nothing recorded yet.</div>`;
  return rows.map((h) => `
    <div class="tl-row"><span class="dot ${esc(h.type)}"></span>
      <div class="grow"><div class="strong small" style="font-size:14px">${esc(h.text)}</div>
      <div class="small muted">${fmtDate(h.at)}${h.detail ? ' · ' + esc(h.detail) : ''}</div></div></div>`).join('');
};

const searchBox = (id, placeholder, value = '') => `
<label class="search" for="${id}">${ICON.search}<input id="${id}" type="search" placeholder="${esc(placeholder)}" value="${esc(value)}" autocomplete="off"></label>`;

const pills = (items, active, attr) => `<div class="pills" role="group">${items.map(([key, label]) =>
  `<button type="button" class="pill" ${attr}="${key}" aria-pressed="${key === active}">${esc(label)}</button>`).join('')}</div>`;

const holderName = (item) => S.memberById(item.holderId)?.name || '';

const itemSub = (item) => {
  const bits = [];
  if (item.kind === 'instrument') bits.push([item.make, item.model].filter(Boolean).join(' '));
  if (item.kind === 'uniform' && item.size) bits.push(`Size ${item.size}`);
  if (item.holderId) bits.push(holderName(item) || 'Unknown member');
  else if (!item.needsRepair) bits.push('In the store');
  if (item.needsRepair) bits.push('needs repair');
  return bits.filter(Boolean).join(' · ');
};

const itemRow = (item) => {
  const st = S.statusOf(item);
  return `<a class="list-row" href="#/item/${item.id}">
    <div class="grow"><div class="name">${esc(item.name)} <span class="muted small">${esc(item.code)}</span></div><div class="sub">${esc(itemSub(item))}</div></div>
    ${chip(st)}</a>`;
};

const pieceRow = (p) => {
  const missing = p.missing || 0;
  return `<a class="list-row" href="#/piece/${p.id}">
    <div class="grow"><div class="name">${esc(p.title)}</div>
    <div class="sub">${esc([p.composer, p.grade ? `Grade ${p.grade}` : '', p.copies ? plural(p.copies, 'copy', 'copies') : ''].filter(Boolean).join(' · '))}</div></div>
    ${missing ? chip('missing', `${missing} missing`) : chip('available', 'All in')}</a>`;
};

// ---------- home ----------
export function home() {
  const s = S.get();
  const cards = [];
  for (const kind of Object.keys(S.KINDS)) {
    const k = S.KINDS[kind];
    if (!S.sectionOn(k.section)) continue;
    const list = S.itemsOfKind(kind);
    cards.push(sectionCard(`#/items/${kind}`, KIND_ICON[kind], k.label, `${plural(list.length, 'item')} · ${list.filter((i) => i.holderId).length} issued out`));
  }
  if (S.sectionOn('music')) {
    const missing = s.pieces.filter((p) => (p.missing || 0) > 0).length;
    cards.push(sectionCard('#/music', ICON.sheet, 'Music', `${plural(s.pieces.length, 'piece')}${missing ? ` · ${missing} with missing parts` : ''}`));
  }

  const attention = [];
  s.items.forEach((i) => {
    if (!S.sectionOn(S.KINDS[i.kind].section)) return;
    const st = S.statusOf(i);
    if (st === 'repair' || st === 'overdue') attention.push({ href: `#/item/${i.id}`, red: st === 'repair', name: `${i.name} ${i.code}`, sub: st === 'repair' ? 'Needs repair' : `Out since ${fmtShort(i.issuedAt)} · ${holderName(i)}`, chip: chip(st) });
  });
  if (S.sectionOn('music')) s.pieces.filter((p) => (p.missing || 0) > 0).forEach((p) => attention.push({ href: `#/piece/${p.id}`, red: false, name: p.title, sub: `${plural(p.missing, 'copy', 'copies')} missing`, chip: chip('missing', 'Missing') }));

  const attentionHtml = attention.slice(0, 6).map((a) => `
    <a class="card row" href="${a.href}" style="min-height:44px">
      <div class="tile sm ${a.red ? 'red' : 'warn'}">${ICON.warn}</div>
      <div class="grow"><div class="strong" style="font-size:15px">${esc(a.name)}</div><div class="small muted">${esc(a.sub)}</div></div>${a.chip}</a>`).join('');

  const html = `
  <div class="row">
    ${logoHtml()}
    <div class="grow"><div class="strong" style="font-size:20px;line-height:1.15">${esc(s.settings.bandName)}</div><div class="eyebrow">Kit manager</div></div>
  </div>
  <a class="scan-card" href="#/scan">${ICON.scan}<div><div class="t">Scan a QR code</div><div class="s">Issue, return or check an item</div></div></a>
  <div class="stack"><h2 class="section-title">Sections</h2>
    ${cards.join('') || `<div class="card muted">No sections are switched on. Turn some on in <a href="#/settings" class="strong" style="text-decoration:underline">Settings</a>.</div>`}
  </div>
  ${attention.length ? `<div class="stack"><h2 class="section-title">Needs attention</h2>${attentionHtml}</div>` : ''}
  ${!s.items.length && !s.pieces.length ? `<div class="card"><div class="strong">Getting started</div><p class="muted small" style="line-height:1.5;margin:6px 0 0">Open a section above and tap <b>Add</b> to enter your first item. Then print QR labels from the item page and stick them on. Everything is stored on this device, so export a backup from Settings now and then.</p></div>` : ''}`;
  return { html, nav: 'home' };
}

// ---------- item lists ----------
const listUI = {};
export function itemList([kind]) {
  const k = S.KINDS[kind];
  if (!k) return notFound();
  const ui = (listUI[kind] ||= { q: '', f: 'all' });
  const rows = () => {
    const q = ui.q.trim().toLowerCase();
    const list = S.itemsOfKind(kind).filter((i) => {
      const st = S.statusOf(i);
      if (ui.f === 'issued' && !i.holderId) return false;
      if (ui.f === 'store' && (i.holderId || i.needsRepair)) return false;
      if (ui.f === 'attention' && st !== 'repair' && st !== 'overdue') return false;
      if (!q) return true;
      return [i.name, i.code, i.make, i.model, i.serial, i.size, holderName(i)].some((v) => String(v || '').toLowerCase().includes(q));
    });
    return list.length ? list.map(itemRow).join('') : `<div class="empty">${S.itemsOfKind(kind).length ? 'No matches.' : `Nothing here yet. Tap <b>Add</b> to enter your first ${esc(k.one)}.`}</div>`;
  };
  const all = S.itemsOfKind(kind);
  const filters = [['all', `All ${all.length}`], ['issued', `Issued ${all.filter((i) => i.holderId).length}`], ['store', `In store ${all.filter((i) => !i.holderId && !i.needsRepair).length}`], ['attention', 'Attention']];
  const html = `
  <div class="topbar">${backBtn('#/')}<h1>${esc(k.label)}</h1></div>
  ${searchBox('q', 'Search name, code, size or member', ui.q)}
  <div id="filters">${pills(filters, ui.f, 'data-f')}</div>
  <div class="list" id="rows">${rows()}</div>`;
  const bar = `<div class="actionbar"><a class="btn btn-primary" href="#/scan">Scan to issue or return</a><a class="btn btn-secondary fit" href="#/new/${kind}">Add</a></div>`;
  return {
    html, bar,
    mount(root) {
      root.querySelector('#q').addEventListener('input', (e) => { ui.q = e.target.value; root.querySelector('#rows').innerHTML = rows(); });
      root.querySelector('#filters').addEventListener('click', (e) => {
        const b = e.target.closest('[data-f]'); if (!b) return;
        ui.f = b.dataset.f;
        root.querySelectorAll('#filters .pill').forEach((p) => p.setAttribute('aria-pressed', String(p.dataset.f === ui.f)));
        root.querySelector('#rows').innerHTML = rows();
      });
    }
  };
}

// ---------- item detail ----------
export function itemDetail([id]) {
  const it = S.itemById(id);
  if (!it) return notFound('That item');
  const k = S.KINDS[it.kind];
  const st = S.statusOf(it);
  const holder = S.memberById(it.holderId);
  const details = [['Code', it.code]];
  if (it.kind === 'instrument') details.push(['Make', it.make], ['Model', it.model], ['Serial number', it.serial], ['Case label', `${it.code}-C`]);
  if (it.kind === 'uniform') details.push(['Size', it.size]);
  if (it.kind === 'accessory') details.push(['Make', it.make], ['Model', it.model]);
  const kv = details.filter(([, v]) => v).map(([l, v]) => `<div class="kv"><div class="k">${esc(l)}</div><div class="v">${esc(v)}</div></div>`).join('');

  const html = `
  <div class="topbar">${backBtn(`#/items/${it.kind}`)}<div class="eyebrow">${esc(it.code)}</div></div>
  <div class="row" style="gap:16px">
    <div class="tile" style="width:72px;height:72px;border-radius:18px">${KIND_ICON[it.kind].replace('<svg', '<svg style="width:40px;height:40px"')}</div>
    <div class="grow"><h1 class="title-xl" style="font-size:26px">${esc(it.name)}</h1><div style="margin-top:6px">${chip(st)}</div></div>
  </div>
  <div class="card grid2">${kv}</div>
  ${it.notes ? `<div class="card small" style="line-height:1.5"><div class="label">Notes</div>${esc(it.notes)}</div>` : ''}
  ${it.holderId ? `<div class="card row"><div class="avatar">${esc(initials(holder?.name))}</div>
      <div class="grow"><div class="small muted">Held by</div><a class="strong" style="font-size:16px" href="#/member/${it.holderId}">${esc(holder?.name || 'Unknown member')}</a></div>
      <div class="small muted" style="text-align:right">Since<br>${fmtShort(it.issuedAt)}</div></div>` : ''}
  <div class="stack">
    ${pills([['all', 'History'], ['repair', 'Repairs']], 'all', 'data-tab')}
    <div class="card card-tight" id="tl">${timeline(it.history)}</div>
  </div>
  <div class="row no-print" style="flex-wrap:wrap">
    <a class="btn btn-secondary btn-sm" href="#/edit/${it.id}">Edit details</a>
    <a class="btn btn-secondary btn-sm" href="#/label/${it.id}">${ICON.print.replace('<svg', '<svg width="18" height="18"')}Print label</a>
    <button class="btn btn-danger btn-sm" data-act="delete">Delete</button>
  </div>`;

  let bar;
  if (st === 'repair' && !it.holderId) bar = `<button class="btn btn-primary" data-act="repaired">Mark repaired</button>`;
  else if (st === 'repair') bar = `<button class="btn btn-primary" data-act="return">Return instrument</button><button class="btn btn-secondary fit" data-act="repaired">Mark repaired</button>`;
  else if (it.holderId) bar = `<button class="btn btn-primary" data-act="return">Return ${esc(k.one)}</button><button class="btn btn-danger fit" data-act="damage">Report damage</button>`;
  else bar = `<a class="btn btn-primary" href="#/issue/${it.id}">Issue to member</a><button class="btn btn-danger fit" data-act="damage">Report damage</button>`;

  return {
    html, bar: `<div class="actionbar">${bar}</div>`,
    mount(root) {
      root.addEventListener('click', async (e) => {
        const tab = e.target.closest('[data-tab]');
        if (tab) {
          root.querySelectorAll('[data-tab]').forEach((p) => p.setAttribute('aria-pressed', String(p === tab)));
          root.querySelector('#tl').innerHTML = timeline(it.history, tab.dataset.tab);
          return;
        }
        const act = e.target.closest('[data-act]')?.dataset.act;
        if (!act) return;
        if (act === 'return') {
          const r = await formDialog({ title: `Return ${it.name}`, message: holder ? `From ${holder.name}.` : '', confirm: 'Return', fields: [
            { name: 'condition', label: 'Condition', type: 'select', options: ['Good', 'Fair', 'Needs repair'], value: 'Good' },
            { name: 'note', label: 'Note (optional)', type: 'textarea' }] });
          if (r) { S.returnItem(it.id, r); toast('Returned'); refresh(); }
        } else if (act === 'damage') {
          const r = await formDialog({ title: 'Report damage', confirm: 'Report', danger: true, fields: [{ name: 'note', label: 'What is wrong?', type: 'textarea', required: true }] });
          if (r) { S.reportDamage(it.id, r.note); toast('Marked as needing repair'); refresh(); }
        } else if (act === 'repaired') {
          const r = await formDialog({ title: 'Mark repaired', confirm: 'Done', fields: [
            { name: 'note', label: 'What was done? (optional)', type: 'textarea' },
            { name: 'cost', label: 'Cost in £ (optional)', type: 'number', min: 0, step: '0.01', inputmode: 'decimal' }] });
          if (r) { S.markRepaired(it.id, r); toast('Repair recorded'); refresh(); }
        } else if (act === 'delete') {
          if (await confirmDialog(`Delete ${it.name} ${it.code}?`, 'Its history goes too. This cannot be undone.', 'Delete', true)) {
            S.deleteItem(it.id); toast('Deleted'); go(`#/items/${it.kind}`);
          }
        }
      });
    }
  };
}

// ---------- issue ----------
export function issueView([id]) {
  const it = S.itemById(id);
  if (!it) return notFound('That item');
  if (it.holderId || it.needsRepair) return { html: `<div class="topbar">${backBtn(`#/item/${id}`)}<h1>Can't issue</h1></div><div class="card muted">${it.needsRepair ? 'This item needs repair. Mark it repaired first.' : 'This item is already issued. Return it first.'}</div>`, nav: 'home' };
  const extrasList = S.get().settings.extras[it.kind] || [];
  const st = { memberId: null, extras: new Set(), condition: 'Good', q: '' };
  const html = `
  <div class="topbar">${backBtn(`#/item/${id}`)}<h1>Issue ${esc(it.kind === 'instrument' ? 'instrument' : 'item')}</h1></div>
  <div class="card row"><div class="tile sm">${KIND_ICON[it.kind]}</div>
    <div class="grow"><div class="strong" style="font-size:15px">${esc(it.name)} ${esc(it.code)}</div><div class="small muted">${esc(itemSub(it))}</div></div>${chip('available')}</div>
  <div><span class="label">Issue to</span>
    ${searchBox('mq', 'Search band members')}
    <div class="list" id="members" style="margin-top:8px"></div>
    <form id="newm" class="row" style="margin-top:8px"><input class="input" id="newname" placeholder="New member's name" aria-label="New member's name" autocomplete="off"><button class="btn btn-secondary btn-sm" type="submit">Add</button></form>
  </div>
  ${extrasList.length ? `<div><span class="label">Goes out with</span><div class="pills" id="extras">${extrasList.map((x) => `<button type="button" class="pill" data-extra="${esc(x)}" aria-pressed="false">${esc(x)}</button>`).join('')}</div></div>` : ''}
  <div><span class="label">Condition</span><div class="seg" id="cond">${['Good', 'Fair', 'Needs repair'].map((c) => `<button type="button" class="pill ${c === 'Good' ? 'good' : ''}" data-cond="${c}" aria-pressed="${c === 'Good'}">${c}</button>`).join('')}</div></div>`;
  const bar = `<div class="actionbar"><button class="btn btn-primary" id="go" disabled>Choose a member</button></div>`;
  return {
    html, bar,
    mount(root) {
      const paintMembers = () => {
        const q = st.q.trim().toLowerCase();
        const list = S.get().members.filter((m) => m.name.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name));
        root.querySelector('#members').innerHTML = list.length ? list.map((m) => `
          <button type="button" class="list-row" data-m="${m.id}" aria-pressed="${st.memberId === m.id}" style="width:100%;border:0;border-bottom:1px solid var(--line-soft);background:${st.memberId === m.id ? '#EEF3FB' : 'none'};text-align:left">
            <span class="avatar sm">${esc(initials(m.name))}</span><span class="grow ${st.memberId === m.id ? 'strong' : ''}">${esc(m.name)}</span>
            ${st.memberId === m.id ? `<span style="color:var(--navy)">${ICON.check}</span>` : ''}</button>`).join('')
          : `<div class="empty">${S.get().members.length ? 'No matches.' : 'No members yet. Add one below.'}</div>`;
        const btn = root.querySelector('#go');
        const m = S.memberById(st.memberId);
        btn.disabled = !m;
        btn.textContent = m ? `Issue to ${m.name}` : 'Choose a member';
      };
      paintMembers();
      root.querySelector('#mq').addEventListener('input', (e) => { st.q = e.target.value; paintMembers(); });
      root.addEventListener('click', (e) => {
        const m = e.target.closest('[data-m]');
        if (m) { st.memberId = m.dataset.m; paintMembers(); return; }
        const x = e.target.closest('[data-extra]');
        if (x) { const on = !st.extras.has(x.dataset.extra); on ? st.extras.add(x.dataset.extra) : st.extras.delete(x.dataset.extra); x.setAttribute('aria-pressed', String(on)); return; }
        const c = e.target.closest('[data-cond]');
        if (c) { st.condition = c.dataset.cond; root.querySelectorAll('[data-cond]').forEach((b) => b.setAttribute('aria-pressed', String(b === c))); return; }
        if (e.target.closest('#go') && st.memberId) {
          S.issueItem(it.id, st.memberId, { extras: [...st.extras], condition: st.condition });
          toast(`Issued to ${S.memberById(st.memberId).name}`);
          go(`#/item/${it.id}`);
        }
      });
      root.querySelector('#newm').addEventListener('submit', (e) => {
        e.preventDefault();
        const input = root.querySelector('#newname');
        const name = input.value.trim();
        if (!name) return;
        st.memberId = S.addMember(name).id; st.q = ''; root.querySelector('#mq').value = ''; input.value = '';
        paintMembers();
      });
    }
  };
}

// ---------- add / edit item ----------
export function itemForm([a, b], mode) {
  const editing = mode === 'edit';
  const it = editing ? S.itemById(a) : null;
  const kind = editing ? it?.kind : a;
  if (editing && !it) return notFound('That item');
  const k = S.KINDS[kind];
  if (!k) return notFound();
  const v = (f) => esc(it?.[f] ?? '');
  const field = (name, label, extra = '') => `<div class="field"><label class="label" for="f-${name}">${label}</label><input class="input" id="f-${name}" name="${name}" value="${v(name)}" ${extra}></div>`;
  const types = ['Trumpet', 'Cornet', 'Trombone', 'Euphonium', 'Tuba', 'French horn', 'Flute', 'Clarinet', 'Saxophone', 'Oboe', 'Bassoon', 'Snare drum', 'Bass drum', 'Cymbals', 'Glockenspiel'];
  const html = `
  <div class="topbar">${backBtn(editing ? `#/item/${it.id}` : `#/items/${kind}`)}<h1>${editing ? 'Edit' : 'Add'} ${esc(k.one)}</h1></div>
  <form id="f" class="stack" style="gap:16px">
    <div class="field"><label class="label" for="f-name">${esc(k.nameLabel)}</label>
      <input class="input" id="f-name" name="name" required value="${v('name')}" placeholder="${esc(k.namePlaceholder)}" ${kind === 'instrument' ? 'list="types"' : ''}>
      ${kind === 'instrument' ? `<datalist id="types">${types.map((t) => `<option value="${t}">`).join('')}</datalist>` : ''}</div>
    ${kind === 'instrument' ? `<div class="grid2">${field('make', 'Make')}${field('model', 'Model')}</div>${field('serial', 'Serial number', 'autocapitalize="characters"')}` : ''}
    ${kind === 'uniform' ? field('size', 'Size', 'placeholder="e.g. 12, M, Waist 32"') : ''}
    ${kind === 'accessory' ? `<div class="grid2">${field('make', 'Make')}${field('model', 'Model')}</div>` : ''}
    <div class="field"><label class="label" for="f-notes">Notes</label><textarea class="textarea" id="f-notes" name="notes">${v('notes')}</textarea></div>
    ${editing ? '' : `<p class="small muted" style="margin:0">A QR code number (${esc(S.nextCode(kind))}) is assigned automatically.</p>`}
  </form>`;
  const bar = `<div class="actionbar"><button class="btn btn-primary" form="f" type="submit">${editing ? 'Save changes' : `Add ${esc(k.one)}`}</button></div>`;
  return {
    html, bar,
    mount(root) {
      root.querySelector('#f').addEventListener('submit', (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target).entries());
        Object.keys(data).forEach((key) => { data[key] = String(data[key]).trim(); });
        const saved = S.saveItem(kind, data, it?.id);
        toast(editing ? 'Saved' : `Added ${saved.code}`);
        go(`#/item/${saved.id}`);
      });
    }
  };
}

// ---------- members ----------
export function membersView() {
  const members = [...S.get().members].sort((a, b) => a.name.localeCompare(b.name));
  const html = `
  <h1 class="title-xl">Members</h1>
  <div class="list">${members.length ? members.map((m) => {
    const held = S.itemsHeldBy(m.id).length;
    return `<a class="list-row" href="#/member/${m.id}"><span class="avatar sm">${esc(initials(m.name))}</span><div class="grow"><div class="name">${esc(m.name)}</div><div class="sub">${held ? `${plural(held, 'item')} out` : 'Nothing out'}</div></div><span class="muted">${ICON.chev}</span></a>`;
  }).join('') : `<div class="empty">No members yet. Add the people who borrow kit.</div>`}</div>
  <button class="btn btn-primary" id="add">Add member</button>`;
  return {
    html, nav: 'members',
    mount(root) {
      root.querySelector('#add').addEventListener('click', async () => {
        const r = await formDialog({ title: 'Add member', confirm: 'Add', fields: [{ name: 'name', label: 'Name', required: true }] });
        if (r?.name.trim()) { S.addMember(r.name); refresh(); }
      });
    }
  };
}

export function memberDetail([id]) {
  const m = S.memberById(id);
  if (!m) return notFound('That member');
  const held = S.itemsHeldBy(id);
  const html = `
  <div class="topbar">${backBtn('#/members')}<h1>${esc(m.name)}</h1></div>
  <div class="stack"><h2 class="section-title">Has out</h2>
    <div class="list">${held.length ? held.map(itemRow).join('') : `<div class="empty">Nothing out right now.</div>`}</div></div>
  <div class="row" style="flex-wrap:wrap">
    <button class="btn btn-secondary btn-sm" data-act="rename">Rename</button>
    <button class="btn btn-danger btn-sm" data-act="delete">Delete member</button>
  </div>`;
  return {
    html, nav: 'members',
    mount(root) {
      root.addEventListener('click', async (e) => {
        const act = e.target.closest('[data-act]')?.dataset.act;
        if (act === 'rename') {
          const r = await formDialog({ title: 'Rename member', fields: [{ name: 'name', label: 'Name', value: m.name, required: true }] });
          if (r?.name.trim()) { S.renameMember(id, r.name); refresh(); }
        } else if (act === 'delete') {
          if (held.length) { toast('Return their items before deleting them'); return; }
          if (await confirmDialog(`Delete ${m.name}?`, 'Past history keeps their name.', 'Delete', true)) { S.deleteMember(id); go('#/members'); }
        }
      });
    }
  };
}

// ---------- music ----------
const pieceUI = { q: '', f: 'all' };
export function musicList() {
  const pieces = S.get().pieces;
  const rows = () => {
    const q = pieceUI.q.trim().toLowerCase();
    const list = pieces.filter((p) => (pieceUI.f === 'all' || (p.missing || 0) > 0) && (!q || [p.title, p.composer, p.code].some((v) => String(v || '').toLowerCase().includes(q))))
      .sort((a, b) => a.title.localeCompare(b.title));
    return list.length ? list.map(pieceRow).join('') : `<div class="empty">${pieces.length ? 'No matches.' : 'No music yet. Tap <b>Add piece</b>.'}</div>`;
  };
  const html = `
  <div class="topbar">${backBtn('#/')}<h1>Music</h1></div>
  ${searchBox('q', 'Search title or composer', pieceUI.q)}
  <div id="filters">${pills([['all', `Library ${pieces.length}`], ['missing', `Missing ${pieces.filter((p) => (p.missing || 0) > 0).length}`]], pieceUI.f, 'data-f')}</div>
  <div class="list" id="rows">${rows()}</div>`;
  const bar = `<div class="actionbar"><a class="btn btn-primary" href="#/scan">Scan folder or part</a><a class="btn btn-secondary fit" href="#/new/piece">Add piece</a></div>`;
  return {
    html, bar,
    mount(root) {
      root.querySelector('#q').addEventListener('input', (e) => { pieceUI.q = e.target.value; root.querySelector('#rows').innerHTML = rows(); });
      root.querySelector('#filters').addEventListener('click', (e) => {
        const b = e.target.closest('[data-f]'); if (!b) return;
        pieceUI.f = b.dataset.f;
        root.querySelectorAll('#filters .pill').forEach((p) => p.setAttribute('aria-pressed', String(p.dataset.f === pieceUI.f)));
        root.querySelector('#rows').innerHTML = rows();
      });
    }
  };
}

export function pieceDetail([id]) {
  const p = S.pieceById(id);
  if (!p) return notFound('That piece');
  const missing = p.missing || 0;
  const html = `
  <div class="topbar">${backBtn('#/music')}<div class="eyebrow">${esc(p.code)}</div></div>
  <div class="row" style="gap:16px"><div class="tile" style="width:72px;height:72px;border-radius:18px">${ICON.sheet.replace('<svg', '<svg style="width:40px;height:40px"')}</div>
    <div class="grow"><h1 class="title-xl" style="font-size:26px">${esc(p.title)}</h1><div style="margin-top:6px">${missing ? chip('missing', `${missing} missing`) : chip('available', 'All in')}</div></div></div>
  <div class="card grid2">
    ${[['Composer', p.composer], ['Grade', p.grade], ['Copies', p.copies], ['Missing', missing]].filter(([, v]) => v !== '' && v != null).map(([l, v]) => `<div class="kv"><div class="k">${l}</div><div class="v">${esc(v)}</div></div>`).join('')}
  </div>
  ${p.notes ? `<div class="card small" style="line-height:1.5"><div class="label">Notes</div>${esc(p.notes)}</div>` : ''}
  <div class="stack"><h2 class="section-title">History</h2><div class="card card-tight">${timeline(p.history)}</div></div>
  <div class="row no-print" style="flex-wrap:wrap">
    <a class="btn btn-secondary btn-sm" href="#/edit-piece/${p.id}">Edit details</a>
    <a class="btn btn-secondary btn-sm" href="#/label/${p.id}">${ICON.print.replace('<svg', '<svg width="18" height="18"')}Print label</a>
    <button class="btn btn-danger btn-sm" data-act="delete">Delete</button></div>`;
  const bar = `<div class="actionbar"><button class="btn btn-primary" data-act="missing">Update missing copies</button></div>`;
  return {
    html, bar,
    mount(root) {
      root.addEventListener('click', async (e) => {
        const act = e.target.closest('[data-act]')?.dataset.act;
        if (act === 'missing') {
          const r = await formDialog({ title: 'Missing copies', message: `How many copies of ${p.title} are missing now?`, confirm: 'Update', fields: [
            { name: 'n', label: 'Missing copies', type: 'number', min: 0, value: missing, inputmode: 'numeric', required: true },
            { name: 'note', label: 'Note (optional)', type: 'textarea' }] });
          if (r) { S.setMissing(p.id, Math.max(0, parseInt(r.n, 10) || 0), r.note); refresh(); }
        } else if (act === 'delete') {
          if (await confirmDialog(`Delete ${p.title}?`, 'This cannot be undone.', 'Delete', true)) { S.deletePiece(p.id); go('#/music'); }
        }
      });
    }
  };
}

export function pieceForm([id], mode) {
  const editing = mode === 'edit';
  const p = editing ? S.pieceById(id) : null;
  if (editing && !p) return notFound('That piece');
  const v = (f) => esc(p?.[f] ?? '');
  const html = `
  <div class="topbar">${backBtn(editing ? `#/piece/${p.id}` : '#/music')}<h1>${editing ? 'Edit' : 'Add'} piece</h1></div>
  <form id="f" class="stack" style="gap:16px">
    <div class="field"><label class="label" for="f-title">Title</label><input class="input" id="f-title" name="title" required value="${v('title')}"></div>
    <div class="field"><label class="label" for="f-composer">Composer or arranger</label><input class="input" id="f-composer" name="composer" value="${v('composer')}"></div>
    <div class="grid2">
      <div class="field"><label class="label" for="f-grade">Grade</label><input class="input" id="f-grade" name="grade" inputmode="numeric" value="${v('grade')}"></div>
      <div class="field"><label class="label" for="f-copies">Copies</label><input class="input" id="f-copies" name="copies" type="number" min="0" inputmode="numeric" value="${v('copies')}"></div>
    </div>
    <div class="field"><label class="label" for="f-notes">Notes</label><textarea class="textarea" id="f-notes" name="notes">${v('notes')}</textarea></div>
  </form>`;
  const bar = `<div class="actionbar"><button class="btn btn-primary" form="f" type="submit">${editing ? 'Save changes' : 'Add piece'}</button></div>`;
  return {
    html, bar,
    mount(root) {
      root.querySelector('#f').addEventListener('submit', (e) => {
        e.preventDefault();
        const d = Object.fromEntries(new FormData(e.target).entries());
        const data = { title: d.title.trim(), composer: d.composer.trim(), grade: d.grade.trim(), copies: Math.max(0, parseInt(d.copies, 10) || 0), notes: d.notes.trim() };
        if (!editing) data.missing = 0;
        const saved = S.savePiece(data, p?.id);
        toast(editing ? 'Saved' : `Added ${saved.code}`);
        go(`#/piece/${saved.id}`);
      });
    }
  };
}

// ---------- settings ----------
export function settingsView() {
  const s = S.get().settings;
  const rows = [
    ['instruments', 'Instruments', 'QR codes, issuing, repairs'],
    ['uniforms', 'Uniforms', 'Sizes, issuing, returns'],
    ['music', 'Music', 'Library, parts, missing copies'],
    ['accessories', 'Accessories and equipment', 'Stands, cases, amps, drum kit']
  ];
  const extraKinds = Object.keys(S.KINDS).filter((k) => s.sections[S.KINDS[k].section]);
  const html = `
  <h1 class="title-xl">Settings</h1>
  <div class="card stack" style="gap:14px">
    <h2 class="section-title" style="font-size:16px">Your band</h2>
    <div class="field"><label class="label" for="bandname">Band name</label><input class="input" id="bandname" value="${esc(s.bandName)}" maxlength="60"></div>
    <div><span class="label">Band logo</span>
      <div class="row" style="gap:14px">
        <div class="logo-lg" id="logo-prev">${s.logo ? `<img src="${esc(s.logo)}" alt="Band logo">` : logoHtml()}</div>
        <div class="row" style="gap:8px;flex-wrap:wrap">
          <label class="btn btn-primary btn-sm" for="logo-file" style="cursor:pointer">Upload logo</label>
          <input id="logo-file" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden>
          ${s.logo ? `<button class="btn btn-secondary btn-sm" id="logo-clear">Remove</button>` : ''}
        </div></div>
      <div class="small muted" style="margin-top:8px">PNG or JPG. A square image works best.</div></div>
  </div>
  <div class="card" style="padding-bottom:6px">
    <h2 class="section-title" style="font-size:16px">Sections to track</h2>
    <div class="small muted" style="margin:4px 0 6px;line-height:1.4">Switch off anything you don't need. Changes save automatically, and turning one back on brings its records back.</div>
    ${rows.map(([key, name, sub]) => `<div class="switch-row"><div class="grow"><div class="strong" style="font-size:15px">${name}</div><div class="small muted" style="margin-top:2px">${sub}</div></div>${switchBtn(key, !!s.sections[key], `Show ${name}`)}</div>`).join('')}
  </div>
  <div class="card stack" style="gap:14px">
    <h2 class="section-title" style="font-size:16px">Issuing</h2>
    <div class="field"><label class="label" for="overdue">Flag as overdue after (days)</label><input class="input" id="overdue" type="number" min="1" inputmode="numeric" value="${s.overdueDays}"></div>
    ${extraKinds.map((k) => `<div class="field"><label class="label" for="ex-${k}">Usual extras for ${esc(S.KINDS[k].label.toLowerCase())} (comma separated)</label><input class="input" id="ex-${k}" data-extras="${k}" value="${esc((s.extras[k] || []).join(', '))}" placeholder="e.g. Case, Strap"></div>`).join('')}
  </div>
  <div class="card stack" style="gap:12px">
    <h2 class="section-title" style="font-size:16px">Your data</h2>
    <p class="small muted" style="margin:0;line-height:1.5">${S.mode === 'cloud' ? 'Your data is stored securely online for this band and shared by everyone who signs in. Export a backup now and then for safekeeping.' : 'Everything is stored on this device only. Export a backup now and then, and use it to move to a new phone.'}</p>
    <div class="row" style="flex-wrap:wrap">
      <button class="btn btn-secondary btn-sm" id="export">Export backup</button>
      <label class="btn btn-secondary btn-sm" for="import-file" style="cursor:pointer">Import backup</label>
      <input id="import-file" type="file" accept="application/json,.json" hidden>
      <button class="btn btn-danger btn-sm" id="erase">Erase all data</button>
    </div>
    ${S.sectionOn('instruments') || S.sectionOn('uniforms') || S.sectionOn('accessories') ? `<div class="row" style="flex-wrap:wrap">${Object.keys(S.KINDS).filter((k) => S.sectionOn(S.KINDS[k].section)).map((k) => `<a class="btn btn-secondary btn-sm" href="#/labels/${k}">Print all ${esc(S.KINDS[k].label.toLowerCase())} labels</a>`).join('')}${S.sectionOn('music') ? `<a class="btn btn-secondary btn-sm" href="#/labels/piece">Print music labels</a>` : ''}</div>` : ''}
  </div>
  ${S.mode === 'cloud' ? `<div class="card stack" style="gap:12px">
    <h2 class="section-title" style="font-size:16px">Account</h2>
    <p class="small muted" style="margin:0;line-height:1.5">Everyone with the band password shares this inventory. Changing the password signs out every other device.</p>
    <div class="row" style="flex-wrap:wrap"><button class="btn btn-secondary btn-sm" id="chpw">Change password</button><button class="btn btn-secondary btn-sm" id="signout">Sign out</button></div>
  </div>` : ''}
  <div class="small muted" style="text-align:center;padding-bottom:8px">Band Kit</div>`;
  return {
    html, nav: 'settings',
    mount(root) {
      root.querySelector('#bandname').addEventListener('change', (e) => S.update((st) => { st.settings.bandName = e.target.value.trim() || 'My Youth Band'; }));
      root.querySelector('#overdue').addEventListener('change', (e) => S.update((st) => { st.settings.overdueDays = Math.max(1, parseInt(e.target.value, 10) || 60); }));
      root.querySelectorAll('[data-extras]').forEach((inp) => inp.addEventListener('change', (e) => S.update((st) => {
        st.settings.extras[e.target.dataset.extras] = e.target.value.split(',').map((x) => x.trim()).filter(Boolean);
      })));
      root.querySelector('#logo-file').addEventListener('change', async (e) => {
        const f = e.target.files[0]; if (!f) return;
        try { const data = await resizeImage(f); S.update((st) => { st.settings.logo = data; }); toast('Logo updated'); refresh(); }
        catch (err) { toast(err.message); }
      });
      root.querySelector('#logo-clear')?.addEventListener('click', () => { S.update((st) => { st.settings.logo = null; }); refresh(); });
      root.addEventListener('click', async (e) => {
        const sw = e.target.closest('[data-switch]');
        if (sw) {
          const on = sw.getAttribute('aria-checked') !== 'true';
          sw.setAttribute('aria-checked', String(on));
          S.update((st) => { st.settings.sections[sw.dataset.switch] = on; });
          return;
        }
        if (e.target.closest('#export')) { download(`band-kit-backup-${new Date().toISOString().slice(0, 10)}.json`, S.exportJson()); toast('Backup downloaded'); }
        if (e.target.closest('#erase') && await confirmDialog('Erase all data?', S.mode === 'cloud' ? 'This removes every item, member and piece for the whole band, on every device. Export a backup first if unsure.' : 'This removes every item, member, piece and setting from this device. Export a backup first if unsure.', 'Erase everything', true)) {
          try { await S.eraseAll(); toast('All data erased'); refresh(); } catch (err) { toast(err.message || 'Could not erase'); }
        }
        if (e.target.closest('#signout') && await confirmDialog('Sign out?', 'You will need the band password to sign in again on this device.', 'Sign out')) { S.signOut(); location.hash = '#/'; location.reload(); }
        if (e.target.closest('#chpw')) {
          const r = await formDialog({ title: 'Change password', message: 'Other devices will be signed out.', confirm: 'Change', fields: [
            { name: 'current', label: 'Current password', type: 'password', required: true },
            { name: 'next', label: 'New password (at least 6 characters)', type: 'password', required: true }] });
          if (r) { try { await S.changePassword(r.current, r.next); toast('Password changed'); } catch (err) { toast(err.message || 'Could not change password'); } }
        }
      });
      root.querySelector('#import-file').addEventListener('change', async (e) => {
        const f = e.target.files[0]; if (!f) return;
        try {
          if (!(await confirmDialog('Replace current data?', S.mode === 'cloud' ? 'Importing replaces everything for the whole band with the backup file.' : 'Importing replaces everything on this device with the backup file.', 'Import', true))) return;
          await S.importJson(await readFileText(f)); toast('Backup imported'); refresh();
        } catch (err) { toast(err.message || 'Could not import that file'); }
        e.target.value = '';
      });
      // Re-render only when the page is revisited so toggles stay put while editing.
    }
  };
}

// ---------- scan ----------
export function scanView() {
  const html = `
  <div class="topbar" style="justify-content:space-between">
    <a class="icon-btn" href="#/" aria-label="Close scanner">${ICON.close}</a>
    <h1 style="text-align:center;font-size:18px">Scan QR code</h1>
    <span style="width:44px"></span>
  </div>
  <div class="scan-view" id="view"><video id="video" playsinline muted></video>
    <span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span></div>
  <p class="scan-msg" id="msg">Starting the camera…</p>
  <form id="manual" class="stack" style="gap:10px;margin-top:auto;padding-bottom:calc(env(safe-area-inset-bottom) + 24px)">
    <label class="scan-msg" for="code" style="color:#fff;font-weight:600">Or type the code</label>
    <div class="row"><input class="input" id="code" placeholder="e.g. INS-014" autocapitalize="characters" autocomplete="off"><button class="btn btn-sm" style="background:#fff;color:var(--ink)" type="submit">Open</button></div>
    <div class="scan-msg" style="font-size:13px">The case and the instrument share one code (the case label ends in -C).</div>
  </form>`;
  return {
    html, bar: '', className: 'scan-page',
    mount(root) {
      const msg = root.querySelector('#msg');
      const open = (text) => {
        const hit = S.findByCode(text);
        if (!hit) { msg.textContent = `No match for “${String(text).slice(0, 40)}”. Try again.`; return false; }
        navigator.vibrate?.(60);
        go(hit.type === 'item' ? `#/item/${hit.id}` : `#/piece/${hit.id}`);
        return true;
      };
      root.querySelector('#manual').addEventListener('submit', (e) => { e.preventDefault(); open(root.querySelector('#code').value); });

      let stopped = false, stream = null, timer = null, last = '';
      const video = root.querySelector('#video');
      (async () => {
        if (!navigator.mediaDevices?.getUserMedia) { msg.textContent = 'Camera scanning is not available here. Type the code below instead.'; return; }
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
          if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
          video.srcObject = stream; await video.play();
          msg.textContent = 'Point at the QR code on the item or its case.';
        } catch (err) {
          msg.textContent = 'Could not open the camera. Check the browser permission, or type the code below.'; return;
        }
        const detector = 'BarcodeDetector' in window ? new BarcodeDetector({ formats: ['qr_code'] }) : null;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const tick = async () => {
          if (stopped) return;
          try {
            if (video.readyState >= 2 && video.videoWidth) {
              let text = null;
              if (detector) { const r = await detector.detect(video); text = r[0]?.rawValue || null; }
              else {
                const scale = Math.min(1, 640 / video.videoWidth);
                canvas.width = Math.round(video.videoWidth * scale); canvas.height = Math.round(video.videoHeight * scale);
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
                text = window.jsQR(img.data, img.width, img.height)?.data || null;
              }
              if (text && text !== last) { last = text; if (open(text)) return; setTimeout(() => { last = ''; }, 2000); }
            }
          } catch { /* keep scanning */ }
          timer = setTimeout(tick, 150);
        };
        tick();
      })();
      return () => { stopped = true; clearTimeout(timer); stream?.getTracks().forEach((t) => t.stop()); };
    }
  };
}

// ---------- labels ----------
export function labelsView([a], mode) {
  let entries = [];
  let back = '#/settings', title = 'Labels';
  const band = S.get().settings.bandName;
  if (mode === 'single') {
    const it = S.itemById(a) || S.pieceById(a);
    if (!it) return notFound('That item');
    const isPiece = !!S.pieceById(a);
    back = isPiece ? `#/piece/${a}` : `#/item/${a}`;
    title = `Label for ${it.name || it.title}`;
    entries = [it].map((x) => ({ code: x.code, name: x.name || x.title, kind: isPiece ? 'piece' : x.kind }));
  } else {
    if (a === 'piece') { entries = S.get().pieces.map((p) => ({ code: p.code, name: p.title, kind: 'piece' })); title = 'Music labels'; }
    else if (S.KINDS[a]) { entries = S.itemsOfKind(a).map((i) => ({ code: i.code, name: i.name, kind: i.kind })); title = `${S.KINDS[a].label} labels`; }
    else return notFound();
  }
  const labels = [];
  entries.forEach((e) => {
    labels.push({ code: e.code, line: e.name });
    if (e.kind === 'instrument') labels.push({ code: `${e.code}-C`, line: `${e.name} (case)` });
  });
  const html = `
  <div class="topbar no-print">${backBtn(back)}<h1 style="font-size:20px">${esc(title)}</h1></div>
  ${labels.length ? `<p class="small muted no-print" style="margin:0;line-height:1.5">${plural(labels.length, 'label')}. Print on sticky labels or plain paper and cut them out. Each instrument gets a second label for its case.</p>` : ''}
  <div class="label-sheet">${labels.length ? labels.map((l) => `<div class="qr-label">${qrSvg(l.code)}<div><div class="code">${esc(l.code)}</div><div class="meta">${esc(l.line)}</div><div class="meta">${esc(band)}</div></div></div>`).join('') : `<div class="empty" style="grid-column:1/-1">Nothing to print yet.</div>`}</div>`;
  const bar = labels.length ? `<div class="actionbar no-print"><button class="btn btn-primary" id="print">Print labels</button></div>` : '';
  return { html, bar, mount(root) { root.querySelector('#print')?.addEventListener('click', () => window.print()); } };
}
