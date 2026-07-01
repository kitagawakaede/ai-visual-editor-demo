import { blobToBase64, isLikelyBase64, base64ToObjectUrl } from './image'
import { HAIRSTYLE_SCORE_PROMPT, type HairScore } from '../constants/prompts'

export const OPENAI_KEY = import.meta.env.VITE_OPENAI_API_KEY ?? ''
const OPENAI_IMAGE_EDIT_URL = 'https://api.openai.com/v1/images/edits'

export async function requestOpenAIImageEdit(
  prompt: string,
  imageBlob: Blob,
  refBlob?: Blob,
  model = 'gpt-image-1.5',
  size = '1024x1024',
  // 'low' で出力モデレーションを緩める（子ども生成など弾かれやすい用途向け）。
  // 'auto' は既定の標準フィルタ。
  moderation?: 'auto' | 'low',
  // 生成品質。'low'/'medium' は高速・低コスト、'high'/'auto' は高品質・低速。
  quality?: 'auto' | 'low' | 'medium' | 'high',
): Promise<{ url: string; base64?: string }> {
  if (!OPENAI_KEY) {
    throw new Error('VITE_OPENAI_API_KEY を設定してください')
  }
  const start = performance.now()

  const toPng = (blob: Blob): Promise<Blob> =>
    new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob)
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        canvas.getContext('2d')!.drawImage(img, 0, 0)
        canvas.toBlob((b) => { URL.revokeObjectURL(url); b ? resolve(b) : reject(new Error('PNG変換失敗')) }, 'image/png')
      }
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('画像読み込み失敗')) }
      img.src = url
    })

  const personPng = await toPng(imageBlob)
  const refPng = refBlob ? await toPng(refBlob) : null

  const formData = new FormData()
  formData.append('model', model)
  formData.append('image[]', personPng, 'person.png')
  if (refPng) {
    formData.append('image[]', refPng, 'reference.png')
  }
  formData.append('prompt', prompt)
  formData.append('n', '1')
  formData.append('size', size)
  if (moderation) {
    formData.append('moderation', moderation)
  }
  if (quality) {
    formData.append('quality', quality)
  }

  console.log('openai:image-edit:start', { model, promptLen: prompt.length, hasRef: Boolean(refBlob), moderation: moderation ?? 'auto', quality: quality ?? 'auto' })

  const response = await fetch(OPENAI_IMAGE_EDIT_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_KEY}` },
    body: formData,
  })

  if (!response.ok) {
    const message = await response.text()
    console.error('openai:image-edit:error', { status: response.status, ms: Math.round(performance.now() - start), message: message.slice(0, 300) })
    throw new Error(`OpenAI image edit error: ${message}`)
  }

  const data = await response.json()
  const b64 = data?.data?.[0]?.b64_json as string | undefined
  if (!b64) throw new Error('OpenAI レスポンスに画像データがありません')

  console.log('openai:image-edit:ok', { ms: Math.round(performance.now() - start) })
  const url = base64ToObjectUrl(b64)
  return { url, base64: b64 }
}

const NANO_URL =
  import.meta.env.VITE_NANO_BANANA_URL ??
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
export const NANO_KEY = import.meta.env.VITE_NANO_BANANA_API_KEY ?? ''

const WHISPER_URL = import.meta.env.VITE_WHISPER_URL ?? 'https://api.openai.com/v1/audio/transcriptions'
export const WHISPER_KEY = import.meta.env.VITE_WHISPER_API_KEY ?? ''

export type NanoResponse = { url: string; base64?: string }

export async function requestNanoBanana(prompt: string, imageBlob: Blob, refBlob?: Blob): Promise<NanoResponse> {
  if (!NANO_KEY) {
    throw new Error('VITE_NANO_BANANA_API_KEY を設定してください')
  }
  const start = performance.now()
  console.log('nano:start', {
    promptLen: prompt.length,
    imageBytes: imageBlob.size,
    hasRef: Boolean(refBlob),
    url: NANO_URL,
  })
  const base64Image = await blobToBase64(imageBlob)
  const refBase64 = refBlob ? await blobToBase64(refBlob) : null

  const parts: Array<{ inline_data?: { mime_type: string; data: string }; text?: string }> = []
  parts.push({ inline_data: { mime_type: 'image/jpeg', data: base64Image } })
  if (refBase64) {
    parts.push({ inline_data: { mime_type: 'image/png', data: refBase64 } })
  }
  parts.push({ text: prompt })

  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: { temperature: 0.0, maxOutputTokens: 40000 },
  }

  const urlWithKey = `${NANO_URL}?key=${encodeURIComponent(NANO_KEY)}`
  const response = await fetch(urlWithKey, {
    method: 'POST',
    mode: 'cors',
    credentials: 'omit',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const message = await response.text()
    console.error('nano:error', { status: response.status, ms: Math.round(performance.now() - start), message: message.slice(0, 300) })
    throw new Error(`nano-banana API error: ${message}`)
  }

  const contentType = response.headers.get('content-type') ?? ''
  console.log('nano:ok', { status: response.status, ms: Math.round(performance.now() - start) })

  if (contentType.includes('application/json')) {
    const rawText = await response.text()
    const data = JSON.parse(rawText)
    const responseParts: unknown[] =
      data?.candidates?.[0]?.content?.parts ??
      data?.contents?.[0]?.parts ??
      data?.candidates?.[0]?.parts ??
      []

    for (const part of responseParts) {
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
  const blob = new Blob([buffer])
  const url = URL.createObjectURL(blob)
  return { url }
}

// 写真から見た目の性別を判定する（参考画像の男女出し分け用）。
// 判定不能・失敗時は 'woman' を返す。
const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions'
export async function detectGenderFromImage(imageBlob: Blob): Promise<'man' | 'woman'> {
  if (!OPENAI_KEY) return 'woman'
  try {
    const base64 = await blobToBase64(imageBlob)
    const body = {
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Look carefully at the main person in this photo (face, hair, body, overall appearance) and decide their most likely apparent gender. You MUST choose one — always pick the more likely option and never refuse. Reply with exactly one lowercase word and nothing else: "man" or "woman".',
            },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}`, detail: 'low' } },
          ],
        },
      ],
      max_tokens: 3,
      temperature: 0,
    }
    const res = await fetch(OPENAI_CHAT_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      console.error('gender:error', { status: res.status })
      return 'woman'
    }
    const data = await res.json()
    const text = (data?.choices?.[0]?.message?.content ?? '').toLowerCase()
    if (text.includes('woman')) return 'woman'
    if (text.includes('man')) return 'man'
    return 'woman'
  } catch (err) {
    console.error('gender:error', err)
    return 'woman'
  }
}

