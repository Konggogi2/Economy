// 계산 실습의 틀(계산기) 공장. 유닛별로 제목·목표·과제만 바꿔 쓴다.
import * as F from '../fin.js';
import { mk } from '../pq.js';

const I = (k, label, min, max, step, value, fmt) => ({ k, label, min, max, step, value, fmt });
const O = (k, label, fn, fmt, big) => ({ k, label, fn, fmt, big });
const pad = (n) => String(n).padStart(2, '0');
const withSet = (inputs, set) => inputs.map((i) => (set && set[i.k] ? { ...i, ...set[i.k] } : i));
const make = (base, o) => ({ type: 'calc', title: o.title, badge: o.badge, goal: o.goal, after: o.after, note: o.note || base.note, toolTitle: base.toolTitle, tbl: o.tbl, tblTitle: o.tblTitle, inputs: withSet(base.inputs, o.set), outputs: base.outputs, chart: base.chart, tasks: o.tasks || [] });

// 단리·복리
const compound = { toolTitle: '이자 계산기',
  inputs: [I('P', '원금', 1e6, 1e8, 1e6, 1e7, 'won2'), I('r', '연 이율', 0, 0.15, 0.005, 0.05, 'pct1'), I('n', '기간', 1, 40, 1, 10, 'yrInt'), { k: 'm', label: '이자 방식', kind: 'select', options: [['c', '복리'], ['s', '단리']], value: 'c' }],
  outputs: [O('fv', '만기 금액', (v) => (v.m === 's' ? F.fvSimple(v.P, v.r, v.n) : F.fv(v.P, v.r, v.n)), 'won', true), O('gain', '이자 합계', (v, o) => o.fv - v.P, 'won'), O('mult', '원금의 몇 배', (v, o) => o.fv / v.P, 'x')],
  chart: { build: (v) => ({ table: mk(['연', '금액'], Array.from({ length: v.n + 1 }, (_, t) => [pad(t), Math.round(v.m === 's' ? F.fvSimple(v.P, v.r, t) : F.fv(v.P, v.r, t))]), ['text', 'number']), spec: { type: 'line', x: '연', y: '금액', agg: 'sum', title: '원금과 이자의 성장' } }) } };
export const compoundLab = (o) => make(compound, o);

// 현재가치
const presentValue = { toolTitle: '현재가치 계산기',
  inputs: [I('FV', '미래에 받을 금액', 1e6, 1e8, 1e6, 1e7, 'won2'), I('r', '할인율(연)', 0, 0.15, 0.005, 0.05, 'pct1'), I('n', '몇 년 뒤', 1, 30, 1, 10, 'yrInt')],
  outputs: [O('pv', '현재가치', (v) => F.pv(v.FV, v.r, v.n), 'won', true), O('disc', '깎인 금액', (v, o) => v.FV - o.pv, 'won'), O('ratio', '미래 금액 대비', (v, o) => o.pv / v.FV, 'ratio')] };
export const pvLab = (o) => make(presentValue, o);

// 매월 적립
const saving = { toolTitle: '적립 계산기',
  inputs: [I('M', '월 납입액', 1e5, 2e6, 1e5, 5e5, 'won2'), I('r', '연 수익률(가정)', 0, 0.12, 0.005, 0.04, 'pct1'), I('n', '기간', 1, 40, 1, 10, 'yrInt')],
  outputs: [O('fv', '만기 금액(월복리)', (v) => F.fvAnnuity(v.M, v.r / 12, v.n * 12), 'won', true), O('paid', '낸 원금 합계', (v) => v.M * 12 * v.n, 'won'), O('gain', '이자(수익) 합계', (v, o) => o.fv - o.paid, 'won')],
  chart: { build: (v) => ({ table: mk(['연', '금액'], Array.from({ length: v.n + 1 }, (_, t) => [pad(t), Math.round(F.fvAnnuity(v.M, v.r / 12, t * 12))]), ['text', 'number']), spec: { type: 'line', x: '연', y: '금액', agg: 'sum', title: '적립금의 성장' } }) } };
export const savingLab = (o) => make(saving, o);

