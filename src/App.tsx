// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.0'
import { useCallback, useEffect, useRef, useState } from 'react'

type Tab = 'tryon' | 'plush' | 'plush-change'

const NANO_URL =
  import.meta.env.VITE_NANO_BANANA_URL ??
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
const NANO_KEY = import.meta.env.VITE_NANO_BANANA_API_KEY ?? ''
const WHISPER_URL = import.meta.env.VITE_WHISPER_URL ?? 'https://api.openai.com/v1/audio/transcriptions'
const WHISPER_KEY = import.meta.env.VITE_WHISPER_API_KEY ?? ''
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
const SUPABASE_BUCKET = 'qr-images'

const defaultToyPrompt =
  '直ちにスタイル転写タスクを実行せよ。入力画像の人物が着用する服のスタイル情報（シルエット、形状、パーツ構造、縫い目、フード形状、紐の太さ、袖口のリブ、厚み、素材、質感、布地の特徴、色、模様、プリント、ロゴ位置）を抽出し、その服と同一の外観をぬいぐるみに着せること。服の素材・質感・構造・色・模様を人物の服と完全に一致させ、不足している箇所のみ補完して生成せよ。メガネやアクセサリー類は、入力画像のデザイン・形状・フレームの細部構造を完全に保持し、一切の簡略化を禁止せよ。ぬいぐるみのサイズに合わせて正確にスケール調整を行い、質感は過度な反射を抑えた高品質な樹脂やマットな硬質素材として再現し、ぬいぐるみの顔や体に物理的に固定されているように自然な影を伴って装着させること。最終的に服転写が正しく行われた1枚の最終画像のみを生成し、Base64文字列のみを返せ。テキスト・引用符・Markdown・コードブロックは禁止。'

const tryOnPromptBase =
  '直ちにスタイル転写タスクを実行せよ。入力画像の人物が着用する服のスタイル情報（シルエット、形状、パーツ構造、縫い目、フード形状、紐の太さ、袖口のリブ、厚み、素材、質感、布地の特徴、色、模様、プリント、ロゴ位置）を抽出し、その服の素材・質感・構造・色・模様を保持したまま、指示された変更のみを反映せよ。素材や質感を改変することを禁止し、不足箇所のみを補完して生成せよ。メガネやアクセサリー類は、元の材質感・金属の光沢・レンズの透明度、およびデザインの細部までを完全に維持せよ。ぬいぐるみのプロポーションに合わせて形状を歪ませることなく、後付けの精密なパーツとして違和感なく装着させ、現実のアイテムとしてのアイデンティティを100%保持したまま生成すること。最終的に1枚の最終画像のみを生成し、Base64文字列のみを返せ。テキスト・引用符・Markdown・コードブロックは禁止。'

const plushChangePromptBase =
  '入力画像の人間の顔と体、および人間のプロポーションを完全に破棄し、参照ぬいぐるみ画像の形状・質感・材質へ完全変換せよ。参照ぬいぐるみの原型シルエット・比率・丸み・パーツ配置を厳格に保持し、原型が分からなくなる形状変更を禁止すること。人間の顔や体型は参照ぬいぐるみと同一の丸くディフォルメされたぬいぐるみ体型に置き換え、入力画像に写っていた人間の身体構造・骨格・筋肉・輪郭は最終画像に一切残してはならない。服は入力画像の色・柄・素材感・テクスチャを保持したまま形状のみをぬいぐるみ体型にフィットさせ、デザイン改変や省略を禁止する。髪・肌・顔の質感はすべて人間的要素を排除し、フェルトや起毛布などのぬいぐるみ素材に置き換えること。人間の髪の色および髪型は重要な参照情報として扱い、色味・明度・系統を忠実に再現しつつ、人間構造を保持せず参照ぬいぐるみの造形ルールに従って簡略化・立体化し、前髪・分け目・長さ・ボリュームなどの特徴をぬいぐるみ적解釈で再構成し、毛ではなく布やフェルトの縫い付けパーツとして表現する。メガネやアクセサリー類は、入力画像のデザイン・形状・フレームの細部構造を完全に保持し、一切の簡略化を禁止せよ。ぬいぐるみのサイズに合わせて正確にスケール調整を行い、質感は過度な反射を抑えた高品質な樹脂やマットな硬質素材として再現し、ぬいぐるみの顔や体に物理的に固定されているように自然な影を伴って装着させること。入力画像に写っていた人間は最終画像に一切表示せず、写実的な人肌・人毛・人間らしい輪郭の残留を禁止する。最終的に参照ぬいぐるみと同一世界観・材質感・造形ルールを持つ完全なぬいぐるみキャラクター1体のみを生成し、出力は1枚の画像のBase64エンコード文字列のみとし、説明文・JSON・改行・余計な文字列は一切含めない。'

  const plushChangePromptWoolFelting =
  '入力画像の人間の顔と体、および人間のプロポーションを完全に破棄し、参照ぬいぐるみ画像の形状・質感・材質へ完全変換せよ。参照ぬいぐるみの原型シルエット・比率・丸み・パーツ配置を厳格に保持し、原型が分からなくなる形状変更を禁止すること。人間の顔や体型は参照ぬいぐるみと同一の丸くディフォルメされたぬいぐるみ体型に置き換え、入力画像に写っていた人間の身体構造・骨格・筋肉・輪郭は最終画像に一切残してはならない。服は入力画像の色・柄・素材感・テクスチャを保持したまま形状のみをぬいぐるみ体型にフィットさせ、デザイン改変や省略を禁止する。髪・肌・顔の質感はすべて人間的要素を排除し、羊毛フェルト特有の繊維感・起毛感・手作業感のある素材として再構成すること。人間の髪の色および髪型は重要な参照情報として扱い、色味・明度・系統を忠実に再現しつつ、羊毛フェルトを盛り上げて成形した立体的な髪パーツとして表現し、毛束の厚み・丸み・ボリューム感が分かる造形とする。メガネやアクセサリー類は、入力画像のデザイン・形状を完全に再現せよ。素材は羊毛フェルトの世界観に合わせつつも、形が崩れることを厳格に禁止し、細いワイヤーワークや樹脂コーティングされたパーツのような精密なハンドメイドパーツとして表現すること。フェルトによる簡略化を禁止し、細部まで実物と同一のディテールを保持して装着させよ。入力画像に写っていた人間は最終画像に一切表示せず、写実的な人肌・人毛・人間らしい輪郭の残留を禁止する。最終的に羊毛フェルト製ぬいぐるみとして一貫した世界観・質感・造形ルールを持つキャラクター1体のみを生成し、出力は1枚の画像のBase64エンコード文字列のみとし、説明文・JSON・改行・余計な文字列は一切含めない。'