// 生成画像を gpt-4o で採点し、2項目（各1〜5）を返す。呼び出し側で全枚を並列採点する。
// 失敗・パース不能時は中央値 {small:3, refined:3} を返す（例外は投げない）。
export async function scoreHairstyle(imageBlob: Blob, gender: 'man' | 'woman'): Promise<HairScore> {
  const fallback: HairScore = { small: 3, refined: 3 }
  if (!OPENAI_KEY) return fallback
  const clamp = (n: unknown): number => {
    const v = Math.round(Number(n))
    if (!Number.isFinite(v)) return 3
    return Math.min(5, Math.max(1, v))
  }
  try {
    const base64 = await blobToBase64(imageBlob)
    const body = {
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: HAIRSTYLE_SCORE_PROMPT(gender) },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}`, detail: 'low' } },
          ],
        },
      ],
      max_tokens: 30,
      temperature: 0,
    }
    const res = await fetch(OPENAI_CHAT_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      console.error('hairscore:error', { status: res.status })
      return fallback
    }
    const data = await res.json()
    const text = (data?.choices?.[0]?.message?.content ?? '') as string
    const match = text.match(/\{[^}]*\}/)
    if (!match) return fallback
    const parsed = JSON.parse(match[0]) as { small?: unknown; refined?: unknown }
    return { small: clamp(parsed.small), refined: clamp(parsed.refined) }
  } catch (err) {
    console.error('hairscore:error', err)
    return fallback
  }
}

export async function transcribeWithWhisper(audioBlob: Blob): Promise<string> {
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
