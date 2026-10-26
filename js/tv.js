// 표 화면 컴포넌트
import { h } from './util.js';
import { fmt, ERR } from './pq.js';
const TI = { text: 'ABC', number: '123', date: '📅', any: '❔' };
export function tableView(t, opt = {}) {
  const max = opt.maxRows || 10;
  const thead = h('tr', null, h('th', { class: 'rn' }, ''), t.cols.map((c, i) => h('th', null, h('span', { class: 'ti' }, TI[t.types[i]] || '❔'), ' ' + c)));
  const body = t.rows.slice(0, max).map((r, n) => h('tr', null, h('td', { class: 'rn' }, n + 1), r.map((v, i) => h('td', { class: (v === null || v === undefined || v === '' ? 'nul ' : '') + (v === ERR ? 'err ' : '') + (typeof v === 'number' ? 'num' : '') }, v === null || v === undefined ? 'null' : v === '' ? '(빈칸)' : fmt(v)))));
  const wrap = h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' }, h('thead', null, thead), h('tbody', null, body)));
  const more = t.rows.length > max ? h('div', { class: 'small tbl-more' }, `… 외 ${t.rows.length - max}행 (총 ${t.rows.length}행)`) : h('div', { class: 'small tbl-more' }, `총 ${t.rows.length}행 · ${t.cols.length}열`);
  return h('div', { class: 'tview' }, wrap, more);
}
