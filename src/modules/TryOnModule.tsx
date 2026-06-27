import { useEffect, useRef, useState } from 'react'
import { captureStill, normalizeImageToSize, base64ToBlob, isValidBase64Image, videoConstraints } from '../lib/image'
import { requestNanoBanana, transcribeWithWhisper, NANO_KEY, WHISPER_KEY } from '../lib/api'
import { uploadToSupabase, generateQrDataUrl } from '../lib/supabase'
import { logError } from '../lib/error'
import { tryOnPromptBase } from '../constants/prompts'
import { useOmikujiOverlay } from '../hooks/useOmikuji'
import { WaitingGame } from '../components/WaitingGame'

type ImageSize = { width: number; height: number }

export function TryOnModule() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [streamError, setStreamError] = useState<string | null>(null)
  const [instruction, setInstruction] = useState('')
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null)
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null)
  const [captureSize, setCaptureSize] = useState<ImageSize | null>(null)
  const [editedUrl, setEditedUrl] = useState<string | null>(null)
  const [editedQr, setEditedQr] = useState<string | null>(null)
  const [isCorrupted, setIsCorrupted] = useState(false)
  const [serverError, setServerError] = useState(false)
  const [status, setStatus] = useState<string>('マイク→撮影→お着替えの3ステップで試着を体験できます。')
  const [isRecording, setIsRecording] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const audioStreamRef = useRef<MediaStream | null>(null)
  const audioChunks = useRef<Blob[]>([])
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

  const toggleRecording = async () => {
    if (isRecording) {
      recorderRef.current?.stop()
      audioStreamRef.current?.getTracks().forEach((t) => t.stop())
      setIsRecording(false)
      return
    }
    setStatus('録音中...')
    audioChunks.current = []
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    audioStreamRef.current = stream
    const mimeType = ['audio/webm', 'audio/mp4', 'audio/ogg'].find((t) => MediaRecorder.isTypeSupported(t)) ?? ''
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
    recorderRef.current = recorder
    recorder.ondataavailable = (evt) => {
      if (evt.data.size > 0) audioChunks.current.push(evt.data)
    }
    recorder.onstop = async () => {
      setIsRecording(false)
      const blob = new Blob(audioChunks.current, { type: mimeType || recorder.mimeType })
      try {
        setStatus('Whisper で文字起こし中...')
        const text = await transcribeWithWhisper(blob)
        setInstruction(text || instruction)
        setStatus('文字起こし完了')
      } catch (err) {
        setStatus(err instanceof Error ? err.message : '文字起こしに失敗しました')
      }
    }
    recorder.start()
    setIsRecording(true)
  }

  const handleCapture = async () => {
    if (!videoRef.current) return
    resetOmikuji()
    setIsCorrupted(false)
    setServerError(false)
    setEditedUrl(null)
    setEditedQr(null)
    setStatus('撮影中...')
    try {
      const shot = await captureStill(videoRef.current)
      setCapturedUrl(shot.url)
      setCapturedBlob(shot.blob)
      setCaptureSize({ width: shot.width, height: shot.height })
      setStatus('撮影完了。お着替えを押してください')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : '撮影に失敗しました')
    }
  }

  const handleTryOn = async () => {
    if (!capturedBlob) {
      setStatus('先に撮影してください')
      return
    }
    setEditedUrl(null)
    setEditedQr(null)
    setIsCorrupted(false)
    setServerError(false)
    triggerOmikuji()
    setIsLoading(true)
    setStatus('変身中...')
    try {
      const combinedPrompt = [tryOnPromptBase, instruction.trim()].filter(Boolean).join(' ')
      const result = await requestNanoBanana(combinedPrompt, capturedBlob)
      if (result.base64 && isValidBase64Image(result.base64)) {
        const blob = await base64ToBlob(result.base64, 'image/jpeg')
        const normalized = await normalizeImageToSize(blob, captureSize?.width, captureSize?.height)
        const displayUrl = URL.createObjectURL(normalized)
        setEditedUrl(displayUrl)
        uploadToSupabase(normalized, 'tryon', { compress: true })
          .then((url) => generateQrDataUrl(url))
          .then(setEditedQr)
          .catch((err) => logError('tryon-qr', err))
        setStatus('AIお着替え完了')
      } else if (result.base64 && !isValidBase64Image(result.base64)) {
        setIsCorrupted(true)
        setStatus('生成できませんでした。もう一度お試しください。')
        logError('tryon-invalid-base64', result.base64)
      } else {
        const sourceBlob = await (await fetch(result.url)).blob()
        const normalized = await normalizeImageToSize(sourceBlob, captureSize?.width, captureSize?.height)
        const displayUrl = URL.createObjectURL(normalized)
        setEditedUrl(displayUrl)
        uploadToSupabase(normalized, 'tryon', { compress: true })
          .then((url) => generateQrDataUrl(url))
          .then(setEditedQr)
          .catch((err) => logError('tryon-qr', err))
        setStatus('AIお着替え完了')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'お着替えに失敗しました'
      const isServerErr = msg.includes('500') || msg.includes('503')
      setServerError(isServerErr)
      setStatus('生成できませんでした。もう一度お試しください。')
      logError('tryon-error', err)
    } finally {
      setIsLoading(false)
      resetOmikuji()
    }
  }

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-2.5">
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-black">こんな自分になってみたいかも…！</p>
          <p className="text-[16px] font-extrabold leading-[1.3] text-black">なりたい自分になれる！</p>
          <p className="text-[10px] text-black">シャッターボタン ▶︎ なりたい自分になれる！</p>
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
        {capturedUrl && !isLoading && !editedUrl && !isCorrupted && (
          <img
            className="absolute bottom-3 right-3 max-w-[160px] rounded-[10px] border border-white/40 shadow-md"
            src={capturedUrl}
            alt="capture"
          />
        )}
        {isCorrupted && !isLoading && (
          <div
            className="absolute inset-0 w-full h-full grid place-items-center gap-3 p-4 text-center bg-[rgba(0,0,0,0.6)] text-white"
            style={{ transform: 'scaleX(-1)' }}
          >
            <p className="text-[12px] m-0">サーバーエラーが発生しました (500/503)。再生成してください。</p>
            <button
              className="border-2 border-[#2a1905] rounded-full px-2.5 py-2 bg-[#7eb8ff] text-[#0b1b3a] text-[12px] font-bold inline-flex items-center justify-center gap-1.5"
              onClick={handleTryOn}
              style={{ transform: 'scaleX(1)' }}
            >
              再生成する
            </button>
          </div>
        )}
        {serverError && !isLoading && (
          <div
            className="absolute inset-0 w-full h-full grid place-items-center gap-3 p-4 text-center bg-[rgba(0,0,0,0.6)] text-white"
            style={{ transform: 'scaleX(-1)' }}
          >
            <p className="text-[12px] m-0">サーバーエラーが発生しました (500/503)。再生成してください。</p>
            <button
              className="border-2 border-[#2a1905] rounded-full px-2.5 py-2 bg-[#7eb8ff] text-[#0b1b3a] text-[12px] font-bold inline-flex items-center justify-center gap-1.5"
              onClick={handleTryOn}
              style={{ transform: 'scaleX(1)' }}
            >
              再生成する
            </button>
          </div>
        )}
        {editedUrl && !isLoading && !isCorrupted && (
          <div className="absolute inset-0 w-full h-full left-0 right-0 flex items-center justify-center bg-[rgba(0,0,0,0.55)]">
            <button
              className="absolute top-2 right-2 w-7 h-7 rounded-full border border-white/70 bg-white/80 text-[#2a1905] font-bold"
              onClick={() => {
                setEditedUrl(null)
                setCapturedUrl(null)
                setIsCorrupted(false)
                setEditedQr(null)
              }}
              aria-label="close result"
            >
              ×
            </button>
            <img className="max-w-full max-h-full object-contain" src={editedUrl} alt="nano banana result" />
            {editedQr && (
              <img className="absolute bottom-3 right-3 w-24 h-24 bg-white p-1 rounded" src={editedQr} alt="QRコード" />
            )}
          </div>
        )}
      </div>

      <div className="bg-[#ffedab] rounded-[16px] p-2.5 flex flex-col gap-2 shadow-[0_8px_16px_rgba(0,0,0,0.15)]">
        <div className="flex gap-2">
          <button
            className={`flex-1 rounded-full px-2.5 py-2 text-[12px] font-bold inline-flex items-center justify-center gap-1.5 text-[#2a1905] ${
              isRecording ? 'bg-[#ffdf9a]' : 'bg-white'
            }`}
            onClick={toggleRecording}
          >
            {isRecording ? '録音停止' : 'マイク開始'}
          </button>
          <button
            className="flex-1 rounded-full px-2.5 py-2 bg-[#111] text-white text-[12px] font-bold inline-flex items-center justify-center gap-1.5"
            onClick={handleCapture}
          >
            {capturedBlob ? '再撮影' : 'シャッター'}
          </button>
          <button
            className="flex-1 rounded-full px-2.5 py-2 bg-[#7eb8ff] text-[#0b1b3a] text-[12px] font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
            onClick={handleTryOn}
            disabled={isLoading}
          >
            {isLoading ? '変身中...' : 'お着替え'}
          </button>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-bold">音声で認識した指示</span>
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="今着ているトップスを赤色にして"
            rows={3}
            className="w-full rounded-[10px] p-2 text-[12px] bg-white text-[#2a1905]"
          />
        </label>

        <p className="text-[11px] text-[#3b2b12]">{status}</p>
        {!NANO_KEY && <p className="text-[11px] text-[#8c2b2b]">環境変数 VITE_NANO_BANANA_API_KEY を設定してください。</p>}
        {!WHISPER_KEY && (
          <p className="text-[11px] text-[#8c2b2b]">
            Whisper APIキー (VITE_WHISPER_API_KEY) が無い場合は手入力で試してください。
          </p>
        )}
      </div>
    </section>
  )
}