// 대출
function sched(v) { return v.method === 'eqpr' ? F.amortEqualPrincipal(v.P, v.r, v.years) : v.method === 'bul' ? null : F.amortEqualPayment(v.P, v.r, v.years); }
const loan = { toolTitle: '대출 상환 계산기',
  inputs: [I('P', '대출 원금', 1e7, 1e9, 1e7, 3e8, 'won2'), I('r', '연 금리', 0.005, 0.12, 0.0025, 0.05, 'pct'), I('years', '기간', 1, 40, 1, 30, 'yrInt'), { k: 'method', label: '상환 방식', kind: 'select', options: [['eqp', '원리금균등'], ['eqpr', '원금균등'], ['bul', '만기일시']], value: 'eqp' }],
  outputs: [O('first', '첫 달 상환액', (v) => { const s = sched(v); return s ? s[0][1] : (v.P * v.r) / 12; }, 'won'), O('total', '총 이자', (v) => { const s = sched(v); return s ? F.totalInterest(s) : F.amortBullet(v.P, v.r, v.years); }, 'won', true), O('pay', '총 상환액', (v, o) => v.P + o.total, 'won')],
  chart: { build: (v) => { const s = sched(v); return { table: mk(['연', '잔액'], Array.from({ length: v.years + 1 }, (_, t) => [pad(t), Math.round(t === 0 ? v.P : s ? s[t * 12 - 1][4] : v.P)]), ['text', 'number']), spec: { type: 'line', x: '연', y: '잔액', agg: 'sum', title: '대출 잔액' } }; } } };
export const loanLab = (o) => make(loan, o);

// 명목·실질 금리
const real = { toolTitle: '실질금리 계산기',
  inputs: [I('r', '명목금리(연)', 0, 0.15, 0.0025, 0.05, 'pct'), I('pi', '물가상승률(연)', -0.03, 0.12, 0.0025, 0.03, 'pct'), I('n', '기간', 1, 30, 1, 10, 'yrInt'), I('A', '금액', 1e6, 1e8, 1e6, 1e7, 'won2')],
  outputs: [O('real', '실질금리(정확식)', (v) => F.realRate(v.r, v.pi), 'pct', true), O('approx', '근사식(명목−물가)', (v) => F.realRateApprox(v.r, v.pi), 'pct'), O('nom', 'n년 뒤 명목 금액', (v) => F.fv(v.A, v.r, v.n), 'won'), O('realv', 'n년 뒤 오늘 기준 가치', (v) => F.fv(v.A, v.r, v.n) / Math.pow(1 + v.pi, v.n), 'won')] };
export const realLab = (o) => make(real, o);

// 물가
const inflation = { toolTitle: '물가상승률 계산기',
  inputs: [I('i0', '기준 시점 물가지수', 80, 130, 1, 100, 'num'), I('i1', '비교 시점 물가지수', 80, 180, 0.5, 110, 'num'), I('n', '기간', 1, 10, 1, 1, 'yrInt'), I('A', '오늘의 금액', 1e6, 1e8, 1e6, 1e7, 'won2')],
  outputs: [O('infl', '기간 전체 물가상승률', (v) => F.inflationRate(v.i0, v.i1), 'pct', true), O('ann', '연평균 물가상승률', (v) => Math.pow(v.i1 / v.i0, 1 / v.n) - 1, 'pct'), O('pp', '같은 금액의 구매력(기준 시점 가치)', (v) => (v.A * v.i0) / v.i1, 'won')] };
export const inflationLab = (o) => make(inflation, o);

// 구매력(물가 반영)
const purchasing = { toolTitle: '구매력 계산기',
  inputs: [I('A', '오늘의 금액', 1e6, 1e8, 1e6, 1e7, 'won2'), I('pi', '연 물가상승률', 0, 0.1, 0.0025, 0.025, 'pct'), I('n', '기간', 1, 40, 1, 20, 'yrInt'), I('g', '연 소득 증가율', 0, 0.1, 0.0025, 0.03, 'pct')],
  outputs: [O('pp', 'n년 뒤 같은 금액의 구매력', (v) => F.purchasingPower(v.A, v.pi, v.n), 'won', true), O('lost', '줄어든 비율', (v, o) => 1 - o.pp / v.A, 'ratio'), O('rg', '실질 소득 증가율', (v) => F.realGrowth(v.g, v.pi), 'pct')],
  chart: { build: (v) => ({ table: mk(['연', '구매력'], Array.from({ length: v.n + 1 }, (_, t) => [pad(t), Math.round(F.purchasingPower(v.A, v.pi, t))]), ['text', 'number']), spec: { type: 'line', x: '연', y: '구매력', agg: 'sum', title: '같은 금액의 구매력' } }) } };
