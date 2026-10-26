// 차트 엔진: 표 + 설정 → 집계된 데이터, SVG 문자열, 채점. DOM에 의존하지 않는다.
import { isBlank } from './pq.js';

export const CHART_TYPES = [['column', '세로 막대'], ['bar', '가로 막대'], ['line', '선'], ['pie', '원'], ['donut', '도넛'], ['scatter', '산점도'], ['hist', '히스토그램'], ['stacked', '누적 막대']];
export const CT = Object.fromEntries(CHART_TYPES);
export const AGGS = [['sum', '합계'], ['avg', '평균'], ['count', '개수'], ['none', '그대로(집계 안 함)']];
const PAL = ['#2f5bd7', '#ef6a5b', '#ffb938', '#4caf6b', '#7a62d6', '#1a9a8a', '#c0527a', '#8a8f9c'];
const num = (v) => (typeof v === 'number' ? v : isBlank(v) ? null : (isNaN(Number(v)) ? null : Number(v)));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

export function colKind(t, c) { const i = t.cols.indexOf(c); if (i < 0) return null; if (t.types[i] === 'date') return 'date'; if (t.types[i] === 'number') return 'number'; return t.rows.every((r) => isBlank(r[i]) || num(r[i]) !== null) ? 'number' : 'text'; }

function agg(fn, vals) {
  const v = vals.map(num).filter((x) => x !== null);
  if (fn === 'count') return vals.length;
  if (!v.length) return 0;
  if (fn === 'avg') return Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 100) / 100;
  return Math.round(v.reduce((a, b) => a + b, 0) * 100) / 100;
}

// 설정 점검: 이 데이터에 이 차트가 문법적으로 가능한지
export function checkSpec(t, s) {
  const issues = [];
  if (!s.type) return ['차트 종류를 고르세요'];
  if (!s.x) issues.push('X(분류) 열을 고르세요');
  if (s.type !== 'hist' && !s.y) issues.push('Y(값) 열을 고르세요');
  if (issues.length) return issues;
  const kx = colKind(t, s.x), ky = s.y ? colKind(t, s.y) : null;
  if (s.type === 'hist' && kx !== 'number') issues.push('히스토그램의 X는 숫자 열이어야 해요');
  if (['column', 'bar', 'line', 'pie', 'donut', 'stacked'].includes(s.type) && ky !== 'number') issues.push('Y(값)는 숫자 열이어야 해요');
  if (s.type === 'scatter' && (kx !== 'number' || ky !== 'number')) issues.push('산점도는 X와 Y가 모두 숫자 열이어야 해요');
  if (s.type === 'line' && kx === 'text') issues.push('선 차트의 X는 날짜나 순서가 있는 값이어야 해요');
  if (s.type === 'stacked' && !s.color) issues.push('누적 막대는 "색(구분)" 열이 필요해요');
  return issues;
}

export function prepare(t, s) {
  const xi = t.cols.indexOf(s.x), yi = s.y ? t.cols.indexOf(s.y) : -1, ci = s.color ? t.cols.indexOf(s.color) : -1;
  if (s.type === 'scatter') return { kind: 'scatter', pts: t.rows.map((r) => ({ x: num(r[xi]), y: num(r[yi]) })).filter((p) => p.x !== null && p.y !== null) };
  if (s.type === 'hist') {
    const v = t.rows.map((r) => num(r[xi])).filter((x) => x !== null); const bins = Math.max(2, parseInt(s.bins, 10) || 5);
    const lo = Math.min(...v), hi = Math.max(...v), w = (hi - lo) / bins || 1; const cnt = Array(bins).fill(0);
    v.forEach((x) => { cnt[Math.min(bins - 1, Math.floor((x - lo) / w))]++; });
    return { kind: 'hist', bars: cnt.map((c, i) => ({ x: `${Math.round((lo + i * w) * 10) / 10}~`, y: c })) };
  }
  const cats = []; const map = new Map();
  t.rows.forEach((r) => { const k = isBlank(r[xi]) ? '(비어 있음)' : String(r[xi]); if (!map.has(k)) { map.set(k, []); cats.push(k); } map.get(k).push(r); });
  let order = cats.slice();
  if (s.type === 'line' || kxDate(t, s.x)) order.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const fn = s.agg === 'none' ? 'sum' : (s.agg || 'sum');
  if (ci >= 0 && ['stacked', 'line', 'column'].includes(s.type)) {
    const groups = [...new Set(t.rows.map((r) => String(r[ci])))];
    return { kind: s.type === 'line' ? 'multiline' : 'stacked', cats: order, series: groups.map((g) => ({ name: g, vals: order.map((c) => agg(fn, map.get(c).filter((r) => String(r[ci]) === g).map((r) => r[yi]))) })) };
  }
  let bars = order.map((c) => ({ x: c, y: agg(fn, map.get(c).map((r) => r[yi])) }));
  if (s.sort === 'desc') bars.sort((a, b) => b.y - a.y); else if (s.sort === 'asc') bars.sort((a, b) => a.y - b.y);
  const top = parseInt(s.top, 10); if (top > 0 && bars.length > top) { const rest = bars.slice(top); bars = bars.slice(0, top); if (s.other && ['pie', 'donut'].includes(s.type)) bars.push({ x: '기타', y: rest.reduce((a, b) => a + b.y, 0) }); }
  return { kind: s.type === 'bar' ? 'bar' : s.type === 'line' ? 'line' : s.type === 'pie' || s.type === 'donut' ? s.type : 'column', bars };
}
const kxDate = (t, c) => colKind(t, c) === 'date';

