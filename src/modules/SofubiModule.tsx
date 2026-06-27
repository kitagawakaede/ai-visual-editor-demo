import { useEffect, useRef, useState } from 'react'
import { captureStill, base64ToBlob, isValidBase64Image, videoConstraints } from '../lib/image'
import { requestOpenAIImageEdit, requestNanoBanana, OPENAI_KEY, NANO_KEY } from '../lib/api'
import { uploadToSupabase, generateQrDataUrl } from '../lib/supabase'
import { logError } from '../lib/error'
import { SOFUBI_PROMPT, SOFUBI_PROMPT_NO_REF } from '../constants/prompts'
import { useOmikujiOverlay } from '../hooks/useOmikuji'
import { WaitingGame } from '../components/WaitingGame'

const sofubiRefUrl = new URL('../assets/ref_sofubi.png', import.meta.url).href

// 生成エンジンはコンポーネント内の state（useGemini）でボタン切り替え。
// 既定は OpenAI（精度重視）。デモで Gemini と比較できるようにするための切替。

// 上半身写真でも全身フィギュアを生成させるため、
// 元画像の下に80%の余白を追加してAIに「体が続く空間がある」と認識させる
async function padImageForFullBody(blob: Blob): Promise<Blob> {
  const imgUrl = URL.createObjectURL(blob)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('画像読み込みに失敗しました'))
      image.src = imgUrl
    })
    const canvas = document.createElement('canvas')
    const size = Math.max(img.width, img.height)
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#f5eedc'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0)
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => { if (b) resolve(b); else reject(new Error('パディング処理に失敗しました')) },
        'image/png',
      )
    })
  } finally {
    URL.revokeObjectURL(imgUrl)
  }
}