export const purchasingLab = (o) => make(purchasing, o);

// 채권
const bond = { toolTitle: '채권 가격 계산기',
  inputs: [I('face', '액면금액', 5e5, 2e6, 1e5, 1e6, 'won'), I('c', '표면금리(연 이자율)', 0, 0.1, 0.005, 0.05, 'pct1'), I('y', '시장금리(요구수익률)', 0.005, 0.12, 0.005, 0.05, 'pct1'), I('n', '만기까지', 1, 20, 1, 5, 'yrInt')],
  outputs: [O('price', '채권 가격', (v) => F.bondPrice(v.face, v.c, v.y, v.n), 'won', true), O('diff', '액면 대비 가격 차이', (v, o) => o.price / v.face - 1, 'pct'), O('cy', '현재수익률(이자÷가격)', (v, o) => F.currentYield(v.face, v.c, o.price), 'pct')] };
export const bondLab = (o) => make(bond, o);

// 실효금리(복리 횟수)
const apyCalc = { toolTitle: '실효금리 계산기',
  inputs: [I('apr', '명목금리(연)', 0, 0.3, 0.005, 0.12, 'pct1'), I('m', '연 복리 횟수', 1, 365, 1, 12, 'int'), I('fee', '선수수수료(원금 대비)', 0, 0.05, 0.0025, 0, 'pct')],
  outputs: [O('apy', '실효금리(APY)', (v) => F.apy(v.apr, v.m), 'pct', true), O('diff', '명목과의 차이', (v, o) => o.apy - v.apr, 'pct'), O('net', '수수료 반영 1년 실질 부담', (v, o) => (1 + o.apy) / (1 - v.fee) - 1, 'pct')] };
export const apyLab = (o) => make(apyCalc, o);

// 환율
const fx = { toolTitle: '환율 계산기',
  inputs: [I('krw', '원화 금액', 1e5, 1e7, 1e5, 1e6, 'won'), I('rate', '원/달러 환율', 900, 1800, 5, 1350, 'rate'), I('usd', '달러 금액', 10, 10000, 10, 1000, 'usd')],
  outputs: [O('toUsd', '원화 → 달러', (v) => v.krw / v.rate, 'usd', true), O('toKrw', '달러 → 원화', (v) => v.usd * v.rate, 'won')] };
export const fxLab = (o) => make(fx, o);

// 환율 변화의 영향
const fxEffect = { toolTitle: '환율 영향 계산기',
  inputs: [I('rate', '원/달러 환율', 900, 1800, 5, 1300, 'rate'), I('exp', '수출품 가격(원)', 1e5, 5e6, 1e5, 1.3e6, 'won'), I('imp', '수입품 가격(달러)', 10, 2000, 10, 1000, 'usd')],
  outputs: [O('expUsd', '수출품의 달러 가격', (v) => v.exp / v.rate, 'usd', true), O('impKrw', '수입품의 원화 가격', (v) => v.imp * v.rate, 'won')] };
export const fxEffectLab = (o) => make(fxEffect, o);

// 교차환율
const cross = { toolTitle: '교차환율 계산기',
  inputs: [I('krw', '원/달러', 900, 1800, 5, 1350, 'rate'), I('jpy', '엔/달러', 80, 200, 1, 150, 'rate'), I('eur', '달러/유로', 0.8, 1.5, 0.01, 1.1, 'num')],
  outputs: [O('k100', '100엔은 몇 원', (v) => (v.krw / v.jpy) * 100, 'rate', true), O('keur', '1유로는 몇 원', (v) => v.eur * v.krw, 'rate'), O('jeur', '1유로는 몇 엔', (v) => v.eur * v.jpy, 'rate')] };
export const crossLab = (o) => make(cross, o);

// 구매력평가
const ppp = { toolTitle: '구매력평가(PPP) 계산기',
  inputs: [I('pd', '국내 가격(원)', 1000, 20000, 100, 5000, 'won'), I('pf', '미국 가격(달러)', 1, 20, 0.1, 5, 'usd'), I('rate', '실제 환율(원/달러)', 900, 1800, 5, 1350, 'rate')],
  outputs: [O('implied', 'PPP 환율(가격 비율)', (v) => F.pppRate(v.pd, v.pf), 'rate', true), O('gap', '실제 환율 대비', (v, o) => o.implied / v.rate - 1, 'pct1')], note: '예시용 가격이에요. PPP 환율이 실제보다 낮으면 원화가 상대적으로 저평가(달러가 고평가)되었다고 해석해요.' };
