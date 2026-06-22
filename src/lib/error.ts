export function logError(label: string, error: unknown) {
  const payload = {
    label,
    error:
      error instanceof Error
        ? error.message
        : typeof error === 'object'
          ? JSON.stringify(error)
          : String(error),
    ts: new Date().toISOString(),
  }
  console.error('app-error', payload)
  try {
    const current = localStorage.getItem('app-error-log')
    const arr = current ? (JSON.parse(current) as unknown[]) : []
    arr.push(payload)
    localStorage.setItem('app-error-log', JSON.stringify(arr).slice(-5000))
  } catch {
    // ignore storage errors
  }
}
