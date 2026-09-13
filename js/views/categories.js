// Editor categoria (condiviso da Budget e Impostazioni)
import { live, upsert, remove } from '../store.js';
import { t } from '../i18n.js';
import { esc } from '../format.js';
import { openSheet, closeLayer, sheetHead, toast, confirm, PALETTE, ICON } from '../ui.js';
import { scheduleSync } from '../sync.js';

export function editCategory(cat, type = 'expense') {
  const c = cat ? { ...cat } : { type, name: '', icon: '🏷️', color: PALETTE[Math.floor(Math.random() * PALETTE.length)], budget: 0, budget_period: 'month', archived: false, sort: live.categories(type).length };
  const el = openSheet(`${sheetHead(cat ? t('edit') : t('new_category'), cat ? `<button class="iconbtn" data-del>${ICON.trash}</button>` : '')}
    <div class="field inline">
      <div class="grow" style="flex:0 0 70px"><label>${t('icon')}</label><input data-f="icon" value="${esc(c.icon)}" maxlength="4" style="font-size:22px;text-align:center"></div>
      <div class="grow"><label>${t('name')}</label><input data-f="name" value="${esc(c.name)}" maxlength="40"></div>
    </div>
    <div class="field"><label>${t('color')}</label><div class="colors">${PALETTE.map(x => `<div class="color-dot ${x === c.color ? 'active' : ''}" data-color="${x}" style="background:${x}"></div>`).join('')}</div></div>
    ${c.type === 'expense' ? `<div class="field inline">
      <div class="grow"><label>${t('budget_cat')}</label><input data-f="budget" type="number" step="1" min="0" inputmode="decimal" value="${c.budget || 0}"></div>
      <div class="grow"><label>${t('budget_period')}</label><select data-f="budget_period"><option value="month" ${c.budget_period !== 'year' ? 'selected' : ''}>${t('monthly')}</option><option value="year" ${c.budget_period === 'year' ? 'selected' : ''}>${t('yearly')}</option></select></div>
    </div>` : ''}
    <label class="switch"><span>${t('archived')}</span><input type="checkbox" data-f="archived" ${c.archived ? 'checked' : ''}></label>
    <button class="btn primary block mt" data-save>${t('save')}</button>`);
  el.querySelectorAll('[data-color]').forEach(d => d.onclick = () => { c.color = d.dataset.color; el.querySelectorAll('[data-color]').forEach(x => x.classList.toggle('active', x === d)); });
  el.querySelector('[data-save]').onclick = async () => {
    c.name = el.querySelector('[data-f=name]').value.trim(); if (!c.name) return;
    c.icon = el.querySelector('[data-f=icon]').value.trim() || '🏷️';
    if (c.type === 'expense') { c.budget = Number(el.querySelector('[data-f=budget]').value) || 0; c.budget_period = el.querySelector('[data-f=budget_period]').value; }
    c.archived = el.querySelector('[data-f=archived]').checked;
    await upsert('categories', c); closeLayer(el); scheduleSync(); toast(t('saved'));
  };
  el.querySelector('[data-del]')?.addEventListener('click', async () => {
    if (!(await confirm(t('confirm_delete'), { okLabel: t('delete'), danger: true }))) return;
    await remove('categories', cat.id); closeLayer(el); scheduleSync(); toast(t('deleted'));
  });
}
