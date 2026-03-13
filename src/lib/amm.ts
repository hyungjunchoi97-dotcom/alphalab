// AMM (Automated Market Maker) utility — constant product formula x * y = k

export interface AMMState {
  yesProbability: number;  // 0–1
  noProbability: number;   // 0–1
  yesOdds: number;         // total return multiplier (e.g. 1.9x)
  noOdds: number;
  k: number;
}

export interface BetReturn {
  sharesReceived: number;
  effectiveOdds: number;    // total return multiplier after fee+slippage
  potentialPayout: number;  // betAmount + sharesReceived * (1 - feeRate)
  newYesPool: number;
  newNoPool: number;
}

const FEE_RATE = 0.05;
const MIN_POOL = 10;

export function calculateAMM(yesPool: number, noPool: number): AMMState {
  const k = yesPool * noPool;
  const totalPool = yesPool + noPool;
  const yesProbability = noPool / totalPool;
  const noProbability = yesPool / totalPool;
  // Theoretical odds before slippage, after fee
  const yesOdds = Math.round((1 / yesProbability) * (1 - FEE_RATE) * 100) / 100;
  const noOdds = Math.round((1 / noProbability) * (1 - FEE_RATE) * 100) / 100;
  return { yesProbability, noProbability, yesOdds, noOdds, k };
}

export function calculateBetReturn(
  yesPool: number,
  noPool: number,
  side: "yes" | "no",
  betAmount: number,
  feeRate = FEE_RATE
): BetReturn {
  const k = yesPool * noPool;

  if (side === "yes") {
    const newYesPool = yesPool + betAmount;
    const newNoPool = k / newYesPool;
    const sharesReceived = noPool - newNoPool;
    const potentialPayout = betAmount + sharesReceived * (1 - feeRate);
    const effectiveOdds = Math.round((potentialPayout / betAmount) * 100) / 100;
    return {
      sharesReceived: Math.round(sharesReceived * 1000) / 1000,
      effectiveOdds,
      potentialPayout: Math.round(potentialPayout * 100) / 100,
      newYesPool: Math.round(newYesPool * 1000) / 1000,
      newNoPool: Math.round(newNoPool * 1000) / 1000,
    };
  } else {
    const newNoPool = noPool + betAmount;
    const newYesPool = k / newNoPool;
    const sharesReceived = yesPool - newYesPool;
    const potentialPayout = betAmount + sharesReceived * (1 - feeRate);
    const effectiveOdds = Math.round((potentialPayout / betAmount) * 100) / 100;
    return {
      sharesReceived: Math.round(sharesReceived * 1000) / 1000,
      effectiveOdds,
      potentialPayout: Math.round(potentialPayout * 100) / 100,
      newYesPool: Math.round(newYesPool * 1000) / 1000,
      newNoPool: Math.round(newNoPool * 1000) / 1000,
    };
  }
}

/** Validate bet before executing */
export function validateBet(
  yesPool: number,
  noPool: number,
  side: "yes" | "no",
  betAmount: number
): string | null {
  if (betAmount < 10) return "최소 베팅은 10 pts입니다";
  const smallerPool = Math.min(yesPool, noPool);
  if (betAmount > smallerPool * 0.2) {
    return `최대 베팅은 ${Math.floor(smallerPool * 0.2)} pts입니다 (풀의 20%)`;
  }
  // Check liquidity after trade
  const { newYesPool, newNoPool } = calculateBetReturn(yesPool, noPool, side, betAmount);
  if (newYesPool < MIN_POOL || newNoPool < MIN_POOL) return "유동성 부족";
  return null;
}

/** Probability after a hypothetical bet (for UI preview) */
export function probabilityAfterBet(
  yesPool: number,
  noPool: number,
  side: "yes" | "no",
  betAmount: number
): { yesPct: number; noPct: number } {
  if (betAmount < 1) return ammPct(yesPool, noPool);
  try {
    const { newYesPool, newNoPool } = calculateBetReturn(yesPool, noPool, side, betAmount);
    return ammPct(newYesPool, newNoPool);
  } catch {
    return ammPct(yesPool, noPool);
  }
}

function ammPct(yp: number, np: number): { yesPct: number; noPct: number } {
  const total = yp + np;
  return {
    yesPct: Math.round((np / total) * 100),
    noPct: Math.round((yp / total) * 100),
  };
}
