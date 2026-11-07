import { uid, nowIso, daysSince } from './util.js';

const KEY = 'bandkit.v1';

export const KINDS = {
  instrument: { section: 'instruments', label: 'Instruments', one: 'instrument', prefix: 'INS', nameLabel: 'Instrument type', namePlaceholder: 'e.g. Trumpet' },
  uniform:    { section: 'uniforms',    label: 'Uniforms',    one: 'uniform item', prefix: 'UNI', nameLabel: 'Item', namePlaceholder: 'e.g. Blazer' },
  accessory:  { section: 'accessories', label: 'Accessories and equipment', one: 'item', prefix: 'EQ', nameLabel: 'Item', namePlaceholder: 'e.g. Music stand' }
};
export const kindForSection = (section) => Object.keys(KINDS).find((k) => KINDS[k].section === section);

const defaults = () => ({
  v: 1,
  settings: {
    bandName: 'My Youth Band',
    logo: null,
    sections: { instruments: true, uniforms: true, music: true, accessories: false },
    overdueDays: 60,
    extras: {
      instrument: ['Case', 'Mouthpiece', 'Music stand'],
      uniform: ['Hat', 'Tie'],
      accessory: []
    }
  },
  counters: { instrument: 0, uniform: 0, accessory: 0, piece: 0 },
  members: [],
  items: [],
  pieces: []
});

let state = load();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch (e) { console.warn('Could not read saved data', e); }
  return defaults();
}

// Fill in anything missing so older or imported data never breaks the app.
function migrate(data) {
  const d = defaults();
  const s = data.settings || {};
  return {
    v: 1,
    settings: {
      ...d.settings, ...s,
      sections: { ...d.settings.sections, ...(s.sections || {}) },
      extras: { ...d.settings.extras, ...(s.extras || {}) }
    },
    counters: { ...d.counters, ...(data.counters || {}) },
    members: Array.isArray(data.members) ? data.members : [],
    items: Array.isArray(data.items) ? data.items : [],
    pieces: Array.isArray(data.pieces) ? data.pieces : []
  };
}

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) { console.error(e); alert('This device is out of storage space, so your last change was not saved. Export a backup from Settings.'); }
}

export const get = () => state;
export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

export function update(fn) {
  fn(state);
  persist();
  listeners.forEach((l) => l());
}

export function exportJson() { return JSON.stringify(state, null, 2); }

export function importJson(text) {
  const data = JSON.parse(text);
  if (!data || typeof data !== 'object' || !Array.isArray(data.items)) throw new Error('That file is not a Band Kit backup.');
  state = migrate(data);
  persist();
  listeners.forEach((l) => l());
}

export function eraseAll() {
  state = defaults();
  persist();
  listeners.forEach((l) => l());
}

// ---------- lookups ----------
export const sectionOn = (section) => !!state.settings.sections[section];
export const memberById = (id) => state.members.find((m) => m.id === id);
export const itemById = (id) => state.items.find((i) => i.id === id);
export const pieceById = (id) => state.pieces.find((p) => p.id === id);
export const itemsOfKind = (kind) => state.items.filter((i) => i.kind === kind);
export const itemsHeldBy = (memberId) => state.items.filter((i) => i.holderId === memberId);

export function statusOf(item) {
  if (item.needsRepair) return 'repair';
  if (item.holderId) return daysSince(item.issuedAt) > state.settings.overdueDays ? 'overdue' : 'issued';
  return 'available';
}
export const STATUS_LABEL = { available: 'Available', issued: 'Issued', repair: 'Repair', overdue: 'Overdue' };

export function nextCode(kind) {
  const prefix = kind === 'piece' ? 'MUS' : KINDS[kind].prefix;
  return `${prefix}-${String(state.counters[kind] + 1).padStart(3, '0')}`;
}

// Resolves whatever a QR code says to an item or piece. Case labels end in -C and point at the same instrument.
export function findByCode(text) {
  let code = String(text || '').trim().toUpperCase();
  if (!code) return null;
  const tryFind = (c) => {
    const item = state.items.find((i) => i.code.toUpperCase() === c);
    if (item) return { type: 'item', id: item.id };
    const piece = state.pieces.find((p) => p.code.toUpperCase() === c);
    if (piece) return { type: 'piece', id: piece.id };
    return null;
  };
  return tryFind(code) || (code.endsWith('-C') ? tryFind(code.slice(0, -2)) : null);
}

