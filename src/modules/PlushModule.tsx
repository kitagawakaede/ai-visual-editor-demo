import { useEffect, useRef, useState } from 'react'
import { captureStill, normalizeImageToSize, blobToBase64, base64ToBlob, isValidBase64Image, videoConstraints } from '../lib/image'
import { requestNanoBanana, NANO_KEY } from '../lib/api'
import { uploadToSupabase, generateQrDataUrl } from '../lib/supabase'
import { logError } from '../lib/error'
import { defaultToyPrompt } from '../constants/prompts'
import { useOmikujiOverlay } from '../hooks/useOmikuji'
import { OmikujiOverlay } from '../components/OmikujiOverlay'

type ImageSize = { width: number; height: number }

export function PlushModule() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [streamError, setStreamError] = useState<string | null>(null)
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null)
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null)
  const [captureSize, setCaptureSize] = useState<ImageSize | null>(null)
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)
  const [generatedBase64, setGeneratedBase64] = useState<string | null>(null)
  const [generatedQr, setGeneratedQr] = useState<string | null>(null)
  const [plushCorrupted, setPlushCorrupted] = useState(false)
  const [plushServerError, setPlushServerError] = useState(false)
  const [status, setStatus] = useState('ぬいぐるみと一緒に撮影してください')
  const [isLoading, setIsLoading] = useState(false)
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
    setStatus('撮影中...')
    setGeneratedQr(null)
    try {
      const shot = await captureStill(videoRef.current)
      setCapturedBlob(shot.blob)
      setCapturedUrl(shot.url)
      setCaptureSize({ width: shot.width, height: shot.height })
      setStatus('撮影完了。生成を押してください')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : '撮影に失敗しました')
    }
  }

  const handleGenerate = async () => {
    if (!capturedBlob) {
      setStatus('先にシャッターを押してください')
      return
    }
    setGeneratedUrl(null)
    setGeneratedBase64(null)
    setGeneratedQr(null)
    setPlushCorrupted(false)
    setPlushServerError(false)
    triggerOmikuji()
    setIsLoading(true)
    setStatus('変身中...')
    try {
      const result = await requestNanoBanana(defaultToyPrompt, capturedBlob)
      if (result.base64 && isValidBase64Image(result.base64)) {
        const blob = await base64ToBlob(result.base64, 'image/jpeg')
        const normalized = await normalizeImageToSize(blob, captureSize?.width, captureSize?.height)
        const displayUrl = URL.createObjectURL(normalized)
        setGeneratedUrl(displayUrl)
        const normalizedBase64 = await blobToBase64(normalized)
        setGeneratedBase64(normalizedBase64)
        uploadToSupabase(normalized, 'plush', { compress: true })
          .then((url) => generateQrDataUrl(url))
          .then(setGeneratedQr)
          .catch((err) => logError('plush-qr', err))
        setStatus('ぬいぐるみお着替え完了')
      } else if (result.base64 && !isValidBase64Image(result.base64)) {
        setPlushCorrupted(true)
        setStatus('生成できませんでした。もう一度生成してください。')
        logError('plush-invalid-base64', result.base64)
      } else {
        const sourceBlob = await (await fetch(result.url)).blob()
        const normalized = await normalizeImageToSize(sourceBlob, captureSize?.width, captureSize?.height)
        const displayUrl = URL.createObjectURL(normalized)
        setGeneratedUrl(displayUrl)
        const normalizedBase64 = await blobToBase64(normalized)
        setGeneratedBase64(normalizedBase64)
        uploadToSupabase(normalized, 'plush', { compress: true })
          .then((url) => generateQrDataUrl(url))
          .then(setGeneratedQr)
          .catch((err) => logError('plush-qr', err))
        setStatus('ぬいぐるみお着替え完了')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '生成に失敗しました'
      const isServerErr = msg.includes('500') || msg.includes('503')
      setPlushServerError(isServerErr)
      setStatus('生成できませんでした。もう一度生成してください。')
      logError('plush-generate-error', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegenerate = async () => {
    if (!generatedBase64 && !generatedUrl) {
      setStatus('先に生成してください')
      return
    }
    triggerOmikuji()
    setIsLoading(true)
    setStatus('不足部分を修正中...')
    try {
      let blob: Blob | null = null
      if (generatedBase64) {
        blob = await base64ToBlob(generatedBase64, 'image/jpeg')
      } else if (generatedUrl) {
        blob = await (await fetch(generatedUrl)).blob()
      }
      if (!blob) throw new Error('元画像の取得に失敗しました')
      const repairPrompt =
        '入力画像は初回生成後の画像である。この画像について、人物の服の素材・形状・色・質感・模様・プリントがぬいぐるみ側に完全に適用されているか確認し、不足や破綻があれば該当箇所のみ補完・修正せよ。' +
        '既に正しく生成されている部分は保持し、全体を破壊的に変更してはならない。' +
        '不足箇所のみを補正した最終画像を1枚だけ生成し、Base64形式のみで返せ。'
      const result = await requestNanoBanana(repairPrompt, blob)
      if (result.base64 && isValidBase64Image(result.base64)) {
        const b = await base64ToBlob(result.base64, 'image/jpeg')
        const normalized = await normalizeImageToSize(b, captureSize?.width, captureSize?.height)
        const displayUrl = URL.createObjectURL(normalized)
        setGeneratedUrl(displayUrl)
        const normalizedBase64 = await blobToBase64(normalized)
        setGeneratedBase64(normalizedBase64)
        uploadToSupabase(normalized, 'plush', { compress: true })
          .then((url) => generateQrDataUrl(url))
          .then(setGeneratedQr)
          .catch((err) => logError('plush-qr', err))
        setPlushCorrupted(false)
        setPlushServerError(false)
        setStatus('不足部分を修正しました')
      } else if (result.base64 && !isValidBase64Image(result.base64)) {
        setPlushCorrupted(true)
        setStatus('生成できませんでした。もう一度生成してください。')
        logError('plush-regenerate-invalid-base64', result.base64)
      } else {
        const sourceBlob = await (await fetch(result.url)).blob()
        const normalized = await normalizeImageToSize(sourceBlob, captureSize?.width, captureSize?.height)
        const displayUrl = URL.createObjectURL(normalized)
        setGeneratedUrl(displayUrl)
        const normalizedBase64 = await blobToBase64(normalized)
        setGeneratedBase64(normalizedBase64)
        setPlushCorrupted(false)
        setPlushServerError(false)
        setStatus('不足部分を修正しました')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '再生成に失敗しました'
      const isServerErr = msg.includes('500') || msg.includes('503')
      setPlushServerError(isServerErr)
      setStatus('生成できませんでした。もう一度生成してください。')
      logError('plush-regenerate-error', err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-2.5">
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-[#1f78c8]">ぬいぐるみ試着</p>
          <p className="text-[15px] font-extrabold leading-[1.3]">ぬいぐるみに、自分と同じ服を着せよう！</p>
          <p className="text-[10px] text-[#3b2b12]">シャッターボタン ▶︎ 服をコピーします。</p>
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
        {capturedUrl && !isLoading && !generatedUrl && (
          <img
            className="absolute bottom-3 right-3 max-w-[160px] rounded-[10px] border border-white/40 shadow-md"
            src={capturedUrl}
            alt="capture"
          />
        )}
        {plushCorrupted && !isLoading && (
          <div className="absolute inset-0 w-full h-full grid place-items-center gap-3 p-4 text-center bg-[rgba(0,0,0,0.6)] text-white">
            <p className="text-[12px] m-0">サーバーエラーが発生しました (500/503)。再生成してください。</p>
            <button
              className="border-2 border-[#2a1905] rounded-full px-2.5 py-2 bg-[#7eb8ff] text-[#0b1b3a] text-[12px] font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
              onClick={handleGenerate}
              disabled={isLoading}
            >
              再生成する
            </button>
          </div>
        )}
        {plushServerError && !isLoading && (
          <div className="absolute inset-0 w-full h-full grid place-items-center gap-3 p-4 text-center bg-[rgba(0,0,0,0.6)] text-white">
            <p className="text-[12px] m-0">サーバーエラーが発生しました (500/503)。再生成してください。</p>
            <button
              className="border-2 border-[#2a1905] rounded-full px-2.5 py-2 bg-[#7eb8ff] text-[#0b1b3a] text-[12px] font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
              onClick={handleGenerate}
              disabled={isLoading}
            >
              再生成する
            </button>
          </div>
        )}
        {generatedUrl && !isLoading && !plushCorrupted && (
          <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-[rgba(0,0,0,0.55)]">
            <button
              className="absolute top-2 right-2 w-7 h-7 rounded-full border border-white/70 bg-white/80 text-[#2a1905] font-bold"
              onClick={() => {
                setGeneratedUrl(null)
                setGeneratedBase64(null)
                setCapturedUrl(null)
                setPlushCorrupted(false)
                setPlushServerError(false)
              }}
              aria-label="close result"
            >
              ×
            </button>
            <img className="max-w-full max-h-full object-contain" src={generatedUrl} alt="nano banana result" />
            {generatedQr && (
              <img className="absolute bottom-3 right-3 w-24 h-24 bg-white p-1 rounded" src={generatedQr} alt="QRコード" />
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
            {isLoading ? '変身中...' : '変身'}
          </button>
        </div>
        <button
          className="w-full rounded-full px-2.5 py-2 bg-white text-[#2a1905] text-[12px] font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
          disabled={isLoading || !generatedUrl}
          onClick={handleRegenerate}
          title="不足部分を修正してもう一度"
        >
          不足部分を修正してもう一度 ✨
        </button>
        <p className="text-[11px] text-[#3b2b12]">{status}</p>
        {!NANO_KEY && <p className="text-[11px] text-[#8c2b2b]">環境変数 VITE_NANO_BANANA_API_KEY を設定してください。</p>}
      </div>
    </section>
  )
}
