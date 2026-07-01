import { useEffect, useRef, useState } from 'react'
import { captureStill, base64ToBlob, isValidBase64Image, videoConstraints, type CaptureShare } from '../lib/image'
import { requestOpenAIImageEdit, requestNanoBanana, detectGenderFromImage, OPENAI_KEY, NANO_KEY } from '../lib/api'
import { uploadToSupabase, generateQrDataUrl } from '../lib/supabase'
import { logError } from '../lib/error'
import { TIME_SLIP_ITEMS, TIME_SLIP_NO_REF_IDS } from '../constants/prompts'
import { useOmikujiOverlay } from '../hooks/useOmikuji'
import { WaitingGame } from '../components/WaitingGame'
import { EngineToggle } from '../components/EngineToggle'

// フィルム内の各コマの傾き（固定レイアウト）
const FILM_ANGLES = [-4, 3, -2, 4, -3, 2, -5, 3, -2]

// 生成エンジンはコンポーネント内の state（useGemini）でボタン切り替え。
// 既定は Gemini（速度重視）。OpenAI に切り替えると全9枚を OpenAI で生成。
// なお赤ちゃん・小学一年生（制服）は Gemini が安全ポリシーで生成できないため、
// useGemini に関わらず常に OpenAI で生成する。

type SlotResult = { id: string; label: string; url: string | null }

// 9枚を1枚のアルバム画像（3×3コラージュ）に合成する（QR共有用）
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image load failed'))
    img.src = src
  })
}

async function buildAlbumComposite(slots: SlotResult[]): Promise<Blob | null> {
  const cols = 3
  const rows = 3
  const cell = 400
  const pad = 28
  const W = pad + cols * (cell + pad)
  const H = pad + rows * (cell + pad)
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#161616'
  ctx.fillRect(0, 0, W, H)
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i]
    if (!s.url) continue
    let img: HTMLImageElement
    try {
      img = await loadImage(s.url)
    } catch {
      continue
    }
    const cx = pad + (i % cols) * (cell + pad)
    const cy = pad + Math.floor(i / cols) * (cell + pad)
    // ポラロイド枠（下に余白）
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(cx - 8, cy - 8, cell + 16, cell + 40)
    // object-cover で描画。縦長は上揃えにして頭が切れないようにする（はみ出しは下＝足元側）
    const scale = Math.max(cell / img.width, cell / img.height)
    const dw = img.width * scale
    const dh = img.height * scale
    const dx = cx + (cell - dw) / 2
    const dy = dh > cell ? cy : cy + (cell - dh) / 2 // 縦長は上端揃え
    ctx.save()
    ctx.beginPath()
    ctx.rect(cx, cy, cell, cell)
    ctx.clip()
    ctx.drawImage(img, dx, dy, dw, dh)
    ctx.restore()
  }
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.9))
}

