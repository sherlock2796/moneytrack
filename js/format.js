// Formattazione importi e date (locale it-IT / en-GB)
import { getLang, t } from './i18n.js';

const locale = () => (getLang() === 'en' ? 'en-GB' : 'it-IT');
// 'always' forza il separatore delle migliaia anche sotto 10.000 (CLDR it-IT altrimenti non lo mette); fallback true
const GROUPING = (() => { try { new Intl.NumberFormat('it-IT', { useGrouping: 'always' }); return 'always'; } catch { return true; } })();

export function money(n, opts = {}) {
  const v = Number(n) || 0;
  const s = new Intl.NumberFormat(locale(), { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: GROUPING }).format(Math.abs(v));
  if (opts.sign) return (v < 0 ? '−' : v > 0 ? '+' : '') + s;
  return v < 0 ? '−' + s : s;
}
export function num(n, digits = 2) {
  return new Intl.NumberFormat(locale(), { minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: GROUPING }).format(Number(n) || 0);
}
export function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

// date helpers: dates are stored as 'YYYY-MM-DD' (local)
export function pad(n) { return String(n).padStart(2, '0'); }
export function toISO(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
export function fromISO(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
export function todayISO() { return toISO(new Date()); }
export function addDays(iso, n) { const d = fromISO(iso); d.setDate(d.getDate() + n); return toISO(d); }
export function addMonths(iso, n) {
  const d = fromISO(iso); const day = d.getDate();
  d.setDate(1); d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last)); return toISO(d);
}
export function fmtDate(iso, style = 'medium') {
  if (!iso) return '';
  const d = fromISO(iso);
  if (style === 'day') {
    const today = todayISO();
    if (iso === today) return t('today');
    if (iso === addDays(today, -1)) return t('yesterday');
    return new Intl.DateTimeFormat(locale(), { weekday: 'short', day: 'numeric', month: 'short' }).format(d);
  }
  if (style === 'short') return new Intl.DateTimeFormat(locale(), { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
  if (style === 'month') return new Intl.DateTimeFormat(locale(), { month: 'long', year: 'numeric' }).format(d);
  if (style === 'monthShort') return new Intl.DateTimeFormat(locale(), { month: 'short' }).format(d);
  return new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
}
export function nowISO() { return new Date().toISOString(); }

export function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// UUID deterministico (v5-like, SHA-1) da una stringa: stesso input → stesso id su ogni dispositivo
export async function stableUuid(str) {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(str));
  const b = new Uint8Array(buf).slice(0, 16);
  b[6] = (b[6] & 0x0f) | 0x50; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Valuta un'espressione del tastierino: cifre, . + - × ÷
export function evalExpr(expr) {
  const s = String(expr).replace(/,/g, '.').replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/\s/g, '');
  if (!s) return 0;
  if (!/^[0-9.+\-*/]+$/.test(s)) return NaN;
  // tokenizza
  const tokens = s.match(/(\d+\.?\d*|\.\d+|[+\-*/])/g) || [];
  // shunting-yard semplice con precedenza
  const out = [], ops = [];
  const prec = { '+': 1, '-': 1, '*': 2, '/': 2 };
  let prevWasOp = true;
  for (const tk of tokens) {
    if (/[+\-*/]/.test(tk)) {
      if (prevWasOp) { if (tk === '-') { out.push(0); } else continue; }
      while (ops.length && prec[ops[ops.length - 1]] >= prec[tk]) out.push(ops.pop());
      ops.push(tk); prevWasOp = true;
    } else { out.push(parseFloat(tk)); prevWasOp = false; }
  }
  if (prevWasOp && ops.length) ops.pop(); // operatore finale ignorato
  while (ops.length) out.push(ops.pop());
  const st = [];
  for (const x of out) {
    if (typeof x === 'number') st.push(x);
    else { const b = st.pop(), a = st.pop(); if (a === undefined || b === undefined) return NaN;
      st.push(x === '+' ? a + b : x === '-' ? a - b : x === '*' ? a * b : b === 0 ? NaN : a / b); }
  }
  return st.length === 1 && Number.isFinite(st[0]) ? round2(st[0]) : NaN;
}
