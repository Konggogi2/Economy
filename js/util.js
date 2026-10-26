export const $ = (s, r = document) => r.querySelector(s);

export function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    e.append(k.nodeType ? k : document.createTextNode(String(k)));
  }
  return e;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(arr, rnd = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const pick = (arr, rnd = Math.random) => arr[Math.floor(rnd() * arr.length)];

// 영어 받아쓰기 비교용: 소문자, 따옴표·문장부호 제거, 공백 정리
export function normEn(s) {
  return String(s ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[‘’´`]/g, "'")
    .replace(/'/g, '')
    .replace(/[.,:;!?“”"()\[\]{}¿¡…—–-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
export function lev(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}

export function toast(msg, ms = 1800) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('on'), ms);
}

export function confetti(n = 46) {
  const cols = ['#f6b73c', '#ef6a5b', '#0f8b8d', '#4caf6b', '#7a62d6', '#3d7be0'];
  for (let i = 0; i < n; i++) {
    const c = h('div', { class: 'confetti', style: { left: Math.random() * 100 + 'vw', background: cols[i % cols.length], animationDuration: 1.6 + Math.random() * 1.6 + 's', animationDelay: Math.random() * 0.4 + 's', transform: `rotate(${Math.random() * 360}deg)` } });
    document.body.append(c);
    setTimeout(() => c.remove(), 3800);
  }
}

export const dayKey = (t = Date.now()) => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