export const pppLab = (o) => make(ppp, o);

// 선물환(이자율평가)
const forward = { toolTitle: '선물환율 계산기',
  inputs: [I('spot', '현물환율(원/달러)', 900, 1800, 5, 1350, 'rate'), I('rd', '한국 금리(연)', 0, 0.1, 0.0025, 0.035, 'pct'), I('rf', '미국 금리(연)', 0, 0.1, 0.0025, 0.05, 'pct'), I('mth', '기간(개월)', 1, 24, 1, 12, 'int')],
  outputs: [O('fwd', '이론 선물환율', (v) => F.forwardRate(v.spot, v.rd, v.rf, v.mth / 12), 'rate', true), O('pr', '현물 대비', (v, o) => o.fwd / v.spot - 1, 'pct')], note: '단순화한 이자율평가예요. 실제 선물환율에는 거래 비용·신용 위험 등이 더해져요.' };
export const forwardLab = (o) => make(forward, o);

// 통화승수
const mm = { toolTitle: '신용창조 계산기',
  inputs: [I('dep', '최초 예금', 1e6, 1e9, 1e6, 1e8, 'won2'), I('rr', '지급준비율', 0.01, 0.5, 0.01, 0.1, 'pct1')],
  outputs: [O('mult', '통화승수(1÷준비율)', (v) => F.moneyMultiplier(v.rr), 'x', true), O('total', '이론상 최대 총예금', (v, o) => v.dep * o.mult, 'won'), O('new', '새로 만들어진 예금', (v, o) => o.total - v.dep, 'won')], note: '모든 은행이 준비금만 남기고 모두 대출하고, 대출이 전부 다시 예금된다고 가정한 이론상 최댓값이에요.' };
export const mmLab = (o) => make(mm, o);

// 테일러 규칙
const taylor = { toolTitle: '테일러 규칙 계산기',
  inputs: [I('rs', '중립 실질금리(%)', 0, 4, 0.25, 1, 'num'), I('pi', '실제 인플레이션(%)', -2, 10, 0.1, 2, 'num'), I('pt', '물가 목표(%)', 1, 4, 0.5, 2, 'num'), I('gap', '생산 갭(%)', -6, 6, 0.5, 0, 'num')],
  outputs: [O('i', '권고 정책금리(%)', (v) => v.rs + v.pi + 0.5 * (v.pi - v.pt) + 0.5 * v.gap, 'num', true)], note: '테일러(1993)의 단순 규칙: i = r* + π + 0.5(π−π*) + 0.5×생산갭. 실제 정책은 이보다 훨씬 많은 정보를 봐요.' };
export const taylorLab = (o) => make(taylor, o);

// 손익계산서
const isCalc = { toolTitle: '손익계산서 계산기',
  inputs: [I('rev', '매출액', 1e8, 1e10, 1e8, 1e9, 'won2'), I('cogs', '매출원가', 0, 1e10, 1e8, 6e8, 'won2'), I('sga', '판매관리비', 0, 5e9, 1e7, 2e8, 'won2'), I('int', '이자비용', 0, 1e9, 1e7, 3e7, 'won2'), I('tax', '법인세율', 0, 0.3, 0.01, 0.2, 'pct1')],
  outputs: [O('gp', '매출총이익', (v) => v.rev - v.cogs, 'won2'), O('op', '영업이익', (v, o) => o.gp - v.sga, 'won2'), O('pbt', '세전이익', (v, o) => o.op - v.int, 'won2'), O('ni', '당기순이익', (v, o) => o.pbt * (1 - v.tax), 'won2', true), O('gm', '매출총이익률', (v, o) => o.gp / v.rev, 'pct1'), O('om', '영업이익률', (v, o) => o.op / v.rev, 'pct1'), O('nm', '순이익률', (v, o) => o.ni / v.rev, 'pct1')] };
export const isLab = (o) => make(isCalc, o);

