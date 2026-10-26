// 실습 화면: 계산 시뮬레이터(calc) / 사례 판단(case)
import { h, toast, confetti } from './util.js';
import * as F from './fin.js';
import * as C from './chart.js';
import { tableView } from './tv.js';

const hdr = (title, onExit, touched) => h('div', { class: 'hd', style: { padding: 'calc(var(--safe-t) + 12px) 16px 0' } }, h('button', { class: 'back', onclick: () => { if (!touched() || confirm('나가면 이번 실습은 저장되지 않아요. 나갈까요?')) onExit(); } }, '←'), h('h2', null, title));
const codeBox = (code) => h('pre', { class: 'code' }, code);

export const FMT = {
  won: (x) => F.krw(x), won2: (x) => F.krwShort(x), pct: (x) => F.pct(x, 2), pct1: (x) => F.pct(x, 1), num: (x) => F.num(x, 2), int: (x) => F.num(x, 0),
  yrInt: (x) => Math.round(x) + '년', x: (x) => F.num(x, 2) + '배', yr: (x) => F.num(x, 1) + '년', usd: (x) => '$' + F.num(x, 2), ratio: (x) => F.num(x * 100, 1) + '%', rate: (x) => F.num(x, 2) + '원',
};
const fmtOf = (f) => (typeof f === 'function' ? f : FMT[f] || FMT.num);
export const defaultsOf = (lab) => Object.fromEntries(lab.inputs.map((i) => [i.k, i.value]));
export function computeOutputs(lab, vals) { const o = {}; (lab.outputs || []).forEach((out) => { try { o[out.k] = out.fn(vals, o); } catch (e) { o[out.k] = NaN; } }); return o; }
export function parseAnswer(s) { const t = String(s).replace(/[,\s원%배년달러$]/g, '').replace(/−/g, '-'); if (t === '' || isNaN(Number(t))) return NaN; return Number(t); }
export function answerOk(task, got, ans) { const dec = task.dec === undefined ? 0 : task.dec; const abs = task.tol !== undefined ? task.tol : 0.5 * Math.pow(10, -dec); const rel = task.rel !== undefined ? task.rel : 0.002; return Math.abs(got - ans) <= Math.max(abs, Math.abs(ans) * rel); }

