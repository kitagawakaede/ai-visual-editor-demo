// @ts-expect-error external import via CDN
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.0'
import { compressImage } from './image'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? ''
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
const SUPABASE_BUCKET = 'qr-images'
const MAX_QR_PAYLOAD = 1500

export const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null

export async function uploadToSupabase(blob: Blob, prefix: string, opts?: { compress?: boolean }): Promise<string> {
  if (!supabase) throw new Error('Supabase未設定です')
  const start = performance.now()
  const compress = Boolean(opts?.compress)
  const processedBlob = compress ? await compressImage(blob) : blob
  console.log('supabase:upload:start', { prefix, bytes: processedBlob.size, compress })
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
    console.error('supabase:upload:error', { prefix, error: detail })
    throw new Error(detail)
  }
  console.log('supabase:upload:ok', { prefix, path, ms: Math.round(performance.now() - start) })
  const { data } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(path)
  if (!data?.publicUrl) throw new Error('public URL の取得に失敗しました')
  return data.publicUrl
}

export async function generateQrDataUrl(text: string): Promise<string> {
  const start = performance.now()
  console.log('qr:start', { len: text.length })
  if (text.length > MAX_QR_PAYLOAD) {
    throw new Error('QR用データが長すぎます（URLを短縮する必要があります）')
  }
  try {
    // @ts-expect-error external import via CDN
    const mod = (await import(/* @vite-ignore */ 'https://esm.sh/qrcode@1.5.3')) as { toDataURL?: (text: string, opts: unknown) => Promise<string>; default?: { toDataURL?: (text: string, opts: unknown) => Promise<string> } }
    const toDataURL = mod?.toDataURL ?? mod?.default?.toDataURL
    if (!toDataURL) throw new Error('QRモジュールの読み込みに失敗しました')
    const dataUrl = await toDataURL(text, { margin: 1, width: 180 })
    console.log('qr:done', { ms: Math.round(performance.now() - start) })
    return dataUrl
  } catch (err) {
    console.error('qr:error', err)
    throw err
  }
}
