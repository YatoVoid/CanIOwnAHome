export type Assumptions = {
  downPaymentPct: number;
  ratePct: number;
  termYears: number;
  taxRatePct: number;
  insuranceRatePct: number;
  pmiRatePct: number;
  closingCostPct: number;
};

// Houston-area defaults. Sources for each rate are listed in lib/rates.ts and shown to users under "View the rates".
export const DEFAULT_ASSUMPTIONS: Assumptions = {
  downPaymentPct: 5,
  ratePct: 7.32, // Freddie Mac weekly survey, 30-yr fixed, 22 Oct 2026. Update weekly.
  termYears: 30,
  taxRatePct: 1.8, // Harris County estimates range ~1.5% to 2%+
  insuranceRatePct: 1.5, // rough: Houston quotes vary a lot; flood insurance is extra
  pmiRatePct: 0.6,
  closingCostPct: 3,
};

export type CostBreakdown = {
  principalInterest: number;
  tax: number;
  insurance: number;
  pmi: number;
  hoa: number;
  total: number;
  loan: number;
  downPayment: number;
  closingCosts: number;
  cashToClose: number;
};

export function monthlyPrincipalInterest(loan: number, ratePct: number, termYears: number) {
  const n = termYears * 12;
  if (loan <= 0 || n <= 0) return 0;
  const r = ratePct / 100 / 12;
  if (r === 0) return loan / n;
  return (loan * r) / (1 - (1 + r) ** -n);
}

export function costBreakdown(price: number, hoaMonthly: number | null, a: Assumptions): CostBreakdown {
  const downPayment = price * (a.downPaymentPct / 100);
  const loan = price - downPayment;
  const principalInterest = monthlyPrincipalInterest(loan, a.ratePct, a.termYears);
  const tax = (price * a.taxRatePct) / 100 / 12;
  const insurance = (price * a.insuranceRatePct) / 100 / 12;
  const pmi = a.downPaymentPct < 20 ? (loan * a.pmiRatePct) / 100 / 12 : 0;
  const hoa = hoaMonthly ?? 0;
  const closingCosts = price * (a.closingCostPct / 100);
  return {
    principalInterest,
    tax,
    insurance,
    pmi,
    hoa,
    total: principalInterest + tax + insurance + pmi + hoa,
    loan,
    downPayment,
    closingCosts,
    cashToClose: downPayment + closingCosts,
  };
}

/**
 * The most a household should spend on housing each month: 28% of gross monthly income, or 36% minus
 * their other monthly debts, whichever is lower. Common lender rules of thumb, not a loan offer.
 */
export function housingBudget(annualIncome: number, monthlyDebts = 0) {
  const gross = annualIncome / 12;
  return Math.max(Math.min(0.28 * gross, 0.36 * gross - monthlyDebts), 0);
}

/** Savings go in as the down payment, so the percentage depends on the price. */
export function withSavings(price: number, a: Assumptions, savings: number): Assumptions {
  return { ...a, downPaymentPct: Math.min(100, Math.max(0, (savings / price) * 100)) };
}

/** The highest price whose full monthly cost (loan, tax, insurance, mortgage insurance) fits the budget. */
export function maxAffordablePrice(budget: number, savings: number, a: Assumptions) {
  if (budget <= 0) return 0;
  let lo = 0;
  let hi = 5_000_000;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (costBreakdown(mid, null, withSavings(mid, a, savings)).total <= budget) lo = mid;
    else hi = mid;
  }
  return Math.floor(lo);
}

/** Loan balance remaining after `months` payments. */
export function remainingBalance(loan: number, ratePct: number, termYears: number, months: number) {
  const r = ratePct / 100 / 12;
  const payment = monthlyPrincipalInterest(loan, ratePct, termYears);
  if (r === 0) return Math.max(0, loan - payment * months);
  return Math.max(0, loan * (1 + r) ** months - (payment * ((1 + r) ** months - 1)) / r);
}

/** Equity after `years` from down payment and principal paid, assuming flat prices. */
export function equityAfterYears(price: number, a: Assumptions, years: number) {
  const { loan, downPayment } = costBreakdown(price, null, a);
  return downPayment + loan - remainingBalance(loan, a.ratePct, a.termYears, years * 12);
}

export type Fit = "under" | "near" | "stretch";

export const NEAR_RENT_FACTOR = 1.15;

export function rentFit(monthlyCost: number, rent: number): Fit {
  if (monthlyCost <= rent) return "under";
  if (monthlyCost <= rent * NEAR_RENT_FACTOR) return "near";
  return "stretch";
}
