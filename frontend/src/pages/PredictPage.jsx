import { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import {
  UserRound, FileText, Eye, EyeOff,
  CheckCircle2, AlertTriangle, XCircle, ClipboardList,
  SlidersHorizontal, ShieldCheck, ShieldAlert, ShieldOff, Lightbulb, Play,
} from 'lucide-react'
import { api } from '../api/client.js'
import { prettyField, fmtRange } from '../lib/labels.js'
import { fieldTip } from '../lib/fieldInfo.js'
import Button from '../components/Button.jsx'
import Field from '../components/Field.jsx'
import EmptyState from '../components/EmptyState.jsx'
import Pill from '../components/Pill.jsx'
import Stamp from '../components/Stamp.jsx'
import { SkeletonCard, SkeletonLines } from '../components/Skeleton.jsx'
import { useLog } from '../log/LogContext.jsx'

const GRADE_VARIANTS = { A: 'success', B: 'success', C: 'warning', D: 'danger', E: 'danger' }

const DECISIONS = {
  APPROVE: { tone: 'ok', icon: CheckCircle2, label: 'Approve', logTone: 'ok' },
  MANUAL_REVIEW: { tone: 'warn', icon: AlertTriangle, label: 'Manual Review', logTone: 'warn' },
  'NON-APPROVE': { tone: 'bad', icon: XCircle, label: 'Non-Approve', logTone: 'bad' },
}

const pct = (p) => `${(p * 100).toFixed(1)}%`

function FactorGroup({ title, factors, kind }) {
  if (!factors || factors.length === 0) return null
  const max = Math.max(...factors.map((f) => Math.abs(f.shap_value)), 1e-9)
  return (
    <div className="factor-group">
      <h4>{title}</h4>
      {factors.map((f, i) => (
        <div key={i} className="factor-row" style={{ animationDelay: `${i * 80}ms` }}>
          <span className="factor-name" title={f.feature}>{prettyField(f.feature)}</span>
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

export default function PredictPage() {
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
          init[f.name] = f.type === 'number' ? (f.mean != null ? Number(f.mean.toPrecision(4)) : '') : (f.options[0] ?? '')
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
      const d = DECISIONS[res.decision] || DECISIONS.MANUAL_REVIEW
      log(
        `MODEL RUN — ${id} · p=${pct(res.default_probability)} · Grade ${res.risk_grade} → ${d.label.toUpperCase()}`,
        d.logTone,
        'RUN',
      )
      // Pre-compute counterfactual suggestions (top risk levers) in the background
      api.whatif(applicant, {}).then(setWhatIf).catch(() => setWhatIf(null))
    } catch (err) {
      setError(err.message)
      setResult(null)
      log(`MODEL RUN FAILED — ${err.message}`, 'bad', 'ERROR')
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
    const t = setTimeout(async () => {
      try {
        const res = await api.whatif(result.applicant, mods)
        if (req === scenarioReq.current) {
          setScenario(res.scenario)
          const improved = res.scenario.grade_improved
          log(
            `SCENARIO — ${Object.keys(mods).length} change(s) · Δ ${(res.scenario.delta_probability * 100).toFixed(1)} pts → Grade ${res.scenario.risk_grade}`,
            improved ? 'ok' : 'ink',
            improved ? 'IMPROVED' : 'SCENARIO',
          )
        }
      } catch (e) {
        if (req === scenarioReq.current) setScenario({ error: e.message })
      }
    }, 400)
    return () => clearTimeout(t)
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
              `VERIFIED — ${st.grounded}/${st.total} claims grounded${st.contradicted ? ` · ${st.contradicted} contradicted` : ''}`,
              st.contradicted ? 'warn' : 'ok',
              'VERIFIED',
            )
          } else {
            log('VERIFICATION — did not complete', 'warn', 'CHECK')
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
    log(`MEMO — generation started · ${result.applicant_id}`, 'ink', 'MEMO')
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
          log('MEMO — demo cache served · Ollama unreachable', 'warn', 'DEMO')
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

  const decision = result ? (DECISIONS[result.decision] || DECISIONS.MANUAL_REVIEW) : null
  const DecisionIcon = decision?.icon

  return (
    <div className="page-grid">
      <section className="sheet-section">
        <div className="section-head">
          <h2 className="section-title"><UserRound size={18} />Applicant Intake</h2>
          <span className="section-note">fields from the training schema</span>
        </div>
        <form onSubmit={handlePredict}>
          {schemaError && <p className="error-text">{schemaError}</p>}
          {!schema && !schemaError && <SkeletonLines n={8} />}
          {schema && (
            <>
              <Field label="Applicant ID" hint="optional">
                <input
                  type="text"
                  value={applicantId}
                  onChange={(e) => setApplicantId(e.target.value)}
                  placeholder="APP_0001"
                />
              </Field>
              <div className="form-grid">
                {numericFields.map((f) => (
                  <Field key={f.name} label={prettyField(f.name)} hint={fmtRange(f.min, f.max)} tip={fieldTip(f.name)}>
                    <input
                      type="number"
                      step="any"
                      min={f.min}
                      max={f.max}
                      value={form[f.name]}
                      onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                      required
                    />
                  </Field>
                ))}
                {categoricalFields.map((f) => (
                  <Field key={f.name} label={prettyField(f.name)} tip={fieldTip(f.name)}>
                    <select value={form[f.name]} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}>
                      {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </Field>
                ))}
              </div>
              <div style={{ marginTop: 'var(--space-2)' }}>
                <Button variant="primary" icon={loading ? undefined : Play} type="submit" disabled={loading}>
                  {loading ? 'Running…' : 'Run Model'}
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
              title="No entry on this page yet"
              description="Fill in the applicant data and run the model — the grade, decision, and factor evidence are recorded here, entry by entry."
            />
          </section>
        )}

        {loading && <div className="skeleton skeleton-card enter" />}

        {result && !loading && decision && (
          <section className="sheet-section">
            <div className="record-line">
              <span>RECORD — {result.applicant_id}</span>
              <Stamp>Run</Stamp>
            </div>

            <div className="verdict-block">
              <div className="verdict-prob">
                <span className="verdict-label">Default probability</span>
                <span className="verdict-num">{pct(result.default_probability)}</span>
              </div>
              <div className={`verdict-grade grade-${result.risk_grade}`} aria-label={`Risk grade ${result.risk_grade}`}>
                {result.risk_grade}
              </div>
              <div className="verdict-side">
                <Stamp tone={decision.tone} large>
                  {DecisionIcon && <DecisionIcon size={18} strokeWidth={2.5} />}
                  {decision.label}
                </Stamp>
                <span className="verdict-mock">mockup decision — thresholds on the Settings folio</span>
              </div>
            </div>

            <div className="ruler-wrap">
              <div className="ruler" role="img" aria-label={`Default probability ${pct(result.default_probability)}`}>
                <div className="ruler-fill" style={{ '--frac': Math.min(Math.max(result.default_probability, 0), 1) }} />
                <div className="ruler-marker" style={{ '--pos': `${Math.min(Math.max(result.default_probability, 0), 1) * 100}%` }} />
              </div>
              <div className="ruler-labels"><span>0%</span><span>default probability</span><span>100%</span></div>
            </div>

            {result.sop && (
              <div className="sop-inline">
                <div className="sop-inline-head">
                  <span className="sop-inline-title">Manual SOP</span>
                  <strong className="mono">{Number(result.sop.score).toFixed(1)}</strong>
                  <Pill variant={GRADE_VARIANTS[result.sop.grade] || 'warning'}>Grade {result.sop.grade}</Pill>
                  <span className="sop-inline-decision">{result.sop.decision.replaceAll('_', ' ')}</span>
                  {result.sop.decision === result.decision ? (
                    <Pill variant="success" icon={CheckCircle2}>agrees with model</Pill>
                  ) : (
                    <Pill variant="warning" icon={AlertTriangle}>differs from model</Pill>
                  )}
                </div>
                {result.sop.warnings.length > 0 && (
                  <p className="sop-inline-note">
                    {result.sop.warnings.length} field(s) have no SOP points assigned (counted as 0) — set them on the SOP folio.
                  </p>
                )}
                <details className="sop-inline-details">
                  <summary>Point breakdown</summary>
                  <div className="table-wrap">
                    <table className="ruled-table">
                      <thead>
                        <tr><th>Field</th><th>Value</th><th style={{ textAlign: 'right' }}>Points</th></tr>
                      </thead>
                      <tbody>
                        {result.sop.breakdown.map((d, i) => (
                          <tr key={i}>
                            <td>{d.field}</td>
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

            <FactorGroup title="Risk factors — increase default risk" factors={result.risk_factors} kind="risk" />
            <FactorGroup title="Protective factors — decrease default risk" factors={result.protective_factors} kind="protect" />

            {whatIf && whatIf.suggestions && whatIf.suggestions.length > 0 && (
              <div className="whatif-panel">
                <h4><SlidersHorizontal size={16} /> What-If Simulator</h4>
                <p className="whatif-hint">
                  Counterfactual re-scoring — live and deterministic, no LLM. Edit a value and the record re-scores itself.
                </p>
                <div className="whatif-grid">
                  {result.risk_factors.slice(0, 4).map((f) => (
                    <div key={f.feature} className="whatif-row">
                      <span className="factor-name" title={f.feature}>{prettyField(f.feature)}</span>
                      <input
                        type="number"
                        step="any"
                        value={modValues[f.feature] ?? ''}
                        placeholder={`now: ${result.applicant[f.feature]}`}
                        onChange={(e) => setModValues({ ...modValues, [f.feature]: e.target.value })}
                      />
                    </div>
                  ))}
                </div>
                <div className="whatif-live">
                  {scenario === undefined && <span className="whatif-hint" style={{ margin: 0 }}>re-scoring…</span>}
                  {scenario && scenario.error && <span className="error-text">{scenario.error}</span>}
                  {scenario && !scenario.error && (
                    <>
                      <span className="verdict-label">Scenario</span>
                      <span className="live-num" key={scenario.default_probability}>{pct(scenario.default_probability)}</span>
                      <span className="mono" style={{ fontSize: 'var(--text-label)', color: 'var(--ink-soft)' }}>
                        {scenario.delta_probability > 0 ? '+' : ''}{(scenario.delta_probability * 100).toFixed(1)} pts
                      </span>
                      <Pill variant={GRADE_VARIANTS[scenario.risk_grade]}>Grade {scenario.risk_grade}</Pill>
                      {scenario.grade_improved && <Pill variant="success" icon={CheckCircle2}>grade improved</Pill>}
                    </>
                  )}
                </div>
                {whatIf.minimal_upgrade && (
                  <p className="whatif-tip">
                    <Lightbulb size={14} />
                    Reduce <strong>{prettyField(whatIf.minimal_upgrade.field)}</strong> from{' '}
                    <span className="mono">{whatIf.minimal_upgrade.from}</span> to ≤{' '}
                    <span className="mono">{Number(whatIf.minimal_upgrade.to).toFixed(2)}</span> → reach Grade{' '}
                    <strong>{whatIf.minimal_upgrade.new_grade}</strong>
                  </p>
                )}
              </div>
            )}

            <div className="memo-actions">
              <Button variant="primary" icon={FileText} onClick={handleMemo} disabled={memoLoading}>
                {memoLoading ? 'Generating…' : 'Generate Credit Memo'}
              </Button>
              <Button variant="ghost" icon={showPrompt ? EyeOff : Eye} onClick={() => setShowPrompt(!showPrompt)}>
                {showPrompt ? 'Hide Prompt' : 'Show Prompt'}
              </Button>
            </div>
            {memoError && <p className="error-text">{memoError}</p>}

            {(memo !== null) && (
              <div className="memo-sheet">
                <div className="memo-head">
                  <h4>Credit Memo — {result.applicant_id}</h4>
                  <div className="memo-badges">
                    {demoNotice && <Pill variant="warning" icon={AlertTriangle}>demo memo — Ollama unreachable</Pill>}
                    {verify && verify.status === 'running' && (
                      <Pill variant="warning" icon={ShieldCheck}>verifying claims…</Pill>
                    )}
                    {verify && verify.status === 'done' && (
                      verify.contradicted > 0 ? (
                        <Stamp tone="bad">{verify.grounded}/{verify.total} grounded · {verify.contradicted} contradicted</Stamp>
                      ) : (
                        <Stamp tone="ok">{verify.grounded}/{verify.total} claims grounded</Stamp>
                      )
                    )}
                    {verify && verify.status === 'error' && (
                      <Pill variant="warning" icon={ShieldOff}>verification unavailable</Pill>
                    )}
                  </div>
                </div>
                {verify && verify.status === 'done' && verify.contradicted > 0 && (
                  <details className="verify-details">
                    <summary>Review flagged claims ({verify.contradicted + verify.unsupported})</summary>
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
                    Memo was cut off at the token limit — increase Max tokens in Settings.
                  </p>
                )}
              </div>
            )}
            {showPrompt && result.llm_prompt && <pre className="prompt-slab">{result.llm_prompt}</pre>}
          </section>
        )}
      </div>
    </div>
  )
}