// 재무상태표
const bs = { toolTitle: '재무상태표 계산기',
  inputs: [I('ca', '유동자산', 0, 1e10, 1e8, 3e9, 'won2'), I('nca', '비유동자산', 0, 1e10, 1e8, 7e9, 'won2'), I('cl', '유동부채', 0, 1e10, 1e8, 2e9, 'won2'), I('ncl', '비유동부채', 0, 1e10, 1e8, 3e9, 'won2')],
  outputs: [O('ta', '자산 합계', (v) => v.ca + v.nca, 'won2'), O('tl', '부채 합계', (v) => v.cl + v.ncl, 'won2'), O('eq', '자본(자산−부채)', (v, o) => o.ta - o.tl, 'won2', true), O('cr', '유동비율', (v) => v.ca / v.cl, 'ratio'), O('dr', '부채비율(부채÷자본)', (v, o) => o.tl / o.eq, 'ratio')] };
export const bsLab = (o) => make(bs, o);

// ROE 분해
const roeCalc = { toolTitle: '듀퐁 분해 계산기',
  inputs: [I('rev', '매출액', 1e8, 1e10, 1e8, 1e9, 'won2'), I('ni', '순이익', 1e7, 2e9, 1e7, 8e7, 'won2'), I('ta', '총자산', 1e8, 2e10, 1e8, 1e9, 'won2'), I('eq', '자본', 1e8, 1e10, 1e8, 4e8, 'won2')],
  outputs: [O('nm', '① 순이익률', (v) => v.ni / v.rev, 'pct'), O('to', '② 총자산회전율', (v) => v.rev / v.ta, 'x'), O('lv', '③ 재무레버리지(자산÷자본)', (v) => v.ta / v.eq, 'x'), O('roe', 'ROE(①×②×③)', (v, o) => o.nm * o.to * o.lv, 'pct', true), O('roa', 'ROA', (v) => v.ni / v.ta, 'pct')] };
export const roeLab = (o) => make(roeCalc, o);

// 안정성
const stab = { toolTitle: '안정성 비율 계산기',
  inputs: [I('ca', '유동자산', 1e8, 1e10, 1e8, 3e9, 'won2'), I('cl', '유동부채', 1e8, 1e10, 1e8, 2e9, 'won2'), I('debt', '부채 총계', 1e8, 1e10, 1e8, 5e9, 'won2'), I('eq', '자본', 1e8, 1e10, 1e8, 5e9, 'won2'), I('ebit', '영업이익', 1e7, 2e9, 1e7, 4e8, 'won2'), I('int', '이자비용', 1e6, 1e9, 1e6, 1e8, 'won2')],
  outputs: [O('cr', '유동비율', (v) => v.ca / v.cl, 'ratio', true), O('dr', '부채비율', (v) => v.debt / v.eq, 'ratio'), O('ic', '이자보상배율', (v) => v.ebit / v.int, 'x')] };
export const stabLab = (o) => make(stab, o);

// 성장·활동
const growth = { toolTitle: '성장·활동성 계산기',
  inputs: [I('b', '시작 매출', 1e8, 1e10, 1e8, 1e9, 'won2'), I('e', '현재 매출', 1e8, 2e10, 1e8, 1.6e9, 'won2'), I('n', '기간', 1, 10, 1, 4, 'yrInt'), I('cogs', '연 매출원가', 1e8, 1e10, 1e8, 1.2e9, 'won2'), I('inv', '평균 재고자산', 1e7, 5e9, 1e7, 3e8, 'won2')],
  outputs: [O('cagr', '연평균 성장률(CAGR)', (v) => F.cagr(v.b, v.e, v.n), 'pct', true), O('turn', '재고자산회전율', (v) => v.cogs / v.inv, 'x'), O('days', '재고 보유 일수', (v) => 365 / (v.cogs / v.inv), 'num')] };
export const growthLab = (o) => make(growth, o);

// 가치평가
const val = { toolTitle: '가치평가 배수 계산기',
  inputs: [I('price', '주가(원)', 1000, 500000, 500, 50000, 'won'), I('eps', 'EPS(주당순이익)', 100, 50000, 50, 5000, 'won'), I('bps', 'BPS(주당순자산)', 1000, 200000, 500, 40000, 'won'), I('mcap', '시가총액', 1e9, 1e12, 1e9, 3e11, 'won2'), I('debt', '순차입 이전 부채', 0, 5e11, 1e9, 1e11, 'won2'), I('cash', '현금', 0, 3e11, 1e9, 4e10, 'won2'), I('ebitda', 'EBITDA', 1e9, 3e11, 1e9, 5e10, 'won2')],
  outputs: [O('per', 'PER', (v) => F.per(v.price, v.eps), 'x', true), O('pbr', 'PBR', (v) => F.pbr(v.price, v.bps), 'x'), O('ev', '기업가치(EV)', (v) => F.ev(v.mcap, v.debt, v.cash), 'won2'), O('evx', 'EV/EBITDA', (v, o) => o.ev / v.ebitda, 'x')] };
