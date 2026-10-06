import { useEffect, useRef, useState } from 'react'
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

function DriftReport({ drift, retraining, onRetrain, retrainMessage }) {
  if (!drift || drift.overall_status === 'no_data') return null
  const rows = (drift.rows || []).filter((r) => r.psi !== null).slice(0, 6)
  return (
    <section className="sheet-section">
      <div className="section-head">
        <h2 className="section-title"><Activity size={18} />Drift Monitor — PSI</h2>
        <Stamp tone={DRIFT_STAMPS[drift.overall_status] || 'warn'}>{drift.overall_status}</Stamp>
      </div>
      <div className="drift-status">
        {drift.overall_psi !== null && drift.overall_psi !== undefined && (
          <span className="mono" style={{ fontSize: 'var(--text-small)', color: 'var(--ink-soft)' }}>
            max PSI {drift.overall_psi.toFixed(3)} · n={drift.sample_size}
          </span>
        )}
        {(drift.overall_status === 'warning' || drift.overall_status === 'drift') && (
          <Button variant="primary" icon={RefreshCw} onClick={onRetrain} disabled={retraining}>
            {retraining ? 'Retraining…' : 'Retrain model'}
          </Button>
        )}
      </div>
      {retrainMessage && <p className="drift-note">{retrainMessage}</p>}
      <p className="drift-note">
        PSI vs. training distribution per feature. Thresholds: &lt;0.1 stable · 0.1–0.25 warning · &gt;0.25 drift (bias-corrected for sample size).
      </p>
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
      log(`DRIFT — ${source} · ${d.overall_status} · max PSI ${d.overall_psi?.toFixed(3)}`, 'bad', 'DRIFT')
    }
  }

  useEffect(() => {
    api.drift()
      .then((d) => {
        const effective = d.overall_status === 'no_data' ? null : d
        setDrift(effective)
        logDrift(effective, 'training reference')
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
      log(
        `BATCH — ${res.results.length} applicant(s) scored · ${errs} error(s)`,
        errs ? 'warn' : 'ok',
        'BATCH',
      )
      logDrift(res.drift, file.name)
    } catch (e) {
      setError(e.message)
      log(`BATCH FAILED — ${e.message}`, 'bad', 'ERROR')
    } finally {
      setLoading(false)
    }
  }

  const handleRetrain = async () => {
    setRetraining(true)
    setRetrainMessage(null)
    try {
      await api.retrain()
      setRetrainMessage('Retraining started — progress is recorded on the Settings folio.')
      log('RETRAIN — started (drift response)', 'ink', 'RETRAIN')
    } catch (e) {
      setRetrainMessage(`Could not start retraining: ${e.message}`)
      log(`RETRAIN FAILED — ${e.message}`, 'bad', 'ERROR')
    } finally {
      setRetraining(false)
    }
  }

  return (
    <div>
      <section className="sheet-section">
        <div className="section-head">
          <h2 className="section-title"><Layers size={18} />Batch Scoring</h2>
          <span className="section-note">CSV or XLSX · same columns as training data</span>
        </div>
        <p style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-small)', marginTop: 0 }}>
          Upload a portfolio and every applicant is scored in one pass.
          An optional <code>applicant_id</code> column is used as the identifier.
        </p>

        <div className="upload-zone" onClick={() => fileInputRef.current.click()}>
          <UploadCloud size={32} strokeWidth={1.5} />
          <div style={{ fontWeight: 700, color: 'var(--ink)' }}>
            {file ? file.name : 'Click to choose a file'}
          </div>
          <div className="mono" style={{ fontSize: 'var(--text-label)' }}>CSV or XLSX</div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          style={{ display: 'none' }}
          onChange={(e) => setFile(e.target.files[0])}
        />

        <Button variant="primary" icon={Play} onClick={handleUpload} disabled={!file || loading}>
          {loading ? 'Scoring…' : 'Score Applicants'}
        </Button>
        {error && <p className="error-text">{error}</p>}
      </section>

      <DriftReport
        drift={drift}
        retraining={retraining}
        onRetrain={handleRetrain}
        retrainMessage={retrainMessage}
      />

      {!results && !loading && (
        <section className="sheet-section">
          <EmptyState
            icon={UploadCloud}
            title="No batch on record"
            description="Score a whole portfolio at once — results and drift land in the log."
          />
        </section>
      )}

      {results && (
        <section className="sheet-section">
          <div className="section-head">
            <h2 className="section-title">{results.length} applicant(s) scored</h2>
            <Stamp tone="ok">Recorded</Stamp>
          </div>
          <div className="table-wrap">
            <table className="ruled-table">
              <thead>
                <tr>
                  <th>ID</th><th>Default Prob.</th><th>Grade</th><th>Decision</th><th>Error</th>
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
                        <Pill variant={DECISION_VARIANTS[r.decision]}>{r.decision.replaceAll('_', ' ')}</Pill>
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
