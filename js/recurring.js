// Ricorrenze: genera le transazioni scadute
import { state, live, upsertMany } from './store.js';
import { addDays, addMonths, todayISO, stableUuid } from './format.js';

export const FREQUENCIES = ['weekly', 'monthly', 'quarterly', 'yearly', 'two_years'];

export function advance(iso, frequency) {
  switch (frequency) {
    case 'weekly': return addDays(iso, 7);
    case 'monthly': return addMonths(iso, 1);
    case 'quarterly': return addMonths(iso, 3);
    case 'yearly': return addMonths(iso, 12);
    case 'two_years': return addMonths(iso, 24);
    default: return addMonths(iso, 1);
  }
}

// Crea le transazioni per ogni ricorrenza attiva con next_date <= oggi. Ritorna il numero creato.
// L'id della transazione è deterministico (regola + data): se due dispositivi generano la stessa
// scadenza prima di sincronizzarsi ottengono lo stesso id e non nascono doppioni; e una scadenza
// che l'utente ha cancellato non viene ricreata.
export async function processDue() {
  const today = todayISO();
  const existing = new Set(state.transactions.map(t => t.id));
  const created = []; const updatedRules = [];
  for (const r of live.recurring()) {
    if (!r.active || !r.next_date) continue;
    let next = r.next_date; let guard = 0;
    while (next <= today && guard++ < 400) {
      const id = await stableUuid(`recurring:${r.id}:${next}`);
      if (!existing.has(id)) {
        created.push({
          id, type: r.type || 'expense', amount: r.amount, date: next, category_id: r.category_id || null,
          account_id: r.account_id || null, to_account_id: r.to_account_id || null, note: r.note || '',
          is_recurring: true, recurring_id: r.id,
        });
        existing.add(id);
      }
      next = advance(next, r.frequency);
    }
    if (next !== r.next_date) updatedRules.push({ ...r, next_date: next });
  }
  if (created.length) await upsertMany('transactions', created, { silent: true });
  if (updatedRules.length) await upsertMany('recurring', updatedRules, { silent: true });
  return created.length;
}

export function upcoming(days = 45) {
  const today = todayISO(); const limit = addDays(today, days);
  return live.recurring().filter(r => r.active && r.next_date && r.next_date <= limit).sort((a, b) => a.next_date.localeCompare(b.next_date));
}

export function monthlyEquivalent(r) {
  const a = Number(r.amount) || 0;
  switch (r.frequency) {
    case 'weekly': return a * 52 / 12;
    case 'quarterly': return a / 3;
    case 'yearly': return a / 12;
    case 'two_years': return a / 24;
    default: return a;
  }
}