export const valLab = (o) => make(val, o);

// NPV / IRR
const npvCalc = { toolTitle: '투자 평가 계산기',
  inputs: [I('I0', '초기 투자금', 1e6, 1e9, 1e6, 1e8, 'won2'), I('cf', '연 현금흐름', 1e6, 5e8, 1e6, 3e7, 'won2'), I('n', '기간', 1, 15, 1, 5, 'yrInt'), I('r', '할인율', 0, 0.2, 0.005, 0.08, 'pct1')],
  outputs: [O('npv', '순현재가치(NPV)', (v) => F.npv(v.r, [-v.I0, ...Array(v.n).fill(v.cf)]), 'won', true), O('irr', '내부수익률(IRR)', (v) => F.irr([-v.I0, ...Array(v.n).fill(v.cf)]), 'pct'), O('pb', '회수기간', (v) => F.payback([-v.I0, ...Array(v.n).fill(v.cf)]), 'yr')] };
export const npvLab = (o) => make(npvCalc, o);

// 손익분기점
const bep = { toolTitle: '손익분기점 계산기',
  inputs: [I('fixed', '고정비(월)', 1e6, 1e9, 1e6, 3e7, 'won2'), I('price', '판매가(개당)', 1000, 1e6, 500, 20000, 'won'), I('vc', '변동비(개당)', 0, 1e6, 500, 12000, 'won'), I('q', '예상 판매량(월)', 0, 20000, 100, 5000, 'int')],
  outputs: [O('be', '손익분기 판매량', (v) => F.breakEvenUnits(v.fixed, v.price, v.vc), 'int', true), O('ber', '손익분기 매출', (v, o) => o.be * v.price, 'won2'), O('cm', '공헌이익률', (v) => F.contributionMargin(v.price, v.vc), 'ratio'), O('profit', '예상 영업이익', (v) => v.q * (v.price - v.vc) - v.fixed, 'won2')] };
export const bepLab = (o) => make(bep, o);

// 기대값(시나리오)
const scen = { toolTitle: '시나리오 기대값 계산기',
  inputs: [I('pu', '낙관 확률', 0, 1, 0.05, 0.25, 'ratio'), I('pd', '비관 확률', 0, 1, 0.05, 0.25, 'ratio'), I('vu', '낙관 시 이익', -5e8, 1e9, 1e7, 3e8, 'won2'), I('vb', '기본 시 이익', -5e8, 1e9, 1e7, 1e8, 'won2'), I('vd', '비관 시 이익', -5e8, 1e9, 1e7, -1e8, 'won2')],
  outputs: [O('pb', '기본 확률(1−낙관−비관)', (v) => 1 - v.pu - v.pd, 'ratio'), O('ev', '기대 이익', (v, o) => F.expectedValue([[v.pu, v.vu], [o.pb, v.vb], [v.pd, v.vd]]), 'won2', true), O('range', '낙관−비관 폭', (v) => v.vu - v.vd, 'won2')] };
export const scenLab = (o) => make(scen, o);

// 레버리지
const lev = { toolTitle: '레버리지 계산기',
  inputs: [I('ra', '자산수익률(세전)', -0.1, 0.2, 0.005, 0.08, 'pct1'), I('rd', '차입 금리', 0, 0.12, 0.005, 0.05, 'pct1'), I('de', '부채/자본', 0, 4, 0.1, 1, 'num')],
  outputs: [O('roe', '자기자본수익률(세전)', (v) => v.ra + (v.ra - v.rd) * v.de, 'pct', true), O('spread', '자산수익률−차입금리', (v) => v.ra - v.rd, 'pct')], note: 'ROE = ra + (ra − rd) × D/E (세전). 자산수익률이 차입금리보다 낮으면 빌릴수록 ROE가 깎여요.' };
export const levLab = (o) => make(lev, o);