const plushChangePromptPixelArt =
  '入力画像の人間の顔と体、および人間のプロポーションを完全に破棄し、参照ぬいぐるみ画像の形状・質感・材質をドット絵表現として完全変換せよ。参照ぬいぐるみの原型シルエット・比率・丸み・パーツ配置をドット単位で厳格に保持し、原型が分からなくなる形状変更を禁止すること。人間の顔や体型はドット絵として表現された丸くディフォルメされたぬいぐるみ体型に置き換え、入力画像に写っていた人間の身体構造・骨格・筋肉・輪郭は最終画像に一切残してはならない。服は入力画像の色・柄を保持しつつ、ドット絵として簡略化されたテクスチャで表現する。髪・肌・顔の質感はすべて人間的要素を排除し、低解像度ピクセルアート特有の階調・色数制限・ドット感で表現すること。人間の髪の色および髪型は重要な参照情報として扱い、色味と特徴を保持したままドット絵として再構成し、立体感ではなくピクセル配置によって髪型を表現する。メガネやアクセサリー類は、実物のデザイン・色・特徴的な形状をドット絵の制約の中で限界まで精密に再現せよ。単なる記号的な表現を禁止し、フレームの厚みやレンズの形、アクセサリーの固有のデザインが識別できるレベルでピクセルを配置し、キャラクターの顔や体に正確にフィットさせて描画すること。背景も人物と同一のドット絵スタイルで統一し、写実的表現や高解像度表現を禁止する。最終的に人物と背景が完全に統一されたドット絵世界観のぬいぐるみキャラクター1体のみを生成し、出力は1枚の画像のBase64エンコード文字列のみとし、説明文・JSON・改行・余計な文字列は一切含めない。'

const plushChangePromptFlatHair =
  '入力画像の人間の顔と体、および人間のプロポーションを完全に破棄し、参照ぬいぐるみ画像の形状・質感・材質へ完全変換せよ。参照ぬいぐるみの原型シルエット・比率・丸み・パーツ配置を厳格に保持し、原型が分からなくなる形状変更を禁止すること。人間の顔や体型は参照ぬいぐるみと同一の丸くディフォルメされたぬいぐるみ体型に置き換え、入力画像に写っていた人間の身体構造・骨格・筋肉・輪郭は最終画像に一切残してはならない。服は入力画像の色・柄・素材感・テクスチャを保持したまま形状のみをぬいぐるみ体型にフィットさせ、デザイン改変や省略を禁止する。髪・肌・顔の質感はすべて人間的要素を排除し、一般的な布製ぬいぐるみ素材として再構成すること。人間の髪の色および髪型は重要な参照情報として扱い、色味・系統は保持しつつ、立体的に盛り上げず平面的に縫い付けられた布パーツやプリント表現として髪型を再構成する。メガネやアクセサリー類は、入力画像のデザイン・形状を完全に保持し、簡略化された刺繍表現ではなく、独立した硬質パーツや高品質な別布パーツとして立体的に再現せよ。フレームの細さや装飾の細部までを維持し、ぬいぐるみの顔の曲線に合わせて正確にフィットさせ、後付けのオプションパーツのような高い完成度で装着させること。入力画像に写っていた人間は最終画像に一切表示せず、写実的な人肌・人毛・人間らしい輪郭の残留を禁止する。最終的に量産型の一般的なぬいぐるみとして自然な世界観・質感・造形ルールを持つキャラクター1体のみを生成し、出力は1枚の画像のBase64エンコード文字列のみとし、説明文・JSON・改行・余計な文字列は一切含めない。'

const omikujiImages = Object.values(
  import.meta.glob('./assets/omikuji/*.png', { eager: true, import: 'default' }) as Record<string, string>,
)

const videoConstraints: MediaStreamConstraints['video'] = {
  width: { ideal: 640 },
  height: { ideal: 360 },
  facingMode: 'user',
}

async function captureStill(video: HTMLVideoElement): Promise<{ blob: Blob; url: string }> {
  const canvas = document.createElement('canvas')
  const width = 640
  const height = 360
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')
  ctx.drawImage(video, 0, 0, width, height)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve({ blob, url: URL.createObjectURL(blob) })
        } else {
          reject(new Error('画像の取得に失敗しました'))
        }
      },
      'image/jpeg',
      0.3,
    )
  })
}

