// Plain-language explanations for intake fields — what the value means and
// how the trained model tends to weigh it (from the SHAP summary in output/).

const FIELD_INFO = {
  RevolvingUtilizationOfUnsecuredLines:
    'Share of available revolving credit (cards, credit lines) currently in use, 0–1+. The model’s strongest single signal — high utilization pushes default risk up sharply, low use is strongly protective.',
  age:
    'Applicant age in years. Younger applicants read as riskier in the training data; older age is protective.',
  'NumberOfTime30-59DaysPastDueNotWorse':
    'How often payments were 30–59 days late in the last 2 years. Each occurrence pushes risk up.',
  DebtRatio:
    'Monthly debt payments relative to monthly income (expressed ×100 in this dataset). A higher burden means higher risk.',
  MonthlyIncome:
    'Monthly income in dollars. Lower income raises risk; higher income is protective.',
  NumberOfOpenCreditLinesAndLoans:
    'Count of open credit cards plus loans. More open credit means more exposure, which slightly raises risk.',
  NumberOfTimes90DaysLate:
    'How often payments were 90+ days late. The model treats these as nearly decisive — even one occurrence pushes risk up hard.',
  NumberRealEstateLoansOrLines:
    'Count of mortgage or real-estate loans and lines. Adds a mild amount of risk.',
  'NumberOfTime60-89DaysPastDueNotWorse':
    'How often payments were 60–89 days late in the last 2 years. Raises risk, like the other delinquency counts.',
  NumberOfDependents:
    'Number of dependents. Only a weak effect on the score.',
}

/** Explanation for an intake field, or null when unknown. */
export function fieldTip(name) {
  return FIELD_INFO[name] || null
}
