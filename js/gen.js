// 유닛 데이터에서 개념 카드·퀴즈 문제를 만든다.
import { UNITS, CHAPTERS } from './data/index.js';
import { shuffle } from './util.js';
import { store, srsDue } from './store.js';

function build(raw, key) {
  const q = { ...raw, key };
  if (raw.t === 'mc') { const opts = shuffle([raw.ok, ...raw.wrongs]); q.opts = opts; q.ans = opts.indexOf(raw.ok); }
  else if (raw.t === 'order') { q.correct = raw.steps.slice(); q.items = shuffle(raw.steps); let g = 0; while (q.items.every((x, i) => x === q.correct[i]) && g++ < 20) q.items = shuffle(raw.steps); }
  else if (raw.t === 'sort') { q.items = shuffle(raw.items); }
  return q;
}
export const cardQs = (u) => u.cards.map((c) => ({ t: 'card', ...c }));
export const quizQs = (u) => u.quiz.map((raw, i) => build(raw, `q:${u.id}:${i}`));
export const ALLQ = {}; UNITS.forEach((u) => u.quiz.forEach((raw, i) => { ALLQ[`q:${u.id}:${i}`] = { raw, unit: u.id }; }));

export function chapterQuiz(ch, n = 10) {
  const units = UNITS.filter((u) => u.id >= ch.from && u.id <= ch.to);
  const pool = units.flatMap((u) => u.quiz.map((raw, i) => ({ raw, key: `q:${u.id}:${i}` }))).filter((x) => x.raw.t !== 'match');
  return shuffle(pool).slice(0, n).map((x) => build(x.raw, x.key));
}
export const learnedKeys = () => Object.keys(store.s.srs).filter((k) => ALLQ[k]);
export const dueCount = () => learnedKeys().filter((k) => srsDue(k)).length;
export function reviewQs(n = 10) {
  const keys = learnedKeys(); const due = keys.filter((k) => srsDue(k)); const weak = keys.filter((k) => !due.includes(k)).sort((a, b) => store.s.srs[a].box - store.s.srs[b].box);
  return shuffle(due).concat(weak).slice(0, n).map((k) => build(ALLQ[k].raw, k));
}
export const hasLearned = () => learnedKeys().length >= 3;
export { UNITS, CHAPTERS };