// 예산 차이
const budget = { toolTitle: '예산 vs 실적',
  inputs: [I('bs', '예산 매출', 1e8, 1e10, 1e7, 1e9, 'won2'), I('as', '실적 매출', 1e8, 1e10, 1e7, 9.2e8, 'won2'), I('bc', '예산 비용', 1e8, 1e10, 1e7, 7e8, 'won2'), I('ac', '실적 비용', 1e8, 1e10, 1e7, 7.5e8, 'won2')],
  outputs: [O('sv', '매출 차이(실적−예산)', (v) => v.as - v.bs, 'won2'), O('cv', '비용 차이(실적−예산)', (v) => v.ac - v.bc, 'won2'), O('pv', '이익 차이', (v) => v.as - v.ac - (v.bs - v.bc), 'won2', true), O('att', '매출 달성률', (v) => v.as / v.bs, 'ratio')] };
export const budgetLab = (o) => make(budget, o);

// 개인 예산
const pbud = { toolTitle: '월 예산 계산기',
  inputs: [I('inc', '월 실수령액', 1e6, 1e7, 1e5, 3e6, 'won2'), I('need', '필수 지출(주거·식비·교통·보험 등)', 0, 6e6, 1e5, 1.5e6, 'won2'), I('want', '선택 지출(외식·여가·쇼핑 등)', 0, 4e6, 1e5, 9e5, 'won2')],
  outputs: [O('sav', '저축·투자 가능액', (v) => v.inc - v.need - v.want, 'won2', true), O('nr', '필수 지출 비중', (v) => v.need / v.inc, 'ratio'), O('wr', '선택 지출 비중', (v) => v.want / v.inc, 'ratio'), O('sr', '저축률', (v, o) => o.sav / v.inc, 'ratio')], note: '50/30/20은 참고용 어림 규칙이에요. 가족·지역·소득에 따라 알맞은 비율은 달라요.' };
export const pbudLab = (o) => make(pbud, o);

// 비상금
const emerg = { toolTitle: '비상금 계산기',
  inputs: [I('exp', '월 필수 생활비', 5e5, 6e6, 1e5, 1.8e6, 'won2'), I('cash', '지금 비상금', 0, 5e7, 1e6, 4e6, 'won2'), I('tm', '목표 개월 수', 1, 12, 1, 6, 'int')],
  outputs: [O('now', '지금 버틸 수 있는 기간', (v) => v.cash / v.exp, 'yr'), O('goal', '목표 비상금', (v) => v.exp * v.tm, 'won2', true), O('short', '부족액', (v, o) => Math.max(0, o.goal - v.cash), 'won2')] };
export const emergLab = (o) => make(emerg, o);

// 카드 할부·장기 부채
const card = { toolTitle: '할부 이자 계산기',
  inputs: [I('P', '결제 금액', 1e5, 1e7, 1e5, 2e6, 'won2'), I('apr', '연 할부 수수료율', 0, 0.25, 0.005, 0.15, 'pct1'), I('mths', '할부 개월', 2, 36, 1, 12, 'int')],
  outputs: [O('pm', '월 납부액(원리금균등)', (v) => F.pmtLoan(v.P, v.apr / 12, v.mths), 'won'), O('int', '총 이자(수수료)', (v, o) => o.pm * v.mths - v.P, 'won', true), O('tot', '총 납부액', (v, o) => o.pm * v.mths, 'won')], note: '카드사 실제 수수료 계산 방식과 조금 다를 수 있어요. 약관의 연 수수료율을 확인하세요.' };
export const cardLab = (o) => make(card, o);

// 은퇴 계획
const retire = { toolTitle: '은퇴 자금 계산기',
  inputs: [I('age', '현재 나이', 20, 60, 1, 30, 'int'), I('ret', '은퇴 나이', 50, 75, 1, 65, 'int'), I('M', '월 적립액', 1e5, 3e6, 1e5, 5e5, 'won2'), I('r', '연 수익률(가정)', 0, 0.1, 0.005, 0.04, 'pct1')],
  outputs: [O('yrs', '적립 기간', (v) => Math.max(0, v.ret - v.age), 'yr'), O('fv', '은퇴 시점 적립금', (v, o) => F.fvAnnuity(v.M, v.r / 12, o.yrs * 12), 'won', true), O('paid', '낸 원금', (v, o) => v.M * 12 * o.yrs, 'won')], note: '물가 상승과 세금, 투자 손익의 변동은 반영하지 않은 단순 계산이에요.' };
export const retireLab = (o) => make(retire, o);

