// 계산기 탭: 과제 없이 자유롭게 쓰는 도구들
import { compoundLab, pvLab, savingLab, loanLab, realLab, inflationLab, bondLab, apyLab, fxLab, crossLab, npvLab, bepLab, pbudLab, emergLab, retireLab, cardLab } from './labdefs.js';

const C = (icon, title, desc, lab) => ({ icon, desc, ...lab, title, goal: desc });
export const CALCS = [
  C('💰', '단리·복리 이자', '원금·이율·기간으로 만기 금액과 성장 그래프를 봐요.', compoundLab({})),
  C('⏳', '현재가치 계산', '미래에 받을 돈이 지금은 얼마의 가치인지 계산해요.', pvLab({})),
  C('🐷', '매월 적립 계산', '매월 같은 금액을 모으면 얼마가 되는지 봐요.', savingLab({})),
  C('🏠', '대출 상환 계산', '원리금균등·원금균등·만기일시의 이자 차이를 비교해요.', loanLab({})),
  C('📉', '실질금리·구매력', '명목금리와 물가로 실질금리를 계산해요.', realLab({})),
  C('🛒', '물가상승률', '물가지수로 물가상승률을 구해요.', inflationLab({})),
  C('📜', '채권 가격', '시장금리가 변하면 채권 가격이 어떻게 변하는지 봐요.', bondLab({})),
  C('🧾', '실효금리(APY)', '복리 횟수와 수수료를 반영한 실효금리를 계산해요.', apyLab({})),
  C('💱', '환율 계산', '원화와 달러를 환산해요.', fxLab({})),
  C('🔀', '교차환율', '원/달러, 엔/달러로 100엔이 몇 원인지 구해요.', crossLab({})),
  C('📈', '투자 평가(NPV·IRR)', '현금흐름으로 순현재가치와 내부수익률을 구해요.', npvLab({})),
  C('⚖️', '손익분기점', '고정비·판매가·변동비로 손익분기 판매량을 구해요.', bepLab({})),
  C('📒', '월 예산', '수입에서 필수·선택 지출을 빼고 저축률을 봐요.', pbudLab({})),
  C('🛟', '비상금', '목표 개월 수에 필요한 비상금을 계산해요.', emergLab({})),
  C('💳', '카드 할부 이자', '할부 수수료로 총 이자를 계산해요.', cardLab({})),
  C('🏖️', '은퇴 자금', '매월 적립으로 은퇴 시점 적립금을 계산해요.', retireLab({})),
];
