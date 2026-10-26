// 진도 저장 (localStorage). 접근 불가해도 앱은 동작한다.
import { dayKey } from './util.js';

const KEY = 'moneylab-save-v1';
const blank = () => ({
  xp: 0, streak: 0, best: 0, lastDay: '', today: { day: '', xp: 0 }, goal: 60,
  units: {},   // { [id]: { st: [개념, 퀴즈, 실습] 별 개수, labSteps } }
  cps: {},     // 챕터 종합 퀴즈 별
  srs: {},     // { key: { box, due, seen } }
  settings: { open: false, theme: '' },
});
let mem = null;
function read() { try { const t = localStorage.getItem(KEY); if (t) return JSON.parse(t); } catch (e) { /* */ } return null; }
const base = blank(); const loaded = read();
mem = loaded ? { ...base, ...loaded, settings: { ...base.settings, ...(loaded.settings || {}) } } : base;

export const store = {
  get s() { return mem; },
  save() { try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) { /* */ } },
  reset() { mem = blank(); this.save(); },
  unit(id) { const u = mem.units[id] || (mem.units[id] = { st: [0, 0, 0] }); while (u.st.length < 3) u.st.push(0); return u; },
  addXp(n) {
    const d = dayKey(); if (mem.today.day !== d) mem.today = { day: d, xp: 0 };
    mem.today.xp += n; mem.xp += n;
    if (mem.lastDay !== d) { const y = dayKey(Date.now() - 86400000); mem.streak = mem.lastDay === y ? mem.streak + 1 : 1; mem.lastDay = d; mem.best = Math.max(mem.best, mem.streak); }
    this.save();
  },
  todayXp() { return mem.today.day === dayKey() ? mem.today.xp : 0; },
  streakNow() { const d = dayKey(), y = dayKey(Date.now() - 86400000); return mem.lastDay === d || mem.lastDay === y ? mem.streak : 0; },
};
const DAYS = [0, 1, 2, 4, 8, 16];
export function srsMark(key, ok) { const e = mem.srs[key] || (mem.srs[key] = { box: 0, due: 0, seen: 0 }); e.seen++; e.box = ok ? Math.min(5, e.box + 1) : Math.max(0, e.box - 2); e.due = Date.now() + DAYS[e.box] * 86400000; }
export const srsDue = (key) => { const e = mem.srs[key]; return !!e && e.due <= Date.now(); };
