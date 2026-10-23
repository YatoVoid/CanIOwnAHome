export type Assumptions = {
  downPaymentPct: number;
  ratePct: number;
  termYears: number;
  taxRatePct: number;
  insuranceRatePct: number;
  pmiRatePct: number;
  closingCostPct: number;
};

// Houston-area defaults. Harris County effective property tax runs about 2%,
// and Gulf Coast homeowners insurance is well above the national average.
export const DEFAULT_ASSUMPTIONS: Assumptions = {
  downPaymentPct: 5,
  ratePct: 6.25,
  termYears: 30,
  taxRatePct: 2.1,
  insuranceRatePct: 0.9,
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