function nice(max) { if (max <= 0) return [0, 1, 1]; const p = Math.pow(10, Math.floor(Math.log10(max))); const f = max / p; const step = (f <= 1 ? 0.2 : f <= 2 ? 0.5 : f <= 5 ? 1 : 2) * p; const top = Math.ceil(max / step) * step; return [0, top, step]; }
const fmtN = (v) => (Math.abs(v) >= 10000 ? Math.round(v / 1000) / 10 + '만' : String(Math.round(v * 100) / 100));

export function renderSVG(d, s) {
  const W = 320, H = 210, L = 38, R = 10, T = 14, B = 34; let g = '';
  const base = s.zero === false ? 'cut' : 'zero';
  const axisY = (min, max, step) => { let o = ''; for (let v = min; v <= max + 1e-9; v += step) { const y = T + (H - T - B) * (1 - (v - min) / (max - min || 1)); o += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" stroke="#d9dff0" stroke-width="1"/><text x="${L - 4}" y="${y + 3}" font-size="9" text-anchor="end" fill="#666b85">${fmtN(v)}</text>`; } return o; };
  const title = s.title ? `<text x="${W / 2}" y="10" font-size="11" font-weight="700" text-anchor="middle" fill="currentColor">${esc(s.title)}</text>` : '';
  if (d.kind === 'pie' || d.kind === 'donut') {
    const total = d.bars.reduce((a, b) => a + Math.max(0, b.y), 0) || 1; let a0 = -Math.PI / 2; const cx = 100, cy = 112, r = 74;
    d.bars.forEach((b, i) => { const a1 = a0 + (Math.max(0, b.y) / total) * Math.PI * 2; const large = a1 - a0 > Math.PI ? 1 : 0; const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0), x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1); g += `<path d="M${cx},${cy} L${x0},${y0} A${r},${r} 0 ${large} 1 ${x1},${y1} Z" fill="${PAL[i % PAL.length]}" stroke="#fff" stroke-width="1.5"/>`; a0 = a1; });
    if (d.kind === 'donut') g += `<circle cx="${cx}" cy="${cy}" r="${r * 0.55}" fill="var(--card,#fff)"/>`;
    d.bars.forEach((b, i) => { g += `<rect x="190" y="${36 + i * 17}" width="9" height="9" fill="${PAL[i % PAL.length]}"/><text x="203" y="${45 + i * 17}" font-size="10" fill="currentColor">${esc(b.x).slice(0, 8)} ${Math.round((Math.max(0, b.y) / total) * 100)}%</text>`; });
    return `<svg viewBox="0 0 ${W} ${H}" class="chart">${title}${g}</svg>`;
  }
  if (d.kind === 'scatter') {
    const xs = d.pts.map((p) => p.x), ys = d.pts.map((p) => p.y); const [x0, x1] = [Math.min(...xs), Math.max(...xs)], [y0, y1] = [Math.min(...ys), Math.max(...ys)];
    g += axisY(y0, y1, (y1 - y0) / 4 || 1);
    d.pts.forEach((p) => { const X = L + (W - L - R) * ((p.x - x0) / (x1 - x0 || 1)), Y = T + (H - T - B) * (1 - (p.y - y0) / (y1 - y0 || 1)); g += `<circle cx="${X}" cy="${Y}" r="3.5" fill="${PAL[0]}" fill-opacity=".75"/>`; });
    g += `<text x="${W / 2}" y="${H - 8}" font-size="10" text-anchor="middle" fill="#666b85">${esc(s.x)} (${fmtN(x0)}~${fmtN(x1)})</text>`;
    return `<svg viewBox="0 0 ${W} ${H}" class="chart">${title}${g}</svg>`;
  }
  if (d.kind === 'stacked' || d.kind === 'multiline') {
    const tot = d.cats.map((_, i) => d.series.reduce((a, s2) => a + s2.vals[i], 0)); const max = d.kind === 'stacked' ? Math.max(...tot) : Math.max(...d.series.flatMap((s2) => s2.vals)); const [mn, mx, st] = nice(max); g += axisY(0, mx, st);
    const bw = (W - L - R) / d.cats.length;
    if (d.kind === 'stacked') d.cats.forEach((c, i) => { let acc = 0; d.series.forEach((s2, k) => { const h = (H - T - B) * (s2.vals[i] / mx); const y = T + (H - T - B) - (H - T - B) * (acc / mx) - h; g += `<rect x="${L + i * bw + bw * 0.18}" y="${y}" width="${bw * 0.64}" height="${h}" fill="${PAL[k % PAL.length]}"/>`; acc += s2.vals[i]; }); g += `<text x="${L + i * bw + bw / 2}" y="${H - 20}" font-size="9" text-anchor="middle" fill="#666b85">${esc(c).slice(0, 5)}</text>`; });
    else { d.series.forEach((s2, k) => { const pts = s2.vals.map((v, i) => `${L + i * bw + bw / 2},${T + (H - T - B) * (1 - v / mx)}`).join(' '); g += `<polyline points="${pts}" fill="none" stroke="${PAL[k % PAL.length]}" stroke-width="2"/>`; }); d.cats.forEach((c, i) => { g += `<text x="${L + i * bw + bw / 2}" y="${H - 20}" font-size="9" text-anchor="middle" fill="#666b85">${esc(c).slice(0, 5)}</text>`; }); }
    d.series.forEach((s2, k) => { g += `<rect x="${L + k * 62}" y="${H - 11}" width="8" height="8" fill="${PAL[k % PAL.length]}"/><text x="${L + k * 62 + 11}" y="${H - 4}" font-size="9" fill="currentColor">${esc(s2.name).slice(0, 6)}</text>`; });
    return `<svg viewBox="0 0 ${W} ${H}" class="chart">${title}${g}</svg>`;
  }
  const bars = d.bars; const vals = bars.map((b) => b.y); const maxV = Math.max(...vals, 0), minV = Math.min(...vals, 0);
  let lo = 0, hi; let st;
  if (s.zero === false && minV >= 0 && vals.length) { const mnv = Math.min(...vals); lo = Math.floor(mnv * 0.9 / Math.pow(10, Math.max(0, Math.floor(Math.log10(mnv || 1)) - 1))) * Math.pow(10, Math.max(0, Math.floor(Math.log10(mnv || 1)) - 1)); hi = maxV * 1.03; st = (hi - lo) / 4; }
  else { [lo, hi, st] = nice(maxV); }
  if (d.kind === 'bar') {
    const bh = (H - T - 12) / bars.length; bars.forEach((b, i) => { const w = (W - 90 - R) * ((b.y - lo) / (hi - lo || 1)); g += `<rect x="80" y="${T + i * bh + bh * 0.15}" width="${Math.max(0, w)}" height="${bh * 0.7}" fill="${PAL[0]}"/><text x="76" y="${T + i * bh + bh * 0.6}" font-size="10" text-anchor="end" fill="currentColor">${esc(b.x).slice(0, 8)}</text>${s.labels ? `<text x="${84 + w}" y="${T + i * bh + bh * 0.6}" font-size="9" fill="#666b85">${fmtN(b.y)}</text>` : ''}`; });
    return `<svg viewBox="0 0 ${W} ${H}" class="chart">${title}${g}</svg>`;
  }
  g += axisY(lo, hi, st); const bw = (W - L - R) / bars.length;
  if (d.kind === 'line') { const pts = bars.map((b, i) => `${L + i * bw + bw / 2},${T + (H - T - B) * (1 - (b.y - lo) / (hi - lo || 1))}`); g += `<polyline points="${pts.join(' ')}" fill="none" stroke="${PAL[0]}" stroke-width="2.2"/>`; bars.forEach((b, i) => { const [px, py] = pts[i].split(','); g += `<circle cx="${px}" cy="${py}" r="3" fill="${PAL[0]}"/>${s.labels ? `<text x="${px}" y="${py - 6}" font-size="9" text-anchor="middle" fill="#666b85">${fmtN(b.y)}</text>` : ''}`; }); }
  else bars.forEach((b, i) => { const h = (H - T - B) * ((b.y - lo) / (hi - lo || 1)); g += `<rect x="${L + i * bw + bw * 0.15}" y="${T + (H - T - B) - h}" width="${bw * 0.7}" height="${Math.max(0, h)}" fill="${d.kind === 'hist' ? PAL[3] : PAL[0]}"/>${s.labels ? `<text x="${L + i * bw + bw / 2}" y="${T + (H - T - B) - h - 3}" font-size="9" text-anchor="middle" fill="#666b85">${fmtN(b.y)}</text>` : ''}`; });
  const every = Math.max(1, Math.ceil(bars.length / 8)); bars.forEach((b, i) => { if (i % every === 0 || i === bars.length - 1) g += `<text x="${L + i * bw + bw / 2}" y="${H - 20}" font-size="9" text-anchor="middle" fill="#666b85">${esc(b.x).slice(0, 6)}</text>`; });
  if (s.zero === false) g += `<text x="${L}" y="${H - 6}" font-size="9" fill="#ef6a5b">⚠ 축이 0에서 시작하지 않아요</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" class="chart">${title}${g}</svg>`;
}

