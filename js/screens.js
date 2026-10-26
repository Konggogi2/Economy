import { h, toast } from './util.js';
import { store } from './store.js';
import { UNITS, CHAPTERS, cardQs, quizQs, chapterQuiz, reviewQs, dueCount, learnedKeys, hasLearned } from './gen.js';
import { runQuiz } from './lessonq.js';
import { runCalcLab, runCaseLab } from './labs.js';
import { CALCS } from './data/calcs.js';
import { GLOSS } from './data/glossary.js';

const app = () => document.getElementById('app');
let tab = 'home'; let route = { name: 'tabs' };
export function go(name, p = {}) { route = { name, ...p }; render(); }
export function setTab(t) { tab = t; route = { name: 'tabs' }; render(); }

export function render() {
  const a = app(); a.innerHTML = '';
  const t = store.s.settings.theme; if (t) document.documentElement.setAttribute('data-theme', t); else document.documentElement.removeAttribute('data-theme');
  const r = route;
  if (r.name === 'unit') return unitScreen(a, r.id);
  if (r.name === 'lesson') return lessonScreen(a, r);
  if (r.name === 'lab') return labScreen(a, r);
  if (r.name === 'result') return resultScreen(a, r);
  if (r.name === 'calc') return calcScreen(a, r.id);
  tabsScreen(a);
}

const isUnlocked = (u) => store.s.settings.open || u.id === 1 || store.unit(u.id - 1).st[2] > 0;
const unitDone = (u) => store.unit(u.id).st[2] > 0 && store.unit(u.id).st[1] > 0;
const chUnlocked = (c) => store.s.settings.open || store.unit(c.to).st[2] > 0;
const starStr = (n) => '★'.repeat(n) + '☆'.repeat(Math.max(0, 3 - n));
const LAB_ICON = { calc: '🧮', case: '🧭' };

function tabsBar(a) {
  const mk = (id, ic, tx) => h('button', { class: tab === id ? 'on' : '', onclick: () => setTab(id) }, h('b', null, ic), tx);
  a.append(h('div', { class: 'tabs' }, mk('home', '🗺️', '학습'), mk('review', '🔁', '복습'), mk('calc', '🧮', '계산기'), mk('gloss', '📖', '용어집'), mk('more', '⚙️', '더보기')));
}
function tabsScreen(a) {
  const scr = h('div', { class: 'scr' }); a.append(scr);
  if (tab === 'home') homeTab(scr); else if (tab === 'review') reviewTab(scr); else if (tab === 'calc') calcTab(scr); else if (tab === 'gloss') glossTab(scr); else moreTab(scr);
  tabsBar(a);
}

const LEVELS = [['Money Rookie', 0], ['Saver', 300], ['Rate Reader', 900], ['Macro Watcher', 1900], ['Analyst', 3300], ['Strategist', 5000], ['Finance Pro', 7000]];
const levelOf = (xp) => { let i = 0; LEVELS.forEach(([, t], k) => { if (xp >= t) i = k; }); return { name: LEVELS[i][0], next: LEVELS[i + 1] ? LEVELS[i + 1][1] : null }; };
const TIPS = ['금리가 오르면 채권 가격은 내려가요. 이자를 더 주는 새 채권이 나오면 옛 채권의 매력이 줄기 때문이에요.', '명목금리에서 물가상승률을 뺀 것이 실질금리예요. 이자율이 5%여도 물가가 5% 오르면 구매력은 제자리예요.', '복리의 힘은 시간이에요. 같은 금액이라도 일찍 시작할수록 크게 불어요.', '재무제표는 숫자 하나가 아니라 관계로 읽어요. 이익, 현금, 부채를 함께 보세요.'];

