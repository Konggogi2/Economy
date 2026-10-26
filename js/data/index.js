import { C1 } from './c1.js';
import { C2 } from './c2.js';
import { C3 } from './c3.js';
import { C4 } from './c4.js';
import { C5 } from './c5.js';
import { C6 } from './c6.js';
import { C7 } from './c7.js';
import { FIX, FIX2, LABFIX } from './tune.js';

export const UNITS = [...C1, ...C2, ...C3, ...C4, ...C5, ...C6, ...C7];
UNITS.forEach((u) => u.quiz.forEach((q, k) => { const f = { ...(FIX[`${u.id}:${k}`] || {}), ...(FIX2[`${u.id}:${k}`] || {}) }; if (Object.keys(f).length) Object.assign(q, f); }));
export const CHAPTERS = [
  { id: 'c1', from: 1, to: 8, icon: '🌱', name: 'Chapter 1 · 금리와 돈의 시간가치', sub: '이자 · 복리 · 현재가치 · 실질금리 · 채권', color: '#2f5bd7', story: '모든 금융의 출발점인 금리와 시간가치를 익혀요. 단리와 복리, 현재가치, 명목·실질금리, 기준금리 체계, 채권 가격까지 직접 계산해 봐요.' },
  { id: 'c2', from: 9, to: 14, icon: '🛒', name: 'Chapter 2 · 인플레이션과 물가', sub: '물가지수 · 원인 · 구매력 · 지표', color: '#e0703f', story: '물가가 오르는 이유와 내 돈에 미치는 영향을 알아봐요. 물가지수 계산, 디플레이션·스태그플레이션, CPI와 근원물가, 임금과 물가의 관계까지요.' },
  { id: 'c3', from: 15, to: 23, icon: '🏛️', name: 'Chapter 3 · 중앙은행과 통화정책', sub: '기준금리 · 전달 경로 · QE · 독립성', color: '#1a9a8a', story: '중앙은행이 하는 일과 기준금리가 정해지고 경제로 퍼지는 길을 따라가요. 통화량, 정책 수단, 양적완화, 테일러 규칙, 독립성과 금융 안정까지요.' },
  { id: 'c4', from: 24, to: 31, icon: '💱', name: 'Chapter 4 · 환율과 국제금융', sub: '환율 · PPP · 선물환 · 국제수지', color: '#8a5cd6', story: '환율 읽는 법부터 환율을 움직이는 요인, 수출입과 물가에 미치는 영향, 구매력평가와 선물환, 국제수지와 환헤지까지 살펴봐요.' },
  { id: 'c5', from: 32, to: 42, icon: '📊', name: 'Chapter 5 · 재무 분석', sub: '재무제표 · 비율 · 가치평가 · NPV', color: '#c0527a', story: '기업의 건강검진표를 읽어요. 세 가지 재무제표와 수익성·안정성·성장성 비율, PER 같은 배수, NPV·IRR, 손익분기점, WACC와 DCF까지 직접 계산해 봐요.' },
  { id: 'c6', from: 43, to: 48, icon: '🧭', name: 'Chapter 6 · 전략과 의사결정', sub: 'SWOT · 기회비용 · 민감도 · 기대값', color: '#2f4f8f', story: '불확실한 상황에서 더 나은 결정을 내리는 도구를 익혀요. 전략 프레임워크, 기회비용과 매몰비용, 민감도·시나리오, 기대값, 예산 차이 분석, 레버리지까지요.' },
  { id: 'c7', from: 49, to: 57, icon: '👛', name: 'Chapter 7 · 개인 재무 관리', sub: '예산 · 비상금 · 대출 · 분산 · 은퇴', color: '#1a9a8a', story: '내 돈을 다루는 기본 원리를 익혀요. 예산과 저축률, 비상금과 위험 관리, 대출 상환 방식, 카드 할부, 분산투자의 원리, 은퇴 계획, 세후 실질 수익률, 금융 사기 예방까지요. 교육용 일반 원리예요.' },
];
UNITS.forEach((u) => { if (u.lab.type === 'case') u.lab.steps.forEach((s, k) => { const f = LABFIX[`${u.id}:${k}`]; if (f) Object.assign(s, f); }); });
