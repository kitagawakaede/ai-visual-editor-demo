import { useEffect, useRef, useState } from 'react'
import { captureStill, base64ToBlob, isValidBase64Image, videoConstraints } from '../lib/image'
import { requestOpenAIImageEdit, requestNanoBanana, detectGenderFromImage, scoreHairstyle, OPENAI_KEY, NANO_KEY } from '../lib/api'
import { uploadToSupabase, generateQrDataUrl } from '../lib/supabase'
import { logError } from '../lib/error'
import { HAIR_STYLE_ITEMS, type HairStyleItem, type HairScore } from '../constants/prompts'
import { useOmikujiOverlay } from '../hooks/useOmikuji'
import { WaitingGame } from '../components/WaitingGame'
import { EngineToggle } from '../components/EngineToggle'

type HairSlot = {
  id: string
  label: string
  url: string | null
  score: HairScore | null
  category: '一番似合う' | '普通' | null // 非nullが比較カード（上位3枚）、nullがグリッド
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image load failed'))
    img.src = src
  })
}

async function buildHairComposite(slots: HairSlot[]): Promise<Blob | null> {
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
  ctx.fillStyle = '#ffffff' // 背景は白
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
    ctx.fillStyle = '#f2f2f2'
    ctx.fillRect(cx - 6, cy - 6, cell + 12, cell + 12)
    const scale = Math.max(cell / img.width, cell / img.height)
    const dw = img.width * scale
    const dh = img.height * scale
    const dx = cx + (cell - dw) / 2
    const dy = dh > cell ? cy : cy + (cell - dh) / 2
    ctx.save()
    ctx.beginPath()
    ctx.rect(cx, cy, cell, cell)
    ctx.clip()
    ctx.drawImage(img, dx, dy, dw, dh)
    ctx.restore()
  }
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.9))
}