function homeTab(scr) {
  const s = store.s, lv = levelOf(s.xp); const prog = Math.min(100, Math.round((store.todayXp() / s.goal) * 100));
  const doneUnits = UNITS.filter(unitDone).length;
  scr.append(h('div', { class: 'stats' }, h('div', { class: 'chip' }, h('b', null, '🔥 ' + store.streakNow()), '연속 학습일'), h('div', { class: 'chip' }, h('b', null, '⭐ ' + s.xp), lv.name), h('div', { class: 'chip' }, h('b', null, '🏅 ' + doneUnits), `완료 / ${UNITS.length}`)));
  scr.append(h('div', { class: 'goal' }, h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 800 } }, h('span', null, '오늘의 목표'), h('span', null, `${Math.min(store.todayXp(), s.goal)} / ${s.goal} XP`)), h('div', { class: 'bar' }, h('i', { style: { width: prog + '%' } }))));
  scr.append(h('div', { class: 'mascot' }, h('div', { class: 'm' }, '🦊'), h('div', { class: 't' }, h('b', null, 'Mr. Fox · 오늘의 팁'), h('br'), TIPS[new Date().getDate() % TIPS.length])));
  const due = dueCount();
  if (due) scr.append(h('button', { class: 'btn teal', style: { marginBottom: '12px' }, onclick: () => go('lesson', { kind: 'review' }) }, `🔁 복습할 문제 ${due}개`));
  CHAPTERS.forEach((ch) => {
    const us = UNITS.filter((u) => u.id >= ch.from && u.id <= ch.to);
    scr.append(h('div', { class: 'sect', style: { background: ch.color } }, h('span', null, `${ch.icon} ${ch.name}`), h('small', null, ch.sub)));
    scr.append(h('div', { style: { fontSize: '13px', color: 'var(--sub)', margin: '6px 4px 0', lineHeight: 1.6 } }, ch.story));
    const path = h('div', { class: 'path' });
    us.forEach((u, i) => {
      const unlocked = isUnlocked(u); const st = store.unit(u.id).st; const n = st.filter((x) => x > 0).length;
      const off = [0, 40, 60, 40, 0][i % 5] * (Math.floor((u.id - 1) / 5) % 2 ? -1 : 1);
      const wrap = h('div', { style: { transform: `translateX(${off}px)`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' } });
      const node = h('button', { class: 'node' + (unitDone(u) ? ' done' : unlocked ? '' : ' lock'), 'data-unit': u.id, onclick: () => { if (!unlocked) { toast('앞 유닛의 실습까지 끝내면 열려요'); return; } go('unit', { id: u.id }); } }, unlocked ? u.emoji : '🔒', h('span', { class: 'no' }, u.id), unitDone(u) ? h('span', { class: 'crown' }, '👑') : null);
      wrap.append(node, h('div', { class: 'nlabel' }, h('b', null, u.title), unlocked ? `${n}/3 단계 · ${LAB_ICON[u.lab.type]}` : '')); path.append(wrap);
    });
    const ok = chUnlocked(ch), stars = (s.cps || (s.cps = {}))[ch.id] || 0;
    path.append(h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' } }, h('button', { class: 'node cp' + (stars >= 2 ? ' done' : ok ? '' : ' lock'), onclick: () => { if (!ok) { toast('이 챕터의 마지막 유닛 실습까지 끝내면 열려요'); return; } go('lesson', { kind: 'cp', ch }); } }, ok ? '🎖️' : '🔒', stars ? h('span', { class: 'crown' }, '★'.repeat(stars)) : null), h('div', { class: 'nlabel' }, h('b', null, ch.name.split('·')[1].trim() + ' 종합 퀴즈'), '챕터 마무리')));
    scr.append(path);
  });
  scr.append(h('div', { class: 'card', style: { textAlign: 'center', color: 'var(--sub)', fontSize: '13px' } }, `${UNITS.length}개 유닛을 모두 마치면 금리·환율·물가 뉴스를 이해하고, 재무제표를 읽고, 내 돈의 계획을 세울 기본기가 생겨요. 💰`));
}

function unitScreen(a, id) {
  const u = UNITS.find((x) => x.id === id); const ch = CHAPTERS.find((c) => id >= c.from && id <= c.to); const us = store.unit(id);
  const scr = h('div', { class: 'scr nonav' });
  scr.append(h('div', { class: 'hd' }, h('button', { class: 'back', onclick: () => go('tabs') }, '←'), h('h2', null, `Unit ${u.id} · ${u.title}`)));
  scr.append(h('div', { class: 'scene' }, h('div', { class: 'pl' }, `${ch.icon} ${ch.name}`), h('div', { class: 'tx' }, u.scene)));
  const stages = [['개념 카드', '📘', '핵심 개념과 예시 코드'], ['퀴즈', '❓', '개념 확인 문제'], [`실습 (${{ calc: '계산 시뮬레이터', case: '사례 판단' }[u.lab.type]})`, LAB_ICON[u.lab.type], u.lab.title]];
  stages.forEach(([name, ic, desc], i) => {
    const prevOk = i === 0 || us.st[i - 1] > 0 || store.s.settings.open; const stars = us.st[i];
    scr.append(h('button', { class: 'stage' + (stars ? ' done' : '') + (prevOk ? '' : ' lock'), 'data-stage': i, onclick: () => { if (!prevOk) { toast('앞 단계를 먼저 끝내 주세요'); return; } if (i === 2) go('lab', { id }); else go('lesson', { kind: 'unit', id, stage: i }); } }, h('div', { class: 'ic' }, ic), h('div', { class: 'tx' }, h('b', null, name), desc), h('div', { class: 'stars', style: { color: stars ? '#e8a410' : '#bbb' } }, starStr(stars))));
  });
  scr.append(h('button', { class: 'btn', style: { marginTop: '6px' }, onclick: () => go('lesson', { kind: 'unit', id, stage: 0 }) }, '📘 개념 카드 다시 보기'));
  a.append(scr);
}

function lessonScreen(a, r) {
  const wrap = h('div', { style: { display: 'flex', flexDirection: 'column', height: '100%' } }); a.append(wrap);
  let questions, title, onDone;
  if (r.kind === 'unit') {
    const u = UNITS.find((x) => x.id === r.id); questions = r.stage === 0 ? cardQs(u) : quizQs(u); title = u.title;
    onDone = (res) => { const us = store.unit(r.id); const stars = r.stage === 0 ? 3 : res.stars; us.st[r.stage] = Math.max(us.st[r.stage], stars); store.save(); go('result', { res: { ...res, stars }, back: { name: 'unit', id: r.id }, title, nextStage: r.stage + 1, id: r.id, card: r.stage === 0 }); };
  } else if (r.kind === 'cp') {
    questions = chapterQuiz(r.ch, 10); title = r.ch.name;
    onDone = (res) => { const c = store.s.cps || (store.s.cps = {}); c[r.ch.id] = Math.max(c[r.ch.id] || 0, res.stars); store.save(); go('result', { res, back: { name: 'tabs' }, title, badge: res.stars >= 2 ? r.ch : null }); };
  } else { questions = reviewQs(10); title = '복습'; onDone = (res) => go('result', { res, back: { name: 'tabs' }, title }); }
  if (!questions.length) { toast('아직 복습할 문제가 없어요. 먼저 유닛 퀴즈를 풀어 보세요!'); setTab(tab); return; }
  runQuiz(wrap, { questions, xpBase: r.kind === 'review' ? 8 : r.stage === 0 ? 6 : 12, onExit: () => go(r.kind === 'unit' ? 'unit' : 'tabs', { id: r.id }), onFinish: onDone });
}

function labScreen(a, r) {
  const u = UNITS.find((x) => x.id === r.id); const wrap = h('div', { style: { display: 'flex', flexDirection: 'column', height: '100%' } }); a.append(wrap);
  const fin = (res) => { const us = store.unit(r.id); us.st[2] = Math.max(us.st[2], res.stars); store.save(); const xp = 15 + res.stars * 10; store.addXp(xp); go('result', { res: { stars: res.stars, xp, acc: 1 }, back: { name: 'unit', id: r.id }, title: u.lab.title, id: r.id, lab: true }); };
  const common = { lab: u.lab, onExit: () => go('unit', { id: r.id }), onFinish: fin };
  ({ calc: runCalcLab, case: runCaseLab })[u.lab.type](wrap, common);
}

function resultScreen(a, r) {
  const { res } = r; const scr = h('div', { class: 'scr nonav' });
  const msg = res.stars === 3 ? ['완벽해요!', '🎉'] : res.stars === 2 ? ['잘했어요!', '😊'] : ['끝까지 해냈어요! 다시 하면 별이 늘어요', '💪'];
  const extra = r.badge ? `🎖️ ${r.badge.name} 종합 퀴즈를 통과했어요!` : r.lab ? '실습을 마쳤어요. 다음 유닛이 열렸어요!' : '';
  scr.append(h('div', { class: 'result' }, h('div', { class: 'big' }, msg[1]), h('h2', { style: { margin: '8px 0' } }, msg[0]), h('div', { class: 'stars', style: { fontSize: '40px', color: '#e8a410' } }, starStr(res.stars)), extra ? h('div', { style: { marginTop: '8px', fontWeight: 800 } }, extra) : null,
    h('div', { class: 'xp' }, h('div', null, h('b', null, '+' + res.xp), 'XP'), h('div', null, h('b', null, Math.round((res.acc || 1) * 100) + '%'), r.lab ? '완성' : '정확도'), h('div', null, h('b', null, '🔥' + store.streakNow()), '연속'))));
  if (r.nextStage != null && r.nextStage <= 2 && r.back.name === 'unit') scr.append(h('button', { class: 'btn pri', style: { marginBottom: '10px' }, onclick: () => (r.nextStage === 2 ? go('lab', { id: r.id }) : go('lesson', { kind: 'unit', id: r.id, stage: r.nextStage })) }, r.nextStage === 2 ? '다음: 실습하러 가기' : '다음: 퀴즈 풀기'));
  scr.append(h('button', { class: 'btn', onclick: () => go(r.back.name === 'unit' ? 'unit' : 'tabs', r.back) }, r.back.name === 'unit' ? '유닛으로 돌아가기' : '홈으로'));
  a.append(scr);
}

function reviewTab(scr) {
  const due = dueCount(), learned = learnedKeys().length;
  scr.append(h('div', { class: 'hd' }, h('h2', null, '복습')));
  scr.append(h('div', { class: 'card' }, h('h3', null, '간격 반복 복습'), h('div', { style: { fontSize: '14px', color: 'var(--sub)', lineHeight: 1.6 } }, '푼 퀴즈를 잊을 때쯤 다시 보여 줘요. 틀린 문제는 더 자주 나와요.'), h('div', { class: 'row', style: { margin: '12px 0' } }, h('div', { class: 'chip' }, h('b', null, due), '지금 복습할 것'), h('div', { class: 'chip' }, h('b', null, learned), '푼 문제'))));
  scr.append(h('button', { class: 'btn pri', onclick: () => { if (!hasLearned()) { toast('먼저 유닛 1의 퀴즈를 풀어 보세요'); return; } go('lesson', { kind: 'review' }); } }, due ? `복습 시작 (${Math.min(due, 10)}문제)` : '약한 문제 연습하기'));
}

function calcTab(scr) {
  scr.append(h('div', { class: 'hd' }, h('h2', null, '계산기')));
  scr.append(h('div', { class: 'disc' }, '학습용 계산기예요. 결과는 단순한 가정에 따른 계산이며 실제 상품의 이자·세금·수수료와 다를 수 있어요.'));
  CALCS.forEach((c, i) => scr.append(h('button', { class: 'stage', 'data-calc': i, onclick: () => go('calc', { id: i }) }, h('div', { class: 'ic' }, c.icon), h('div', { class: 'tx' }, h('b', null, c.title), c.desc))));
}
function calcScreen(a, id) {
  const wrap = h('div', { style: { display: 'flex', flexDirection: 'column', height: '100%' } }); a.append(wrap);
  runCalcLab(wrap, { lab: CALCS[id], onExit: () => setTab('calc'), onFinish: () => {}, free: true });
}

function glossTab(scr) {
  scr.append(h('div', { class: 'hd' }, h('h2', null, '용어집')));
  const inp = h('input', { class: 'search', placeholder: '용어·함수·단계 검색 (예: 피벗, JOIN, 막대)', type: 'search' }); const list = h('div');
  const rows = []; GLOSS.forEach((sec) => sec.items.forEach(([t, d, c]) => rows.push({ sec: sec.title, t, d, c })));
    const draw = () => { const q = inp.value.trim().toLowerCase(); list.innerHTML = ''; const rs = rows.filter((r) => !q || r.t.toLowerCase().includes(q) || r.d.toLowerCase().includes(q) || r.sec.toLowerCase().includes(q)); let last = ''; rs.slice(0, 120).forEach((r) => { if (r.sec !== last) { list.append(h('div', { class: 'opcat', style: { margin: '14px 4px 6px' } }, r.sec)); last = r.sec; } list.append(h('div', { class: 'card gl' }, h('b', null, r.t), h('div', { class: 'small', style: { margin: '3px 0' } }, r.d), r.c ? h('pre', { class: 'code' }, r.c) : null)); }); if (!rs.length) list.append(h('div', { class: 'card', style: { color: 'var(--sub)' } }, '검색 결과가 없어요.')); };
  inp.addEventListener('input', draw); scr.append(inp, list); draw();
}

function moreTab(scr) {
  const s = store.s, lv = levelOf(s.xp);
  scr.append(h('div', { class: 'hd' }, h('h2', null, '더보기')));
  scr.append(h('div', { class: 'card' }, h('h3', null, `Level: ${lv.name}`), h('div', { style: { fontSize: '14px', color: 'var(--sub)' } }, `총 ${s.xp} XP` + (lv.next ? ` · 다음 레벨까지 ${lv.next - s.xp} XP` : ' · 최고 레벨!'))));
  scr.append(h('div', { class: 'card' }, h('h3', null, '학습 설정'),
    h('div', { class: 'switch' }, h('span', null, '하루 목표'), (() => { const sel = h('select', { onchange: () => { s.goal = +sel.value; store.save(); } }, [30, 60, 100, 150].map((n) => h('option', { value: n, selected: s.goal === n }, n + ' XP'))); return sel; })()),
    h('label', { class: 'switch' }, h('span', null, '모든 유닛 열어 두기'), h('input', { type: 'checkbox', checked: s.settings.open, onchange: (e) => { s.settings.open = e.target.checked; store.save(); } })),
    h('div', { class: 'switch' }, h('span', null, '화면 색'), (() => { const sel = h('select', { onchange: () => { s.settings.theme = sel.value; store.save(); render(); } }, [['', '자동'], ['light', '밝게'], ['dark', '어둡게']].map(([v, t]) => h('option', { value: v, selected: s.settings.theme === v }, t))); return sel; })())));
  scr.append(h('div', { class: 'card' }, h('h3', null, '내 기록'), h('div', { style: { fontSize: '14px', lineHeight: 1.8 } }, `총 XP ${s.xp} · 최고 연속 ${s.best}일 · 완료 유닛 ${UNITS.filter(unitDone).length}/${UNITS.length} · 푼 문제 ${learnedKeys().length}`)));
  scr.append(h('div', { class: 'card small', style: { lineHeight: 1.7, color: 'var(--sub)' } }, '⚠️ 이 앱은 교육용이에요. 특정 상품·종목의 매수·매도를 권유하지 않으며, 개인의 상황에 맞는 투자·세무·법률 자문이 아니에요. 제도와 수치(금리, 세율 등)는 바뀔 수 있으니 중요한 결정 전에는 공식 자료와 전문가를 확인하세요.'));
  scr.append(h('button', { class: 'btn bad', onclick: () => { if (confirm('모든 진도를 지울까요? 되돌릴 수 없어요.')) { store.reset(); render(); toast('초기화했어요'); } } }, '진도 초기화'));
}
