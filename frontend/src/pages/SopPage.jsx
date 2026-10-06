import { useEffect, useMemo, useState } from 'react'
import {
  Save, CheckCircle2, FlaskConical, Award, ListChecks, Hash, SlidersHorizontal,
  Gavel,
} from 'lucide-react'
import { api } from '../api/client.js'
import Button from '../components/Button.jsx'
import Field from '../components/Field.jsx'
import Pill from '../components/Pill.jsx'
import Stamp from '../components/Stamp.jsx'
import { SkeletonLines } from '../components/Skeleton.jsx'
import { useLog } from '../log/LogContext.jsx'

const DEMO_APPLICANT = {
  'RevolvingUtilizationOfUnsecuredLines': 0.77, 'age': 45,
  'NumberOfTime30-59DaysPastDueNotWorse': 2, 'DebtRatio': 0.8, 'MonthlyIncome': 9120,
  'NumberOfOpenCreditLinesAndLoans': 13, 'NumberOfTimes90DaysLate': 0,
  'NumberRealEstateLoansOrLines': 6, 'NumberOfTime60-89DaysPastDueNotWorse': 0,
  'NumberOfDependents': 2,
}

const DECISION_OPTIONS = ['APPROVE', 'MANUAL_REVIEW', 'NON-APPROVE']

/** Number input that allows blank (= unassigned / 0 points). */
function PointsInput({ value, onChange }) {
  return (
    <input
      type="number"
      step="any"
      value={value === null || value === undefined ? '' : value}
      placeholder="0"
      style={{ width: 90, textAlign: 'right' }}
      onChange={(e) => {
        const raw = e.target.value
        onChange(raw === '' ? null : Number(raw))
      }}
    />
  )
}

/** Table row cells for a field-grouped table: renders the field cell once per group. */
function GroupedRows({ rows, fieldOf, cells }) {
  return rows.map((row, i) => {
    const prevField = i > 0 ? fieldOf(rows[i - 1]) : null
    const field = fieldOf(row)
    return (
      <tr key={i}>
        {field !== prevField && (
          <td rowSpan={rows.filter((r) => fieldOf(r) === field).length}
            style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
            {field}
          </td>
        )}
        {cells(row, i)}
      </tr>
    )
  })
}