// ====================== 계산 시뮬레이터 ======================
export function runCalcLab(root, { lab, onExit, onFinish, free }) {
  const tasks = lab.tasks || [];
  let ti = 0, wrong = 0, hints = 0, tries = 0, msg = null, done = !tasks.length && !free, touched = false; const log = [];
  let vals = defaultsOf(lab);
  const startTask = () => { const t = tasks[ti]; if (!t) return; vals = { ...defaultsOf(lab), ...(t.params || t.start || {}) }; tries = 0; msg = null; };
  if (tasks.length && !free) startTask();
  root.innerHTML = ''; const scr = h('div', { class: 'scr nonav' }); root.append(hdr(lab.title, onExit, () => touched && !done && !free), scr);
  let outsEl = null, chartEl = null;

  function inputRow(inp) {
    const row = h('div', { class: 'frow' });
    const show = (v) => fmtOf(inp.fmt)(v);
    row.append(h('label', null, inp.label, inp.kind === 'select' ? null : h('b', { class: 'val', style: { marginLeft: '8px', color: 'var(--ink)' } }, show(vals[inp.k]))));
    if (inp.kind === 'select') {
      const s = h('select', { 'data-k': inp.k }, inp.options.map(([v, t]) => h('option', { value: v }, t))); s.value = vals[inp.k];
      s.addEventListener('change', () => { vals[inp.k] = s.value; touched = true; refresh(); }); row.append(s);
    } else {
      const r = h('input', { type: 'range', class: 'slider', 'data-k': inp.k, min: inp.min, max: inp.max, step: inp.step, value: vals[inp.k] });
      r.addEventListener('input', () => { vals[inp.k] = Number(r.value); touched = true; row.querySelector('.val').textContent = show(vals[inp.k]); refresh(); });
      row.append(r, h('div', { class: 'range-ends' }, h('span', null, show(inp.min)), h('span', null, show(inp.max))));
    }
    return row;
  }
  function outputsBox() {
    const o = computeOutputs(lab, vals); const box = h('div', { class: 'outs' });
    (lab.outputs || []).forEach((out) => box.append(h('div', { class: 'out' + (out.big ? ' big' : '') }, h('span', null, out.label), h('b', { 'data-o': out.k }, Number.isFinite(o[out.k]) ? fmtOf(out.fmt)(o[out.k]) : '–'))));
    return box;
  }
  function drawChart() { if (chartEl && lab.chart) { const ch = lab.chart.build(vals); chartEl.innerHTML = C.renderSVG(C.prepare(ch.table, ch.spec), ch.spec); } }
  function refresh() { if (outsEl) { const box = outputsBox(); outsEl.replaceWith(box); outsEl = box; } drawChart(); }

  function paint() {
    const keep = scr.scrollTop; scr.innerHTML = '';
    scr.append(h('div', { class: 'card goalc' }, h('h3', null, '🎯 ' + (lab.badge || '계산 실습')), h('div', { class: 'gbody', html: lab.goal })));
    if (lab.tbl) scr.append(h('div', { class: 'card' }, h('h3', null, lab.tblTitle || '📋 자료'), tableView(lab.tbl, { maxRows: 14 })));
    const calc = h('div', { class: 'card builder' }, h('h3', null, '🧮 ' + (lab.toolTitle || '계산기')));
    lab.inputs.forEach((i) => calc.append(inputRow(i)));
    outsEl = outputsBox(); calc.append(outsEl);
    if (lab.chart) { chartEl = h('div', { class: 'chartbox' }); calc.append(chartEl); drawChart(); }
    if (lab.note) calc.append(h('div', { class: 'small', style: { color: 'var(--sub)', marginTop: '6px' } }, lab.note));
    scr.append(calc);
    if (free) { scr.scrollTop = keep; return; }
    if (done) {
      const stars = wrong === 0 && hints === 0 ? 3 : wrong <= 2 ? 2 : 1;
      scr.append(h('div', { class: 'card okc' }, h('h3', null, '🎉 모든 과제를 마쳤어요'), h('div', { class: 'stars', style: { fontSize: '30px', color: '#e8a410' } }, '★'.repeat(stars) + '☆'.repeat(3 - stars)), log.map((l) => h('div', { class: 'small', style: { margin: '3px 0' } }, (l.ok ? '✅ ' : '▫️ ') + l.text)), lab.after ? h('div', { class: 'note2', html: '💡 ' + lab.after }) : null, h('button', { class: 'btn pri', style: { marginTop: '10px' }, onclick: () => onFinish({ stars }) }, '완료하고 나가기')));
      scr.scrollTop = keep; return;
    }
    const t = tasks[ti];
    const tc = h('div', { class: 'card taskc' }, h('h3', null, `📝 과제 ${ti + 1} / ${tasks.length}`), h('div', { class: 'gbody', html: t.prompt }));
    if (t.kind === 'answer') {
      const inp = h('input', { type: 'text', class: 'inp2', 'data-k': 'answer', inputmode: 'decimal', autocomplete: 'off', placeholder: '답을 숫자로 입력' + (t.unit ? ` (${t.unit})` : '') });
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(inp); });
      tc.append(h('div', { class: 'ansrow' }, inp, t.unit ? h('span', { class: 'unit' }, t.unit) : null), h('button', { class: 'btn pri', style: { marginTop: '8px' }, onclick: () => submit(inp) }, '확인'));
    } else {
      tc.append(h('div', { class: 'small', style: { color: 'var(--sub)', marginBottom: '8px' } }, '위 계산기의 슬라이더를 조절해 조건을 만족시키세요.'), h('button', { class: 'btn pri', onclick: () => submit(null) }, '조건 확인'));
    }
    if (msg) tc.append(h('div', { class: 'warn' + (msg.ok ? '' : ' bad'), style: { marginTop: '8px' }, html: msg.t }));
    if (t.hint) tc.append(h('button', { class: 'btn sm sun', style: { marginTop: '8px' }, onclick: () => { hints++; msg = { ok: true, t: '💡 ' + t.hint }; paint(); } }, '💡 힌트'));
    scr.append(tc);
    scr.scrollTop = keep;
  }
  function advance(ok, text) { log.push({ ok, text }); ti++; if (ti >= tasks.length) { done = true; msg = null; confetti(); } else startTask(); paint(); }
  function submit(inp) {
    touched = true; const t = tasks[ti];
    if (t.kind === 'answer') {
      const got = parseAnswer(inp.value); const p = { ...defaultsOf(lab), ...(t.params || {}) }; const o = computeOutputs(lab, p); const ans = t.answer(p, o);
      if (isNaN(got)) { msg = { ok: false, t: '숫자로 입력해 주세요. (쉼표·단위는 있어도 돼요)' }; paint(); return; }
      const shown = t.fmtAns ? t.fmtAns(ans) : F.num(ans, t.dec || 0);
      if (answerOk(t, got, ans)) { advance(tries === 0, `${t.short || '과제 ' + (ti + 1)}: ${shown}`); return; }
      tries++; wrong++;
      if (tries >= 3) { log.push({ ok: false, text: `${t.short || '과제 ' + (ti + 1)}: ${shown} (정답 확인)` }); ti++; if (ti >= tasks.length) done = true; else startTask(); msg = { ok: false, t: `직전 과제의 정답은 <b>${shown}</b>이었어요. ${t.why || ''}` }; if (done) msg = null; paint(); return; }
      msg = { ok: false, t: `❌ 아직이에요 (${tries}/3). ${t.nudge || '위 계산기에 조건을 넣어 확인해 보세요.'}` }; paint(); return;
    }
    const o = computeOutputs(lab, vals);
    if (t.ok(vals, o)) { advance(tries === 0, `${t.short || '과제 ' + (ti + 1)}: 조건 충족`); return; }
    tries++; wrong++; msg = { ok: false, t: '❌ 아직 조건을 만족하지 않아요. ' + (t.nudge || '결과 값을 보며 조절해 보세요.') }; paint();
  }
  paint();
  window.__lab = { kind: 'calc', lab, get vals() { return vals; }, get ti() { return ti; }, get done() { return done; }, paint };
}

