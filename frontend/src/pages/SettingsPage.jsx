import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
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
      log(t('log.settingsSaved'), 'ok', t('stamps.saved'))
    } catch (e) {
      setError(e.message)
      log(t('log.settingsSaveFailed', { message: e.message }), 'bad', t('stamps.error'))
    }
  }

  const startRetrain = async () => {
    setError(null)
    try {
      await api.putSettings(settings)
      await api.retrain()
      setRetrainStatus({ running: true, message: 'Starting…', error: null })
      wasRunning.current = true
      log(t('log.retrainStarted', { source: '' }), 'ink', t('stamps.retrain'))
      pollRef.current = setInterval(async () => {
        const st = await api.retrainStatus()
        setRetrainStatus(st)
        if (!st.running) {
          clearInterval(pollRef.current)
          if (wasRunning.current) {
            log(t('log.retrainDone', { message: st.message || t('settings.saved') }), st.error ? 'bad' : 'ok', st.error ? t('stamps.error') : t('stamps.done'))
            wasRunning.current = false
          }
          const m = await api.metrics().catch(() => null)
          if (m) setMetrics(m)
        }
      }, 2000)
    } catch (e) {
      setError(e.message)
      log(t('log.retrainFailed', { message: e.message }), 'bad', t('stamps.error'))
    }
  }

  if (!settings) {
    return (
      <section className="sheet-section">
        <div className="section-head"><h2 className="section-title">{t('nav.settings')}</h2></div>
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
          <h2 className="section-title"><PenLine size={18} />{t('settings.keeperTitle')}</h2>
          <span className="section-note">{t('settings.keeperNote')}</span>
        </div>
        <div className="form-grid">
          <Field label={t('settings.initials')} hint={t('settings.initialsHint')}>
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
          ? <Stamp tone="ok">{t('stamps.initialsSet', { operator })}</Stamp>
          : <p className="drift-note">{t('settings.keeperBlank')}</p>}
      </section>

      <section className="sheet-section">
        <div className="section-head">
          <h2 className="section-title"><SlidersHorizontal size={18} />{t('settings.thresholdsTitle')}</h2>
          <span className="section-note">{t('settings.thresholdsNote')}</span>
        </div>
        <Field label={t('settings.approveBelow', { value: d.approve_threshold.toFixed(2) })}>
          <input type="range" min="0" max="1" step="0.01" value={d.approve_threshold}
            onChange={(e) => update('decision', 'approve_threshold', Number(e.target.value))} />
        </Field>
        <Field label={t('settings.declineAbove', { value: d.decline_threshold.toFixed(2) })}>
          <input type="range" min="0" max="1" step="0.01" value={d.decline_threshold}
            onChange={(e) => update('decision', 'decline_threshold', Number(e.target.value))} />
        </Field>
        <p className="mono" style={{ fontSize: 'var(--text-label)', color: 'var(--ink-faint)' }}>
          {t('settings.thresholdLegend', { approve: d.approve_threshold.toFixed(2), decline: d.decline_threshold.toFixed(2) })}
        </p>
      </section>

      <section className="sheet-section">
        <div className="section-head">
          <h2 className="section-title"><Bot size={18} />{t('settings.llmTitle')}</h2>
          <span className="section-note">{t('settings.llmNote')}</span>
        </div>
        <div className="checkbox-row" style={{ marginBottom: 'var(--space-2)' }}>
          <input id="llm-enabled" type="checkbox" checked={llm.enabled}
            onChange={(e) => update('llm', 'enabled', e.target.checked)} />
          <label htmlFor="llm-enabled">{t('settings.enableLlm')}</label>
        </div>
        <div className="checkbox-row" style={{ marginBottom: 'var(--space-2)' }}>
          <input id="llm-include-sop" type="checkbox" checked={llm.include_sop !== false}
            onChange={(e) => update('llm', 'include_sop', e.target.checked)} />
          <label htmlFor="llm-include-sop">
            {t('settings.includeSop')}
            <span style={{ color: 'var(--ink-faint)', fontSize: 'var(--text-label)', display: 'block' }}>
              {t('settings.includeSopSub')}
            </span>
          </label>
        </div>
        <div className="form-grid">
          <Field label={t('settings.ollamaUrl')}>
            <input type="text" value={llm.ollama_url} onChange={(e) => update('llm', 'ollama_url', e.target.value)} />
          </Field>
          <Field label={t('settings.model')}>
            {models.models.length > 0 ? (
              <select value={llm.model} onChange={(e) => update('llm', 'model', e.target.value)}>
                {models.models.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            ) : (
              <input type="text" value={llm.model} onChange={(e) => update('llm', 'model', e.target.value)}
                placeholder={t('settings.modelPlaceholder')} />
            )}
          </Field>
        </div>
        {models.error && (
          <p style={{ fontSize: 'var(--text-label)', color: 'var(--ink-faint)' }}>
            {t('settings.ollamaUnreachable')}
          </p>
        )}
        <div className="form-grid">
          <Field label={t('settings.maxTokens')} hint={t('settings.maxTokensHint')}>
            <input type="number" min={16} max={4096} step={1} value={llm.num_predict}
              onChange={(e) => update('llm', 'num_predict', Number(e.target.value))} />
          </Field>
          <Field label={t('settings.temperature')} hint={t('settings.temperatureHint')}>
            <input type="number" min={0} max={2} step={0.1} value={llm.temperature}
              onChange={(e) => update('llm', 'temperature', Number(e.target.value))} />
          </Field>
          <Field label={t('settings.keepAlive')} hint={t('settings.keepAliveHint')}>
            <input type="text" value={llm.keep_alive}
              onChange={(e) => update('llm', 'keep_alive', e.target.value)} />
          </Field>
        </div>
        <Field label={t('settings.promptTemplate')} hint={t('settings.promptTemplateHint')}>
          <textarea rows={12} value={llm.prompt_template}
            onChange={(e) => update('llm', 'prompt_template', e.target.value)} />
        </Field>
      </section>

      <section className="sheet-section">
        <div className="section-head">
          <h2 className="section-title"><Cpu size={18} />{t('settings.xgbTitle')}</h2>
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
              {t('settings.metricsLabel')}
            </h4>
            <div className="table-wrap">
              <table className="ruled-table">
                <thead>
                  <tr><th></th><th>{t('settings.thAuc')}</th><th>{t('settings.thGini')}</th><th>{t('settings.thKs')}</th><th>{t('settings.thF1')}</th></tr>
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
            title={t('settings.noMetricsTitle')}
            description={t('settings.noMetricsDesc')}
          />
        )}

        <Button variant="primary" icon={RefreshCw} onClick={startRetrain} disabled={retrainStatus?.running}>
          {retrainStatus?.running ? t('batch.retraining') : t('settings.saveRetrain')}
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
        <Button variant="primary" icon={Save} onClick={save}>{t('settings.recordSettings')}</Button>
        {saved && <span className="saved-note"><CheckCircle2 size={16} />{t('settings.saved')}</span>}
        {error && <span className="error-text">{error}</span>}
      </div>
    </div>
  )
}
