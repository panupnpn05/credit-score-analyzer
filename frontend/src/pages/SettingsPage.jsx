import { useEffect, useRef, useState } from 'react'
import { SlidersHorizontal, Bot, Cpu, Save, RefreshCw, CheckCircle2, PenLine } from 'lucide-react'
import { api } from '../api/client.js'
import Button from '../components/Button.jsx'
import Field from '../components/Field.jsx'
import EmptyState from '../components/EmptyState.jsx'
import Stamp from '../components/Stamp.jsx'
import { SkeletonLines } from '../components/Skeleton.jsx'
import { useLog } from '../log/LogContext.jsx'

const XGB_FIELDS = [
  ['max_depth', 1, 16, 1],
  ['learning_rate', 0.001, 1, 0.001],
  ['n_estimators', 10, 10000, 10],
  ['subsample', 0.1, 1, 0.05],
  ['colsample_bytree', 0.1, 1, 0.05],
  ['scale_pos_weight', 0.1, 20, 0.1],
  ['early_stopping_rounds', 1, 1000, 1],
]

export default function SettingsPage() {
  const { log, operator, setOperator } = useLog()
  const [settings, setSettings] = useState(null)
  const [metrics, setMetrics] = useState(null)
  const [models, setModels] = useState({ models: [], error: null })
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)
  const [retrainStatus, setRetrainStatus] = useState(null)
  const pollRef = useRef(null)
  const wasRunning = useRef(false)

  useEffect(() => {
    api.getSettings().then(setSettings).catch((e) => setError(e.message))
    api.metrics().then(setMetrics).catch(() => setMetrics(null))
    api.ollamaModels().then(setModels).catch(() => setModels({ models: [], error: null }))
    api.retrainStatus().then(setRetrainStatus).catch(() => {})
  }, [])

  useEffect(() => () => clearInterval(pollRef.current), [])

  const update = (section, key, value) => {
    setSettings((s) => ({ ...s, [section]: { ...s[section], [key]: value } }))
    setSaved(false)
  }

  const save = async () => {
    setError(null)
    try {
      const merged = await api.putSettings(settings)
      setSettings(merged)
      setSaved(true)
      log('SETTINGS — thresholds, LLM and model parameters recorded', 'ok', 'SAVED')
    } catch (e) {
      setError(e.message)
      log(`SETTINGS SAVE FAILED — ${e.message}`, 'bad', 'ERROR')
    }
  }

  const startRetrain = async () => {
    setError(null)
    try {
      await api.putSettings(settings)
      await api.retrain()
      setRetrainStatus({ running: true, message: 'Starting…', error: null })
      wasRunning.current = true
      log('RETRAIN — started with current settings', 'ink', 'RETRAIN')
      pollRef.current = setInterval(async () => {
        const st = await api.retrainStatus()
        setRetrainStatus(st)
        if (!st.running) {
          clearInterval(pollRef.current)
          if (wasRunning.current) {
            log(`RETRAIN — finished · ${st.message || 'model artifacts replaced'}`, st.error ? 'bad' : 'ok', st.error ? 'ERROR' : 'DONE')
            wasRunning.current = false
          }
          const m = await api.metrics().catch(() => null)
          if (m) setMetrics(m)
        }
      }, 2000)
    } catch (e) {
      setError(e.message)
      log(`RETRAIN FAILED — ${e.message}`, 'bad', 'ERROR')
    }
  }

  if (!settings) {
    return (
      <section className="sheet-section">
        <div className="section-head"><h2 className="section-title">Settings</h2></div>
        <SkeletonLines n={8} />
      </section>
    )
  }

  const d = settings.decision
  const llm = settings.llm
  const xgb = settings.xgboost

  return (
    <div>
      <section className="sheet-section">
        <div className="section-head">
          <h2 className="section-title"><PenLine size={18} />Record Keeper</h2>
          <span className="section-note">initials are written into every log entry</span>
        </div>
        <div className="form-grid">
          <Field label="Operator initials" hint="up to 4 letters, e.g. PN">
            <input
              type="text"
              value={operator}
              maxLength={4}
              onChange={(e) => setOperator(e.target.value)}
              placeholder="PN"
            />
          </Field>
        </div>
        {operator
          ? <Stamp tone="ok">INITIALS SET — {operator}</Stamp>
          : <p className="drift-note">Blank for now — entries carry no initials until a record keeper is named.</p>}
      </section>

      <section className="sheet-section">
        <div className="section-head">
          <h2 className="section-title"><SlidersHorizontal size={18} />Decision Thresholds</h2>
          <span className="section-note">mockup loan decision from predicted probability</span>
        </div>
        <Field label={`Approve below — ${d.approve_threshold.toFixed(2)}`}>
          <input type="range" min="0" max="1" step="0.01" value={d.approve_threshold}
            onChange={(e) => update('decision', 'approve_threshold', Number(e.target.value))} />
        </Field>
        <Field label={`Non-approve above — ${d.decline_threshold.toFixed(2)}`}>
          <input type="range" min="0" max="1" step="0.01" value={d.decline_threshold}
            onChange={(e) => update('decision', 'decline_threshold', Number(e.target.value))} />
        </Field>
        <p className="mono" style={{ fontSize: 'var(--text-label)', color: 'var(--ink-faint)' }}>
          &lt; {d.approve_threshold.toFixed(2)} → Approve · &gt; {d.decline_threshold.toFixed(2)} → Non-approve · between → Manual review
        </p>
      </section>

      <section className="sheet-section">
        <div className="section-head">
          <h2 className="section-title"><Bot size={18} />LLM Settings</h2>
          <span className="section-note">memos are generated locally — nothing leaves this machine</span>
        </div>
        <div className="checkbox-row" style={{ marginBottom: 'var(--space-2)' }}>
          <input id="llm-enabled" type="checkbox" checked={llm.enabled}
            onChange={(e) => update('llm', 'enabled', e.target.checked)} />
          <label htmlFor="llm-enabled">Enable Ollama memo generation</label>
        </div>
        <div className="checkbox-row" style={{ marginBottom: 'var(--space-2)' }}>
          <input id="llm-include-sop" type="checkbox" checked={llm.include_sop !== false}
            onChange={(e) => update('llm', 'include_sop', e.target.checked)} />
          <label htmlFor="llm-include-sop">
            Include SOP guideline in memo prompt
            <span style={{ color: 'var(--ink-faint)', fontSize: 'var(--text-label)', display: 'block' }}>
              appends the manual scoring SOP rules + this applicant's point breakdown — the LLM uses them as its judging guideline
            </span>
          </label>
        </div>
        <div className="form-grid">
          <Field label="Ollama URL">
            <input type="text" value={llm.ollama_url} onChange={(e) => update('llm', 'ollama_url', e.target.value)} />
          </Field>
          <Field label="Model">
            {models.models.length > 0 ? (
              <select value={llm.model} onChange={(e) => update('llm', 'model', e.target.value)}>
                {models.models.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            ) : (
              <input type="text" value={llm.model} onChange={(e) => update('llm', 'model', e.target.value)}
                placeholder="qwen2.5:7b" />
            )}
          </Field>
        </div>
        {models.error && (
          <p style={{ fontSize: 'var(--text-label)', color: 'var(--ink-faint)' }}>
            Ollama not reachable — type the model name manually.
          </p>
        )}
        <div className="form-grid">
          <Field label="Max tokens (num_predict)" hint="cap memo length — lower is faster">
            <input type="number" min={16} max={4096} step={1} value={llm.num_predict}
              onChange={(e) => update('llm', 'num_predict', Number(e.target.value))} />
          </Field>
          <Field label="Temperature" hint="0 = deterministic">
            <input type="number" min={0} max={2} step={0.1} value={llm.temperature}
              onChange={(e) => update('llm', 'temperature', Number(e.target.value))} />
          </Field>
          <Field label="Keep-alive" hint="how long Ollama keeps the model loaded, e.g. 10m, -1">
            <input type="text" value={llm.keep_alive}
              onChange={(e) => update('llm', 'keep_alive', e.target.value)} />
          </Field>
        </div>
        <Field label="Prompt Template"
          hint="placeholders: {applicant_id} {probability} {grade} {applicant_summary} {risk_factors} {protective_factors}">
          <textarea rows={12} value={llm.prompt_template}
            onChange={(e) => update('llm', 'prompt_template', e.target.value)} />
        </Field>
      </section>

      <section className="sheet-section">
        <div className="section-head">
          <h2 className="section-title"><Cpu size={18} />Model Fine-Tune — XGBoost</h2>
        </div>
        <div className="form-grid">
          {XGB_FIELDS.map(([key, min, max, step]) => (
            <Field key={key} label={key}>
              <input type="number" min={min} max={max} step={step} value={xgb[key]}
                onChange={(e) => update('xgboost', key, Number(e.target.value))} />
            </Field>
          ))}
        </div>

        {metrics ? (
          <div style={{ margin: 'var(--space-3) 0' }}>
            <h4 className="mono" style={{
              fontSize: 'var(--text-label)', letterSpacing: '0.1em', textTransform: 'uppercase',
              color: 'var(--ink-soft)', marginBottom: 'var(--space-1)',
            }}>
              Current model metrics
            </h4>
            <div className="table-wrap">
              <table className="ruled-table">
                <thead>
                  <tr><th></th><th>AUC</th><th>Gini</th><th>KS</th><th>F1</th></tr>
                </thead>
                <tbody>
                  {['validation', 'test'].map((split) => (
                    <tr key={split}>
                      <td style={{ textTransform: 'capitalize' }}>{split}</td>
                      <td className="mono">{metrics[split].auc.toFixed(4)}</td>
                      <td className="mono">{metrics[split].gini.toFixed(4)}</td>
                      <td className="mono">{metrics[split].ks.toFixed(4)}</td>
                      <td className="mono">{metrics[split].f1.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <EmptyState
            icon={Cpu}
            title="No metrics"
            description="Train the model to see evaluation metrics."
          />
        )}

        <Button variant="primary" icon={RefreshCw} onClick={startRetrain} disabled={retrainStatus?.running}>
          {retrainStatus?.running ? 'Retraining…' : 'Save & Retrain Model'}
        </Button>
        {retrainStatus && (
          <div className="retrain-status">
            {retrainStatus.running && <div className="skeleton retrain-bar" />}
            <span>{retrainStatus.message}</span>
            {retrainStatus.error && <pre className="prompt-slab">{retrainStatus.error}</pre>}
          </div>
        )}
      </section>

      <div className="signoff-bar">
        <Button variant="primary" icon={Save} onClick={save}>Record Settings</Button>
        {saved && <span className="saved-note"><CheckCircle2 size={16} />Saved</span>}
        {error && <span className="error-text">{error}</span>}
      </div>
    </div>
  )
}
