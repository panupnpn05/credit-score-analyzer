// Display-only label helpers — the raw schema names stay the API contract,
// these make them readable for humans.

const FRIENDLY = {
  RevolvingUtilizationOfUnsecuredLines: 'Revolving utilization of unsecured lines',
  age: 'Age',
  'NumberOfTime30-59DaysPastDueNotWorse': 'Times 30–59 days past due',
  DebtRatio: 'Debt ratio',
  MonthlyIncome: 'Monthly income',
  NumberOfOpenCreditLinesAndLoans: 'Open credit lines and loans',
  NumberOfTimes90DaysLate: 'Times 90 days or more late',
  NumberRealEstateLoansOrLines: 'Real estate loans or lines',
  'NumberOfTime60-89DaysPastDueNotWorse': 'Times 60–89 days past due',
  NumberOfDependents: 'Number of dependents',
}

/** Human-readable name for a raw training-schema column. */
export function prettyField(name) {
  if (!name) return ''
  if (FRIENDLY[name]) return FRIENDLY[name]
  const spaced = String(name)
    .replace(/[_-]+/g, ' ')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/** "0–50,708" style range from schema min/max. */
export function fmtRange(min, max) {
  const fmt = (v) => Number(v).toLocaleString('en-US')
  return `${fmt(min)}–${fmt(max)}`
}
