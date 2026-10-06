import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

const LogContext = createContext(null)

const STORAGE_KEY = 'lablog.entries.v1'
const OPERATOR_KEY = 'lablog.operator'
const MAX_ENTRIES = 80

function loadEntries() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function loadOperator() {
  try {
    return localStorage.getItem(OPERATOR_KEY) || ''
  } catch {
    return ''
  }
}

function now() {
  return new Date().toLocaleTimeString('en-GB', { hour12: false })
}

export function LogProvider({ children }) {
  const [entries, setEntries] = useState(loadEntries)
  const [operator, setOperatorState] = useState(loadOperator)
  const operatorRef = useRef(operator)
  const counter = useRef(0)

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)))
    } catch { /* storage unavailable — the log lives in memory */ }
  }, [entries])

  const setOperator = useCallback((value) => {
    const clean = (value || '').slice(0, 4).toUpperCase()
    operatorRef.current = clean
    setOperatorState(clean)
    try {
      localStorage.setItem(OPERATOR_KEY, clean)
    } catch { /* storage unavailable — the operator lives in memory */ }
  }, [])

  const log = useCallback((text, tone = 'ink', stamp = null) => {
    counter.current += 1
    const entry = {
      id: `${Date.now()}-${counter.current}`,
      time: now(),
      text,
      tone,
      stamp,
      operator: operatorRef.current,
    }
    setEntries((prev) => [entry, ...prev].slice(0, MAX_ENTRIES))
  }, [])

  return <LogContext.Provider value={{ entries, log, operator, setOperator }}>{children}</LogContext.Provider>
}

export function useLog() {
  const ctx = useContext(LogContext)
  if (!ctx) return { entries: [], log: () => {}, operator: '', setOperator: () => {} }
  return ctx
}
