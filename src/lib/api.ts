import { blobToBase64, isLikelyBase64, base64ToObjectUrl } from './image'

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
