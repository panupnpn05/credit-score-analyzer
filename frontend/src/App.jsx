import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { Calculator, Layers, Settings, FileText, NotebookText } from 'lucide-react'
import PredictPage from './pages/PredictPage.jsx'
import BatchPage from './pages/BatchPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import SopPage from './pages/SopPage.jsx'
import LogBook from './components/LogBook.jsx'
import { LogProvider } from './log/LogContext.jsx'

const SECTIONS = [
  { to: '/', end: true, folio: '01', label: 'Predict', icon: Calculator },
  { to: '/batch', folio: '02', label: 'Batch', icon: Layers },
  { to: '/sop', folio: '03', label: 'SOP', icon: FileText },
  { to: '/settings', folio: '04', label: 'Settings', icon: Settings },
]

const FOLIO_TOTAL = '04'

function today() {
  return new Date()
    .toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
    .toUpperCase()
}

export default function App() {
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
              <span className="brand-name">AI Credit Scoring</span>
              <span className="brand-sub">Lab Log · Local Run</span>
            </span>
          </a>
          <div className="masthead-meta">
            <span>{today()}</span>
            <span className="folio">FOLIO <span className="folio-num">{current.folio}</span>/{FOLIO_TOTAL} — {current.label.toUpperCase()}</span>
          </div>
        </header>

        <div className="book">
          <aside className="rail">
            <nav className="index-tabs" aria-label="Sections">
              {SECTIONS.map(({ to, end, folio, label, icon: Icon }) => (
                <NavLink key={to} to={to} end={end} className={({ isActive }) => `index-tab${isActive ? ' active' : ''}`}>
                  <Icon size={15} strokeWidth={2} />
                  {label}
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
          <span>For educational / side-project use only. Not financial advice. Do not use for real lending decisions without regulatory review.</span>
          <span className="colophon-rule">Local run — no data leaves this machine · session log clears on browser close</span>
        </footer>
      </div>
    </LogProvider>
  )
}
