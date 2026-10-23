import { DEFAULT_ASSUMPTIONS as A } from "@/lib/finance";

export type RateInfo = {
  key: string;
  label: string;
  value: string;
  detail: string;
  links: { text: string; url: string }[];
};

// What the site assumes, and where to check it. Values come from DEFAULT_ASSUMPTIONS so they cannot drift apart.
export const RATE_INFO: RateInfo[] = [
  {
    key: "rate",
    label: "Mortgage interest rate",
    value: `${A.ratePct}%`,
    detail: "Average 30-year fixed rate from Freddie Mac's weekly survey, released 22 October 2026. It changes every week, and your own rate depends on your credit.",
    links: [{ text: "Freddie Mac weekly rates", url: "https://www.freddiemac.com/pmms" }],
  },
  {
    key: "tax",
    label: "Property tax",
    value: `${A.taxRatePct}% of the price, per year`,
    detail: "Harris County estimates range from about 1.5% (based on Census data) to 2% or more (lender estimates). Your real bill depends on the home and its taxing districts.",
    links: [
      { text: "Harris County property tax guide", url: "https://taxbycounty.com/texas/harris-county" },
      { text: "Texas tax rates by county", url: "https://www.taxdrop.com/blog/texas-property-tax-rates-by-county-2026" },
    ],
  },
  {
    key: "insurance",
    label: "Home insurance",
    value: `${A.insuranceRatePct}% of the price, per year`,
    detail: "A rough middle. Houston quotes cluster around $5,400 to $6,400 a year for a $300,000 home, but sources range from about $1,800 to $9,000. Flood insurance is extra.",
    links: [
      { text: "Houston home insurance costs", url: "https://insurify.com/homeowners-insurance/texas/houston/" },
      { text: "Another estimate", url: "https://www.monitorbankrates.com/homeowners-insurance/texas/houston" },
    ],
  },
  {
    key: "pmi",
    label: "Mortgage insurance (PMI)",
    value: `${A.pmiRatePct}% of the loan, per year`,
    detail: "Added when your down payment is under 20% of the price. Typical lender rule of thumb.",
    links: [],
  },
  {
    key: "budget",
    label: "Housing budget rule",
    value: "28% of income, or 36% with debts",
    detail: "Lenders often limit housing to 28% of gross monthly income, and housing plus other debts to 36%. We use whichever gives the lower number.",
    links: [],
  },
];
