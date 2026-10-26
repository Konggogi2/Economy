// 퀴즈·개념 카드 진행기: 문제를 차례로 풀고, 틀린 문제는 뒤로 보내 다시 푼다.
import { h, confetti, toast } from './util.js';
import { mountQ } from './qs.js';
import { store, srsMark } from './store.js';

const PRAISE = ['좋아요! 👏', '정확해요!', '잘했어요!', '완벽해요!', '맞았어요!'];
const ENCOURAGE = ['괜찮아요, 다시 나와요', '아쉬워요! 이렇게 기억해요', '조금만 더!'];
const rnd = (a) => a[Math.floor(Math.random() * a.length)];

// opts: { questions, onExit(), onFinish(result), xpBase }
export function runQuiz(root, opts) {
  const total = opts.questions.length; const queue = opts.questions.slice();
  let done = 0, graded = 0, firstOk = 0; const retry = new Map();
  let comp = null, current = null, state = 'q';
  root.innerHTML = '';
  const bar = h('i'); bar.style.width = '0%';
  const hd = h('div', { class: 'lhd' }, h('button', { class: 'x', 'aria-label': '나가기', onclick: () => { if (confirm('그만둘까요? 진행 상황은 저장되지 않아요.')) opts.onExit(); } }, '✕'), h('div', { class: 'pbar' }, bar));
  const body = h('div', { class: 'lbody' }); const fb = h('div', { class: 'fb idle' }); const btn = h('button', { class: 'btn pri' }, '확인');
  fb.append(btn); root.append(hd, body, fb);
  const progress = () => { bar.style.width = Math.min(100, Math.round((done / total) * 100)) + '%'; };
  function next() {
    if (!queue.length) { finish(); return; }
    current = queue.shift(); window.__q = current; state = 'q';
    body.innerHTML = ''; body.scrollTop = 0; fb.className = 'fb idle'; fb.innerHTML = ''; fb.append(btn);
    comp = mountQ(current, { ready: (b) => { btn.disabled = !b; }, submit: () => { if (!btn.disabled && state === 'q') check(); }, done: (res) => settle(res) });
    body.append(comp.el);
    if (comp.noCheck && !comp.teach) btn.style.display = 'none'; else btn.style.display = '';
    if (comp.teach) { btn.disabled = false; btn.textContent = '계속'; btn.className = 'btn teal'; } else { btn.disabled = true; btn.textContent = '확인'; btn.className = 'btn pri'; }
    btn.onclick = comp.teach ? () => { done++; progress(); next(); } : check;
  }
  function check() { if (state !== 'q') return; settle(comp.check()); }
  function settle(res) {
    if (state !== 'q') return; state = 'fb'; const q = current; const first = !retry.has(q);
    if (q.t === 'match') { graded++; if (res.mistakes === 0) firstOk++; if (q.key) srsMark(q.key, res.mistakes === 0); }
    else { if (first) { graded++; if (res.correct) firstOk++; } if (q.key) srsMark(q.key, res.correct); if (!res.correct) { retry.set(q, true); queue.push(q); } }
    done++; progress();
    if (res.silent) { if (q.t === 'match') toast(res.correct ? '완벽해요! 👏' : '완성! (몇 번 틀렸어요)', 1000); setTimeout(next, 650); return; }
    fb.className = 'fb ' + (res.correct ? 'ok' : 'no'); fb.innerHTML = '';
    fb.append(h('div', { class: 'tt' }, res.correct ? rnd(PRAISE) : rnd(ENCOURAGE)));
    if (!res.correct || res.extra) fb.append(h('div', { class: 'ans' }, res.correct ? res.extra : [res.ans ? ['정답: ', h('b', null, res.ans)] : null, res.extra ? h('div', { style: { color: 'var(--sub)', fontSize: '13px', whiteSpace: 'pre-wrap' } }, res.extra) : null]));
    fb.append(h('button', { class: 'btn ' + (res.correct ? 'pri' : 'bad'), onclick: next }, '계속'));
  }
  function finish() {
    const acc = graded ? firstOk / graded : 1; const stars = acc >= 0.9 ? 3 : acc >= 0.7 ? 2 : 1;
    const xp = (opts.xpBase || 10) + firstOk * 2; store.addXp(xp); if (stars >= 2) confetti();
    opts.onFinish({ acc, stars, xp, graded, firstOk });
  }
  progress(); next();
}
