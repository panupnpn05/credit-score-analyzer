const BASE = '/api'

async function request(path, options = {}) {
  const res = await fetch(BASE + path, {
    headers: options.body instanceof FormData ? undefined : { 'Content-Type': 'application/json' },
    ...options,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.detail || `Request failed: ${res.status}`)
  }
  return data
}

export const api = {
  health: () => request('/health'),
  schema: () => request('/schema'),
  metrics: () => request('/metrics'),
  predict: (applicant, applicantId) =>
    request('/predict', { method: 'POST', body: JSON.stringify({ applicant, applicant_id: applicantId }) }),
  memo: (applicant, applicantId, llmPrompt) =>
    request('/memo', { method: 'POST', body: JSON.stringify({ applicant, applicant_id: applicantId, llm_prompt: llmPrompt }) }),
  memoStream: async (applicant, applicantId, llmPrompt, { onToken, onDone, onError, onDemoNotice }) => {
    let finishReason = null
    const res = await fetch(`${BASE}/memo/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicant, applicant_id: applicantId, llm_prompt: llmPrompt }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      onError?.(data.detail || `Request failed: ${res.status}`)
      return
    }
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const events = buffer.split('\n\n')
      buffer = events.pop()
      for (const evt of events) {
        const line = evt.replace(/^data: /, '')
        if (!line) continue
        try {
          const data = JSON.parse(line)
          if (data.token) onToken?.(data.token)
          if (data.error) onError?.(data.error)
          if (data.demo_notice) onDemoNotice?.()
          if (data.done) finishReason = data.finish_reason
        } catch { /* ignore malformed chunk */ }
      }
    }
    onDone?.(finishReason)
  },
  batch: (file) => {
    const form = new FormData()
    form.append('file', file)
    return request('/batch', { method: 'POST', body: form })
  },
  whatif: (applicant, modifications) =>
    request('/predict/whatif', { method: 'POST', body: JSON.stringify({ applicant, modifications }) }),
  memoVerify: (memoText, evidence) =>
    request('/memo/verify', { method: 'POST', body: JSON.stringify({ memo_text: memoText, evidence }) }),
  memoVerifyStatus: (verifyId) => request(`/memo/verify/${verifyId}`),
  drift: () => request('/drift'),
  getSettings: () => request('/settings'),
  putSettings: (settings) => request('/settings', { method: 'PUT', body: JSON.stringify(settings) }),
  getSop: () => request('/sop'),
  putSop: (sop) => request('/sop', { method: 'PUT', body: JSON.stringify(sop) }),
  verifySop: (applicant) => request('/sop/verify', { method: 'POST', body: JSON.stringify({ applicant }) }),
  ollamaModels: () => request('/ollama/models'),
  retrain: () => request('/retrain', { method: 'POST' }),
  retrainStatus: () => request('/retrain/status'),
}
