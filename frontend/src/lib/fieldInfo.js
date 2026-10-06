// Plain-language, localized explanations for intake fields — what the value
// means and how the trained model tends to weigh it (per the SHAP summary in
// output/). Dictionary lives in the locale files (fieldTips.*).

/** Localized explanation for an intake field, or null when unknown. */
export function fieldTip(name, t) {
  return t(`fieldTips.${name}`, { defaultValue: '' }) || null
}