export default function SopPage() {
  const { log } = useLog()
  const [sop, setSop] = useState(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  const [verifyText, setVerifyText] = useState('')
  const [verifyResult, setVerifyResult] = useState(null)
  const [verifyError, setVerifyError] = useState(null)
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    api.getSop().then(setSop).catch((e) => setError(e.message))
  }, [])

  const catGroups = useMemo(() => {
    if (!sop) return []
    return sop.categorical
  }, [sop])

  const updateRow = (section, idx, patch) => {
    setSop((s) => ({
      ...s,
      [section]: s[section].map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    }))
    setSaved(false)
  }

  const save = async () => {
    setError(null)
    try {
      const savedSop = await api.putSop(sop)
      setSop(savedSop)
      setSaved(true)
      log('SOP — manual guideline recorded to docs/SCORING_SOP.md', 'ok', 'SAVED')
    } catch (e) {
      setError(e.message)
      log(`SOP SAVE FAILED — ${e.message}`, 'bad', 'ERROR')
    }
  }

  const verify = async () => {
    setVerifyError(null)
    setVerifyResult(null)
    let applicant
    try {
      applicant = JSON.parse(verifyText)
    } catch {
      setVerifyError('Invalid JSON — paste a JSON object with the applicant fields.')
      return
    }
    setVerifying(true)
    try {
      const res = await api.verifySop(applicant)
      setVerifyResult(res)
      const agree = res.manual && res.model && !res.model.error && res.manual.decision === res.model.decision
      const modelTxt = res.model.error
        ? `model error`
        : `${(res.model.default_probability * 100).toFixed(1)}% (${res.model.grade})`
      log(
        `SOP CHECK — manual ${Number(res.manual.total).toFixed(1)} (${res.manual.grade}) vs ${modelTxt} · ${agree ? 'agree' : 'disagree'}`,
        agree ? 'ok' : 'warn',
        agree ? 'AGREE' : 'DIFFER',
      )
    } catch (e) {
      setVerifyError(e.message)
    } finally {
      setVerifying(false)
    }
  }

  if (!sop) {
    return (
      <section className="sheet-section">
        <div className="section-head"><h2 className="section-title">SOP Editor</h2></div>
        <SkeletonLines n={8} />
      </section>
    )
  }

  const { manual, model } = verifyResult || {}
  const agree = manual && model && !model.error && manual.decision === model.decision

  return (
    <div>
      <section className="sheet-section">
        <div className="section-head">
          <h2 className="section-title"><SlidersHorizontal size={18} />Scoring Parameters</h2>
          <span className="section-note">the model is not changed by these tables</span>
        </div>
        <p style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-small)', marginTop: 0 }}>
          Manual policy from <code>docs/SCORING_SOP.md</code> — a human-usable cross-check beside the XGBoost model.
          Empty points count as 0; Appendix A of the SOP shows model-derived weights as a reference.
        </p>
        <div className="form-grid">
          <Field label="Base score" hint="total = base score + sum of all field points">
            <input type="number" step="any" value={sop.base_score}
              onChange={(e) => { setSop((s) => ({ ...s, base_score: Number(e.target.value) })); setSaved(false) }} />
          </Field>
        </div>
      </section>

      <section className="sheet-section">
        <div className="section-head">
          <h2 className="section-title"><ListChecks size={18} />Categorical Points</h2>
        </div>
        <div className="table-wrap">
          <table className="ruled-table sop-table">
            <thead>
              <tr><th>Field</th><th>Value</th><th>Points</th></tr>
            </thead>
            <tbody>
              <GroupedRows
                rows={catGroups}
                fieldOf={(r) => r.field}
                cells={(row, idx) => (
                  <>
                    <td>
                      {row.value}
                      {row.baseline && (
                        <span className="sop-baseline" title="Model baseline (reference) category"> *</span>
                      )}
                    </td>
                    <td>
                      <PointsInput value={row.points}
                        onChange={(v) => updateRow('categorical', idx, { points: v })} />
                    </td>
                  </>
                )}
              />
            </tbody>
          </table>
        </div>
        {catGroups.length === 0 && (
          <p className="drift-note">No categorical fields in the current training schema — this table stays empty until one exists.</p>
        )}
      </section>

      <section className="sheet-section">
        <div className="section-head">
          <h2 className="section-title"><Hash size={18} />Numeric Band Points</h2>
        </div>
        <div className="table-wrap">
          <table className="ruled-table sop-table">
            <thead>
              <tr><th>Field</th><th>Band</th><th>Points</th></tr>
            </thead>
            <tbody>
              <GroupedRows
                rows={sop.numeric}
                fieldOf={(r) => r.field}
                cells={(row, idx) => (
                  <>
                    <td className="mono">{row.band}</td>
                    <td>
                      <PointsInput value={row.points}
                        onChange={(v) => updateRow('numeric', idx, { points: v })} />
                    </td>
                  </>
                )}
              />
            </tbody>
          </table>
        </div>
      </section>

      <section className="sheet-section">
        <div className="section-head">
          <h2 className="section-title"><Award size={18} />Grade Cutoffs</h2>
        </div>
        <div className="table-wrap">
          <table className="ruled-table">
            <thead>
              <tr><th>Grade</th><th>Min score</th><th>Max score</th></tr>
            </thead>
            <tbody>
              {sop.grades.map((g, idx) => (
                <tr key={idx}>
                  <td style={{ fontWeight: 700 }}>{g.grade}</td>
                  <td>
                    <PointsInput value={g.min} onChange={(v) => updateRow('grades', idx, { min: v ?? 0 })} />
                  </td>
                  <td>
                    <PointsInput value={g.max} onChange={(v) => updateRow('grades', idx, { max: v ?? 0 })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="sheet-section">
        <div className="section-head">
          <h2 className="section-title"><Gavel size={18} />Decision Policy</h2>
        </div>
        <div className="table-wrap">
          <table className="ruled-table">
            <thead>
              <tr><th>Grade</th><th>Decision</th></tr>
            </thead>
            <tbody>
              {sop.decision.map((d, idx) => (
                <tr key={idx}>
                  <td style={{ fontWeight: 700 }}>{d.grade}</td>
                  <td>
                    <select value={d.decision} onChange={(e) => updateRow('decision', idx, { decision: e.target.value })}>
                      {DECISION_OPTIONS.map((o) => <option key={o} value={o}>{o.replaceAll('_', ' ')}</option>)}
                      {!DECISION_OPTIONS.includes(d.decision) && <option value={d.decision}>{d.decision}</option>}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="sheet-section">
        <div className="section-head">
          <h2 className="section-title"><FlaskConical size={18} />Test Applicant — Verify Against Model</h2>
        </div>
        <p style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-small)', marginTop: 0 }}>
          Paste an applicant as JSON and compare the manual SOP score with the XGBoost model —
          same as <code>python scripts/verify_sop.py</code>.
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-2)', flexWrap: 'wrap' }}>
          <Button variant="ghost" onClick={() => setVerifyText(JSON.stringify(DEMO_APPLICANT, null, 2))}>
            Load demo applicant
          </Button>
          <Button variant="primary" icon={FlaskConical} onClick={verify} disabled={verifying || !verifyText.trim()}>
            {verifying ? 'Verifying…' : 'Verify'}
          </Button>
        </div>
        <textarea
          rows={8}
          value={verifyText}
          onChange={(e) => setVerifyText(e.target.value)}
          placeholder='{"RevolvingUtilizationOfUnsecuredLines": 0.77, ...}'
          className="mono"
          style={{
            width: '100%', padding: 'var(--space-2)', border: '1px solid var(--rule-strong)',
            borderRadius: 'var(--radius)', fontSize: 'var(--text-small)', background: '#fff', color: 'var(--ink)',
          }}
        />
        {verifyError && <p className="error-text">{verifyError}</p>}

        {manual && (
          <div style={{ marginTop: 'var(--space-3)' }}>
            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
              <div className="sop-result-box">
                <div className="sop-result-label">Manual SOP</div>
                <div className="sop-result-value">{Number(manual.total).toFixed(1)}</div>
                <div className="sop-result-sub">Grade {manual.grade} → {manual.decision.replaceAll('_', ' ')}</div>
              </div>
              <div className="sop-result-box">
                <div className="sop-result-label">XGBoost model</div>
                <div className="sop-result-value">
                  {model.error ? '—' : `${(model.default_probability * 100).toFixed(1)}%`}
                </div>
                <div className="sop-result-sub">
                  {model.error ? model.error : `Grade ${model.grade} → ${model.decision.replaceAll('_', ' ')}`}
                </div>
              </div>
              {!model.error && (
                agree
                  ? <Stamp tone="ok">Decisions agree</Stamp>
                  : <Stamp tone="warn">Decisions differ</Stamp>
              )}
            </div>

            {manual.warnings.length > 0 && (
              <p style={{ fontSize: 'var(--text-label)', color: 'var(--warn)', margin: 'var(--space-2) 0 0' }}>
                {manual.warnings.length} warning(s): fields with no points assigned count as 0.
              </p>
            )}

            <div className="table-wrap" style={{ marginTop: 'var(--space-2)' }}>
              <table className="ruled-table">
                <thead>
                  <tr><th>Field</th><th>Value</th><th>Points</th></tr>
                </thead>
                <tbody>
                  {manual.details.map((d, i) => (
                    <tr key={i}>
                      <td>{d.field}</td>
                      <td className="mono">{d.value}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{Number(d.points).toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <div className="signoff-bar">
        <Button variant="primary" icon={Save} onClick={save}>Record SOP</Button>
        {saved && (
          <span className="saved-note">
            <CheckCircle2 size={16} />Saved — docs/SCORING_SOP.md updated
          </span>
        )}
        {error && <span className="error-text">{error}</span>}
      </div>
    </div>
  )
}