// ---------- mutations ----------
const log = (target, type, text, extra = {}) => {
  (target.history ||= []).unshift({ id: uid(), at: nowIso(), type, text, ...extra });
};

export function addMember(name) {
  const m = { id: uid(), name: name.trim() };
  update((s) => { s.members.push(m); });
  return m;
}
export function renameMember(id, name) { update(() => { memberById(id).name = name.trim(); }); }
export function deleteMember(id) {
  if (itemsHeldBy(id).length) return false;
  update((s) => { s.members = s.members.filter((m) => m.id !== id); });
  return true;
}

export function saveItem(kind, data, id) {
  let saved;
  update((s) => {
    if (id) {
      saved = itemById(id);
      Object.assign(saved, data);
      log(saved, 'note', 'Details edited');
    } else {
      s.counters[kind] += 1;
      const code = `${KINDS[kind].prefix}-${String(s.counters[kind]).padStart(3, '0')}`;
      saved = { id: uid(), kind, code, ...data, holderId: null, issuedAt: null, needsRepair: false, history: [] };
      log(saved, 'created', 'Added to the inventory');
      s.items.push(saved);
    }
  });
  return saved;
}
export function deleteItem(id) { update((s) => { s.items = s.items.filter((i) => i.id !== id); }); }

export function issueItem(id, memberId, { extras = [], condition = 'Good' } = {}) {
  update(() => {
    const it = itemById(id);
    const m = memberById(memberId);
    it.holderId = memberId;
    it.issuedAt = nowIso();
    const bits = [`Condition ${condition.toLowerCase()}`];
    if (extras.length) bits.push(`with ${extras.join(', ').toLowerCase()}`);
    log(it, 'issued', `Issued to ${m.name}`, { memberId, detail: bits.join(' · ') });
    if (condition === 'Needs repair') {
      it.needsRepair = true;
      log(it, 'repair', 'Issued needing repair', { detail: 'Flagged at issue' });
    }
  });
}

export function returnItem(id, { condition = 'Good', note = '' } = {}) {
  update(() => {
    const it = itemById(id);
    const m = memberById(it.holderId);
    log(it, 'returned', `Returned by ${m ? m.name : 'unknown member'}`, { memberId: it.holderId, detail: [`Condition ${condition.toLowerCase()}`, note].filter(Boolean).join(' · ') });
    it.holderId = null;
    it.issuedAt = null;
    if (condition === 'Needs repair') {
      it.needsRepair = true;
      log(it, 'repair', 'Flagged as needing repair', { detail: note || 'Flagged on return' });
    }
  });
}

export function reportDamage(id, note) {
  update(() => {
    const it = itemById(id);
    it.needsRepair = true;
    log(it, 'repair', 'Damage reported', { detail: note });
  });
}

export function markRepaired(id, { note = '', cost = '' } = {}) {
  update(() => {
    const it = itemById(id);
    it.needsRepair = false;
    log(it, 'repair', 'Repair completed', { detail: [note, cost ? `£${cost}` : ''].filter(Boolean).join(' · '), done: true });
  });
}

export function savePiece(data, id) {
  let saved;
  update((s) => {
    if (id) {
      saved = pieceById(id);
      Object.assign(saved, data);
    } else {
      s.counters.piece += 1;
      saved = { id: uid(), code: `MUS-${String(s.counters.piece).padStart(3, '0')}`, ...data, history: [] };
      log(saved, 'created', 'Added to the library');
      s.pieces.push(saved);
    }
  });
  return saved;
}
export function deletePiece(id) { update((s) => { s.pieces = s.pieces.filter((p) => p.id !== id); }); }
export function setMissing(id, missing, note = '') {
  update(() => {
    const p = pieceById(id);
    const before = p.missing || 0;
    p.missing = missing;
    log(p, missing > before ? 'repair' : 'returned', missing === 0 ? 'All copies accounted for' : `${missing} missing`, { detail: note });
  });
}
