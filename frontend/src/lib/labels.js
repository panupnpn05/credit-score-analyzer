// Display-only label helpers — the raw schema names stay the API contract,
// these make them readable for humans (localized via i18n).

/** Human-readable, localized name for a raw training-schema column. */
export function prettyField(name, t) {
  const friendly = t(`fields.${name}`, { defaultValue: '' })
  if (friendly) return friendly
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

/**
 * True when a numeric schema field should be treated as whole-numbered:
 * count-like fields (age, "number of…", delinquency counts) and other columns
 * whose training min/max are whole numbers. Truly continuous measures
 * (utilization, ratios, proportions) are excluded by name. The schema's
 * min/max/mean statistics alone can't separate these — every column in the
 * shipped dataset happens to have whole min/max, and means are always
 * decimals — so the field name is the deciding signal.
 */
const CONTINUOUS_NAME = /utilization|ratio|share|proportion|percent|percentage|balance/i
const COUNT_NAME = /^(age|number|num|count|times|n_|dependents|duration)/i

export function isIntegerField(f) {
  const name = String(f.name || '')
  if (CONTINUOUS_NAME.test(name)) return false
  if (COUNT_NAME.test(name)) return true
  return Number.isInteger(Number(f.min)) && Number.isInteger(Number(f.max))
}
