import { useEffect, useRef, useState } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import { Layers, Play, UploadCloud, Activity, RefreshCw } from 'lucide-react'
import { api } from '../api/client.js'
import Button from '../components/Button.jsx'
import EmptyState from '../components/EmptyState.jsx'
import Pill from '../components/Pill.jsx'
import Stamp from '../components/Stamp.jsx'
import { useLog } from '../log/LogContext.jsx'

const DECISION_VARIANTS = { APPROVE: 'success', MANUAL_REVIEW: 'warning', 'NON-APPROVE': 'danger' }
const DRIFT_STAMPS = { stable: 'ok', warning: 'warn', drift: 'bad' }

const MAX_PSI_DISPLAY = 0.5

function DriftReport({ drift, retraining, onRetrain, retrainMessage, t }) {
  if (!drift || drift.overall_status === 'no_data') return null
  const rows = (drift.rows || []).filter((r) => r.psi !== null).slice(0, 6)
  return (
    <section className="sheet-section">
      <div className="section-head">
        <h2 className="section-title"><Activity size={18} />{t('batch.driftTitle')}</h2>
        <Stamp tone={DRIFT_STAMPS[drift.overall_status] || 'warn'}>{t(`driftStatus.${drift.overall_status}`, { defaultValue: drift.overall_status })}</Stamp>
      </div>
      <div className="drift-status">
        {drift.overall_psi !== null && drift.overall_psi !== undefined && (
          <span className="mono" style={{ fontSize: 'var(--text-small)', color: 'var(--ink-soft)' }}>
            {t('batch.maxPsi', { psi: drift.overall_psi.toFixed(3), n: drift.sample_size })}
          </span>
        )}
        {(drift.overall_status === 'warning' || drift.overall_status === 'drift') && (
          <Button variant="primary" icon={RefreshCw} onClick={onRetrain} disabled={retraining}>
            {retraining ? t('batch.retraining') : t('batch.retrain')}
          </Button>
        )}
      </div>
      {retrainMessage && <p className="drift-note">{retrainMessage}</p>}
      <p className="drift-note">{t('batch.driftNote')}</p>
      {rows.length > 0 && (
        <div className="drift-rows">
          {rows.map((r) => (
            <div key={r.feature} className="factor-row">
              <span className="factor-name" title={r.feature}>{r.feature}</span>
              <div className="drift-bar-track">
                <div
                  className={`drift-bar ${r.status}`}
                  style={{ width: `${Math.min((r.psi / MAX_PSI_DISPLAY) * 100, 100)}%` }}
                />
              </div>
              <span className={`factor-shap ${r.status === 'stable' ? 'protect' : 'risk'}`}>
                {r.psi.toFixed(3)}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export default function BatchPage() {
  const { t } = useTranslation()
  const { log } = useLog()
  const [file, setFile] = useState(null)
  const [results, setResults] = useState(null)
  const [drift, setDrift] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [retraining, setRetraining] = useState(false)
  const [retrainMessage, setRetrainMessage] = useState(null)
  const fileInputRef = useRef(null)
  const driftLogged = useRef(null)

  const logDrift = (d, source) => {
    if (!d || d.overall_status === 'no_data') return
    const key = `${d.overall_status}-${d.overall_psi?.toFixed(3)}-${source}`
    if (driftLogged.current === key) return
    driftLogged.current = key
    if (d.overall_status === 'warning' || d.overall_status === 'drift') {
      log(
        t('log.drift', { source, status: d.overall_status, psi: d.overall_psi?.toFixed(3) }),
        'bad',
        t('stamps.drift'),
      )
    }
  }

  useEffect(() => {
    api.drift()
      .then((d) => {
        const effective = d.overall_status === 'no_data' ? null : d
        setDrift(effective)
        logDrift(effective, t('batch.trainingRef'))
      })
      .catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleUpload = async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    setResults(null)
    try {
      const res = await api.batch(file)
      setResults(res.results)
      setDrift(res.drift || null)
      const errs = res.results.filter((r) => r.error).length
      log(t('log.batch', { count: res.results.length, errors: errs }), errs ? 'warn' : 'ok', t('stamps.batch'))
      logDrift(res.drift, file.name)
    } catch (e) {
      setError(e.message)
      log(t('log.batchFailed', { message: e.message }), 'bad', t('stamps.error'))
    } finally {
      setLoading(false)
    }
  }

  const handleRetrain = async () => {
    setRetraining(true)
    setRetrainMessage(null)
    try {
      await api.retrain()
      setRetrainMessage(t('batch.retrainStarted'))
      log(t('log.retrainStarted', { source: ` (${t('batch.title')})` }), 'ink', t('stamps.retrain'))
    } catch (e) {
      setRetrainMessage(t('batch.retrainFailed', { message: e.message }))
      log(t('log.retrainFailed', { message: e.message }), 'bad', t('stamps.error'))
    } finally {
      setRetraining(false)
    }
  }

  return (
    <div>
      <section className="sheet-section">
        <div className="section-head">
          <h2 className="section-title"><Layers size={18} />{t('batch.title')}</h2>
          <span className="section-note">{t('batch.note')}</span>
        </div>
        <p style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-small)', marginTop: 0 }}>
          <Trans i18nKey="batch.desc" components={[<code />]} />
        </p>

        <div className="upload-zone" onClick={() => fileInputRef.current.click()}>
          <UploadCloud size={32} strokeWidth={1.5} />
          <div style={{ fontWeight: 700, color: 'var(--ink)' }}>
            {file ? file.name : t('batch.chooseFile')}
          </div>
          <div className="mono" style={{ fontSize: 'var(--text-label)' }}>{t('batch.fileTypes')}</div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          style={{ display: 'none' }}
          onChange={(e) => setFile(e.target.files[0])}
        />

        <Button variant="primary" icon={Play} onClick={handleUpload} disabled={!file || loading}>
          {loading ? t('batch.scoring') : t('batch.score')}
        </Button>
        {error && <p className="error-text">{error}</p>}
      </section>

      <DriftReport
        drift={drift}
        retraining={retraining}
        onRetrain={handleRetrain}
        retrainMessage={retrainMessage}
        t={t}
      />

      {!results && !loading && (
        <section className="sheet-section">
          <EmptyState
            icon={UploadCloud}
            title={t('batch.emptyTitle')}
            description={t('batch.emptyDesc')}
          />
        </section>
      )}

      {results && (
        <section className="sheet-section">
          <div className="section-head">
            <h2 className="section-title">{t('batch.scoredHead', { count: results.length })}</h2>
            <Stamp tone="ok">{t('stamps.recorded')}</Stamp>
          </div>
          <div className="table-wrap">
            <table className="ruled-table">
              <thead>
                <tr>
                  <th>{t('batch.thId')}</th><th>{t('batch.thProb')}</th><th>{t('batch.thGrade')}</th><th>{t('batch.thDecision')}</th><th>{t('batch.thError')}</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={r.applicant_id} className="enter" style={{ animationDelay: `${Math.min(i, 10) * 60}ms` }}>
                    <td><span className="nameplate">{r.applicant_id}</span></td>
                    <td className="mono">{r.error ? '—' : `${(r.default_probability * 100).toFixed(1)}%`}</td>
                    <td style={{ fontWeight: 700 }}>{r.risk_grade || '—'}</td>
                    <td>
                      {r.decision && (
                        <Pill variant={DECISION_VARIANTS[r.decision]}>{t(`decision.${r.decision}`)}</Pill>
                      )}
                    </td>
                    <td className="error-text">{r.error || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
