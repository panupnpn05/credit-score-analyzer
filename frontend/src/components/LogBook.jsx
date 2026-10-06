import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollText } from 'lucide-react'
import Stamp from './Stamp.jsx'
import { useLog } from '../log/LogContext.jsx'

/** THE LOG — the running record of everything the system did this session. */
export default function LogBook() {
  const { t } = useTranslation()
  const { entries } = useLog()
  const seen = useRef(new Set(entries.map((e) => e.id)))

  useEffect(() => {
    entries.forEach((e) => seen.current.add(e.id))
  }, [entries])

  return (
    <div className="logbook">
      <div className="logbook-head">
        <span><ScrollText size={11} style={{ verticalAlign: '-1px' }} /> {t('log.title')}</span>
        <span className="log-count">{t('log.entryCount', { count: entries.length })}</span>
      </div>
      <div className="log-entries" aria-live="polite">
        {entries.length === 0 && (
          <p className="log-empty">{t('log.empty')}</p>
        )}
        {entries.map((e) => (
          <div key={e.id} className={`log-entry${seen.current.has(e.id) ? '' : ' fresh'}`}>
            <span className="log-time">{e.time}</span>
            <span className="log-text">{e.text}</span>
            {e.operator && <span className="log-initials" title={t('settings.keeperTitle')}>{e.operator}</span>}
            {e.stamp && <Stamp tone={e.tone}>{e.stamp}</Stamp>}
          </div>
        ))}
      </div>
    </div>
  )
}
