// Periodi: giorno / settimana / mese / anno / tutto / personalizzato
import { toISO, fromISO, todayISO, addDays, addMonths, fmtDate, pad } from './format.js';
import { t } from './i18n.js';

export const PERIOD_TYPES = ['day', 'week', 'month', 'year', 'all', 'custom'];

// period = { type, anchor: 'YYYY-MM-DD', from?, to? }
export function defaultPeriod() { return { type: 'month', anchor: todayISO() }; }

function startOfWeek(iso) { const d = fromISO(iso); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); return toISO(d); }

export function range(p) {
  const a = p.anchor || todayISO();
  switch (p.type) {
    case 'day': return { from: a, to: a };
    case 'week': { const f = startOfWeek(a); return { from: f, to: addDays(f, 6) }; }
    case 'month': { const d = fromISO(a); const f = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`; const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); return { from: f, to: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(last)}` }; }
    case 'year': { const y = a.slice(0, 4); return { from: `${y}-01-01`, to: `${y}-12-31` }; }
    case 'custom': return { from: p.from || a, to: p.to || a };
    default: return { from: null, to: null };
  }
}

export function shift(p, dir) {
  const a = p.anchor || todayISO();
  switch (p.type) {
    case 'day': return { ...p, anchor: addDays(a, dir) };
    case 'week': return { ...p, anchor: addDays(a, 7 * dir) };
    case 'month': return { ...p, anchor: addMonths(a.slice(0, 8) + '01', dir) };
    case 'year': return { ...p, anchor: `${Number(a.slice(0, 4)) + dir}-01-01` };
    case 'custom': { const r = range(p); const len = Math.round((fromISO(r.to) - fromISO(r.from)) / 86400000) + 1; return { ...p, from: addDays(r.from, len * dir), to: addDays(r.to, len * dir) }; }
    default: return p;
  }
}

export function label(p) {
  const r = range(p);
  switch (p.type) {
    case 'day': return fmtDate(p.anchor, 'long');
    case 'week': return `${fmtDate(r.from, 'short')} – ${fmtDate(r.to, 'short')}`;
    case 'month': return fmtDate(r.from, 'month');
    case 'year': return r.from.slice(0, 4);
    case 'custom': return `${fmtDate(r.from, 'short')} – ${fmtDate(r.to, 'short')}`;
    default: return t('all');
  }
}

// mese corrente (per budget)
export function monthRange(iso = todayISO()) { return range({ type: 'month', anchor: iso }); }
export function yearRange(iso = todayISO()) { return range({ type: 'year', anchor: iso }); }
export function lastMonths(n, iso = todayISO()) {
  const out = [];
  let a = iso.slice(0, 8) + '01';
  for (let i = 0; i < n; i++) { out.unshift(range({ type: 'month', anchor: a })); a = addMonths(a, -1); }
  return out;
}
