export type ImageSize = { width: number; height: number }

// 撮影した写真を全機能で共有するための props。App が保持し各モジュールへ渡す。
// 一度撮影すれば別タブに切り替えても引き継がれる（機能ごとの撮り直し不要）。
export type CaptureShare = {
  capturedUrl: string | null
  capturedBlob: Blob | null
  onCapture: (url: string | null, blob: Blob | null) => void
}

export const CAMERA_ASPECT_RATIO = 3 / 4

export const videoConstraints: MediaStreamConstraints['video'] = {
  width: { ideal: 720 },
  height: { ideal: 960 },
  aspectRatio: { ideal: CAMERA_ASPECT_RATIO },
  facingMode: 'user',
}

export async function captureStill(
  video: HTMLVideoElement,
): Promise<{ blob: Blob; url: string; width: number; height: number }> {
  const canvas = document.createElement('canvas')
  const width = video.videoWidth || 640
  const height = video.videoHeight || 360
  const displayWidth = video.clientWidth || 0
  const displayHeight = video.clientHeight || 0
  const targetRatio = displayWidth && displayHeight ? displayWidth / displayHeight : CAMERA_ASPECT_RATIO
  const sourceRatio = width / height
  let sx = 0
  let sy = 0
  let sWidth = width
  let sHeight = height
  if (sourceRatio > targetRatio) {
    sWidth = Math.round(height * targetRatio)
    sx = Math.round((width - sWidth) / 2)
  } else if (sourceRatio < targetRatio) {
    sHeight = Math.round(width / targetRatio)
    sy = Math.round((height - sHeight) / 2)
  }
  const outputWidth = Math.max(1, Math.round(displayWidth || sWidth))
  const outputHeight = Math.max(1, Math.round(displayHeight || sHeight))
  canvas.width = outputWidth
  canvas.height = outputHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')
  ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, outputWidth, outputHeight)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve({ blob, url: URL.createObjectURL(blob), width: outputWidth, height: outputHeight })
        } else {
          reject(new Error('画像の取得に失敗しました'))
        }
      },
      'image/jpeg',
      0.3,
    )
  })
}

export async function compressImage(blob: Blob, maxSize = 960, quality = 0.72): Promise<Blob> {
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

export async function normalizeImageToSize(
  blob: Blob,
  targetWidth?: number,
  targetHeight?: number,
  quality = 0.9,
): Promise<Blob> {
  if (!targetWidth || !targetHeight) return blob
  const imgUrl = URL.createObjectURL(blob)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('画像の読み込みに失敗しました'))
      image.src = imgUrl
    })
    if (img.width === targetWidth && img.height === targetHeight) return blob
    const canvas = document.createElement('canvas')
    canvas.width = targetWidth
    canvas.height = targetHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas not supported')
    const scale = Math.max(targetWidth / img.width, targetHeight / img.height)
    const drawWidth = Math.round(img.width * scale)
    const drawHeight = Math.round(img.height * scale)
    const dx = Math.round((targetWidth - drawWidth) / 2)
    const dy = Math.round((targetHeight - drawHeight) / 2)
    ctx.drawImage(img, dx, dy, drawWidth, drawHeight)
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b) resolve(b)
          else reject(new Error('画像の調整に失敗しました'))
        },
        'image/jpeg',
        quality,
      )
    })
  } finally {
    URL.revokeObjectURL(imgUrl)
  }
}

export function base64ToObjectUrl(base64: string): string {
  const binary = atob(base64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  const blob = new Blob([bytes], { type: 'image/png' })
  return URL.createObjectURL(blob)
}

export async function base64ToBlob(base64: string, mime = 'image/png'): Promise<Blob> {
  const res = await fetch(`data:${mime};base64,${base64}`)
  return res.blob()
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result
      if (typeof result === 'string') {
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

export function isLikelyBase64(text: string): boolean {
  const cleaned = text.replace(/\s+/g, '')
  if (cleaned.length <= 500) return false
  if (cleaned.length % 4 !== 0) return false
  if (!/^[A-Za-z0-9+/=]+$/.test(cleaned)) return false
  return cleaned.endsWith('=') || cleaned.endsWith('==') || /^[A-Za-z0-9+/]{20,}$/.test(cleaned)
}

export function isValidBase64Image(base64: string): boolean {
  try {
    const cleaned = base64.replace(/^data:image\/\w+;base64,/, '')
    atob(cleaned)
    return true
  } catch {
    return false
  }
}
