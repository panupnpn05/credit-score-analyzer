import { useEffect, useMemo, useState } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import {
  Save, CheckCircle2, FlaskConical, Award, ListChecks, Hash, SlidersHorizontal,
  Gavel,
} from 'lucide-react'
import { api } from '../api/client.js'
import { prettyField } from '../lib/labels.js'
import Button from '../components/Button.jsx'
import Field from '../components/Field.jsx'
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
function GroupedRows({ rows, fieldOf, cells, t }) {
  return rows.map((row, i) => {
    const prevField = i > 0 ? fieldOf(rows[i - 1]) : null
    const field = fieldOf(row)
    return (
      <tr key={i}>
        {field !== prevField && (
          <td rowSpan={rows.filter((r) => fieldOf(r) === field).length}
            style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
            {prettyField(field, t)}
          </td>
        )}
        {cells(row, i)}
      </tr>
    )
  })
}

export default function SopPage() {
  const { t } = useTranslation()
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
      log(t('log.sopSaved'), 'ok', t('stamps.saved'))
    } catch (e) {
      setError(e.message)
      log(t('log.sopSaveFailed', { message: e.message }), 'bad', t('stamps.error'))
    }
  }

  const verify = async () => {
    setVerifyError(null)
    setVerifyResult(null)
    let applicant
    try {
      applicant = JSON.parse(verifyText)
    } catch {
      setVerifyError(t('sop.invalidJson'))
      return
    }
    setVerifying(true)
    try {
      const res = await api.verifySop(applicant)
      setVerifyResult(res)
      const agree = res.manual && res.model && !res.model.error && res.manual.decision === res.model.decision
      const modelTxt = res.model.error
        ? t('sop.xgboostModel')
        : `${(res.model.default_probability * 100).toFixed(1)}% (${res.model.grade})`
      log(
        t('log.sopCheck', {
          manual: Number(res.manual.total).toFixed(1),
          manualGrade: res.manual.grade,
          modelText: modelTxt,
          verdict: agree ? t('stamps.agree') : t('stamps.differ'),
        }),
        agree ? 'ok' : 'warn',
        agree ? t('stamps.agree') : t('stamps.differ'),
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
        <div className="section-head"><h2 className="section-title">SOP</h2></div>
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
          <h2 className="section-title"><SlidersHorizontal size={18} />{t('sop.paramsTitle')}</h2>
          <span className="section-note">{t('sop.paramsNote')}</span>
        </div>
        <p style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-small)', marginTop: 0 }}>
          <Trans i18nKey="sop.paramsDesc" components={[<code />]} />
        </p>
        <div className="form-grid">
          <Field label={t('sop.baseScore')} hint={t('sop.baseScoreHint')}>
            <input type="number" step="any" value={sop.base_score}
              onChange={(e) => { setSop((s) => ({ ...s, base_score: Number(e.target.value) })); setSaved(false) }} />
          </Field>
        </div>
      </section>

      <section className="sheet-section">
        <div className="section-head">
          <h2 className="section-title"><ListChecks size={18} />{t('sop.catTitle')}</h2>
        </div>
        <div className="table-wrap">
          <table className="ruled-table sop-table">
            <thead>
              <tr><th>{t('predict.thField')}</th><th>{t('predict.thValue')}</th><th>{t('predict.thPoints')}</th></tr>
            </thead>
            <tbody>
              <GroupedRows
                rows={catGroups}
                fieldOf={(r) => r.field}
                t={t}
                cells={(row, idx) => (
                  <>
                    <td>
                      {row.value}
                      {row.baseline && (
                        <span className="sop-baseline" title={t('sop.baselineTitle')}> *</span>
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
          <p className="drift-note">{t('sop.catEmpty')}</p>
        )}
      </section>

      <section className="sheet-section">
        <div className="section-head">
          <h2 className="section-title"><Hash size={18} />{t('sop.numericTitle')}</h2>
        </div>
        <div className="table-wrap">
          <table className="ruled-table sop-table">
            <thead>
              <tr><th>{t('predict.thField')}</th><th>{t('sop.thBand')}</th><th>{t('predict.thPoints')}</th></tr>
            </thead>
            <tbody>
              <GroupedRows
                rows={sop.numeric}
                fieldOf={(r) => r.field}
                t={t}
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
          <h2 className="section-title"><Award size={18} />{t('sop.cutoffsTitle')}</h2>
        </div>
        <div className="table-wrap">
          <table className="ruled-table">
            <thead>
              <tr><th>{t('batch.thGrade')}</th><th>{t('sop.thMin')}</th><th>{t('sop.thMax')}</th></tr>
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
          <h2 className="section-title"><Gavel size={18} />{t('sop.policyTitle')}</h2>
        </div>
        <div className="table-wrap">
          <table className="ruled-table">
            <thead>
              <tr><th>{t('batch.thGrade')}</th><th>{t('sop.thDecision')}</th></tr>
            </thead>
            <tbody>
              {sop.decision.map((d, idx) => (
                <tr key={idx}>
                  <td style={{ fontWeight: 700 }}>{d.grade}</td>
                  <td>
                    <select value={d.decision} onChange={(e) => updateRow('decision', idx, { decision: e.target.value })}>
                      {DECISION_OPTIONS.map((o) => <option key={o} value={o}>{t(`decision.${o}`)}</option>)}
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
          <h2 className="section-title"><FlaskConical size={18} />{t('sop.verifyTitle')}</h2>
        </div>
        <p style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-small)', marginTop: 0 }}>
          <Trans i18nKey="sop.verifyDesc" components={[<code />]} />
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-2)', flexWrap: 'wrap' }}>
          <Button variant="ghost" onClick={() => setVerifyText(JSON.stringify(DEMO_APPLICANT, null, 2))}>
            {t('sop.loadDemo')}
          </Button>
          <Button variant="primary" icon={FlaskConical} onClick={verify} disabled={verifying || !verifyText.trim()}>
            {verifying ? t('sop.verifying') : t('sop.verify')}
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
                <div className="sop-result-label">{t('sop.manualSop')}</div>
                <div className="sop-result-value">{Number(manual.total).toFixed(1)}</div>
                <div className="sop-result-sub">
                  {t('sop.gradeToDecision', { grade: manual.grade, decision: t(`decision.${manual.decision}`) })}
                </div>
              </div>
              <div className="sop-result-box">
                <div className="sop-result-label">{t('sop.xgboostModel')}</div>
                <div className="sop-result-value">
                  {model.error ? '—' : `${(model.default_probability * 100).toFixed(1)}%`}
                </div>
                <div className="sop-result-sub">
                  {model.error ? model.error : t('sop.gradeToDecision', { grade: model.grade, decision: t(`decision.${model.decision}`) })}
                </div>
              </div>
              {!model.error && (
                agree
                  ? <Stamp tone="ok">{t('sop.agreeStamp')}</Stamp>
                  : <Stamp tone="warn">{t('sop.differStamp')}</Stamp>
              )}
            </div>

            {manual.warnings.length > 0 && (
              <p style={{ fontSize: 'var(--text-label)', color: 'var(--warn)', margin: 'var(--space-2) 0 0' }}>
                {t('sop.warnings', { count: manual.warnings.length })}
              </p>
            )}

            <div className="table-wrap" style={{ marginTop: 'var(--space-2)' }}>
              <table className="ruled-table">
                <thead>
                  <tr><th>{t('predict.thField')}</th><th>{t('predict.thValue')}</th><th>{t('predict.thPoints')}</th></tr>
                </thead>
                <tbody>
                  {manual.details.map((d, i) => (
                    <tr key={i}>
                      <td>{prettyField(d.field, t)}</td>
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
        <Button variant="primary" icon={Save} onClick={save}>{t('sop.record')}</Button>
        {saved && (
          <span className="saved-note">
            <CheckCircle2 size={16} />{t('sop.savedNote')}
          </span>
        )}
        {error && <span className="error-text">{error}</span>}
      </div>
    </div>
  )
}