async function transcribeWithWhisper(audioBlob: Blob): Promise<string> {
  if (!WHISPER_KEY) {
    throw new Error('VITE_WHISPER_API_KEY を設定してください')
  }
  const formData = new FormData()
  formData.append('file', audioBlob, 'audio.webm')
  formData.append('model', 'whisper-1')
  formData.append('response_format', 'json')

  const response = await fetch(WHISPER_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${WHISPER_KEY}` },
    body: formData,
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(`Whisper transcription failed: ${message}`)
  }

  const data = await response.json()
  return data.text ?? ''
}

type NanoResponse = { url: string; base64?: string }

const MAX_QR_PAYLOAD = 1500

async function generateQrDataUrl(text: string): Promise<string> {
  if (text.length > MAX_QR_PAYLOAD) {
    throw new Error('QR用データが長すぎます（URLを短縮する必要があります）')
  }
  // @ts-ignore external import via CDN
  const mod = (await import(/* @vite-ignore */ 'https://esm.sh/qrcode@1.5.3')) as any
  const toDataURL = mod?.toDataURL ?? mod?.default?.toDataURL
  if (!toDataURL) throw new Error('QRモジュールの読み込みに失敗しました')
  return toDataURL(text, { margin: 1, width: 180 })
}

async function compressImage(blob: Blob, maxSize = 960, quality = 0.72): Promise<Blob> {
  const imgUrl = URL.createObjectURL(blob)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('画像の読み込みに失敗しました'))
      image.src = imgUrl
    })
    const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
    const width = Math.max(1, Math.round(img.width * scale))
    const height = Math.max(1, Math.round(img.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas not supported')
    ctx.drawImage(img, 0, 0, width, height)

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b) resolve(b)
          else reject(new Error('画像の圧縮に失敗しました'))
        },
        'image/jpeg',
        quality,
      )
    })
  } finally {
    URL.revokeObjectURL(imgUrl)
  }
}

const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null

async function uploadToSupabase(blob: Blob, prefix: string, opts?: { compress?: boolean }): Promise<string> {
  if (!supabase) throw new Error('Supabase未設定です')
  const processedBlob = opts?.compress ? await compressImage(blob) : blob
  const path = `${prefix}/${Date.now()}-${Math.random().toString(16).slice(2)}.jpg`
  const upload = async () =>
    supabase.storage.from(SUPABASE_BUCKET).upload(path, processedBlob, {
      upsert: true,
      contentType: processedBlob.type || 'image/jpeg',
    })
  let { error } = await upload()
  if (error && error.message?.toLowerCase().includes('bucket')) {
    await supabase.storage.createBucket(SUPABASE_BUCKET, { public: true })
    const retry = await upload()
    error = retry.error
  }
  if (error) {
    const detail =
      error instanceof Error ? error.message : typeof error === 'object' ? JSON.stringify(error) : String(error)
    throw new Error(detail)
  }
  const { data } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(path)
  if (!data?.publicUrl) throw new Error('public URL の取得に失敗しました')
  return data.publicUrl
}

function isValidBase64Image(base64: string): boolean {
  try {
    const cleaned = base64.replace(/^data:image\/\w+;base64,/, '')
    atob(cleaned)
    return true
  } catch {
    return false
  }
}

function logError(label: string, error: unknown) {
  const payload = {
    label,
    error:
      error instanceof Error
        ? error.message
        : typeof error === 'object'
          ? JSON.stringify(error)
          : String(error),
    ts: new Date().toISOString(),
  }
  console.error('app-error', payload)
  try {
    const current = localStorage.getItem('app-error-log')
    const arr = current ? (JSON.parse(current) as unknown[]) : []
    arr.push(payload)
    localStorage.setItem('app-error-log', JSON.stringify(arr).slice(-5000))
  } catch {
    // ignore storage errors
  }
}

async function requestNanoBanana(prompt: string, imageBlob: Blob, refBlob?: Blob): Promise<NanoResponse> {
  if (!NANO_KEY) {
    throw new Error('VITE_NANO_BANANA_API_KEY を設定してください')
  }
  const base64Image = await blobToBase64(imageBlob)
  const refBase64 = refBlob ? await blobToBase64(refBlob) : null

  const parts: Array<{ inline_data?: { mime_type: string; data: string }; text?: string }> = []
  parts.push({
    inline_data: {
      mime_type: 'image/jpeg',
      data: base64Image,
    },
  })
  if (refBase64) {
    parts.push({
      inline_data: {
        mime_type: 'image/png',
        data: refBase64,
      },
    })
  }
  parts.push({ text: prompt })

  const body = {
    contents: [
      {
        role: 'user',
        parts,
      },
    ],
    generationConfig: {
      temperature: 0.0,
      maxOutputTokens: 40000,
    },
  }

  const urlWithKey = `${NANO_URL}?key=${encodeURIComponent(NANO_KEY)}`

  const response = await fetch(urlWithKey, {
    method: 'POST',
    mode: 'cors',
    credentials: 'omit',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(`nano-banana API error: ${message}`)
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    const rawText = await response.text()
    console.log('nano-banana raw JSON response:', rawText)
    const data = JSON.parse(rawText)
    // Gemini系レスポンスから画像データを探す
    const parts: unknown[] =
      data?.candidates?.[0]?.content?.parts ??
      data?.contents?.[0]?.parts ??
      data?.candidates?.[0]?.parts ??
      []

    for (const part of parts) {
      if (typeof part === 'object' && part !== null) {
        const inline =
          (part as { inlineData?: { data?: string } }).inlineData ??
          (part as { inline_data?: { data?: string } }).inline_data
        if (inline?.data && isLikelyBase64(inline.data)) {
          const url = base64ToObjectUrl(inline.data)
          return { url, base64: inline.data }
        }
        const text = (part as { text?: string }).text
        if (text && isLikelyBase64(text)) {
          const url = base64ToObjectUrl(text)
          return { url, base64: text }
        }
      }
    }
    throw new Error('レスポンスに画像データがありません')
  }

  const buffer = await response.arrayBuffer()
  console.log('nano-banana binary response bytes:', buffer.byteLength)
  const blob = new Blob([buffer])
  const url = URL.createObjectURL(blob)
  return { url }
}

function base64ToObjectUrl(base64: string) {
  const binary = atob(base64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  const blob = new Blob([bytes], { type: 'image/png' })
  return URL.createObjectURL(blob)
}

async function base64ToBlob(base64: string, mime = 'image/png'): Promise<Blob> {
  const res = await fetch(`data:${mime};base64,${base64}`)
  return res.blob()
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result
      if (typeof result === 'string') {
        // result is data URL; strip prefix
        const base64 = result.split(',')[1] ?? ''
        resolve(base64)
      } else {
        reject(new Error('Base64変換に失敗しました'))
      }
    }
    reader.onerror = () => reject(reader.error ?? new Error('Base64変換に失敗しました'))
    reader.readAsDataURL(blob)
  })
}

function isLikelyBase64(text: string) {
  const cleaned = text.replace(/\s+/g, '')
  // Base64 文字のみ、長さが4の倍数、かつ十分な長さがある場合に画像とみなす
  if (cleaned.length <= 500) return false
  if (cleaned.length % 4 !== 0) return false
  if (!/^[A-Za-z0-9+/=]+$/.test(cleaned)) return false
  // 末尾にパディングを含む一般的なBase64の形を確認
  return cleaned.endsWith('=') || cleaned.endsWith('==') || /^[A-Za-z0-9+/]{20,}$/.test(cleaned)
}

function useOmikujiOverlay() {
  const [omikujiUrl, setOmikujiUrl] = useState<string | null>(null)
  const [omikujiVisible, setOmikujiVisible] = useState(false)
  const timerRef = useRef<number | null>(null)
  const fadeTimerRef = useRef<number | null>(null)

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (fadeTimerRef.current) {
      window.clearTimeout(fadeTimerRef.current)
      fadeTimerRef.current = null
    }
  }, [])

  const triggerOmikuji = useCallback(() => {
    if (!omikujiImages.length) return
    clearTimers()
    setOmikujiVisible(false)
    setOmikujiUrl(null)
    timerRef.current = window.setTimeout(() => {
      const pick = omikujiImages[Math.floor(Math.random() * omikujiImages.length)]
      setOmikujiVisible(false)
      setOmikujiUrl(pick)
      fadeTimerRef.current = window.setTimeout(() => setOmikujiVisible(true), 20)
    }, 3000)
  }, [clearTimers])

  const resetOmikuji = useCallback(() => {
    clearTimers()
    setOmikujiVisible(false)
    setOmikujiUrl(null)
  }, [clearTimers])

  useEffect(() => {
    return () => {
      clearTimers()
    }
  }, [clearTimers])

  return { omikujiUrl, omikujiVisible, triggerOmikuji, resetOmikuji }
}

function OmikujiOverlay({ url, visible, onClose }: { url: string | null; visible: boolean; onClose?: () => void }) {
  if (!url) return null
  return (
    <div className={`absolute inset-0 flex items-center justify-center z-20 transition-opacity duration-700 ${visible ? 'opacity-100' : 'opacity-0'}`}>
      {onClose && (
        <button
          className="absolute top-3 right-3 w-9 h-9 rounded-full border border-white/30 bg-[rgba(0,0,0,0.55)] text-white text-lg font-bold shadow-md"
          onClick={onClose}
          aria-label="おみくじを閉じる"
        >
          ×
        </button>
      )}
      <img
        className="max-w-[75%] max-h-[75%] object-contain rounded-[16px] border border-white/25 shadow-[0_10px_35px_rgba(0,0,0,0.35)]"
        src={url}
        alt="おみくじ"
      />
    </div>
  )
}

function TryOnModule() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [streamError, setStreamError] = useState<string | null>(null)
  const [instruction, setInstruction] = useState('')
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null)
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null)
  const [editedUrl, setEditedUrl] = useState<string | null>(null)
  const [editedQr, setEditedQr] = useState<string | null>(null)
  const [isCorrupted, setIsCorrupted] = useState(false)
  const [serverError, setServerError] = useState(false)
  const [status, setStatus] = useState<string>('マイクで指示を録音 → 撮影 → お着替え')
  const [isRecording, setIsRecording] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const audioStreamRef = useRef<MediaStream | null>(null)
  const audioChunks = useRef<Blob[]>([])
  const { omikujiUrl, omikujiVisible, triggerOmikuji, resetOmikuji } = useOmikujiOverlay()

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
    const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
    recorderRef.current = recorder
    recorder.ondataavailable = (evt) => {
      if (evt.data.size > 0) audioChunks.current.push(evt.data)
    }
    recorder.onstop = async () => {
      setIsRecording(false)
      const blob = new Blob(audioChunks.current, { type: 'audio/webm' })
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
    setStatus('nano-banana に送信中...')
    try {
      const combinedPrompt = [tryOnPromptBase, instruction.trim()].filter(Boolean).join(' ')
      const result = await requestNanoBanana(combinedPrompt, capturedBlob)
      if (result.base64 && isValidBase64Image(result.base64)) {
        setEditedUrl(result.url)
        const blob = await base64ToBlob(result.base64, 'image/jpeg')
        uploadToSupabase(blob, 'tryon', { compress: true })
          .then((url) => generateQrDataUrl(url))
          .then(setEditedQr)
          .catch((err) => logError('tryon-qr', err))
        setStatus('AIお着替え完了')
      } else if (result.base64 && !isValidBase64Image(result.base64)) {
        setIsCorrupted(true)
        setStatus('生成できませんでした。もう一度お試しください。')
        logError('tryon-invalid-base64', result.base64)
      } else {
        setEditedUrl(result.url)
        fetch(result.url)
          .then((res) => res.blob())
          .then((b) => uploadToSupabase(b, 'tryon', { compress: true }))
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
    }
  }

  return (
    <section className="rounded-[18px] p-[18px] bg-[rgba(10,13,28,0.92)] border border-white/10 shadow-[0_10px_35px_rgba(0,0,0,0.3)] space-y-4">
      <header className="flex justify-between items-center gap-3 mb-3">
        <div className="space-y-1">
          <p className="text-[12px] uppercase tracking-[0.08em] text-[#9ccfff] m-0">AI試着</p>
          <p className="text-sm text-[#9fa8c1] m-0">マイク→撮影→お着替えの3ステップで試着を体験できます。</p>
        </div>
        <span
          className={`px-3 py-2 rounded-full text-[12px] border ${
            streamError
              ? 'bg-[rgba(255,132,132,0.15)] text-[#ffc3c3] border-[rgba(255,132,132,0.35)]'
              : 'bg-[rgba(82,246,169,0.18)] text-[#b1f2d5] border-[rgba(82,246,169,0.45)]'
          }`}
        >
          {streamError ? 'カメラ許可が必要です' : 'カメラ準備OK'}
        </span>
      </header>

      <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
        <div className="relative overflow-hidden rounded-[16px] bg-[#0b1024] min-h-[320px] aspect-[16/9]">
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover rounded-[16px] bg-[#0d132d] z-0"
            style={{ transform: 'scaleX(-1)' }}
            muted
            playsInline
          />
          <OmikujiOverlay url={omikujiUrl} visible={omikujiVisible} onClose={resetOmikuji} />
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[rgba(5,7,18,0.65)] text-[#dfe6ff] font-bold text-lg z-10 backdrop-blur-[2px] rounded-[16px]">
              生成中...
            </div>
          )}
          {capturedUrl && !isLoading && !editedUrl && !isCorrupted && (
            <img
              className="absolute bottom-3 right-3 max-w-[180px] rounded-[12px] border border-white/20 shadow-lg"
              src={capturedUrl}
              alt="capture"
            />
          )}
          {isCorrupted && !isLoading && (
            <div
              className="absolute inset-0 w-full h-full grid place-items-center gap-3 p-4 text-center bg-[rgba(0,0,0,0.45)]"
              style={{ transform: 'scaleX(-1)' }}
            >
              <p className="text-[12px] text-[#9ccfff] m-0">サーバーエラーが発生しました (500/503)。再生成してください。</p>
              <button
                className="border border-white/10 bg-gradient-to-r from-[#7dd8ff] to-[#70a4ff] text-[#0a0f26] px-3 py-2 rounded-[12px] font-semibold shadow-[0_8px_18px_rgba(112,164,255,0.35)]"
                onClick={handleTryOn}
                style={{ transform: 'scaleX(1)' }}
              >
                再生成する
              </button>
            </div>
          )}
          {serverError && !isLoading && (
            <div
              className="absolute inset-0 w-full h-full grid place-items-center gap-3 p-4 text-center bg-[rgba(0,0,0,0.45)]"
              style={{ transform: 'scaleX(-1)' }}
            >
              <p className="text-[12px] text-[#9ccfff] m-0">サーバーエラーが発生しました (500/503)。再生成してください。</p>
              <button
                className="border border-white/10 bg-gradient-to-r from-[#7dd8ff] to-[#70a4ff] text-[#0a0f26] px-3 py-2 rounded-[12px] font-semibold shadow-[0_8px_18px_rgba(112,164,255,0.35)]"
                onClick={handleTryOn}
                style={{ transform: 'scaleX(1)' }}
              >
                再生成する
              </button>
            </div>
          )}
          {editedUrl && !isLoading && !isCorrupted && (
            <div className="absolute inset-0 w-full h-full left-0 right-0 flex items-center justify-center bg-[rgba(5,7,18,0.4)] rounded-[16px]">
              <button
                className="absolute top-2 right-2 w-8 h-8 rounded-full border border-white/30 bg-[rgba(0,0,0,0.4)] text-white text-lg"
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

        <div className="bg-white/5 border border-white/10 rounded-[16px] p-4 flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <button
              className={`border border-white/10 bg-white/5 text-white px-3 py-2 rounded-[12px] font-semibold transition ${
                isRecording ? 'bg-[rgba(255,166,48,0.2)] border-[rgba(255,166,48,0.5)]' : ''
              }`}
              onClick={toggleRecording}
            >
              {isRecording ? '録音停止' : 'マイク開始'}
            </button>
            <button
              className="border border-white/10 bg-white/5 text-white px-3 py-2 rounded-[12px] font-semibold transition"
              onClick={handleCapture}
            >
              {capturedBlob ? '再撮影' : 'シャッター'}
            </button>
            <button
              className="border border-white/10 bg-gradient-to-r from-[#7dd8ff] to-[#70a4ff] text-[#0a0f26] px-3 py-2 rounded-[12px] font-semibold shadow-[0_8px_18px_rgba(112,164,255,0.35)] disabled:opacity-60"
              onClick={handleTryOn}
              disabled={isLoading}
            >
              {isLoading ? '生成中...' : 'お着替え'}
            </button>
          </div>

          <label className="flex flex-col gap-1 font-semibold text-[#dfe6ff]">
            <span>音声で認識した指示</span>
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="今着ているトップスを赤色にして"
              rows={3}
              className="w-full min-h-[96px] px-3 py-2 rounded-[12px] border border-white/10 bg-white/5 text-white text-[15px]"
            />
          </label>

          <p className="text-[#cbd3ec] m-0 text-sm">{status}</p>
          {!NANO_KEY && <p className="text-[#ffc9c9] m-0 text-[13px]">環境変数 VITE_NANO_BANANA_API_KEY を設定してください。</p>}
          {!WHISPER_KEY && (
            <p className="text-[#ffc9c9] m-0 text-[13px]">
              Whisper APIキー (VITE_WHISPER_API_KEY) が無い場合は手入力で試してください。
            </p>
          )}
        </div>
      </div>
    </section>
  )
}

function PlushModule() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [streamError, setStreamError] = useState<string | null>(null)
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null)
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null)
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)
  const [generatedBase64, setGeneratedBase64] = useState<string | null>(null)
  const [generatedQr, setGeneratedQr] = useState<string | null>(null)
  const [plushCorrupted, setPlushCorrupted] = useState(false)
  const [plushServerError, setPlushServerError] = useState(false)
  const [status, setStatus] = useState('ぬいぐるみと一緒に撮影してください')
  const [isLoading, setIsLoading] = useState(false)
  const { omikujiUrl, omikujiVisible, triggerOmikuji, resetOmikuji } = useOmikujiOverlay()

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
    setStatus('nano-banana で生成中...')
    try {
      const result = await requestNanoBanana(defaultToyPrompt, capturedBlob)
      if (result.base64 && isValidBase64Image(result.base64)) {
        setGeneratedBase64(result.base64)
        setGeneratedUrl(result.url)
        const blob = await base64ToBlob(result.base64, 'image/jpeg')
        uploadToSupabase(blob, 'plush', { compress: true })
          .then((url) => generateQrDataUrl(url))
          .then(setGeneratedQr)
          .catch((err) => logError('plush-qr', err))
        setStatus('ぬいぐるみお着替え完了')
      } else if (result.base64 && !isValidBase64Image(result.base64)) {
        setPlushCorrupted(true)
        setStatus('生成できませんでした。もう一度生成してください。')
        logError('plush-invalid-base64', result.base64)
      } else {
        setGeneratedUrl(result.url)
        fetch(result.url)
          .then((res) => res.blob())
          .then((b) => uploadToSupabase(b, 'plush', { compress: true }))
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
        setGeneratedUrl(result.url)
        setGeneratedBase64(result.base64)
        const b = await base64ToBlob(result.base64, 'image/jpeg')
        uploadToSupabase(b, 'plush', { compress: true })
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
        setGeneratedUrl(result.url)
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
    <section className="rounded-[18px] p-[18px] bg-[rgba(10,13,28,0.92)] border border-white/10 shadow-[0_10px_35px_rgba(0,0,0,0.3)] space-y-4">
      <header className="flex justify-between items-center gap-3 mb-3">
        <div className="space-y-1">
          <p className="text-[12px] uppercase tracking-[0.08em] text-[#9ccfff] m-0">ぬいぐるみ制作</p>
          <h2 className="text-xl font-bold text-white m-0">一緒に写った服をぬいぐるみに転写</h2>
          <p className="text-sm text-[#9fa8c1] m-0">シャッターボタン → nano-banana で服をコピーします。</p>
        </div>
        <span
          className={`px-3 py-2 rounded-full text-[12px] border ${
            streamError
              ? 'bg-[rgba(255,132,132,0.15)] text-[#ffc3c3] border-[rgba(255,132,132,0.35)]'
              : 'bg-[rgba(82,246,169,0.18)] text-[#b1f2d5] border-[rgba(82,246,169,0.45)]'
          }`}
        >
          {streamError ? 'カメラ許可が必要です' : 'カメラ準備OK'}
        </span>
      </header>

      <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
        <div className="relative overflow-hidden rounded-[16px] bg-[#0b1024] min-h-[320px] aspect-[16/9]">
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover rounded-[16px] bg-[#0d132d]"
            style={{ transform: 'scaleX(-1)' }}
            muted
            playsInline
          />
          <OmikujiOverlay url={omikujiUrl} visible={omikujiVisible} onClose={resetOmikuji} />
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[rgba(5,7,18,0.65)] text-[#dfe6ff] font-bold text-lg z-10 backdrop-blur-[2px] rounded-[16px]">
              生成中...
            </div>
          )}
          {capturedUrl && !isLoading && !generatedUrl && (
            <img
              className="absolute bottom-3 right-3 max-w-[180px] rounded-[12px] border border-white/20 shadow-lg"
              src={capturedUrl}
              alt="capture"
            />
          )}
          {plushCorrupted && !isLoading && (
            <div className="absolute inset-0 w-full h-full grid place-items-center gap-3 p-4 text-center bg-[rgba(0,0,0,0.45)]">
              <p className="text-[12px] text-[#9ccfff] m-0">サーバーエラーが発生しました (500/503)。再生成してください。</p>
              <div className="flex justify-center">
                <button
                  className="border border-white/10 bg-gradient-to-r from-[#7dd8ff] to-[#70a4ff] text-[#0a0f26] px-3 py-2 rounded-[12px] font-semibold shadow-[0_8px_18px_rgba(112,164,255,0.35)]"
                  onClick={handleGenerate}
                  disabled={isLoading}
                >
                  再生成する
                </button>
              </div>
            </div>
          )}
          {plushServerError && !isLoading && (
            <div className="absolute inset-0 w-full h-full grid place-items-center gap-3 p-4 text-center bg-[rgba(0,0,0,0.45)]">
              <p className="text-[12px] text-[#9ccfff] m-0">サーバーエラーが発生しました (500/503)。再生成してください。</p>
              <div className="flex justify-center">
                <button
                  className="border border-white/10 bg-gradient-to-r from-[#7dd8ff] to-[#70a4ff] text-[#0a0f26] px-3 py-2 rounded-[12px] font-semibold shadow-[0_8px_18px_rgba(112,164,255,0.35)]"
                  onClick={handleGenerate}
                  disabled={isLoading}
                >
                  再生成する
                </button>
              </div>
            </div>
          )}
          {generatedUrl && !isLoading && !plushCorrupted && (
            <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-[rgba(5,7,18,0.4)] rounded-[16px]">
              <button
                className="absolute top-2 right-2 w-8 h-8 rounded-full border border-white/30 bg-[rgba(0,0,0,0.4)] text-white text-lg"
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

        <div className="bg-white/5 border border-white/10 rounded-[16px] p-4 flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <button className="border border-white/10 bg-white/5 text-white px-3 py-2 rounded-[12px] font-semibold transition" onClick={handleCapture}>
              {capturedBlob ? '再撮影' : 'シャッター'}
            </button>
            <button
              className="border border-white/10 bg-gradient-to-r from-[#7dd8ff] to-[#70a4ff] text-[#0a0f26] px-3 py-2 rounded-[12px] font-semibold shadow-[0_8px_18px_rgba(112,164,255,0.35)] disabled:opacity-60"
              disabled={isLoading}
              onClick={handleGenerate}
            >
              {isLoading ? '生成中...' : '生成する'}
            </button>
            <button
              className="border border-white/10 bg-white/5 text-white px-3 py-2 rounded-[12px] font-semibold transition disabled:opacity-60"
              disabled={isLoading || !generatedUrl}
              onClick={handleRegenerate}
              title="不足部分を修正してもう一度"
            >
              不足部分を修正してもう一度 ✨
            </button>
          </div>
          <p className="text-[#cbd3ec] m-0 text-sm">{status}</p>
          {!NANO_KEY && <p className="text-[#ffc9c9] m-0 text-[13px]">環境変数 VITE_NANO_BANANA_API_KEY を設定してください。</p>}
        </div>
      </div>
    </section>
  )
}

type PlushOption = { id: string; label: string; description: string; image: string; prompt: string }

const plushOptions: PlushOption[] = [
  {
    id: 'plushA',
    label: 'ぬいぐるみA',
    description: '丸みのある可愛いシルエットのぬいぐるみタイプ',
    image: new URL('./assets/スクリーンショット 2025-12-13 16.03.58.png', import.meta.url).href,
    prompt: plushChangePromptWoolFelting,
  },
  {
    id: 'plushB',
    label: 'ぬいぐるみB',
    description: '細部がはっきりしたフォルムのぬいぐるみタイプ',
    image: new URL('./assets/スクリーンショット 2025-12-13 12.36.50.png', import.meta.url).href,
    prompt: plushChangePromptPixelArt,
  },
  {
    id: 'plushC',
    label: 'ぬいぐるみC',
    description: 'ふんわり質感のディフォルメぬいぐるみタイプ',
    image: new URL('./assets/スクリーンショット 2025-12-13 12.05.19.png', import.meta.url).href,
    prompt: plushChangePromptFlatHair,
  },
]

function PlushChangeModule() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [streamError, setStreamError] = useState<string | null>(null)
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null)
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [resultQr, setResultQr] = useState<string | null>(null)
  const [selected, setSelected] = useState<PlushOption>(plushOptions[0])
  const [isCorrupted, setIsCorrupted] = useState(false)
  const [serverError, setServerError] = useState(false)
  const [status, setStatus] = useState('写真を撮影して、変身先のぬいぐるみを選んでください')
  const [isLoading, setIsLoading] = useState(false)
  const refCache = useRef<Record<string, Blob>>({})
  const { omikujiUrl, omikujiVisible, triggerOmikuji, resetOmikuji } = useOmikujiOverlay()

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
    setStatus('nano-banana で変身中...')
    try {
      const refBlob = await getRefBlob(selected)
      const result = await requestNanoBanana(buildPrompt(selected), capturedBlob, refBlob)
      if (result.base64 && isValidBase64Image(result.base64)) {
        setResultUrl(result.url)
        const blob = await base64ToBlob(result.base64, 'image/jpeg')
        uploadToSupabase(blob, 'plush-change', { compress: true })
          .then((url) => generateQrDataUrl(url))
          .then(setResultQr)
          .catch((err) => logError('plush-change-qr', err))
        setStatus('ぬいぐるみ変身完了')
      } else if (result.base64 && !isValidBase64Image(result.base64)) {
        setIsCorrupted(true)
        setStatus('生成できませんでした。もう一度生成してください。')
        logError('plush-change-invalid-base64', result.base64)
      } else {
        setResultUrl(result.url)
        fetch(result.url)
          .then((res) => res.blob())
          .then((b) => uploadToSupabase(b, 'plush-change', { compress: true }))
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
    <section className="rounded-[18px] p-[18px] bg-[rgba(10,13,28,0.92)] border border-white/10 shadow-[0_10px_35px_rgba(0,0,0,0.3)] space-y-4">
      <header className="flex justify-between items-center gap-3 mb-3">
        <div className="space-y-1">
          <p className="text-[12px] uppercase tracking-[0.08em] text-[#9ccfff] m-0">ぬいぐるみチェンジ</p>
          <p className="text-sm text-[#9fa8c1] m-0">撮影した写真を、選んだぬいぐるみタイプに「変身」します。</p>
        </div>
        <span
          className={`px-3 py-2 rounded-full text-[12px] border ${
            streamError
              ? 'bg-[rgba(255,132,132,0.15)] text-[#ffc3c3] border-[rgba(255,132,132,0.35)]'
              : 'bg-[rgba(82,246,169,0.18)] text-[#b1f2d5] border-[rgba(82,246,169,0.45)]'
          }`}
        >
          {streamError ? 'カメラ許可が必要です' : 'カメラ準備OK'}
        </span>
      </header>

      <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
        <div className="relative overflow-hidden rounded-[16px] bg-[#0b1024] min-h-[320px] aspect-[16/9]">
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover rounded-[16px] bg-[#0d132d]"
            style={{ transform: 'scaleX(-1)' }}
            muted
            playsInline
          />
          <OmikujiOverlay url={omikujiUrl} visible={omikujiVisible} onClose={resetOmikuji} />
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[rgba(5,7,18,0.65)] text-[#dfe6ff] font-bold text-lg z-10 backdrop-blur-[2px] rounded-[16px]">
              生成中...
            </div>
          )}
          {capturedUrl && !isLoading && !resultUrl && !isCorrupted && !serverError && (
            <img
              className="absolute bottom-3 right-3 max-w-[180px] rounded-[12px] border border-white/20 shadow-lg"
              src={capturedUrl}
              alt="capture"
            />
          )}

          {isCorrupted && !isLoading && (
            <div className="absolute inset-0 w-full h-full grid place-items-center gap-3 p-4 text-center bg-[rgba(0,0,0,0.45)]">
              <p className="text-[12px] text-[#9ccfff] m-0">サーバーエラーが発生しました (500/503)。再生成してください。</p>
              <button
                className="border border-white/10 bg-gradient-to-r from-[#7dd8ff] to-[#70a4ff] text-[#0a0f26] px-3 py-2 rounded-[12px] font-semibold shadow-[0_8px_18px_rgba(112,164,255,0.35)]"
                onClick={handleRetry}
              >
                再生成する
              </button>
            </div>
          )}

          {serverError && !isLoading && (
            <div className="absolute inset-0 w-full h-full grid place-items-center gap-3 p-4 text-center bg-[rgba(0,0,0,0.45)]">
              <p className="text-[12px] text-[#9ccfff] m-0">サーバーエラーが発生しました (500/503)。再生成してください。</p>
              <button
                className="border border-white/10 bg-gradient-to-r from-[#7dd8ff] to-[#70a4ff] text-[#0a0f26] px-3 py-2 rounded-[12px] font-semibold shadow-[0_8px_18px_rgba(112,164,255,0.35)]"
                onClick={handleRetry}
              >
                再生成する
              </button>
            </div>
          )}

          {resultUrl && !isLoading && !isCorrupted && (
            <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-[rgba(5,7,18,0.4)] rounded-[16px]">
              <button
                className="absolute top-2 right-2 w-8 h-8 rounded-full border border-white/30 bg-[rgba(0,0,0,0.4)] text-white text-lg"
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

        <div className="bg-white/5 border border-white/10 rounded-[16px] p-4 flex flex-col gap-3">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2">
            {plushOptions.map((opt) => (
              <button
                key={opt.id}
                className={`border border-white/10 bg-white/5 rounded-[12px] p-2 flex flex-col gap-2 items-center transition ${
                  selected.id === opt.id ? 'border-[rgba(139,220,255,0.8)] bg-[rgba(139,220,255,0.12)] -translate-y-[2px]' : ''
                }`}
                onClick={() => setSelected(opt)}
              >
                <img className="w-full aspect-square rounded-[10px] object-cover" src={opt.image} alt={opt.label} />
                <div className="text-[#e8edff] font-bold text-[14px]">{opt.label}</div>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button className="border border-white/10 bg-white/5 text-white px-3 py-2 rounded-[12px] font-semibold transition" onClick={handleCapture}>
              {capturedBlob ? '再撮影' : 'シャッター'}
            </button>
            <button
              className="border border-white/10 bg-gradient-to-r from-[#7dd8ff] to-[#70a4ff] text-[#0a0f26] px-3 py-2 rounded-[12px] font-semibold shadow-[0_8px_18px_rgba(112,164,255,0.35)] disabled:opacity-60"
              disabled={isLoading}
              onClick={handleTransform}
            >
              {isLoading ? '生成中...' : '変身する'}
            </button>
          </div>
          <p className="text-[#cbd3ec] m-0 text-sm">{status}</p>
          {!NANO_KEY && <p className="text-[#ffc9c9] m-0 text-[13px]">環境変数 VITE_NANO_BANANA_API_KEY を設定してください。</p>}
        </div>
      </div>
    </section>
  )
}

function App() {
  const [tab, setTab] = useState<Tab>('tryon')

  return (
    <div className="max-w-[1200px] mx-auto flex flex-col gap-6 px-[22px] pt-[28px] pb-[56px]">
      <header
        className="flex items-end justify-between gap-3 px-[22px] py-[18px] rounded-[18px] border border-white/10 shadow-[0_20px_45px_rgba(0,0,0,0.35)]"
        style={{
          background:
            'linear-gradient(135deg, rgba(98, 121, 255, 0.18), rgba(87, 214, 255, 0.12)), rgba(11, 17, 40, 0.9)',
        }}
      >
        <div className="space-y-1">
          <p className="text-[12px] uppercase tracking-[0.08em] text-[#9ccfff] m-0">AI ビジュアルエディター (デモ)</p>
          <h1 className="text-[24px] font-bold m-0 text-white">3つのAI機能をまとめた Webデモ</h1>
        </div>
        <div className="flex gap-2">
          <button
            className={`px-[14px] py-[10px] rounded-[10px] border text-[14px] font-semibold transition ${
              tab === 'tryon'
                ? 'border-[#8bdcff] bg-[rgba(139,220,255,0.16)] -translate-y-px'
                : 'border-white/10 bg-white/5'
            }`}
            onClick={() => setTab('tryon')}
          >
            AI試着
          </button>
          <button
            className={`px-[14px] py-[10px] rounded-[10px] border text-[14px] font-semibold transition ${
              tab === 'plush'
                ? 'border-[#8bdcff] bg-[rgba(139,220,255,0.16)] -translate-y-px'
                : 'border-white/10 bg-white/5'
            }`}
            onClick={() => setTab('plush')}
          >
            ぬいぐるみ制作
          </button>
          <button
            className={`px-[14px] py-[10px] rounded-[10px] border text-[14px] font-semibold transition ${
              tab === 'plush-change'
                ? 'border-[#8bdcff] bg-[rgba(139,220,255,0.16)] -translate-y-px'
                : 'border-white/10 bg-white/5'
            }`}
            onClick={() => setTab('plush-change')}
          >
            ぬいぐるみチェンジ
          </button>
        </div>
      </header>

      {tab === 'tryon' && <TryOnModule />}
      {tab === 'plush' && <PlushModule />}
      {tab === 'plush-change' && <PlushChangeModule />}

    </div>
  )
}

export default App
