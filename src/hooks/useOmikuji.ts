import { useCallback, useEffect, useRef, useState } from 'react'

const omikujiImages = Object.values(
  import.meta.glob('../assets/omikuji/*.png', { eager: true, import: 'default' }) as Record<string, string>,
)

export function useOmikujiOverlay() {
  const [omikujiUrl, setOmikujiUrl] = useState<string | null>(null)
  const [omikujiVisible, setOmikujiVisible] = useState(false)
  const [omikujiKey, setOmikujiKey] = useState(0)
  const timerRef = useRef<number | null>(null)
  const loadTokenRef = useRef(0)

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const triggerOmikuji = useCallback(() => {
    if (!omikujiImages.length) return
    clearTimers()
    loadTokenRef.current += 1
    setOmikujiVisible(false)
    setOmikujiUrl(null)
    const currentToken = loadTokenRef.current
    timerRef.current = window.setTimeout(() => {
      const pick = omikujiImages[Math.floor(Math.random() * omikujiImages.length)]
      const loader = new Image()
      loader.onload = () => {
        if (loadTokenRef.current !== currentToken) return
        setOmikujiKey(Date.now())
        setOmikujiUrl(pick)
        setOmikujiVisible(true)
      }
      loader.onerror = () => {
        if (loadTokenRef.current !== currentToken) return
        setOmikujiKey(Date.now())
        setOmikujiUrl(pick)
        setOmikujiVisible(true)
      }
      loader.src = pick
    }, 3000)
  }, [clearTimers])

  const resetOmikuji = useCallback(() => {
    clearTimers()
    loadTokenRef.current += 1
    setOmikujiVisible(false)
    setOmikujiUrl(null)
  }, [clearTimers])

  useEffect(() => {
    return () => {
      clearTimers()
    }
  }, [clearTimers])

  return { omikujiUrl, omikujiVisible, omikujiKey, triggerOmikuji, resetOmikuji }
}
