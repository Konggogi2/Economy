// 금융 계산 모음: 순수 함수. DOM에 의존하지 않는다. 금리 등은 소수(5% = 0.05)로 다룬다.
export const round = (x, d = 0) => { const p = Math.pow(10, d); return Math.round((x + Number.EPSILON) * p) / p; };
export const fv = (pv, r, n) => pv * Math.pow(1 + r, n);                   // 복리 미래가치
export const fvSimple = (pv, r, n) => pv * (1 + r * n);                    // 단리
export const pv = (fvv, r, n) => fvv / Math.pow(1 + r, n);                // 현재가치
export const fvAnnuity = (pmt, r, n) => (r === 0 ? pmt * n : pmt * ((Math.pow(1 + r, n) - 1) / r)); // 매기 말 납입
export const pvAnnuity = (pmt, r, n) => (r === 0 ? pmt * n : pmt * ((1 - Math.pow(1 + r, -n)) / r));
export const pmtLoan = (P, r, n) => (r === 0 ? P / n : (P * r) / (1 - Math.pow(1 + r, -n))); // 원리금균등 1회 상환액(r, n은 같은 기간 단위)
export const apy = (apr, m) => Math.pow(1 + apr / m, m) - 1;               // 연 m회 복리 실효금리
export const realRate = (nominal, infl) => (1 + nominal) / (1 + infl) - 1; // 피셔(정확식)
export const realRateApprox = (nominal, infl) => nominal - infl;           // 근사식
export const rule72 = (r) => 72 / (r * 100);                                // 원금이 두 배가 되는 대략의 햇수
export const doublingYears = (r) => Math.log(2) / Math.log(1 + r);
export const cagr = (b, e, years) => Math.pow(e / b, 1 / years) - 1;
export const purchasingPower = (amount, infl, years) => amount / Math.pow(1 + infl, years);
export const inflationRate = (idx0, idx1) => idx1 / idx0 - 1;
export const realGrowth = (nominalGrowth, infl) => (1 + nominalGrowth) / (1 + infl) - 1;

export function bondPrice(face, couponRate, ytm, n, freq = 1) {
  const c = (face * couponRate) / freq, y = ytm / freq, N = n * freq; let p = 0;
  for (let t = 1; t <= N; t++) p += c / Math.pow(1 + y, t);
  return p + face / Math.pow(1 + y, N);
}
export const currentYield = (face, couponRate, price) => (face * couponRate) / price;

export const npv = (rate, flows) => flows.reduce((s, c, t) => s + c / Math.pow(1 + rate, t), 0);
export function irr(flows) {
  let lo = -0.99, hi = 10; const f = (r) => npv(r, flows);
  if (f(lo) * f(hi) > 0) return NaN;
  for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (f(lo) * f(mid) <= 0) hi = mid; else lo = mid; }
  return (lo + hi) / 2;
}
export function payback(flows) { let cum = 0; for (let t = 0; t < flows.length; t++) { const prev = cum; cum += flows[t]; if (cum >= 0 && t > 0) return t - 1 + (-prev) / flows[t]; } return NaN; }

// 대출 상환표: 행 = [회차, 상환액, 이자, 원금, 잔액]
export function amortEqualPayment(P, rAnnual, years, perYear = 12) {
  const n = years * perYear, r = rAnnual / perYear, pm = pmtLoan(P, r, n); let bal = P; const rows = [];
  for (let k = 1; k <= n; k++) { const i = bal * r, pr = pm - i; bal -= pr; rows.push([k, pm, i, pr, Math.max(0, bal)]); }
  return rows;
}
export function amortEqualPrincipal(P, rAnnual, years, perYear = 12) {
  const n = years * perYear, r = rAnnual / perYear, pr = P / n; let bal = P; const rows = [];
  for (let k = 1; k <= n; k++) { const i = bal * r; bal -= pr; rows.push([k, pr + i, i, pr, Math.max(0, bal)]); }
  return rows;
}
export const totalInterest = (rows) => rows.reduce((s, r) => s + r[2], 0);
export function amortBullet(P, rAnnual, years) { return P * rAnnual * years; } // 만기일시상환 총이자

// 환율: 원/달러처럼 "외화 1단위의 자국통화 가격"
export const convert = (amount, rate) => amount * rate;
export const crossRate = (aPerUsd, bPerUsd) => aPerUsd / bPerUsd;               // A/B 가격: B 1단위가 A 얼마
export const pctChange = (a, b) => b / a - 1;
export const forwardRate = (spot, rDom, rFor, t = 1) => (spot * (1 + rDom * t)) / (1 + rFor * t); // 이자율평가(단순)
export const pppRate = (priceDom, priceFor) => priceDom / priceFor;

// 재무 분석
export const margin = (profit, revenue) => profit / revenue;
export const roe = (ni, equity) => ni / equity;
export const roa = (ni, assets) => ni / assets;
export const debtRatio = (debt, equity) => debt / equity;
export const currentRatio = (ca, cl) => ca / cl;
export const interestCoverage = (ebit, interest) => ebit / interest;
export const per = (price, eps) => price / eps;
export const pbr = (price, bps) => price / bps;
export const dupontRoe = (nm, turnover, leverage) => nm * turnover * leverage;
export const breakEvenUnits = (fixed, price, vc) => fixed / (price - vc);
export const contributionMargin = (price, vc) => (price - vc) / price;
export const ev = (marketCap, debt, cash) => marketCap + debt - cash;
export const expectedValue = (outcomes) => outcomes.reduce((s, [p, v]) => s + p * v, 0);
export const wacc = (E, D, re, rd, tax) => (E / (E + D)) * re + (D / (E + D)) * rd * (1 - tax);
export const dcfValue = (flows, rate, terminalGrowth) => { // flows: 1기~N기 현금흐름
  const N = flows.length; let v = 0; flows.forEach((c, i) => { v += c / Math.pow(1 + rate, i + 1); });
  const tv = (flows[N - 1] * (1 + terminalGrowth)) / (rate - terminalGrowth); return v + tv / Math.pow(1 + rate, N);
};

// 통화·은행
export const moneyMultiplier = (reserveRatio) => 1 / reserveRatio;
export const taylor = (neutral, inflGap, outputGap, a = 0.5, b = 0.5) => neutral + a * inflGap + b * outputGap; // 단순 테일러(%p)

// 표기
export const krw = (x) => { const v = Math.round(x); const a = Math.abs(v); const s = a.toLocaleString('ko-KR'); return (v < 0 ? '-' : '') + s + '원'; };
export const krwShort = (x) => { const v = Math.abs(Math.round(x)); const sign = x < 0 ? '-' : ''; if (v >= 1e8) { const u = Math.floor(v / 1e8); const m = Math.round((v % 1e8) / 1e4); return sign + u + '억' + (m ? ' ' + m.toLocaleString('ko-KR') + '만원' : '원'); } if (v >= 1e4) return sign + Math.round(v / 1e4).toLocaleString('ko-KR') + '만원'; return sign + v.toLocaleString('ko-KR') + '원'; };
export const pct = (x, d = 2) => (x * 100).toFixed(d) + '%';
export const num = (x, d = 2) => (Math.round(x * Math.pow(10, d)) / Math.pow(10, d)).toLocaleString('ko-KR', { maximumFractionDigits: d });
