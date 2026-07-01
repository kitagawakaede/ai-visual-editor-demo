import { useEffect, useRef, useState } from 'react'
import { captureStill, base64ToBlob, isValidBase64Image, videoConstraints, type CaptureShare } from '../lib/image'
import { requestOpenAIImageEdit, requestNanoBanana, OPENAI_KEY, NANO_KEY } from '../lib/api'
import { uploadToSupabase, generateQrDataUrl } from '../lib/supabase'
import { logError } from '../lib/error'
import { buildLineStampGridPrompt, pickRandomStamps } from '../constants/prompts'
import { useOmikujiOverlay } from '../hooks/useOmikuji'
import { WaitingGame } from '../components/WaitingGame'
import { EngineToggle } from '../components/EngineToggle'

// 生成エンジンはコンポーネント内の state（useGemini）でボタン切り替え。
// 既定は OpenAI（文字精度重視。moderation:'low' + quality:'medium'）。
// Gemini は速いが日本語の文字化けが大きい。

export function LineStampModule({ capturedUrl, capturedBlob, onCapture }: CaptureShare) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [streamError, setStreamError] = useState<string | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [resultQr, setResultQr] = useState<string | null>(null)
  const [isCorrupted, setIsCorrupted] = useState(false)
  const [serverError, setServerError] = useState(false)
  const [status, setStatus] = useState(capturedBlob ? '撮影済み。「スタンプ作成」を押してください' : '写真を撮影して「スタンプ作成」を押してください')
  const [isLoading, setIsLoading] = useState(false)
  const [useGemini, setUseGemini] = useState(false) // 既定 OpenAI。デモ比較用にボタンで切替
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
      setStatus('撮影完了。「スタンプ作成」を押してください')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : '撮影に失敗しました')
    }
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
      // 12種からランダムで6種を選び、その6種でプロンプトを組み立てる
      const selected = pickRandomStamps(6)
      const prompt = buildLineStampGridPrompt(selected)
      console.log('stamp:selected', selected.map((s) => s.text))
      // 参照画像の人物に引っ張られて本人と似なくなるため、参照画像は渡さず
      // 本人写真のみを入力にする（画風・文字スタイルはプロンプトで指定）。
      // 6枚グリッド生成。USE_GEMINI=true なら Gemini（速い・サイズ指定不可）、false なら OpenAI（縦長指定可）
      const result = useGemini
        ? await requestNanoBanana(prompt, capturedBlob)
        : await requestOpenAIImageEdit(prompt, capturedBlob, undefined, 'gpt-image-1.5', '1024x1536', 'low', 'medium')
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
        const displayUrl = URL.createObjectURL(rawBlob)
        setResultUrl(displayUrl)
        uploadToSupabase(rawBlob, 'stamp', { compress: true })
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
      resetOmikuji()
    }
  }

  const handleCloseResult = () => {
    setResultUrl(null)
    setIsCorrupted(false)
    setServerError(false)
    setResultQr(null)
    // 撮影写真は共有のため保持（続けて他機能でも使える）
    setStatus(capturedBlob ? '撮影済み。「スタンプ作成」を押してください' : '写真を撮影して「スタンプ作成」を押してください')
  }

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-2.5">
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-black">LINE STAMP</p>
          <p className="text-[16px] font-extrabold leading-[1.3] text-black">自分のLINE STAMPを作ってみよう！</p>
          <p className="text-[10px] text-black">撮影 ▶︎ 1ステップで自分のスタンプを作れちゃう。</p>
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

        {/* LINEスタンプ購入画面（カメラ枠内に再現） */}
        {resultUrl && !isLoading && !isCorrupted && (
          <div className="absolute inset-0 w-full h-full flex flex-col bg-white text-[#222]">
            {/* ヘッダー */}
            <div className="flex items-center justify-between px-3 py-2 shrink-0">
              <button className="text-[20px] leading-none text-[#444]" onClick={handleCloseResult} aria-label="back">
                ‹
              </button>
              <div className="flex items-center gap-3">
                <span className="text-[16px] text-[#444]">⤴</span>
                <button className="text-[18px] leading-none text-[#444]" onClick={handleCloseResult} aria-label="close">
                  ✕
                </button>
              </div>
            </div>

            {/* QR + MY STAMP */}
            <div className="flex flex-col items-center gap-1.5 pb-2 shrink-0">
              {resultQr ? (
                <img className="w-[88px] h-[88px]" src={resultQr} alt="QRコード" />
              ) : (
                <div className="w-[88px] h-[88px] grid place-items-center bg-[#f2f2f2] text-[10px] text-[#999] rounded">
                  QR生成中
                </div>
              )}
              <span className="text-[11px] font-bold tracking-wide text-[#333] border border-[#ddd] rounded-md px-3 py-1">
                MY STAMP
              </span>
            </div>

            {/* アクション行（ダミー） */}
            <div className="flex items-center justify-center gap-2 px-3 pb-2 shrink-0">
              <div className="flex flex-row items-center justify-center gap-0.5 px-1.5 py-0.5 rounded-md border border-[#e5e5e5]">
                <span className="text-[9px] leading-none text-[#ff4d6d]">♥</span>
                <span className="text-[8px] text-[#888] leading-none">10,000</span>
              </div>
              <button
                className="w-28 text-center rounded-md border border-[#cfcfcf] bg-white text-[#333] font-bold py-0.5"
                style={{ fontSize: '11px' }}
              >
                プレゼントする
              </button>
              <button
                className="w-28 text-center rounded-md bg-[#06C755] text-white font-bold py-0.5"
                style={{ fontSize: '11px' }}
              >
                購入する
              </button>
            </div>

            {/* スタンプ一覧（この部分のみスクロール） */}
            <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-2 bg-[#fafafa]">
              <img className="w-full h-auto block" src={resultUrl} alt="stamp grid" />
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
            {isLoading ? '生成中...' : 'スタンプ作成'}
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