// 세후 실질 수익률
const aftertax = { toolTitle: '세후 실질금리 계산기',
  inputs: [I('r', '예금 이자율(세전)', 0, 0.1, 0.0025, 0.04, 'pct'), I('tax', '이자소득세율', 0, 0.3, 0.001, 0.154, 'pct1'), I('pi', '물가상승률', 0, 0.1, 0.0025, 0.025, 'pct')],
  outputs: [O('net', '세후 이자율', (v) => v.r * (1 - v.tax), 'pct'), O('real', '세후 실질금리', (v, o) => F.realRate(o.net, v.pi), 'pct', true)], note: '이자소득세율(15.4% 등)은 제도에 따라 바뀌거나 비과세 상품이 있을 수 있어요. 학습용 가정값이에요.' };
export const aftertaxLab = (o) => make(aftertax, o);

// 자산 배분(교육용 변동성 체험)
const alloc = { toolTitle: '자산 배분 시뮬레이터',
  inputs: [I('w', '위험자산 비중', 0, 1, 0.05, 0.5, 'ratio'), I('rs', '위험자산 가정 수익률', -0.4, 0.4, 0.01, 0.07, 'pct1'), I('dn', '위험자산 하락 시나리오', -0.5, 0, 0.01, -0.3, 'pct1'), I('rb', '안전자산 가정 수익률', 0, 0.08, 0.005, 0.03, 'pct1')],
  outputs: [O('exp', '평소 시나리오 포트폴리오 수익률', (v) => v.w * v.rs + (1 - v.w) * v.rb, 'pct'), O('bad', '하락 시나리오 포트폴리오 수익률', (v) => v.w * v.dn + (1 - v.w) * v.rb, 'pct', true)], note: '교육용 가정이에요. 실제 수익률은 변동하고 손실이 날 수 있어요. 특정 자산이나 비중을 권유하는 것이 아니에요.' };
export const allocLab = (o) => make(alloc, o);



// 자본비용(WACC)
const waccCalc = { toolTitle: 'WACC 계산기',
  inputs: [I('E', '자기자본(시가)', 10, 90, 5, 60, 'num'), I('D', '타인자본(부채)', 10, 90, 5, 40, 'num'), I('re', '자기자본비용', 0.03, 0.2, 0.005, 0.1, 'pct1'), I('rd', '부채 이자율', 0.01, 0.12, 0.005, 0.05, 'pct1'), I('tax', '법인세율', 0, 0.3, 0.01, 0.2, 'pct1')],
  outputs: [O('we', '자기자본 비중', (v) => v.E / (v.E + v.D), 'ratio'), O('rdat', '세후 부채비용', (v) => v.rd * (1 - v.tax), 'pct'), O('wacc', 'WACC', (v) => F.wacc(v.E, v.D, v.re, v.rd, v.tax), 'pct', true)], note: '이자는 세금을 줄여 주므로(세후 비용) 부채 비용은 (1−세율)을 곱해요.' };
export const waccLab = (o) => make(waccCalc, o);

// DCF(현금흐름 할인)
const dcfCalc = { toolTitle: 'DCF 가치 계산기',
  inputs: [I('cf', '1년차 현금흐름', 1e7, 1e9, 1e7, 1e8, 'won2'), I('g', '5년간 연 성장률', 0, 0.2, 0.005, 0.05, 'pct1'), I('r', '할인율(WACC)', 0.05, 0.2, 0.005, 0.1, 'pct1'), I('tg', '영구 성장률', 0, 0.04, 0.005, 0.02, 'pct1')],
  outputs: [O('val', '기업(사업)가치 추정', (v) => F.dcfValue(Array.from({ length: 5 }, (_, i) => v.cf * Math.pow(1 + v.g, i)), v.r, v.tg), 'won2', true), O('tvshare', '잔존가치 비중', (v, o) => { const f = Array.from({ length: 5 }, (_, i) => v.cf * Math.pow(1 + v.g, i)); const exp = F.npv(v.r, [0, ...f]); return 1 - exp / o.val; }, 'ratio')], note: '5년의 명시적 예측 + 그 이후 영구 성장(잔존가치) 모형이에요. 가정에 매우 민감해요.' };
export const dcfLab = (o) => make(dcfCalc, o);

export const FACTORIES = { compoundLab, pvLab, savingLab, loanLab, realLab, inflationLab, purchasingLab, bondLab, apyLab, fxLab, fxEffectLab, crossLab, pppLab, forwardLab, mmLab, taylorLab, isLab, bsLab, roeLab, stabLab, growthLab, valLab, npvLab, bepLab, scenLab, levLab, budgetLab, pbudLab, emergLab, cardLab, retireLab, aftertaxLab, allocLab, waccLab, dcfLab };