export function SofubiModule() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [streamError, setStreamError] = useState<string | null>(null)
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null)
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [resultQr, setResultQr] = useState<string | null>(null)
  const [isCorrupted, setIsCorrupted] = useState(false)
  const [serverError, setServerError] = useState(false)
  const [status, setStatus] = useState('写真を撮影してください')
  const [isLoading, setIsLoading] = useState(false)
  const [useGemini, setUseGemini] = useState(false) // 既定 OpenAI。デモ比較用にボタンで切替
  const refBlobCache = useRef<Blob | null>(null)
  const { omikujiVisible, triggerOmikuji, resetOmikuji } = useOmikujiOverlay()

  const getRefBlob = async () => {
    if (refBlobCache.current) return refBlobCache.current
    const res = await fetch(sofubiRefUrl)
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
      setStatus('撮影完了。「変身する」を押してください')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : '撮影に失敗しました')
    }
  }

  const handleTransform = async () => {
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
    setStatus('変身中...')
    try {
      let result
      if (useGemini) {
        const refBlob = await getRefBlob()
        const paddedBlob = await padImageForFullBody(capturedBlob)
        result = await requestNanoBanana(SOFUBI_PROMPT, paddedBlob, refBlob)
      } else {
        // 速度テスト: 参照画像なし・パディングなし・本人写真1枚のみ（全身化はプロンプト指示に依存）。
        // quality:'medium'（low だと質感が落ちるため medium で精度と速度のバランスを取る）。
        result = await requestOpenAIImageEdit(SOFUBI_PROMPT_NO_REF, capturedBlob, undefined, 'gpt-image-1.5', '1024x1536', 'low', 'medium')
      }
      // normalizeImageToSize はキャプチャの3:4比率にcropするため使わない
      // ソフビは生成された正方形画像をそのまま表示する
      let rawBlob: Blob | null = null
      if (result.base64 && isValidBase64Image(result.base64)) {
        rawBlob = await base64ToBlob(result.base64, 'image/jpeg')
      } else if (result.base64 && !isValidBase64Image(result.base64)) {
        setIsCorrupted(true)
        setStatus('生成できませんでした。もう一度生成してください。')
        logError('sofubi-invalid-base64', result.base64)
      } else {
        rawBlob = await (await fetch(result.url)).blob()
      }
      if (rawBlob) {
        const displayUrl = URL.createObjectURL(rawBlob)
        setResultUrl(displayUrl)
        uploadToSupabase(rawBlob, 'sofubi', { compress: true })
          .then((url) => generateQrDataUrl(url))
          .then(setResultQr)
          .catch((err) => logError('sofubi-qr', err))
        setStatus('ソフビ変身完了')
      }
    } catch (err) {
      setServerError(true)
      setStatus('生成できませんでした。もう一度生成してください。')
      logError('sofubi-error', err)
    } finally {
      setIsLoading(false)
      resetOmikuji()
    }
  }

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-2.5">
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-black">フィギュアに変身！</p>
          <p className="text-[16px] font-extrabold leading-[1.3] text-black">フィギュアになれる！</p>
          <p className="text-[10px] text-black">シャッターボタン ▶︎ 自分がフィギュアになれる！</p>
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
        {(isCorrupted || serverError) && !isLoading && (
          <div className="absolute inset-0 w-full h-full grid place-items-center gap-3 p-4 text-center bg-[rgba(0,0,0,0.6)] text-white">
            <p className="text-[12px] m-0">生成できませんでした。もう一度お試しください。</p>
            <button
              className="border-2 border-[#2a1905] rounded-full px-2.5 py-2 bg-[#7eb8ff] text-[#0b1b3a] text-[12px] font-bold inline-flex items-center justify-center gap-1.5"
              onClick={handleTransform}
            >
              再生成する
            </button>
          </div>
        )}
        {resultUrl && !isLoading && !isCorrupted && (
          <div className="absolute inset-0 flex items-center justify-center bg-[rgba(0,0,0,0.55)]">
            <button
              className="absolute top-2 right-2 w-7 h-7 rounded-full border border-white/70 bg-white/80 text-[#2a1905] font-bold z-10"
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
            <img
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }}
              src={resultUrl}
              alt="sofubi result"
            />
            {resultQr && (
              <img className="absolute bottom-3 right-3 w-24 h-24 bg-white p-1 rounded z-10" src={resultQr} alt="QRコード" />
            )}
          </div>
        )}
      </div>

      <div className="bg-[#ffedab] rounded-[16px] p-2.5 flex flex-col gap-2 shadow-[0_8px_16px_rgba(0,0,0,0.15)]">
        {/* 生成エンジン切替（検証用） */}
        <div className="flex items-center justify-center gap-1.5 text-[10px] text-[#3b2b12]">
          <span className="font-bold">エンジン:</span>
          <div className="inline-flex rounded-full border border-[#caa94d] overflow-hidden">
            <button
              className={`px-2.5 py-1 font-bold ${useGemini ? 'bg-[#111] text-white' : 'bg-transparent text-[#3b2b12]'}`}
              onClick={() => setUseGemini(true)}
              disabled={isLoading}
            >
              Gemini
            </button>
            <button
              className={`px-2.5 py-1 font-bold ${!useGemini ? 'bg-[#111] text-white' : 'bg-transparent text-[#3b2b12]'}`}
              onClick={() => setUseGemini(false)}
              disabled={isLoading}
            >
              OpenAI
            </button>
          </div>
        </div>
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
            {isLoading ? '変身中...' : '変身する'}
          </button>
        </div>
        <p className="text-[11px] text-[#3b2b12]">{status}</p>
        {useGemini
          ? !NANO_KEY && (
              <p className="text-[11px] text-[#8c2b2b]">環境変数 VITE_NANO_BANANA_API_KEY を設定してください。</p>
            )
          : !OPENAI_KEY && (
              <p className="text-[11px] text-[#8c2b2b]">環境変数 VITE_OPENAI_API_KEY を設定してください。</p>
            )}
      </div>
    </section>
  )
}
