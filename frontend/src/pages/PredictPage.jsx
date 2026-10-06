import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import {
  UserRound, FileText, Eye, EyeOff,
  CheckCircle2, AlertTriangle, XCircle, ClipboardList,
  SlidersHorizontal, ShieldCheck, ShieldAlert, ShieldOff, Lightbulb, Play,
} from 'lucide-react'
import { api } from '../api/client.js'
import { prettyField, fmtRange, isIntegerField } from '../lib/labels.js'
import { fieldTip } from '../lib/fieldInfo.js'
import Button from '../components/Button.jsx'
import Field from '../components/Field.jsx'
import EmptyState from '../components/EmptyState.jsx'
import Pill from '../components/Pill.jsx'
import Stamp from '../components/Stamp.jsx'
import { SkeletonLines } from '../components/Skeleton.jsx'
import { useLog } from '../log/LogContext.jsx'

const GRADE_VARIANTS = { A: 'success', B: 'success', C: 'warning', D: 'danger', E: 'danger' }

const pct = (p) => `${(p * 100).toFixed(1)}%`

export default function PredictPage() {
  const { t } = useTranslation()
  const { log } = useLog()
  const [schema, setSchema] = useState(null)
  const [schemaError, setSchemaError] = useState(null)
  const [form, setForm] = useState({})
  const [applicantId, setApplicantId] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [memo, setMemo] = useState(null)
  const [memoLoading, setMemoLoading] = useState(false)
  const [memoError, setMemoError] = useState(null)
  const [memoTruncated, setMemoTruncated] = useState(false)
  const [showPrompt, setShowPrompt] = useState(false)
  const [whatIf, setWhatIf] = useState(null)
  const [scenario, setScenario] = useState(null)
  const [modValues, setModValues] = useState({})
  const [verify, setVerify] = useState(null)
  const [demoNotice, setDemoNotice] = useState(false)
  const scenarioReq = useRef(0)

  useEffect(() => {
    api.schema()
      .then((s) => {
        setSchema(s)
        const init = {}
        s.fields.forEach((f) => {
          init[f.name] = f.type === 'number'
            ? (f.mean != null ? (isIntegerField(f) ? Math.round(f.mean) : Number(f.mean.toPrecision(4))) : '')
            : (f.options[0] ?? '')
        })
        setForm(init)
      })
      .catch((e) => setSchemaError(e.message))
  }, [])

  const numericFields = useMemo(() => schema?.fields.filter((f) => f.type === 'number') || [], [schema])
  const categoricalFields = useMemo(() => schema?.fields.filter((f) => f.type === 'category') || [], [schema])

  const handlePredict = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMemo(null)
    setMemoError(null)
    setMemoTruncated(false)
    setShowPrompt(false)
    setWhatIf(null)
    setScenario(null)
    setModValues({})
    setVerify(null)
    setDemoNotice(false)
    try {
      const applicant = {}
      schema.fields.forEach((f) => {
        applicant[f.name] = f.type === 'number' ? Number(form[f.name]) : form[f.name]
      })
      const id = applicantId || 'APP_0001'
      const res = await api.predict(applicant, id)
      setResult({ ...res, applicant })
      log(
        t('log.modelRun', {
          id,
          pct: pct(res.default_probability),
          grade: res.risk_grade,
          decision: t(`decision.${res.decision}`),
        }),
        res.decision === 'NON-APPROVE' ? 'bad' : res.decision === 'MANUAL_REVIEW' ? 'warn' : 'ok',
        t('stamps.run'),
      )
      // Pre-compute counterfactual suggestions (top risk levers) in the background
      api.whatif(applicant, {}).then(setWhatIf).catch(() => setWhatIf(null))
    } catch (err) {
      setError(err.message)
      setResult(null)
      log(t('log.modelRunFailed', { message: err.message }), 'bad', t('stamps.error'))
    } finally {
      setLoading(false)
    }
  }

  // Live-bound what-if: every edit re-scores after a short settle — no submit step.
  useEffect(() => {
    if (!result) return
    const mods = {}
    Object.entries(modValues).forEach(([k, v]) => {
      if (v !== '' && v !== null && Number(v) !== result.applicant[k]) mods[k] = Number(v)
    })
    if (Object.keys(mods).length === 0) {
      setScenario(null)
      return
    }
    const req = ++scenarioReq.current
    setScenario(undefined)
    const t0 = setTimeout(async () => {
      try {
        const res = await api.whatif(result.applicant, mods)
        if (req === scenarioReq.current) {
          setScenario(res.scenario)
          const improved = res.scenario.grade_improved
          log(
            t('log.scenario', {
              count: Object.keys(mods).length,
              delta: (res.scenario.delta_probability * 100).toFixed(1),
              grade: res.scenario.risk_grade,
            }),
            improved ? 'ok' : 'ink',
            improved ? t('stamps.improved') : t('stamps.scenario'),
          )
        }
      } catch (e) {
        if (req === scenarioReq.current) setScenario({ error: e.message })
      }
    }, 400)
    return () => clearTimeout(t0)
  }, [modValues, result]) // eslint-disable-line react-hooks/exhaustive-deps

  const startVerification = async (memoText) => {
    setVerify({ status: 'running' })
    try {
      const { verify_id } = await api.memoVerify(memoText, result)
      for (let i = 0; i < 45; i++) {
        await new Promise((r) => setTimeout(r, 2000))
        const st = await api.memoVerifyStatus(verify_id).catch(() => null)
        if (!st) break
        if (st.status !== 'running') {
          setVerify(st)
          if (st.status === 'done') {
            log(
              t('log.verified', {
                grounded: st.grounded,
                total: st.total,
                contradicted: st.contradicted ? ` · ${t('predict.groundedContradicted', { grounded: st.grounded, total: st.total, contradicted: st.contradicted })}` : '',
              }),
              st.contradicted ? 'warn' : 'ok',
              t('stamps.verified'),
            )
          } else {
            log(t('log.verifyFailed'), 'warn', t('stamps.check'))
          }
          return
        }
      }
      setVerify({ status: 'error', error: 'Verification timed out.' })
    } catch (e) {
      setVerify({ status: 'error', error: e.message })
    }
  }

  const handleMemo = async () => {
    setMemoLoading(true)
    setMemoError(null)
    setMemoTruncated(false)
    setMemo('')
    setVerify(null)
    setDemoNotice(false)
    log(t('log.memoStarted', { id: result.applicant_id }), 'ink', t('stamps.memo'))
    let acc = ''
    try {
      await api.memoStream(result.applicant, result.applicant_id, result.llm_prompt, {
        onToken: (token) => {
          acc += token
          setMemo((m) => (m || '') + token)
        },
        onError: (msg) => setMemoError(msg),
        onDemoNotice: () => {
          setDemoNotice(true)
          log(t('log.memoDemo'), 'warn', t('stamps.demo'))
        },
        onDone: (finishReason) => {
          setMemoTruncated(finishReason === 'length')
          // Faithfulness audit: skip for demo memos (they don't match this evidence)
          if (finishReason !== 'demo' && !memoError && acc.trim().length >= 20) {
            startVerification(acc)
          }
        },
      })
    } catch (err) {
      setMemoError(err.message)
    } finally {
      setMemoLoading(false)
    }
  }

  const decisionTone = result
    ? result.decision === 'APPROVE' ? 'ok' : result.decision === 'NON-APPROVE' ? 'bad' : 'warn'
    : null
  const DecisionIcon = result?.decision === 'APPROVE' ? CheckCircle2
    : result?.decision === 'NON-APPROVE' ? XCircle
    : AlertTriangle

  return (
    <div className="page-grid">
      <section className="sheet-section">
        <div className="section-head">
          <h2 className="section-title"><UserRound size={18} />{t('predict.intakeTitle')}</h2>
          <span className="section-note">{t('predict.intakeNote')}</span>
        </div>
        <form onSubmit={handlePredict}>
          {schemaError && <p className="error-text">{schemaError}</p>}
          {!schema && !schemaError && <SkeletonLines n={8} />}
          {schema && (
            <>
              <Field label={t('predict.applicantId')} hint={t('predict.optional')}>
                <input
                  type="text"
                  value={applicantId}
                  onChange={(e) => setApplicantId(e.target.value)}
                  placeholder="APP_0001"
                />
              </Field>
              <div className="form-grid">
                {numericFields.map((f) => (
                  <Field key={f.name} label={prettyField(f.name, t)} hint={t('predict.trainingRange', { range: fmtRange(f.min, f.max) })} tip={fieldTip(f.name, t)}>
                    <input
                      type="number"
                      step={isIntegerField(f) ? 1 : 'any'}
                      inputMode="numeric"
                      value={form[f.name]}
                      onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                      required
                    />
                  </Field>
                ))}
                {categoricalFields.map((f) => (
                  <Field key={f.name} label={prettyField(f.name, t)} tip={fieldTip(f.name, t)}>
                    <select value={form[f.name]} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}>
                      {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </Field>
                ))}
              </div>
              <div style={{ marginTop: 'var(--space-2)' }}>
                <Button variant="primary" icon={loading ? undefined : Play} type="submit" disabled={loading}>
                  {loading ? t('predict.running') : t('predict.runModel')}
                </Button>
              </div>
              {error && <p className="error-text">{error}</p>}
            </>
          )}
        </form>
      </section>

      <div>
        {!result && !loading && (
          <section className="sheet-section">
            <EmptyState
              icon={ClipboardList}
              title={t('predict.emptyTitle')}
              description={t('predict.emptyDesc')}
            />
          </section>
        )}

        {loading && <div className="skeleton skeleton-card enter" />}

        {result && !loading && decisionTone && (
          <section className="sheet-section">
            <div className="record-line">
              <span>{t('predict.record', { id: result.applicant_id })}</span>
              <Stamp>{t('stamps.run')}</Stamp>
            </div>

            <div className="verdict-block">
              <div className="verdict-prob">
                <span className="verdict-label">{t('predict.defaultProb')}</span>
                <span className="verdict-num">{pct(result.default_probability)}</span>
              </div>
              <div className={`verdict-grade grade-${result.risk_grade}`} aria-label={t('grade', { grade: result.risk_grade })}>
                {result.risk_grade}
              </div>
              <div className="verdict-side">
                <Stamp tone={decisionTone} large>
                  <DecisionIcon size={18} strokeWidth={2.5} />
                  {t(`decision.${result.decision}`)}
                </Stamp>
                <span className="verdict-mock">{t('predict.mockupNote')}</span>
              </div>
            </div>

            <div className="ruler-wrap">
              <div className="ruler" role="img" aria-label={`${t('predict.defaultProb')} ${pct(result.default_probability)}`}>
                <div className="ruler-fill" style={{ '--frac': Math.min(Math.max(result.default_probability, 0), 1) }} />
                <div className="ruler-marker" style={{ '--pos': `${Math.min(Math.max(result.default_probability, 0), 1) * 100}%` }} />
              </div>
              <div className="ruler-labels"><span>0%</span><span>{t('predict.rulerLabel')}</span><span>100%</span></div>
            </div>

            {result.sop && (
              <div className="sop-inline">
                <div className="sop-inline-head">
                  <span className="sop-inline-title">{t('predict.sopInline')}</span>
                  <strong className="mono">{Number(result.sop.score).toFixed(1)}</strong>
                  <Pill variant={GRADE_VARIANTS[result.sop.grade] || 'warning'}>{t('grade', { grade: result.sop.grade })}</Pill>
                  <span className="sop-inline-decision">{t(`decision.${result.sop.decision}`)}</span>
                  {result.sop.decision === result.decision ? (
                    <Pill variant="success" icon={CheckCircle2}>{t('predict.agrees')}</Pill>
                  ) : (
                    <Pill variant="warning" icon={AlertTriangle}>{t('predict.differs')}</Pill>
                  )}
                </div>
                {result.sop.warnings.length > 0 && (
                  <p className="sop-inline-note">
                    {t('predict.sopWarnings', { count: result.sop.warnings.length })}
                  </p>
                )}
                <details className="sop-inline-details">
                  <summary>{t('predict.breakdown')}</summary>
                  <div className="table-wrap">
                    <table className="ruled-table">
                      <thead>
                        <tr><th>{t('predict.thField')}</th><th>{t('predict.thValue')}</th><th style={{ textAlign: 'right' }}>{t('predict.thPoints')}</th></tr>
                      </thead>
                      <tbody>
                        {result.sop.breakdown.map((d, i) => (
                          <tr key={i}>
                            <td>{prettyField(d.field, t)}</td>
                            <td className="mono">{d.value}</td>
                            <td className="mono" style={{ textAlign: 'right' }}>
                              {d.points > 0 ? '+' : ''}{Number(d.points).toFixed(1)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </div>
            )}

            <FactorGroup title={t('predict.riskFactors')} factors={result.risk_factors} kind="risk" t={t} />
            <FactorGroup title={t('predict.protectiveFactors')} factors={result.protective_factors} kind="protect" t={t} />

            {whatIf && whatIf.suggestions && whatIf.suggestions.length > 0 && (
              <div className="whatif-panel">
                <h4><SlidersHorizontal size={16} /> {t('predict.whatifTitle')}</h4>
                <p className="whatif-hint">{t('predict.whatifHint')}</p>
                <div className="whatif-grid">
                  {result.risk_factors.slice(0, 4).map((f) => (
                    <div key={f.feature} className="whatif-row">
                      <span className="factor-name" title={f.feature}>{prettyField(f.feature, t)}</span>
                      <input
                        type="number"
                        step={numericFields.some((nf) => nf.name === f.feature && isIntegerField(nf)) ? 1 : 'any'}
                        inputMode="numeric"
                        value={modValues[f.feature] ?? ''}
                        placeholder={`${t('predict.now')} ${result.applicant[f.feature]}`}
                        onChange={(e) => setModValues({ ...modValues, [f.feature]: e.target.value })}
                      />
                    </div>
                  ))}
                </div>
                <div className="whatif-live">
                  {scenario === undefined && <span className="whatif-hint" style={{ margin: 0 }}>{t('predict.rescoring')}</span>}
                  {scenario && scenario.error && <span className="error-text">{scenario.error}</span>}
                  {scenario && !scenario.error && (
                    <>
                      <span className="verdict-label">{t('predict.scenario')}</span>
                      <span className="live-num" key={scenario.default_probability}>{pct(scenario.default_probability)}</span>
                      <span className="mono" style={{ fontSize: 'var(--text-label)', color: 'var(--ink-soft)' }}>
                        {scenario.delta_probability > 0 ? '+' : ''}{(scenario.delta_probability * 100).toFixed(1)} pts
                      </span>
                      <Pill variant={GRADE_VARIANTS[scenario.risk_grade]}>{t('grade', { grade: scenario.risk_grade })}</Pill>
                      {scenario.grade_improved && <Pill variant="success" icon={CheckCircle2}>{t('predict.gradeImproved')}</Pill>}
                    </>
                  )}
                </div>
                {whatIf.minimal_upgrade && (
                  <p className="whatif-tip">
                    <Lightbulb size={14} />
                    <Trans
                      i18nKey="predict.tipReduce"
                      values={{
                        field: prettyField(whatIf.minimal_upgrade.field, t),
                        from: whatIf.minimal_upgrade.from,
                        to: Number(whatIf.minimal_upgrade.to).toFixed(2),
                        grade: whatIf.minimal_upgrade.new_grade,
                      }}
                      components={[<strong />, <span className="mono" />, <span className="mono" />, <strong />]}
                    />
                  </p>
                )}
              </div>
            )}

            <div className="memo-actions">
              <Button variant="primary" icon={FileText} onClick={handleMemo} disabled={memoLoading}>
                {memoLoading ? t('predict.generating') : t('predict.generateMemo')}
              </Button>
              <Button variant="ghost" icon={showPrompt ? EyeOff : Eye} onClick={() => setShowPrompt(!showPrompt)}>
                {showPrompt ? t('predict.hidePrompt') : t('predict.showPrompt')}
              </Button>
            </div>
            {memoError && <p className="error-text">{memoError}</p>}

            {(memo !== null) && (
              <div className="memo-sheet">
                <div className="memo-head">
                  <h4>{t('predict.memoTitle', { id: result.applicant_id })}</h4>
                  <div className="memo-badges">
                    {demoNotice && <Pill variant="warning" icon={AlertTriangle}>{t('predict.demoMemo')}</Pill>}
                    {verify && verify.status === 'running' && (
                      <Pill variant="warning" icon={ShieldCheck}>{t('predict.verifying')}</Pill>
                    )}
                    {verify && verify.status === 'done' && (
                      verify.contradicted > 0 ? (
                        <Stamp tone="bad">{t('predict.groundedContradicted', { grounded: verify.grounded, total: verify.total, contradicted: verify.contradicted })}</Stamp>
                      ) : (
                        <Stamp tone="ok">{t('predict.claimsGrounded', { grounded: verify.grounded, total: verify.total })}</Stamp>
                      )
                    )}
                    {verify && verify.status === 'error' && (
                      <Pill variant="warning" icon={ShieldOff}>{t('predict.verifyUnavailable')}</Pill>
                    )}
                  </div>
                </div>
                {verify && verify.status === 'done' && verify.contradicted > 0 && (
                  <details className="verify-details">
                    <summary>{t('predict.flaggedClaims', { count: verify.contradicted + verify.unsupported })}</summary>
                    <ul>
                      {verify.claims.filter((c) => c.verdict !== 'grounded').map((c, i) => (
                        <li key={i} className={`verify-claim ${c.verdict}`}>
                          <strong>{c.verdict}</strong> — {c.claim}
                          {c.note && <em> ({c.note})</em>}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                <div className="memo-markdown">
                  <ReactMarkdown>{memo}</ReactMarkdown>
                  {memoLoading && <span className="stream-caret" />}
                </div>
                {memoTruncated && (
                  <p className="truncation-notice">
                    <AlertTriangle size={14} />
                    {t('predict.truncated')}
                  </p>
                )}
              </div>
            )}
            {showPrompt && result.llm_prompt && (
              <pre className="prompt-slab">
                <span className="prompt-label">{t('predict.promptSlab')}</span>
                {result.llm_prompt}
              </pre>
            )}
          </section>
        )}
      </div>
    </div>
  )
}

function FactorGroup({ title, factors, kind, t }) {
  if (!factors || factors.length === 0) return null
  const max = Math.max(...factors.map((f) => Math.abs(f.shap_value)), 1e-9)
  return (
    <div className="factor-group">
      <h4>{title}</h4>
      {factors.map((f, i) => (
        <div key={i} className="factor-row" style={{ animationDelay: `${i * 80}ms` }}>
          <span className="factor-name" title={f.feature}>{prettyField(f.feature, t)}</span>
          <div className="factor-track">
            <div className={`factor-bar ${kind}`} style={{ width: `${(Math.abs(f.shap_value) / max) * 100}%` }} />
          </div>
          <span className={`factor-shap ${kind}`}>
            {f.shap_value > 0 ? '+' : ''}{f.shap_value.toFixed(4)}
          </span>
        </div>
      ))}
    </div>
  )
}
