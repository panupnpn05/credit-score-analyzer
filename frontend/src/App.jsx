import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Calculator, Layers, Settings, FileText, NotebookText } from 'lucide-react'
import PredictPage from './pages/PredictPage.jsx'
import BatchPage from './pages/BatchPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import SopPage from './pages/SopPage.jsx'
import LogBook from './components/LogBook.jsx'
import { LogProvider } from './log/LogContext.jsx'

const SECTIONS = [
  { to: '/', end: true, folio: '01', label: 'predict', icon: Calculator },
  { to: '/batch', folio: '02', label: 'batch', icon: Layers },
  { to: '/sop', folio: '03', label: 'sop', icon: FileText },
  { to: '/settings', folio: '04', label: 'settings', icon: Settings },
]

const FOLIO_TOTAL = '04'

function today(lang) {
  const locale = lang === 'th' ? 'th-TH-u-ca-gregory' : 'en-GB'
  return new Date()
    .toLocaleDateString(locale, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
    .toUpperCase()
}

export default function App() {
  const { t, i18n } = useTranslation()
  const location = useLocation()
  const current = SECTIONS.find((s) => (s.end ? location.pathname === s.to : location.pathname.startsWith(s.to)))
    || SECTIONS[0]

  return (
    <LogProvider>
      <div className="app">
        <header className="masthead">
          <a className="masthead-brand" href="#/">
            <span className="brand-mark"><NotebookText size={18} strokeWidth={2.25} /></span>
            <span className="brand-text">
              <span className="brand-name">{t('brand.name')}</span>
              <span className="brand-sub">{t('brand.sub')}</span>
            </span>
          </a>
          <div className="masthead-meta">
            <div className="lang-toggle" role="group" aria-label={t('lang.label')}>
              {['en', 'th'].map((lng) => (
                <button
                  key={lng}
                  type="button"
                  className={`lang-btn${i18n.language === lng ? ' active' : ''}`}
                  aria-pressed={i18n.language === lng}
                  onClick={() => i18n.changeLanguage(lng)}
                >
                  {t(`lang.${lng}`)}
                </button>
              ))}
            </div>
            <span className="masthead-date">{today(i18n.language)}</span>
            <span className="folio">
              {t('folio.label')}{' '}
              <span className="folio-num">{current.folio}</span>/{FOLIO_TOTAL} — {t(`nav.${current.label}`).toUpperCase()}
            </span>
          </div>
        </header>

        <div className="book">
          <aside className="rail">
            <nav className="index-tabs" aria-label="Sections">
              {SECTIONS.map(({ to, end, folio, label, icon: Icon }) => (
                <NavLink key={to} to={to} end={end} className={({ isActive }) => `index-tab${isActive ? ' active' : ''}`}>
                  <Icon size={15} strokeWidth={2} />
                  {t(`nav.${label}`)}
                  <span className="tab-folio">{folio}</span>
                </NavLink>
              ))}
            </nav>
            <LogBook />
          </aside>
          <main className="sheet">
            <Routes>
              <Route path="/" element={<PredictPage />} />
              <Route path="/batch" element={<BatchPage />} />
              <Route path="/sop" element={<SopPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </main>
        </div>

        <footer className="colophon">
          <span>{t('colophon.disclaimer')}</span>
          <span className="colophon-rule">{t('colophon.local')}</span>
        </footer>
      </div>
    </LogProvider>
  )
}