// ====================== 사례 판단 (개념형 실습) ======================
export function runCaseLab(root, { lab, onExit, onFinish }) {
  let i = 0, wrong = 0, tick = 0; const log = [];
  root.innerHTML = ''; const scr = h('div', { class: 'scr nonav' }); root.append(hdr(lab.title, onExit, () => tick > 0 && i < lab.steps.length), scr);
  function paint() {
    scr.innerHTML = '';
    scr.append(h('div', { class: 'card goalc' }, h('h3', null, '🧭 ' + (lab.badge || '사례 판단')), h('div', { class: 'gbody', html: lab.goal })));
    log.forEach((l) => scr.append(h('div', { class: 'card' + (l.ok ? ' okc' : '') }, h('div', { class: 'small', style: { fontWeight: 800 } }, l.prompt), h('div', { class: 'small', style: { margin: '4px 0' } }, (l.ok ? '✅ ' : '❌ ') + l.pick), h('div', { class: 'small', style: { color: 'var(--sub)' } }, l.why))));
    if (i >= lab.steps.length) {
      const stars = wrong === 0 ? 3 : wrong === 1 ? 2 : 1;
      scr.append(h('div', { class: 'card okc' }, h('h3', null, '🎉 사례를 끝까지 판단했어요'), h('div', { class: 'stars', style: { fontSize: '30px', color: '#e8a410' } }, '★'.repeat(stars) + '☆'.repeat(3 - stars)), lab.after ? h('div', { class: 'note2', html: '💡 ' + lab.after }) : null, h('button', { class: 'btn pri', style: { marginTop: '10px' }, onclick: () => onFinish({ stars }) }, '완료하고 나가기'))); return;
    }
    const s = lab.steps[i]; const opts = s._opts || (s._opts = [s.ok, ...s.wrongs].sort(() => Math.random() - 0.5));
    if (s.code) scr.append(h('div', { class: 'card' }, codeBox(s.code)));
    if (s.tbl) scr.append(tableView(s.tbl));
    scr.append(h('div', { class: 'card' }, h('h3', null, `판단 ${i + 1} / ${lab.steps.length}`), h('div', { class: 'gbody', style: { marginBottom: '8px' }, html: s.prompt }), h('div', { class: 'opts' }, opts.map((o) => h('button', { class: 'opt', 'data-ok': o === s.ok ? '1' : '0', onclick: () => { tick++; const ok = o === s.ok; if (!ok) wrong++; log.push({ prompt: s.prompt.replace(/<[^>]+>/g, ''), pick: o, ok, why: s.why }); i++; paint(); } }, o)))));
    window.scrollTo(0, 0);
  }
  paint();
  window.__lab = { kind: 'case', lab, get i() { return i; } };
}
