import { useEffect, useRef, useState } from 'react'
import { captureStill, normalizeImageToSize, base64ToBlob, isValidBase64Image, videoConstraints, type CaptureShare } from '../lib/image'
import { requestOpenAIImageEdit, OPENAI_KEY } from '../lib/api'
import { uploadToSupabase, generateQrDataUrl } from '../lib/supabase'
import { logError } from '../lib/error'
import { plushChangePromptBase } from '../constants/prompts'
import { useOmikujiOverlay } from '../hooks/useOmikuji'
import { WaitingGame } from '../components/WaitingGame'

type ImageSize = { width: number; height: number }

const plushRefUrl = new URL('../assets/image copy 2.png', import.meta.url).href

export function PlushChangeModule({ capturedUrl, capturedBlob, onCapture }: CaptureShare) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [streamError, setStreamError] = useState<string | null>(null)
  const [captureSize, setCaptureSize] = useState<ImageSize | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [resultQr, setResultQr] = useState<string | null>(null)
  const [isCorrupted, setIsCorrupted] = useState(false)
  const [serverError, setServerError] = useState(false)
  const [status, setStatus] = useState(capturedBlob ? '撮影済み。「変身」を押してください' : 'シャッターボタンを押して撮影してください')
  const [isLoading, setIsLoading] = useState(false)
  const refCache = useRef<Blob | null>(null)
  const { omikujiVisible, triggerOmikuji, resetOmikuji } = useOmikujiOverlay()

  useEffect(() => {
    let active = true
    navigator.mediaDevices
      .getUserMedia({ video: videoConstraints, audio: false })
      .then((stream) => {
        if (!active) return
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
        }
      })
      .catch((err) => setStreamError(err.message))
    return () => {
      active = false
      if (videoRef.current?.srcObject instanceof MediaStream) {
        videoRef.current.srcObject.getTracks().forEach((t) => t.stop())
      }
    }
  }, [])

  const handleCapture = async () => {
    if (!videoRef.current) return
    resetOmikuji()
    setIsCorrupted(false)
    setServerError(false)
    setResultUrl(null)
    setResultQr(null)
    setStatus('撮影中...')
    try {
      const shot = await captureStill(videoRef.current)
      onCapture(shot.url, shot.blob)
      setCaptureSize({ width: shot.width, height: shot.height })
      setStatus('撮影完了。「変身」を押してください')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : '撮影に失敗しました')
    }
  }

  const getRefBlob = async () => {
    if (refCache.current) return refCache.current
    const blob = await fetch(plushRefUrl).then((r) => r.blob())
    refCache.current = blob
    return blob
  }

  const handleTransform = async () => {
    if (!capturedBlob) {
      setStatus('先にシャッターを押してください')
      return
    }
    setIsCorrupted(false)
    setServerError(false)
    setResultUrl(null)
    triggerOmikuji()
    setIsLoading(true)
    setStatus('変身中...')
    try {
      const refBlob = await getRefBlob()
      const result = await requestOpenAIImageEdit(plushChangePromptBase, capturedBlob, refBlob)
      if (result.base64 && isValidBase64Image(result.base64)) {
        const blob = await base64ToBlob(result.base64, 'image/jpeg')
        const normalized = await normalizeImageToSize(blob, captureSize?.width, captureSize?.height)
        const displayUrl = URL.createObjectURL(normalized)
        setResultUrl(displayUrl)
        uploadToSupabase(normalized, 'plush-change', { compress: true })
          .then((url) => generateQrDataUrl(url))
          .then(setResultQr)
          .catch((err) => logError('plush-change-qr', err))
        setStatus('ぬいぐるみ変身完了')
      } else if (result.base64 && !isValidBase64Image(result.base64)) {
        setIsCorrupted(true)
        setStatus('生成できませんでした。もう一度生成してください。')
        logError('plush-change-invalid-base64', result.base64)
      } else {
        const sourceBlob = await (await fetch(result.url)).blob()
        const normalized = await normalizeImageToSize(sourceBlob, captureSize?.width, captureSize?.height)
        const displayUrl = URL.createObjectURL(normalized)
        setResultUrl(displayUrl)
        uploadToSupabase(normalized, 'plush-change', { compress: true })
          .then((url) => generateQrDataUrl(url))
          .then(setResultQr)
          .catch((err) => logError('plush-change-qr', err))
        setStatus('ぬいぐるみ変身完了')
      }
    } catch (err) {
      setServerError(true)
      setStatus('生成できませんでした。もう一度生成してください。')
      logError('plush-change-error', err)
    } finally {
      setIsLoading(false)
      resetOmikuji()
    }
  }

  const handleRetry = () => handleTransform()

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-2.5">
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-black">ぬいぐるみに変身！</p>
          <p className="text-[16px] font-extrabold leading-[1.3] text-black">ぬいぐるみになれる！</p>
          <p className="text-[10px] text-black">シャッターボタン ▶︎ 自分がぬいぐるみになれる！</p>
        </div>
        <span
          className={`border-2 text-[11px] font-bold px-2.5 py-1.5 rounded-full whitespace-nowrap ${
            streamError
              ? 'border-[#7a1b1b] text-[#7a1b1b] bg-[rgba(255,150,150,0.22)]'
              : 'border-[#358ae6] text-[#358ae6] bg-[rgba(53,138,230,0.25)]'
          }`}
        >
          {streamError ? 'カメラ許可が必要です' : 'カメラ準備OK'}
        </span>
      </div>

      <div className="relative overflow-hidden rounded-[18px] bg-[#0f0f12] aspect-[3/4] shadow-[0_10px_18px_rgba(0,0,0,0.2)] w-full max-w-[320px] md:max-w-[360px] mx-auto">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ transform: 'scaleX(-1)' }}
          muted
          playsInline
        />
        <WaitingGame visible={omikujiVisible} onClose={resetOmikuji} />
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[rgba(0,0,0,0.6)] text-white font-bold text-lg z-10">
            変身中...
          </div>
        )}
        {capturedUrl && !isLoading && !resultUrl && !isCorrupted && !serverError && (
          <img
            className="absolute bottom-3 right-3 max-w-[160px] rounded-[10px] border border-white/40 shadow-md"
            src={capturedUrl}
            alt="capture"
          />
        )}

        {isCorrupted && !isLoading && (
          <div className="absolute inset-0 w-full h-full grid place-items-center gap-3 p-4 text-center bg-[rgba(0,0,0,0.6)] text-white">
            <p className="text-[12px] m-0">サーバーエラーが発生しました (500/503)。再生成してください。</p>
            <button className="border-2 border-[#2a1905] rounded-full px-2.5 py-2 bg-[#7eb8ff] text-[#0b1b3a] text-[12px] font-bold inline-flex items-center justify-center gap-1.5" onClick={handleRetry}>
              再生成する
            </button>
          </div>
        )}

        {serverError && !isLoading && (
          <div className="absolute inset-0 w-full h-full grid place-items-center gap-3 p-4 text-center bg-[rgba(0,0,0,0.6)] text-white">
            <p className="text-[12px] m-0">サーバーエラーが発生しました (500/503)。再生成してください。</p>
            <button className="border-2 border-[#2a1905] rounded-full px-2.5 py-2 bg-[#7eb8ff] text-[#0b1b3a] text-[12px] font-bold inline-flex items-center justify-center gap-1.5" onClick={handleRetry}>
              再生成する
            </button>
          </div>
        )}

        {resultUrl && !isLoading && !isCorrupted && (
          <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-[rgba(0,0,0,0.55)]">
            <button
              className="absolute top-2 right-2 w-7 h-7 rounded-full border border-white/70 bg-white/80 text-[#2a1905] font-bold"
              onClick={() => {
                setResultUrl(null)
                setIsCorrupted(false)
                setServerError(false)
                setResultQr(null)
              }}
              aria-label="close result"
            >
              ×
            </button>
            <img className="max-w-full max-h-full object-contain" src={resultUrl} alt="plush morph result" />
            {resultQr && (
              <img className="absolute bottom-3 right-3 w-24 h-24 bg-white p-1 rounded" src={resultQr} alt="QRコード" />
            )}
          </div>
        )}
      </div>

      <div className="bg-[#ffedab] rounded-[16px] p-2.5 flex flex-col gap-2 shadow-[0_8px_16px_rgba(0,0,0,0.15)]">
        <div className="flex gap-2">
          <button
            className="flex-1 rounded-full px-2.5 py-2 bg-[#111] text-white text-[12px] font-bold inline-flex items-center justify-center gap-1.5"
            onClick={handleCapture}
          >
            {capturedBlob ? '再撮影' : 'シャッター'}
          </button>
          <button
            className="flex-1 rounded-full px-2.5 py-2 bg-[#7eb8ff] text-[#0b1b3a] text-[12px] font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
            disabled={isLoading}
            onClick={handleTransform}
          >
            {isLoading ? '変身中...' : '変身'}
          </button>
        </div>
        <p className="text-[11px] text-[#3b2b12]">{status}</p>
        {!OPENAI_KEY && <p className="text-[11px] text-[#8c2b2b]">環境変数 VITE_OPENAI_API_KEY を設定してください。</p>}
      </div>
    </section>
  )
}
