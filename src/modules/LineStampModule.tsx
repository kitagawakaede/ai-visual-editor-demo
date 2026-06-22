import { useEffect, useRef, useState } from 'react'
import { captureStill, normalizeImageToSize, base64ToBlob, isValidBase64Image, videoConstraints } from '../lib/image'
import { requestNanoBanana, NANO_KEY } from '../lib/api'
import { uploadToSupabase, generateQrDataUrl } from '../lib/supabase'
import { logError } from '../lib/error'
import { LINE_STAMP_PROMPT_BASE } from '../constants/prompts'
import { STAMP_TEXTS } from '../constants/stamps'
import { useOmikujiOverlay } from '../hooks/useOmikuji'
import { OmikujiOverlay } from '../components/OmikujiOverlay'

const stampRefUrl = new URL('../assets/ref_stamp.png', import.meta.url).href

async function overlayTextOnStamp(blob: Blob, text: string): Promise<Blob> {
  const imgUrl = URL.createObjectURL(blob)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('画像読み込みに失敗しました'))
      image.src = imgUrl
    })
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0)

    const fontSize = Math.round(img.width * 0.11)
    ctx.font = `bold ${fontSize}px "Hiragino Kaku Gothic ProN", "Hiragino Sans", "Noto Sans JP", sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    const x = img.width / 2
    const y = img.height - Math.round(img.height * 0.04)

    // 白縁取り
    ctx.strokeStyle = 'white'
    ctx.lineWidth = fontSize * 0.35
    ctx.lineJoin = 'round'
    ctx.strokeText(text, x, y)

    // カラフルなグラデーション塗り
    const grad = ctx.createLinearGradient(0, y - fontSize, 0, y)
    grad.addColorStop(0, '#ff8fab')
    grad.addColorStop(1, '#e0003c')
    ctx.fillStyle = grad
    ctx.fillText(text, x, y)

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => { if (b) resolve(b); else reject(new Error('テキスト合成に失敗しました')) },
        'image/jpeg',
        0.92,
      )
    })
  } finally {
    URL.revokeObjectURL(imgUrl)
  }
}

type ImageSize = { width: number; height: number }

export function LineStampModule() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [streamError, setStreamError] = useState<string | null>(null)
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null)
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null)
  const [captureSize, setCaptureSize] = useState<ImageSize | null>(null)
  const [selectedText, setSelectedText] = useState<string>(STAMP_TEXTS[0])
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [resultQr, setResultQr] = useState<string | null>(null)
  const [isCorrupted, setIsCorrupted] = useState(false)
  const [serverError, setServerError] = useState(false)
  const [status, setStatus] = useState('写真を撮影してスタンプにするテキストを選んでください')
  const [isLoading, setIsLoading] = useState(false)
  const refBlobCache = useRef<Blob | null>(null)
  const { omikujiUrl, omikujiVisible, omikujiKey, triggerOmikuji, resetOmikuji } = useOmikujiOverlay()

  const getRefBlob = async () => {
    if (refBlobCache.current) return refBlobCache.current
    const res = await fetch(stampRefUrl)
    const blob = await res.blob()
    refBlobCache.current = blob
    return blob
  }

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
      setStatus('撮影完了。テキストを選んで「スタンプ作成」を押してください')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : '撮影に失敗しました')
    }
  }

  const handleRandomText = () => {
    const current = selectedText
    const others = STAMP_TEXTS.filter((t) => t !== current)
    const next = others[Math.floor(Math.random() * others.length)]
    setSelectedText(next)
  }

  const handleGenerate = async () => {
    if (!capturedBlob) {
      setStatus('先にシャッターを押してください')
      return
    }
    setIsCorrupted(false)
    setServerError(false)
    setResultUrl(null)
    setResultQr(null)
    triggerOmikuji()
    setIsLoading(true)
    setStatus('スタンプ生成中...')
    try {
      const refBlob = await getRefBlob()
      const result = await requestNanoBanana(LINE_STAMP_PROMPT_BASE, capturedBlob, refBlob)
      let rawBlob: Blob | null = null
      if (result.base64 && isValidBase64Image(result.base64)) {
        rawBlob = await base64ToBlob(result.base64, 'image/jpeg')
      } else if (result.base64 && !isValidBase64Image(result.base64)) {
        setIsCorrupted(true)
        setStatus('生成できませんでした。もう一度お試しください。')
        logError('stamp-invalid-base64', result.base64)
        return
      } else {
        rawBlob = await (await fetch(result.url)).blob()
      }
      if (rawBlob) {
        const normalized = await normalizeImageToSize(rawBlob, captureSize?.width, captureSize?.height)
        const withText = await overlayTextOnStamp(normalized, selectedText)
        const displayUrl = URL.createObjectURL(withText)
        setResultUrl(displayUrl)
        uploadToSupabase(withText, 'stamp', { compress: true })
          .then((url) => generateQrDataUrl(url))
          .then(setResultQr)
          .catch((err) => logError('stamp-qr', err))
        setStatus('スタンプ生成完了')
      }
    } catch (err) {
      setServerError(true)
      setStatus('生成できませんでした。もう一度お試しください。')
      logError('stamp-error', err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-2.5">
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-[#1f78c8]">LINEスタンプ作成</p>
          <p className="text-[16px] font-extrabold leading-[1.3]">自分だけのスタンプを作ろう！</p>
          <p className="text-[10px] text-[#3b2b12]">撮影 ▶︎ テキスト選択 ▶︎ スタンプ作成の3ステップ。</p>
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
            生成中...
          </div>
        )}
        {capturedUrl && !isLoading && !resultUrl && !isCorrupted && !serverError && (
          <img
            className="absolute bottom-3 right-3 max-w-[160px] rounded-[10px] border border-white/40 shadow-md"
            src={capturedUrl}
            alt="capture"
          />
        )}
        {(isCorrupted || serverError) && !isLoading && (
          <div className="absolute inset-0 w-full h-full grid place-items-center gap-3 p-4 text-center bg-[rgba(0,0,0,0.6)] text-white">
            <p className="text-[12px] m-0">生成できませんでした。もう一度お試しください。</p>
            <button
              className="border-2 border-[#2a1905] rounded-full px-2.5 py-2 bg-[#7eb8ff] text-[#0b1b3a] text-[12px] font-bold inline-flex items-center justify-center gap-1.5"
              onClick={handleGenerate}
            >
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
            <img className="max-w-full max-h-full object-contain" src={resultUrl} alt="stamp result" />
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
            onClick={handleGenerate}
          >
            {isLoading ? '生成中...' : 'スタンプ作成'}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-[#2a1905] whitespace-nowrap">テキスト：</span>
          <span className="text-[12px] font-bold text-[#1f78c8] flex-1">{selectedText}</span>
          <button
            className="rounded-full px-2.5 py-1.5 bg-white text-[#2a1905] text-[11px] font-bold border border-[#2a1905]"
            onClick={handleRandomText}
          >
            ランダム
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1">
          {STAMP_TEXTS.map((text) => (
            <button
              key={text}
              className={`rounded-[8px] py-1.5 px-1 text-[10px] font-medium border transition ${
                selectedText === text
                  ? 'bg-[#7eb8ff] text-[#0b1b3a] border-transparent'
                  : 'bg-white text-[#2a1905] border-[#c9c9c9]'
              }`}
              onClick={() => setSelectedText(text)}
            >
              {text}
            </button>
          ))}
        </div>

        <p className="text-[11px] text-[#3b2b12]">{status}</p>
        {!NANO_KEY && (
          <p className="text-[11px] text-[#8c2b2b]">環境変数 VITE_NANO_BANANA_API_KEY を設定してください。</p>
        )}
      </div>
    </section>
  )
}