export function HairStyleModule() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [streamError, setStreamError] = useState<string | null>(null)
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null)
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null)
  const [results, setResults] = useState<HairSlot[] | null>(null)
  const [gender, setGender] = useState<'man' | 'woman'>('woman')
  const [resultQr, setResultQr] = useState<string | null>(null)
  const [resultVisible, setResultVisible] = useState(false)
  const [serverError, setServerError] = useState(false)
  const [status, setStatus] = useState('写真を撮影して「診断」を押してください')
  const [isLoading, setIsLoading] = useState(false)
  const [useGemini, setUseGemini] = useState(true)
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
    setResultVisible(false)
    setStatus('撮影中...')
    try {
      const shot = await captureStill(videoRef.current)
      setCapturedUrl(shot.url)
      setCapturedBlob(shot.blob)
      setStatus('撮影完了。「診断」を押してください')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : '撮影に失敗しました')
    }
  }

  const generateOne = async (item: HairStyleItem, blob: Blob, g: 'man' | 'woman'): Promise<string | null> => {
    try {
      const prompt = item.promptByGender[g]
      const result = useGemini
        ? await requestNanoBanana(prompt, blob)
        : await requestOpenAIImageEdit(prompt, blob, undefined, 'gpt-image-1.5', '1024x1536', 'low', 'medium')
      if (result.base64 && isValidBase64Image(result.base64)) {
        return URL.createObjectURL(await base64ToBlob(result.base64, 'image/jpeg'))
      }
      return result.url ?? null
    } catch (err) {
      logError(`hair-${item.id}`, err)
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
    setResultVisible(false)
    triggerOmikuji()
    setIsLoading(true)
    setStatus('9枚を並列生成中...')
    try {
      const g = await detectGenderFromImage(capturedBlob)
      setGender(g)
      console.log('hair:gender', g)
      // 9枚を並列生成
      const urls = await Promise.all(HAIR_STYLE_ITEMS.map((item) => generateOne(item, capturedBlob, g)))
      // 生成成功した全枚を並列採点（3→9枚に増えても Promise.all で同時実行なので待ち時間はほぼ一定）
      const scoreByIndex = new Map<number, HairScore>()
      await Promise.all(
        HAIR_STYLE_ITEMS.map(async (_item, i) => {
          if (!urls[i]) return
          const resp = await fetch(urls[i] as string)
          const blob = await resp.blob()
          scoreByIndex.set(i, await scoreHairstyle(blob, g))
        }),
      )
      // 生成成功した全枚を合計スコア降順でソートし、上位3枚にカテゴリを割り当て
      const rankedIdx = HAIR_STYLE_ITEMS
        .map((_item, i) => i)
        .filter((i) => urls[i])
        .sort((a, b) => {
          const sa = scoreByIndex.get(a) ?? { small: 0, refined: 0 }
          const sb = scoreByIndex.get(b) ?? { small: 0, refined: 0 }
          return sb.small + sb.refined - (sa.small + sa.refined)
        })
      const categoryByIndex = new Map<number, '一番似合う' | '普通'>()
      rankedIdx.slice(0, 3).forEach((i, rank) => categoryByIndex.set(i, rank === 0 ? '一番似合う' : '普通'))

      const slots: HairSlot[] = HAIR_STYLE_ITEMS.map((item, i) => ({
        id: item.id,
        label: item.label,
        url: urls[i],
        score: scoreByIndex.get(i) ?? null,
        category: categoryByIndex.get(i) ?? null,
      }))
      const successCount = slots.filter((s) => s.url).length
      if (successCount === 0) {
        setServerError(true)
        setStatus('生成できませんでした。もう一度お試しください。')
        return
      }
      setResults(slots)
      setStatus(`診断完了（${successCount}/9枚）`)
      requestAnimationFrame(() => requestAnimationFrame(() => setResultVisible(true)))
      // QR（後追い）: 9枚を buildHairComposite で合成
      buildHairComposite(slots)
        .then((blob) => (blob ? uploadToSupabase(blob, 'hair', { compress: true, maxSize: 1440, quality: 0.82 }) : null))
        .then((url) => (url ? generateQrDataUrl(url) : null))
        .then((qr) => qr && setResultQr(qr))
        .catch((err) => logError('hair-qr', err))
    } catch (err) {
      setServerError(true)
      setStatus('生成できませんでした。もう一度お試しください。')
      logError('hair-error', err)
    } finally {
      setIsLoading(false)
      resetOmikuji()
    }
  }

  const handleCloseResult = () => {
    setResults(null)
    setResultQr(null)
    setResultVisible(false)
    setCapturedUrl(null)
    setServerError(false)
    setStatus('写真を撮影して「診断」を押してください')
  }

  // 評価項目ラベル（女性=小顔効果、男性=爽やかさ／共通=垢抜け度）
  const smallLabel = gender === 'man' ? '爽やかさ' : '小顔効果'
  const stars = (n: number) => '★★★★★☆☆☆☆☆'.slice(5 - Math.min(5, Math.max(0, n)), 10 - Math.min(5, Math.max(0, n)))

  const featured = results ? results.filter((s) => s.category !== null) : []
  const others = results ? results.filter((s) => s.category === null) : []
  // featured はスコア合計の降順で並べる（先頭＝一番似合う）。
  const scoreSum = (s: HairSlot) => (s.score ? s.score.small + s.score.refined : -1)
  // 合計順で1位でも個別項目では下位が上回ることがあるため、下位カードの各項目を
  // 上位カード以下にクランプし、「一番似合う」が常に最高評価に見えるようにする（表示上の単調性を担保）。
  let prevSmall = 5
  let prevRefined = 5
  const featuredSorted = [...featured]
    .sort((a, b) => scoreSum(b) - scoreSum(a))
    .map((slot) => {
      if (!slot.score) return slot
      const small = Math.min(slot.score.small, prevSmall)
      const refined = Math.min(slot.score.refined, prevRefined)
      prevSmall = small
      prevRefined = refined
      return { ...slot, score: { small, refined } }
    })

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-2.5">
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-black">こんな自分になってみたいかも…！</p>
          <p className="text-[16px] font-extrabold leading-[1.3] text-black">なりたい自分になれる！</p>
          <p className="text-[10px] text-black">シャッターボタン ▶︎ 似合う髪型を診断できちゃう</p>
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
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} muted playsInline />
        <WaitingGame visible={omikujiVisible} onClose={resetOmikuji} />
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[rgba(0,0,0,0.6)] text-white font-bold text-lg z-10">診断中...</div>
        )}
        {capturedUrl && !isLoading && !results && !serverError && (
          <img className="absolute bottom-3 right-3 max-w-[160px] rounded-[10px] border border-white/40 shadow-md" src={capturedUrl} alt="capture" />
        )}
        {serverError && !isLoading && (
          <div className="absolute inset-0 w-full h-full grid place-items-center gap-3 p-4 text-center bg-[rgba(0,0,0,0.6)] text-white">
            <p className="text-[12px] m-0">生成できませんでした。もう一度お試しください。</p>
            <button className="border-2 border-[#2a1905] rounded-full px-2.5 py-2 bg-[#7eb8ff] text-[#0b1b3a] text-[12px] font-bold inline-flex items-center justify-center gap-1.5" onClick={handleGenerate}>再生成する</button>
          </div>
        )}

        {/* 診断結果（カメラ枠内・他機能と同じくオーバーレイ表示・フェードイン） */}
        {results && !isLoading && (
          <div className="absolute inset-0 w-full h-full flex flex-col bg-white">
            <div className="flex items-center justify-between px-2 py-1.5 shrink-0">
              <span className="text-[11px] font-extrabold text-black tracking-wide">診断結果</span>
              <div className="flex items-center gap-2">
                {resultQr ? (
                  <img className="w-8 h-8 bg-white p-0.5 rounded border border-black/10" src={resultQr} alt="QRコード" />
                ) : (
                  <span className="text-black/40 text-[9px]">QR生成中…</span>
                )}
                <button
                  className="w-6 h-6 rounded-full border border-black/30 text-black/70 text-[13px] leading-none"
                  onClick={handleCloseResult}
                  aria-label="close result"
                >
                  ✕
                </button>
              </div>
            </div>
            <div
              className="flex-1 min-h-0 overflow-y-auto px-2 pb-2 transition-opacity duration-700 ease-out"
              style={{ opacity: resultVisible ? 1 : 0 }}
            >
              {/* 上段：上位3枚 比較カード（星付き） */}
              <div className="grid grid-cols-3 gap-1">
                {featuredSorted.map((slot) => (
                  <div key={slot.id} className="flex flex-col bg-white border border-black/10 rounded-[8px] overflow-hidden shadow-sm">
                    <div className="text-center py-0.5 text-[9px] font-bold text-black leading-tight">
                      {slot.category === '一番似合う' ? '👑一番似合う' : slot.category}
                    </div>
                    <div className="aspect-square bg-[#eee] overflow-hidden">
                      {slot.url ? <img className="w-full h-full object-cover block" src={slot.url} alt={slot.label} /> : <div className="w-full h-full grid place-items-center text-[8px] text-[#999]">生成失敗</div>}
                    </div>
                    <p className="text-center text-[7px] text-[#444] mt-0.5 px-0.5 leading-tight truncate">{slot.label}</p>
                    <div className="px-1 pb-1 text-[7px] text-[#c8a013] leading-tight">
                      <div className="flex justify-between"><span className="text-[#666]">{smallLabel}</span><span>{slot.score ? stars(slot.score.small) : '—'}</span></div>
                      <div className="flex justify-between"><span className="text-[#666]">垢抜け度</span><span>{slot.score ? stars(slot.score.refined) : '—'}</span></div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 下段：その他6枚グリッド（星なし） */}
              <div className="grid grid-cols-3 gap-1 mt-1.5">
                {others.map((slot) => (
                  <div key={slot.id} className="flex flex-col bg-white border border-black/10 rounded-[6px] overflow-hidden">
                    <div className="aspect-square bg-[#eee] overflow-hidden">
                      {slot.url ? <img className="w-full h-full object-cover block" src={slot.url} alt={slot.label} /> : <div className="w-full h-full grid place-items-center text-[8px] text-[#999]">生成失敗</div>}
                    </div>
                    <p className="text-center text-[7px] text-[#444] py-0.5 px-0.5 leading-tight truncate">{slot.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-[#ffedab] rounded-[16px] p-2.5 flex flex-col gap-2 shadow-[0_8px_16px_rgba(0,0,0,0.15)]">
        <EngineToggle useGemini={useGemini} onChange={setUseGemini} disabled={isLoading} />
        <div className="flex gap-2">
          <button className="flex-1 rounded-full px-2.5 py-2 bg-[#111] text-white text-[12px] font-bold inline-flex items-center justify-center gap-1.5" onClick={handleCapture}>
            {capturedBlob ? '再撮影' : 'シャッター'}
          </button>
          <button className="flex-1 rounded-full px-2.5 py-2 bg-[#7eb8ff] text-[#0b1b3a] text-[12px] font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-60" disabled={isLoading} onClick={handleGenerate}>
            {isLoading ? '診断中...' : '診断'}
          </button>
        </div>
        <p className="text-[11px] text-[#3b2b12]">{status}</p>
        {useGemini
          ? !NANO_KEY && <p className="text-[11px] text-[#8c2b2b]">環境変数 VITE_NANO_BANANA_API_KEY を設定してください。</p>
          : !OPENAI_KEY && <p className="text-[11px] text-[#8c2b2b]">環境変数 VITE_OPENAI_API_KEY を設定してください。</p>}
      </div>
    </section>
  )
}
