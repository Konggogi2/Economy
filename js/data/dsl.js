// 콘텐츠 작성용 도우미
import { mk } from '../pq.js';
export { mk };
const TY = { t: 'text', n: 'number', d: 'date', a: 'any' };
// T('날짜:d,지점:t,매출:n', [[...]]) — 열 이름:형식(t 텍스트, n 숫자, d 날짜, a 미지정)
export const T = (spec, rows) => { const parts = spec.split(',').map((s) => s.trim().split(':')); return mk(parts.map((p) => p[0]), rows, parts.map((p) => TY[p[1] || 'a'])); };
export const mc = (prompt, ok, wrongs, why, extra = {}) => ({ t: 'mc', prompt, ok, wrongs, why, ...extra });
export const ord = (prompt, steps, why) => ({ t: 'order', prompt, steps, why });
export const srt = (prompt, cats, items, why) => ({ t: 'sort', prompt, cats, items, why });
export const mat = (pairs, prompt) => ({ t: 'match', pairs, prompt });
export const st = (op, p = {}) => ({ op, p });
export const card = (title, body, extra = {}) => ({ title, body, ...extra });
export const pqLab = (o) => ({ type: 'pq', main: o.main || Object.keys(o.sources)[0], ...o });
export const sqlLab = (o) => ({ type: 'sql', ...o });
export const chartLab = (o) => ({ type: 'chart', ...o });
export const fixLab = (o) => ({ type: 'fix', ...o });
export const caseLab = (o) => ({ type: 'case', ...o });
export const U = (o) => o;
// 계산 실습 과제 도우미
export const ans = (prompt, params, answer, o = {}) => ({ kind: 'answer', prompt, params, answer, ...o });
export const tgt = (prompt, start, ok, solution, o = {}) => ({ kind: 'target', prompt, start, ok, solution, ...o });