// 채점: rubric = { accept: [종류], best: 종류, x, y, agg, must: { sort, top, zero, labels } }
export function gradeChart(spec, rubric, t) {
  const notes = []; let ok = true; let stars = 3;
  const issues = checkSpec(t, spec); if (issues.length) return { ok: false, stars: 0, notes: issues };
  if (!rubric.accept.includes(spec.type)) { return { ok: false, stars: 0, notes: [rubric.whyNot && rubric.whyNot[spec.type] ? rubric.whyNot[spec.type] : `이 목적에는 '${CT[spec.type]}'보다 적합한 차트가 있어요.`] }; }
  if (spec.type !== rubric.best) { stars = Math.min(stars, 2); notes.push(rubric.alt || `'${CT[spec.type]}'도 가능하지만 '${CT[rubric.best]}'가 더 잘 전달돼요.`); }
  if (rubric.x && spec.x !== rubric.x) { ok = false; notes.push(`X(분류)는 '${rubric.x}' 열이 적절해요.`); }
  if (rubric.y && spec.type !== 'hist' && spec.y !== rubric.y) { ok = false; notes.push(`Y(값)는 '${rubric.y}' 열이 적절해요.`); }
  if (rubric.agg && !['scatter', 'hist'].includes(spec.type) && spec.agg !== rubric.agg) { ok = false; notes.push(`집계는 '${AGGS.find((a) => a[0] === rubric.agg)[1]}'가 알맞아요.`); }
  const m = rubric.must || {};
  if (m.sort && spec.sort !== m.sort) { stars = Math.min(stars, 2); notes.push(m.sort === 'desc' ? '순위를 보여 줄 때는 큰 값부터 정렬하면 읽기 쉬워요.' : '정렬을 확인해 보세요.'); }
  if (m.top && !(parseInt(spec.top, 10) > 0 && parseInt(spec.top, 10) <= m.top)) { stars = Math.min(stars, 2); notes.push(`항목이 많아요. 상위 ${m.top}개만 보여 주면 핵심이 보여요.`); }
  if (m.zero && spec.zero === false) { ok = false; notes.push('막대 차트는 축이 0에서 시작해야 길이 비교가 정직해요.'); }
  if (m.labels && !spec.labels) { stars = Math.min(stars, 2); notes.push('값 레이블을 켜면 정확한 숫자를 바로 읽을 수 있어요.'); }
  if (m.color && !spec.color) { ok = false; notes.push('구성(색 구분) 열이 필요해요.'); }
  return { ok, stars: ok ? stars : 0, notes };
}