export function TimeSlipModule({ capturedUrl, capturedBlob, onCapture }: CaptureShare) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [streamError, setStreamError] = useState<string | null>(null)
  const [results, setResults] = useState<SlotResult[] | null>(null)
  const [resultQr, setResultQr] = useState<string | null>(null)
  const [filmVisible, setFilmVisible] = useState(false)
  const [serverError, setServerError] = useState(false)
  const [status, setStatus] = useState(capturedBlob ? '撮影済み。「タイムスリップ」を押してください' : '写真を撮影して「タイムスリップ」を押してください')
  const [isLoading, setIsLoading] = useState(false)
  const [useGemini, setUseGemini] = useState(true) // 既定 Gemini。デモ比較用にボタンで切替
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
    setServerError(false)
    setResults(null)
    setFilmVisible(false)
    setStatus('撮影中...')
    try {
      const shot = await captureStill(videoRef.current)
      onCapture(shot.url, shot.blob, { width: shot.width, height: shot.height })
      setStatus('撮影完了。「タイムスリップ」を押してください')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : '撮影に失敗しました')
    }
  }

  const generateOne = async (index: number, blob: Blob, gender: 'man' | 'woman'): Promise<string | null> => {
    try {
      const item = TIME_SLIP_ITEMS[index]
      // 赤ちゃん・小学一年生は「本人の顔×子どもの体」が Gemini の安全ポリシーで弾かれるため、
      // OpenAI(gpt-image-1.5) + moderation:'low' で生成する（本人写真のみ・era参照は渡さない）。
      const isChild = (TIME_SLIP_NO_REF_IDS as readonly string[]).includes(item.id)
      if (isChild) {
        const result = await requestOpenAIImageEdit(item.prompt, blob, undefined, 'gpt-image-1.5', '1024x1536', 'low', 'low')
        if (result.base64 && isValidBase64Image(result.base64)) {
          return URL.createObjectURL(await base64ToBlob(result.base64, 'image/jpeg'))
        }
        return result.url ?? null
      }
      // 年代別アイテムは性別で出し分け（promptByGender があればそちらを使用）。全項目テキストのみ生成。
      const prompt = item.promptByGender ? item.promptByGender[gender] : item.prompt
      const result = useGemini
        ? await requestNanoBanana(prompt, blob)
        : await requestOpenAIImageEdit(prompt, blob, undefined, 'gpt-image-1.5', '1024x1536', 'low', 'medium')
      if (result.base64 && isValidBase64Image(result.base64)) {
        const rawBlob = await base64ToBlob(result.base64, 'image/jpeg')
        return URL.createObjectURL(rawBlob)
      }
      if (result.url) {
        return result.url
      }
      return null
    } catch (err) {
      logError(`timeslip-${TIME_SLIP_ITEMS[index].id}`, err)
      return null
    }
  }

  const handleGenerate = async () => {
    if (!capturedBlob) {
      setStatus('先にシャッターを押してください')
      return
    }
    setServerError(false)
    setResults(null)
    setResultQr(null)
    setFilmVisible(false)
    triggerOmikuji()
    setIsLoading(true)
    setStatus('9枚を並列生成中...')
    try {
      // 写真から性別を判定（ギャングの参考画像出し分け用）
      const gender = await detectGenderFromImage(capturedBlob)
      console.log('timeslip:gender', gender)
      // 9枚を並列生成（部分失敗しても揃ったものを表示）
      const urls = await Promise.all(TIME_SLIP_ITEMS.map((_, i) => generateOne(i, capturedBlob, gender)))
      const slots: SlotResult[] = TIME_SLIP_ITEMS.map((item, i) => ({
        id: item.id,
        label: item.label,
        url: urls[i],
      }))
      const successCount = slots.filter((s) => s.url).length
      if (successCount === 0) {
        setServerError(true)
        setStatus('生成できませんでした。もう一度お試しください。')
        return
      }
      // すべて揃ってからフィルムをフェードインで表示
      setResults(slots)
      setStatus(`タイムスリップ完了（${successCount}/9枚）`)
      requestAnimationFrame(() => requestAnimationFrame(() => setFilmVisible(true)))
      // アルバム合成→アップロード→QR生成（非同期で後追い表示）
      buildAlbumComposite(slots)
        .then((blob) => (blob ? uploadToSupabase(blob, 'timeslip', { compress: true, maxSize: 1440, quality: 0.82 }) : null))
        .then((url) => (url ? generateQrDataUrl(url) : null))
        .then((qr) => qr && setResultQr(qr))
        .catch((err) => logError('timeslip-qr', err))
    } catch (err) {
      setServerError(true)
      setStatus('生成できませんでした。もう一度お試しください。')
      logError('timeslip-error', err)
    } finally {
      setIsLoading(false)
      resetOmikuji()
    }
  }

  const handleCloseResult = () => {
    setResults(null)
    setResultQr(null)
    setFilmVisible(false)
    setServerError(false)
    // 撮影写真は共有のため保持（続けて他機能でも使える）
    setStatus(capturedBlob ? '撮影済み。「タイムスリップ」を押してください' : '写真を撮影して「タイムスリップ」を押してください')
  }

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-2.5">
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-black">あの時代に生きてたら…！</p>
          <p className="text-[16px] font-extrabold leading-[1.3] text-black">過去の時代にタイムスリップ！</p>
          <p className="text-[10px] text-black">シャッターボタン ▶︎ あの時代にタイムスリップできちゃう</p>
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
            生成中...
          </div>
        )}
        {capturedUrl && !isLoading && !results && !serverError && (
          <img
            className="absolute bottom-3 right-3 max-w-[160px] rounded-[10px] border border-white/40 shadow-md"
            src={capturedUrl}
            alt="capture"
          />
        )}
        {serverError && !isLoading && (
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

        {/* フィルムアルバム（カメラ枠内・固定レイアウト・フェードイン） */}
        {results && !isLoading && (
          <div className="absolute inset-0 w-full h-full flex flex-col bg-[#161616]">
            <div className="flex items-center justify-between px-3 py-2 shrink-0">
              <span className="text-white/80 text-[11px] font-bold tracking-wide">TIME SLIP ALBUM</span>
              <div className="flex items-center gap-2">
                {resultQr ? (
                  <img className="w-9 h-9 bg-white p-0.5 rounded" src={resultQr} alt="QRコード" />
                ) : (
                  <span className="text-white/40 text-[9px]">QR生成中…</span>
                )}
                <button
                  className="w-6 h-6 rounded-full border border-white/50 text-white/90 text-[13px] leading-none"
                  onClick={handleCloseResult}
                  aria-label="close result"
                >
                  ✕
                </button>
              </div>
            </div>
            <div
              className="flex-1 min-h-0 overflow-hidden p-2 grid grid-cols-3 grid-rows-3 gap-1 place-items-center transition-opacity duration-700 ease-out"
              style={{ opacity: filmVisible ? 1 : 0 }}
            >
              {results.map((slot, i) => (
                <div
                  key={slot.id}
                  className="w-full h-full flex flex-col bg-white p-[3px] shadow-[0_3px_8px_rgba(0,0,0,0.45)]"
                  style={{ transform: `rotate(${FILM_ANGLES[i % FILM_ANGLES.length]}deg)` }}
                >
                  <div className="flex-1 min-h-0 overflow-hidden bg-[#eee]">
                    {slot.url ? (
                      <img className="w-full h-full object-cover block" src={slot.url} alt={slot.label} />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-[8px] text-[#999] text-center px-1">
                        生成失敗
                      </div>
                    )}
                  </div>
                  <p className="text-center text-[6px] text-[#444] mt-[2px] leading-none truncate">{slot.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-[#ffedab] rounded-[16px] p-2.5 flex flex-col gap-2 shadow-[0_8px_16px_rgba(0,0,0,0.15)]">
        {/* 生成エンジン切替（アイコン：選択=黒背景／未選択=白背景） */}
        <EngineToggle useGemini={useGemini} onChange={setUseGemini} disabled={isLoading} />
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
            {isLoading ? '生成中...' : 'タイムスリップ'}
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
