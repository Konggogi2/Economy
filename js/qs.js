// 문제·개념 카드 컴포넌트. 각 함수는 { el, check?, noCheck?, teach? } 를 돌려준다.
import { h, shuffle } from './util.js';
import { tableView } from './tv.js';

const title = (q) => h('div', { class: 'q-t' }, q.prompt, q.sub ? h('small', null, q.sub) : null);
const codeBlock = (code) => h('pre', { class: 'code' }, code);

function mc(q, hooks) {
  let sel = -1;
  const el = h('div'); el.append(title(q));
  if (q.show) el.append(h('div', { class: 'bubble' }, q.mono ? codeBlock(q.show) : h('div', { class: 'phr' }, q.show)));
  if (q.tbl) el.append(tableView(q.tbl));
  const box = h('div', { class: 'opts' });
  const btns = q.opts.map((o, i) => h('button', { class: 'opt' + (q.monoOpts ? ' mono' : ''), onclick: () => { if (box.dataset.lock) return; sel = i; btns.forEach((b, j) => b.classList.toggle('sel', j === i)); hooks.ready(true); } }, o));
  btns.forEach((b) => box.append(b)); el.append(box);
  return { el, check() { box.dataset.lock = '1'; const ok = sel === q.ans; btns.forEach((b, j) => { b.classList.remove('sel'); if (j === q.ans) b.classList.add('ok'); else if (j === sel) b.classList.add('no'); }); return { correct: ok, ans: q.opts[q.ans], extra: q.why }; } };
}

// 순서 맞추기: 항목을 눌러 순서대로 쌓는다
function order(q, hooks) {
  const el = h('div'); el.append(title(q));
  const ansBox = h('div', { class: 'ordans' }); const pool = h('div', { class: 'ordpool' });
  const chosen = [];
  const tiles = q.items.map((t, i) => h('button', { class: 'otile', onclick: () => { if (tiles[i].classList.contains('used') || ansBox.dataset.lock) return; tiles[i].classList.add('used'); chosen.push(i); draw(); } }, t));
  function draw() {
    ansBox.innerHTML = '';
    chosen.forEach((i, k) => ansBox.append(h('button', { class: 'otile placed', onclick: () => { if (ansBox.dataset.lock) return; chosen.splice(k, 1); tiles[i].classList.remove('used'); draw(); } }, `${k + 1}. ${q.items[i]}`)));
    if (!chosen.length) ansBox.append(h('div', { class: 'small', style: { color: 'var(--sub)' } }, '아래 항목을 순서대로 눌러 쌓아 보세요 (누르면 빠져요)'));
    hooks.ready(chosen.length === q.items.length);
  }
  tiles.forEach((t) => pool.append(t)); draw();
  el.append(ansBox, pool);
  return { el, check() { ansBox.dataset.lock = '1'; const got = chosen.map((i) => q.items[i]); const ok = got.every((t, k) => t === q.correct[k]); return { correct: ok, ans: q.correct.map((t, k) => `${k + 1}. ${t}`).join('\n'), extra: q.why }; } };
}

// 분류하기: 각 항목을 범주에 넣는다
function sort(q, hooks) {
  const el = h('div'); el.append(title(q));
  const pick = q.items.map(() => -1); const rows = [];
  q.items.forEach((it, i) => {
    const btns = q.cats.map((c, k) => h('button', { class: 'cbtn', onclick: () => { if (el.dataset.lock) return; pick[i] = k; btns.forEach((b, j) => b.classList.toggle('sel', j === k)); hooks.ready(pick.every((x) => x >= 0)); } }, c));
    const row = h('div', { class: 'srow' }, h('div', { class: 'st' }, it[0]), h('div', { class: 'cb' }, btns)); rows.push({ row, btns }); el.append(row);
  });
  return { el, check() { el.dataset.lock = '1'; let ok = true; rows.forEach((r, i) => { const good = pick[i] === q.items[i][1]; if (!good) ok = false; r.row.classList.add(good ? 'good' : 'bad'); }); return { correct: ok, ans: q.items.map((it) => `${it[0]} → ${q.cats[it[1]]}`).join('\n'), extra: q.why }; } };
}

function match(q, hooks) {
  const el = h('div'); el.append(h('div', { class: 'q-t' }, q.prompt || '짝을 맞춰 보세요', h('small', null, '왼쪽과 오른쪽을 차례로 눌러요')));
  const lefts = shuffle(q.pairs.map((p, i) => ({ t: p[0], i }))), rights = shuffle(q.pairs.map((p, i) => ({ t: p[1], i })));
  const grid = h('div', { class: 'pairs' }); let selL = null, selR = null, left = q.pairs.length, mistakes = 0;
  const L = lefts.map((x) => h('button', { class: 'pair', onclick: () => pickSide('L', x.i) }, x.t)), R = rights.map((x) => h('button', { class: 'pair', style: { fontSize: '13px' }, onclick: () => pickSide('R', x.i) }, x.t));
  const bl = (i) => L[lefts.findIndex((x) => x.i === i)], br = (i) => R[rights.findIndex((x) => x.i === i)];
  function pickSide(side, i) {
    if (side === 'L') { if (selL != null) bl(selL).classList.remove('sel'); selL = i; bl(i).classList.add('sel'); } else { if (selR != null) br(selR).classList.remove('sel'); selR = i; br(i).classList.add('sel'); }
    if (selL != null && selR != null) {
      if (selL === selR) { const a = bl(selL), c = br(selR); setTimeout(() => { a.classList.add('gone'); c.classList.add('gone'); }, 150); selL = selR = null; left--; if (!left) setTimeout(() => hooks.done({ correct: mistakes === 0, ans: '', silent: true, mistakes }), 400); }
      else { mistakes++; const a = bl(selL), c = br(selR); [a, c].forEach((x) => { x.classList.remove('sel'); x.classList.add('wrong'); setTimeout(() => x.classList.remove('wrong'), 400); }); selL = selR = null; }
    }
  }
  for (let k = 0; k < q.pairs.length; k++) grid.append(L[k], R[k]); el.append(grid);
  return { el, noCheck: true };
}

// 개념 카드: 설명 + (선택) 코드 + 팁
function card(q) {
  const el = h('div');
  el.append(h('div', { class: 'q-t' }, q.title, q.tag ? h('small', null, q.tag) : null));
  el.append(h('div', { class: 'card gbody', html: q.body }));
  if (q.code) el.append(h('div', { class: 'card' }, h('div', { class: 'small', style: { marginBottom: '6px', color: 'var(--sub)' } }, q.codeLabel || '예시 코드'), codeBlock(q.code)));
  if (q.tbl) el.append(tableView(q.tbl));
  if (q.tip) el.append(h('div', { class: 'note2' }, '💡 ' + q.tip));
  return { el, noCheck: true, teach: true };
}

export function mountQ(q, hooks) { return { mc, order, sort, match, card }[q.t](q, hooks); }
