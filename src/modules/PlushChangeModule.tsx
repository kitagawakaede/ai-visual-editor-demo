import { useEffect, useRef, useState } from 'react'
import { captureStill, normalizeImageToSize, base64ToBlob, isValidBase64Image, videoConstraints } from '../lib/image'
import { requestNanoBanana, NANO_KEY } from '../lib/api'
import { uploadToSupabase, generateQrDataUrl } from '../lib/supabase'
import { logError } from '../lib/error'
import { plushChangePromptBase, plushChangePromptWoolFelting, plushChangePromptPixelArt, plushChangePromptFlatHair } from '../constants/prompts'
import { useOmikujiOverlay } from '../hooks/useOmikuji'
import { OmikujiOverlay } from '../components/OmikujiOverlay'

type ImageSize = { width: number; height: number }
type PlushOption = { id: string; label: string; description: string; image: string; prompt: string }

const plushOptions: PlushOption[] = [
  {
    id: 'plushA',
    label: 'ぬいぐるみA',
    description: '丸みのある可愛いシルエットのぬいぐるみタイプ',
    image: new URL('../assets/スクリーンショット 2025-12-13 16.03.58.png', import.meta.url).href,
    prompt: plushChangePromptWoolFelting,
  },
  {
    id: 'plushB',
    label: 'ぬいぐるみB',
    description: '細部がはっきりしたフォルムのぬいぐるみタイプ',
    image: new URL('../assets/スクリーンショット 2025-12-13 12.36.50.png', import.meta.url).href,
    prompt: plushChangePromptPixelArt,
  },
  {
    id: 'plushC',
    label: 'ぬいぐるみC',
    description: 'ふんわり質感のディフォルメぬいぐるみタイプ',
    image: new URL('../assets/スクリーンショット 2025-12-13 12.05.19.png', import.meta.url).href,
    prompt: plushChangePromptFlatHair,
  },
]

export function PlushChangeModule() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [streamError, setStreamError] = useState<string | null>(null)
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null)
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null)
  const [captureSize, setCaptureSize] = useState<ImageSize | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [resultQr, setResultQr] = useState<string | null>(null)
  const [selected, setSelected] = useState<PlushOption>(plushOptions[0])
  const [isCorrupted, setIsCorrupted] = useState(false)
  const [serverError, setServerError] = useState(false)
  const [status, setStatus] = useState('写真を撮影して、変身先のぬいぐるみを選んでください')
  const [isLoading, setIsLoading] = useState(false)
  const refCache = useRef<Record<string, Blob>>({})
  const { omikujiUrl, omikujiVisible, omikujiKey, triggerOmikuji, resetOmikuji } = useOmikujiOverlay()

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
      setCapturedUrl(shot.url)
      setCapturedBlob(shot.blob)
      setCaptureSize({ width: shot.width, height: shot.height })
      setStatus('撮影完了。ぬいぐるみを選んで「変身する」を押してください')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : '撮影に失敗しました')
    }
  }

  const buildPrompt = (option: PlushOption) =>
    `${option.prompt || plushChangePromptBase} 選択したタイプ: ${option.label}。特徴: ${option.description}。`

  const getRefBlob = async (option: PlushOption) => {
    if (refCache.current[option.id]) return refCache.current[option.id]
    const res = await fetch(option.image)
    const blob = await res.blob()
    refCache.current[option.id] = blob
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
      const refBlob = await getRefBlob(selected)
      const result = await requestNanoBanana(buildPrompt(selected), capturedBlob, refBlob)
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
    }
  }

  const handleRetry = () => handleTransform()

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-2.5">
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-[#1f78c8]">ぬいぐるみに変身！</p>
          <p className="text-[16px] font-extrabold leading-[1.3]">ぬいぐるみになれる！</p>
          <p className="text-[10px] text-[#3b2b12]">シャッターボタン ▶︎ 自分がぬいぐるみになる！</p>
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
        <OmikujiOverlay url={omikujiUrl} visible={omikujiVisible} fadeKey={omikujiKey} onClose={resetOmikuji} />
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
                setCapturedUrl(null)
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
        <div className="grid grid-cols-3 gap-0 place-items-center pb-1">
          {plushOptions.map((opt) => (
            <button
              key={opt.id}
              className={`min-w-[86px] rounded-[12px] bg-white p-1 flex flex-col gap-1 items-center ${
                selected.id === opt.id ? 'bg-[#e0f1ff]' : ''
              }`}
              onClick={() => setSelected(opt)}
              aria-pressed={selected.id === opt.id}
            >
              <img className="w-[72px] h-[72px] object-cover rounded-[10px] border border-[#c9c9c9]" src={opt.image} alt={opt.label} />
              <div className="text-[10px] font-bold">{opt.label}</div>
            </button>
          ))}
        </div>

        <p className="text-[11px] text-[#3b2b12]">{status}</p>
        {!NANO_KEY && <p className="text-[11px] text-[#8c2b2b]">環境変数 VITE_NANO_BANANA_API_KEY を設定してください。</p>}
      </div>
    </section>
  )
}
