import { FaceLandmarker, FilesetResolver, type FaceLandmarkerResult } from '@mediapipe/tasks-vision'
import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

type Tab = 'tryon' | 'plush' | 'filters'

const NANO_URL =
  import.meta.env.VITE_NANO_BANANA_URL ??
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent'
const NANO_KEY = import.meta.env.VITE_NANO_BANANA_API_KEY ?? ''
const WHISPER_URL =
  import.meta.env.VITE_WHISPER_URL ?? 'https://api.openai.com/v1/audio/transcriptions'
const WHISPER_KEY = import.meta.env.VITE_WHISPER_API_KEY ?? ''

type FilterPreset = {
  id: string
  label: string
  modality: 'skin_enhancement' | 'age_transformation' | 'style_transfer' | 'animal_ears'
  overlay?: 'ears' | 'comic' | 'retro' | 'bokeh' | 'glow' | 'rabbit' | 'stars' | 'injury' | 'hearts' | 'crown' | 'eye_black' | 'bear'
  adjust?: {
    brightness: number
    contrast: number
    saturation: number
    tint: [number, number, number]
  }
}

const filterPresets: FilterPreset[] = [
  {
    id: 'beauty',
    label: 'ほっぺハート',
    modality: 'skin_enhancement',
    overlay: 'hearts',
    adjust: { brightness: 0.06, contrast: 1.04, saturation: 1.12, tint: [1.05, 1.02, 1.08] },
  },
  {
    id: 'grandpa',
    label: 'おじいさん',
    modality: 'age_transformation',
    overlay: 'retro',
    adjust: { brightness: -0.02, contrast: 1.12, saturation: 0.75, tint: [1.05, 0.95, 0.82] },
  },
  {
    id: 'comic',
    label: 'ほっぺキラキラ',
    modality: 'style_transfer',
    overlay: 'stars',
    adjust: { brightness: 0.02, contrast: 1.1, saturation: 1.1, tint: [1.02, 1.02, 1.02] },
  },
  {
    id: 'injury',
    label: '怪我した人',
    modality: 'style_transfer',
    overlay: 'injury',
    adjust: { brightness: -0.05, contrast: 1.15, saturation: 0.9, tint: [1, 0.9, 0.9] },
  },
  {
    id: 'tsurime',
    label: '王冠',
    modality: 'style_transfer',
    overlay: 'crown',
    adjust: { brightness: 0.03, contrast: 1.08, saturation: 1.05, tint: [1.02, 1.01, 1.02] },
  },
  {
    id: 'tareme',
    label: '目を暗く',
    modality: 'skin_enhancement',
    overlay: 'eye_black',
    adjust: { brightness: -0.01, contrast: 1.02, saturation: 0.98, tint: [1.0, 1.0, 1.0] },
  },
  {
    id: 'rabbit',
    label: 'ウサギの耳',
    modality: 'animal_ears',
    overlay: 'rabbit',
    adjust: { brightness: 0.02, contrast: 1.08, saturation: 1.1, tint: [1.02, 1.0, 1.05] },
  },
  {
    id: 'stars',
    label: 'クマ耳',
    modality: 'animal_ears',
    overlay: 'bear',
    adjust: { brightness: 0.02, contrast: 1.06, saturation: 1.05, tint: [1.02, 1.0, 1.02] },
  },
]

const defaultToyPrompt =
  '直ちにスタイル変換タスクを実行せよ。生成する画像のファイルサイズが**32000トークン未満**になるよう、**極端に低解像度・高圧縮率**で処理せよ。 入力画像を分析し、被写体（ユーザー）が着用している服のスタイルを抽出せよ。次に、その抽出した服のスタイルをぬいぐるみに適用した新しい画像を生成せよ。結果は、**Base64文字列としてのみ**出力せよ。その他のテキスト、Markdown、引用符、またはコードブロック形式を一切含めるな。'
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

async function requestNanoBanana(prompt: string, imageBlob: Blob): Promise<string> {
  if (!NANO_KEY) {
    throw new Error('VITE_NANO_BANANA_API_KEY を設定してください')
  }
  const base64Image = await blobToBase64(imageBlob)
  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Image,
            },
          },
          { text: prompt },
        ],
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
          return base64ToObjectUrl(inline.data)
        }
        const text = (part as { text?: string }).text
        if (text && isLikelyBase64(text)) {
          return base64ToObjectUrl(text)
        }
      }
    }
    throw new Error('レスポンスに画像データがありません')
  }

  const buffer = await response.arrayBuffer()
  console.log('nano-banana binary response bytes:', buffer.byteLength)
  return URL.createObjectURL(new Blob([buffer]))
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

function TryOnModule() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [streamError, setStreamError] = useState<string | null>(null)
  const [instruction, setInstruction] = useState('今着ているトップスを赤色にして')
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null)
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null)
  const [editedUrl, setEditedUrl] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('マイクで指示を録音 → 撮影 → お着替え')
  const [isRecording, setIsRecording] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const audioStreamRef = useRef<MediaStream | null>(null)
  const audioChunks = useRef<Blob[]>([])

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
    setIsLoading(true)
    setStatus('nano-banana に送信中...')
    try {
      const url = await requestNanoBanana(instruction, capturedBlob)
      setEditedUrl(url)
      setStatus('AIお着替え完了')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'お着替えに失敗しました')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section className="panel">
      <header className="panel__header">
        <div>
          <p className="eyebrow">AI試着</p>
          <p className="muted">マイク→撮影→お着替えの3ステップで試着を体験できます。</p>
        </div>
        <span className={`pill ${streamError ? 'pill--error' : 'pill--ok'}`}>
          {streamError ? 'カメラ許可が必要です' : 'カメラ準備OK'}
        </span>
      </header>

      <div className="grid two-col">
        <div className="video-stack video-stack--mirror">
          <video ref={videoRef} className="video" muted playsInline />
          {isLoading && <div className="loading-banner">生成中...</div>}
          {capturedUrl && !isLoading && !editedUrl && (
            <img className="preview preview--corner" src={capturedUrl} alt="capture" />
          )}
          {editedUrl && !isLoading && (
            <div className="preview preview--floating preview--large">
              <button
                className="preview__close"
                onClick={() => {
                  setEditedUrl(null)
                  setCapturedUrl(null)
                }}
                aria-label="close result"
              >
                ×
              </button>
              <p className="preview__label">生成結果</p>
              <img src={editedUrl} alt="nano banana result" />
            </div>
          )}
        </div>

        <div className="control-slab">
          <div className="cta-row">
            <button className={`cta ${isRecording ? 'cta--warn' : ''}`} onClick={toggleRecording}>
              {isRecording ? '録音停止' : 'マイク開始'}
            </button>
            <button className="cta" onClick={handleCapture}>
              シャッター
            </button>
            <button className="cta cta--primary" onClick={handleTryOn} disabled={isLoading}>
              {isLoading ? '生成中...' : 'お着替え'}
            </button>
          </div>

          <label className="field">
            <span>音声で認識した指示</span>
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="今着ているトップスを赤色にして"
              rows={3}
            />
          </label>

          <p className="status">{status}</p>
          {!NANO_KEY && <p className="alert">環境変数 VITE_NANO_BANANA_API_KEY を設定してください。</p>}
          {!WHISPER_KEY && (
            <p className="alert">Whisper APIキー (VITE_WHISPER_API_KEY) が無い場合は手入力で試してください。</p>
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
  const [status, setStatus] = useState('ぬいぐるみと一緒に撮影してください')
  const [isLoading, setIsLoading] = useState(false)

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
    setStatus('撮影中...')
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
    setIsLoading(true)
    setStatus('nano-banana で生成中...')
    try {
      const url = await requestNanoBanana(defaultToyPrompt, capturedBlob)
      setGeneratedUrl(url)
      setStatus('ぬいぐるみお着替え完了')
    } catch (err) {
      setStatus(err instanceof Error ? err.message : '生成に失敗しました')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section className="panel">
      <header className="panel__header">
        <div>
          <p className="eyebrow">ぬいぐるみ制作</p>
          <h2>一緒に写った服をぬいぐるみに転写</h2>
          <p className="muted">シャッターボタン → nano-banana で服をコピーします。</p>
        </div>
        <span className={`pill ${streamError ? 'pill--error' : 'pill--ok'}`}>
          {streamError ? 'カメラ許可が必要です' : 'カメラ準備OK'}
        </span>
      </header>

      <div className="grid two-col">
        <div className="video-stack video-stack--mirror">
          <video ref={videoRef} className="video" muted playsInline />
          {isLoading && <div className="loading-banner">生成中...</div>}
          {capturedUrl && !isLoading && !generatedUrl && (
            <img className="preview preview--corner" src={capturedUrl} alt="capture" />
          )}
          {generatedUrl && !isLoading && (
            <div className="preview preview--floating preview--large">
              <button
                className="preview__close"
                onClick={() => {
                  setGeneratedUrl(null)
                  setCapturedUrl(null)
                }}
                aria-label="close result"
              >
                ×
              </button>
              <p className="preview__label">生成結果</p>
              <img src={generatedUrl} alt="nano banana result" />
            </div>
          )}
        </div>

        <div className="control-slab">
          <div className="cta-row">
            <button className="cta" onClick={handleCapture}>
              シャッター
            </button>
            <button className="cta cta--primary" disabled={isLoading} onClick={handleGenerate}>
              {isLoading ? '生成中...' : '生成する'}
            </button>
          </div>
          <p className="status">{status}</p>
          {!NANO_KEY && <p className="alert">環境変数 VITE_NANO_BANANA_API_KEY を設定してください。</p>}
        </div>
      </div>
    </section>
  )
}

function LiveFiltersModule() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const glCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const overlayRef = useRef<HTMLCanvasElement | null>(null)
  const glRendererRef = useRef<GLRenderer | null>(null)
  const [streamError, setStreamError] = useState<string | null>(null)
  const [status, setStatus] = useState('モデル読み込み中...')
  const [filterId, setFilterId] = useState<string>('beauty')
  const [skinTone, setSkinTone] = useState(0.15)
  const [lipColor, setLipColor] = useState(0)
  const [mirror, setMirror] = useState(false)
  const [videoAspect, setVideoAspect] = useState('16 / 9')
  const [landmarker, setLandmarker] = useState<FaceLandmarker | null>(null)

  const selectedFilter = useMemo(
    () => filterPresets.find((f) => f.id === filterId) ?? filterPresets[0],
    [filterId],
  )

  useEffect(() => {
    let active = true
    navigator.mediaDevices
      .getUserMedia({ video: videoConstraints, audio: false })
      .then((stream) => {
        if (!active) return
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
          setStatus('カメラ準備OK / フィルター適用中')
        }
      })
      .catch((err) => setStreamError(err.message))
    return () => {
      active = false
      if (videoRef.current?.srcObject instanceof MediaStream) {
        videoRef.current.srcObject.getTracks().forEach((t) => t.stop())
      }
      glRendererRef.current?.dispose()
    }
  }, [])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const filesetResolver = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.4/wasm',
        )
        const lm = await FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task',
          },
          outputFaceBlendshapes: false,
          runningMode: 'VIDEO',
          numFaces: 1,
        })
        if (mounted) {
          setLandmarker(lm)
          setStatus('フィルター適用中')
        }
      } catch (err) {
        setStatus('顔ランドマークモデルの読み込みに失敗しました')
        console.error(err)
      }
    }
    load()
    return () => {
      mounted = false
      landmarker?.close()
      glRendererRef.current?.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const video = videoRef.current
    const canvas = overlayRef.current
    const glCanvas = glCanvasRef.current
    if (!video || !canvas || !glCanvas) return
    const handleReady = () => {
      const width = video.videoWidth || 1280
      const height = video.videoHeight || 720
      canvas.width = width
      canvas.height = height
      glCanvas.width = width
      glCanvas.height = height
      console.log('handleReady sizes', { videoW: width, videoH: height })
      setVideoAspect(`${width} / ${height}`)
      try {
        glRendererRef.current?.dispose()
        glRendererRef.current = createGLRenderer(video, glCanvas)
        setStatus('フィルター適用中')
      } catch (err) {
        setStatus(err instanceof Error ? err.message : 'WebGL 初期化に失敗しました')
      }
    }
    if (video.readyState >= 2) handleReady()
    video.addEventListener('loadedmetadata', handleReady)
    return () => {
      video.removeEventListener('loadedmetadata', handleReady)
    }
  }, [])

  const glAdjust = useMemo(() => {
    const base =
      selectedFilter.adjust ?? ({
        brightness: 0,
        contrast: 1,
        saturation: 1,
        tint: [1, 1, 1],
      } satisfies FilterAdjustments)
    const strength = 1
    const mix = (v: number, center = 1) => center + (v - center) * strength
    const brightness = base.brightness * strength
    console.log('glAdjust inputs', { skinTone, lipColor })
    return {
      brightness,
      contrast: mix(base.contrast),
      saturation: mix(base.saturation),
      tint: [mix(base.tint[0]), mix(base.tint[1]), mix(base.tint[2])] as [number, number, number],
    }
  }, [selectedFilter])

  useEffect(() => {
    let id = 0
    const render = () => {
      if (landmarker && videoRef.current && overlayRef.current) {
        const result = landmarker.detectForVideo(videoRef.current, performance.now())
        if (!result?.faceLandmarks?.[0]) {
          console.log('landmarks missing on frame')
        } else {
          console.log('landmarks sample', result.faceLandmarks[0].slice(0, 3))
        }
        drawOverlay({
          canvas: overlayRef.current,
          result,
          skinTone,
          lipColor,
          filter: selectedFilter,
        })
      }
      if (glRendererRef.current) {
        glRendererRef.current.draw(glAdjust)
      }
      id = requestAnimationFrame(render)
    }
    id = requestAnimationFrame(render)
    return () => cancelAnimationFrame(id)
  }, [landmarker, skinTone, selectedFilter, glAdjust])

  return (
    <section className="panel">
      <header className="panel__header">
        <div>
          <p className="eyebrow">リアルタイム顔フィルター</p>
          <p className="muted">プリセット + 肌トーン / 唇色 などをローカル処理で適用します。</p>
        </div>
        <span className={`pill ${streamError ? 'pill--error' : 'pill--ok'}`}>
          {streamError ? 'カメラ許可が必要です' : status}
        </span>
      </header>

      <div className="grid two-col">
        <div
          className={`video-stack ${mirror ? 'video-stack--mirror' : ''}`}
          style={{ aspectRatio: videoAspect }}
        >
          <canvas ref={glCanvasRef} className="gl-canvas" />
          <canvas ref={overlayRef} className="overlay" />
          <video ref={videoRef} className="video" muted playsInline />
        </div>

        <div className="control-slab">
          <div className="filter-scroll">
            {filterPresets.map((preset) => (
              <button
                key={preset.id}
                className={`chip ${filterId === preset.id ? 'chip--active' : ''}`}
                onClick={() => setFilterId(preset.id)}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <label className="field">
            <span>ミラー表示</span>
            <input type="checkbox" checked={mirror} onChange={(e) => setMirror(e.target.checked)} />
          </label>

          <label className="field slider">
            <div>
              <span>肌トーン</span>
              <span className="muted">{skinTone.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={0.8}
              step={0.01}
              value={skinTone}
              onChange={(e) => setSkinTone(Number(e.target.value))}
            />
          </label>

          <label className="field slider">
            <div>
              <span>唇の色</span>
              <span className="muted">{lipColor.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={0.8}
              step={0.01}
              value={lipColor}
              onChange={(e) => setLipColor(Number(e.target.value))}
            />
          </label>

          <p className="status">{status}</p>
        </div>
      </div>
    </section>
  )
}

type OverlayDrawProps = {
  canvas: HTMLCanvasElement
  result: FaceLandmarkerResult | undefined
  skinTone: number
  lipColor: number
  filter: FilterPreset
}

function drawOverlay({ canvas, result, skinTone, lipColor, filter }: OverlayDrawProps) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  if (!result?.faceLandmarks?.length) return
  const landmarks = result.faceLandmarks[0]
  const xs = landmarks.map((p) => p.x)
  const ys = landmarks.map((p) => p.y)
  const minX = Math.min(...xs) * canvas.width
  const maxX = Math.max(...xs) * canvas.width
  const minY = Math.min(...ys) * canvas.height
  const maxY = Math.max(...ys) * canvas.height
  const boxWidth = maxX - minX
  const boxHeight = maxY - minY
  const faceCenterX = minX + boxWidth / 2

  // Skin tint overlay (face contourマスクで限定)
  const faceOvalIndices = [
    10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150,
    136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
  ]
  const ovalPoints = faceOvalIndices.map((idx) => landmarks[idx]).filter(Boolean)
  if (ovalPoints.length) {
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(ovalPoints[0].x * canvas.width, ovalPoints[0].y * canvas.height)
    for (let i = 1; i < ovalPoints.length; i += 1) {
      ctx.lineTo(ovalPoints[i].x * canvas.width, ovalPoints[i].y * canvas.height)
    }
    ctx.closePath()
    ctx.clip()
    ctx.fillStyle = `rgba(255, 215, 201, ${skinTone * 0.45})`
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.restore()
  }

  // Eye emphasis
  // Lips color overlay（上下唇を別ポリゴンで塗布）
  if (lipColor > 0.001) {
    // 上唇外周
    const upperLipIdx = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291]
    // 下唇外周（標準FaceMeshの外周）
    const lowerLipIdx = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291]
    const upper = upperLipIdx.map((idx) => landmarks[idx]).filter(Boolean)
    const lower = lowerLipIdx.map((idx) => landmarks[idx]).filter(Boolean)
    const alpha = Math.min(0.85, 0.1 + lipColor * 1.1)
    const fillLip = (pts: { x: number; y: number }[]) => {
      ctx.beginPath()
      ctx.moveTo(pts[0].x * canvas.width, pts[0].y * canvas.height)
      for (let i = 1; i < pts.length; i += 1) {
        ctx.lineTo(pts[i].x * canvas.width, pts[i].y * canvas.height)
      }
      ctx.closePath()
      ctx.fill()
    }
    ctx.save()
    ctx.fillStyle = `rgba(255, 70, 140, ${alpha})`
    if (upper.length === upperLipIdx.length) fillLip(upper)
    if (lower.length === lowerLipIdx.length) fillLip(lower)
    ctx.restore()
  }

  // Filter overlays
  if (filter.overlay === 'ears') {
    const earWidth = boxWidth * 0.32
    const earHeight = boxHeight * 0.35
    const topY = minY - earHeight * 0.6
    const leftX = faceCenterX - earWidth * 0.7
    const rightX = faceCenterX + earWidth * 0.05
    ctx.fillStyle = 'rgba(255, 192, 203, 0.85)'
    drawEar(ctx, leftX, topY, earWidth, earHeight)
    drawEar(ctx, rightX, topY, earWidth, earHeight)
  } else if (filter.overlay === 'rabbit') {
    const earWidth = boxWidth * 0.24
    const earHeight = boxHeight * 0.55
    const topY = minY - earHeight * 1.1
    const leftX = faceCenterX - earWidth * 1.6
    const rightX = faceCenterX + earWidth * 0.6
    ctx.fillStyle = 'rgba(255, 220, 235, 0.9)'
    drawEar(ctx, leftX, topY, earWidth, earHeight)
    drawEar(ctx, rightX, topY, earWidth, earHeight)
    ctx.fillStyle = 'rgba(255, 150, 200, 0.6)'
    drawEar(ctx, leftX + earWidth * 0.12, topY + earHeight * 0.25, earWidth * 0.76, earHeight * 0.6)
    drawEar(ctx, rightX + earWidth * 0.12, topY + earHeight * 0.25, earWidth * 0.76, earHeight * 0.6)
  } else if (filter.overlay === 'comic') {
    drawComicHalftone(ctx, canvas.width, canvas.height)
  } else if (filter.overlay === 'retro') {
    ctx.fillStyle = 'rgba(255, 215, 170, 0.08)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  } else if (filter.overlay === 'bokeh') {
    drawBokeh(ctx, canvas.width, canvas.height)
  } else if (filter.overlay === 'stars') {
    drawStars(ctx, canvas.width, canvas.height, landmarks)
  } else if (filter.overlay === 'injury') {
    drawInjury(ctx, landmarks, canvas.width, canvas.height)
  } else if (filter.overlay === 'hearts') {
    drawHearts(ctx, canvas.width, canvas.height, landmarks)
  } else if (filter.overlay === 'crown') {
    drawCrown(ctx, canvas.width, canvas.height, landmarks)
  } else if (filter.overlay === 'eye_black') {
    drawEyeBlack(ctx, canvas.width, canvas.height, landmarks)
  } else if (filter.overlay === 'bear') {
    drawBearEars(ctx, faceCenterX, minY, boxWidth, boxHeight)
  } else if (filter.overlay === 'glow') {
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.ellipse(faceCenterX, minY + boxHeight * 0.1, boxWidth * 0.4, boxHeight * 0.2, 0, 0, Math.PI * 2)
    ctx.stroke()
  }
}

function drawEar(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
  ctx.beginPath()
  ctx.moveTo(x, y + height)
  ctx.lineTo(x + width / 2, y)
  ctx.lineTo(x + width, y + height)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.beginPath()
  ctx.moveTo(x + width * 0.2, y + height)
  ctx.lineTo(x + width / 2, y + height * 0.25)
  ctx.lineTo(x + width * 0.8, y + height)
  ctx.closePath()
  ctx.fill()
}

function drawComicHalftone(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.fillStyle = 'rgba(255,255,255,0.12)'
  const spacing = 24
  for (let y = 0; y < height; y += spacing) {
    for (let x = 0; x < width; x += spacing) {
      ctx.beginPath()
      ctx.arc(x, y, 4, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'
  ctx.lineWidth = 2
  ctx.strokeRect(16, 16, width - 32, height - 32)
}

function drawBokeh(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const bubbles = 8
  for (let i = 0; i < bubbles; i += 1) {
    const radius = Math.random() * 60 + 30
    const x = Math.random() * width
    const y = Math.random() * height * 0.6
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
    gradient.addColorStop(0, 'rgba(255,255,255,0.25)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawStars(ctx: CanvasRenderingContext2D, width: number, height: number, landmarks: { x: number; y: number }[]) {
  const cheeks = [
    { x: landmarks[234].x * width, y: landmarks[234].y * height },
    { x: landmarks[454].x * width, y: landmarks[454].y * height },
  ]
  ctx.fillStyle = 'rgba(255, 236, 139, 0.9)'
  cheeks.forEach((pos) => {
    const size = 18
    ctx.save()
    ctx.translate(pos.x, pos.y)
    ctx.beginPath()
    for (let i = 0; i < 5; i += 1) {
      ctx.lineTo(0, -size)
      ctx.translate(0, -size)
      ctx.rotate((Math.PI * 2) / 10)
      ctx.lineTo(0, size)
      ctx.translate(0, size)
      ctx.rotate(-(Math.PI * 6) / 10)
    }
    ctx.fill()
    ctx.restore()
  })
}

function drawInjury(ctx: CanvasRenderingContext2D, landmarks: { x: number; y: number }[], width: number, height: number) {
  const cheek = { x: landmarks[50].x * width, y: landmarks[50].y * height }
  ctx.strokeStyle = 'rgba(180, 50, 50, 0.8)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(cheek.x - 30, cheek.y - 10)
  ctx.lineTo(cheek.x + 30, cheek.y + 10)
  ctx.moveTo(cheek.x - 25, cheek.y + 12)
  ctx.lineTo(cheek.x + 25, cheek.y + 34)
  ctx.stroke()
}

function drawHearts(ctx: CanvasRenderingContext2D, width: number, height: number, landmarks: { x: number; y: number }[]) {
  const cheeks = [
    { x: landmarks[234].x * width, y: landmarks[234].y * height },
    { x: landmarks[454].x * width, y: landmarks[454].y * height },
  ]
  ctx.fillStyle = 'rgba(255, 105, 180, 0.9)'
  cheeks.forEach((pos) => {
    const size = 16
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y + size / 3)
    ctx.bezierCurveTo(pos.x - size, pos.y - size / 2, pos.x - size * 1.2, pos.y + size / 2, pos.x, pos.y + size)
    ctx.bezierCurveTo(pos.x + size * 1.2, pos.y + size / 2, pos.x + size, pos.y - size / 2, pos.x, pos.y + size / 3)
    ctx.fill()
  })
}

function drawCrown(ctx: CanvasRenderingContext2D, width: number, height: number, landmarks: { x: number; y: number }[]) {
  const top = landmarks[10]
  const left = landmarks[234]
  const right = landmarks[454]
  if (!top || !left || !right) return
  const crownWidth = (right.x - left.x) * width * 1.05
  const crownHeight = crownWidth * 0.4
  const cx = ((left.x + right.x) / 2) * width
  const cy = top.y * height - crownHeight * 0.25
  const startX = cx - crownWidth / 2
  const baseY = cy + crownHeight * 0.4
  ctx.fillStyle = 'rgba(255, 215, 0, 0.9)'
  ctx.beginPath()
  ctx.moveTo(startX, baseY)
  ctx.lineTo(startX + crownWidth * 0.16, cy - crownHeight * 0.6)
  ctx.lineTo(startX + crownWidth * 0.33, baseY)
  ctx.lineTo(startX + crownWidth * 0.5, cy - crownHeight * 0.65)
  ctx.lineTo(startX + crownWidth * 0.67, baseY)
  ctx.lineTo(startX + crownWidth * 0.84, cy - crownHeight * 0.6)
  ctx.lineTo(startX + crownWidth, baseY)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
  const peaks = [
    { x: startX + crownWidth * 0.16, y: cy - crownHeight * 0.6 },
    { x: startX + crownWidth * 0.5, y: cy - crownHeight * 0.65 },
    { x: startX + crownWidth * 0.84, y: cy - crownHeight * 0.6 },
  ]
  peaks.forEach((p) => {
    ctx.beginPath()
    ctx.arc(p.x, p.y - 6, 5, 0, Math.PI * 2)
    ctx.fill()
  })
}

function drawEyeBlack(ctx: CanvasRenderingContext2D, width: number, height: number, landmarks: { x: number; y: number }[]) {
  const leftEyeIdx = [33, 7, 163, 144, 145, 153, 154, 155, 133]
  const rightEyeIdx = [362, 382, 381, 380, 374, 373, 390, 249, 263]
  const eyes = [leftEyeIdx, rightEyeIdx]
  ctx.fillStyle = 'rgba(10, 10, 10, 0.65)'
  eyes.forEach((eyeIdx) => {
    const pts = eyeIdx.map((i) => landmarks[i]).filter(Boolean)
    if (pts.length === eyeIdx.length) {
      ctx.beginPath()
      ctx.moveTo(pts[0].x * width, pts[0].y * height)
      for (let i = 1; i < pts.length; i += 1) {
        ctx.lineTo(pts[i].x * width, pts[i].y * height)
      }
      ctx.closePath()
      ctx.fill()
    }
  })
}

function drawBearEars(ctx: CanvasRenderingContext2D, faceCenterX: number, minY: number, boxWidth: number, boxHeight: number) {
  const earWidth = boxWidth * 0.32
  const earHeight = boxHeight * 0.32
  const topY = minY - earHeight * 0.5
  const leftX = faceCenterX - earWidth * 1.4
  const rightX = faceCenterX + earWidth * 0.4
  ctx.fillStyle = 'rgba(120, 90, 60, 0.95)'
  drawEar(ctx, leftX, topY, earWidth, earHeight)
  drawEar(ctx, rightX, topY, earWidth, earHeight)
  ctx.fillStyle = 'rgba(200, 160, 120, 0.8)'
  drawEar(ctx, leftX + earWidth * 0.2, topY + earHeight * 0.2, earWidth * 0.6, earHeight * 0.6)
  drawEar(ctx, rightX + earWidth * 0.2, topY + earHeight * 0.2, earWidth * 0.6, earHeight * 0.6)
}

type FilterAdjustments = {
  brightness: number
  contrast: number
  saturation: number
  tint: [number, number, number]
}

type GLRenderer = {
  draw: (adjust: FilterAdjustments) => void
  dispose: () => void
}

function createGLRenderer(video: HTMLVideoElement, canvas: HTMLCanvasElement): GLRenderer {
  const gl = canvas.getContext('webgl', { premultipliedAlpha: false })
  if (!gl) {
    throw new Error('WebGL がサポートされていません')
  }

  const vertexSrc = `
    attribute vec2 a_position;
    attribute vec2 a_texCoord;
    varying vec2 v_texCoord;
    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
      v_texCoord = a_texCoord;
    }
  `

  const fragmentSrc = `
    precision mediump float;
    varying vec2 v_texCoord;
    uniform sampler2D u_texture;
    uniform float u_brightness;
    uniform float u_contrast;
    uniform float u_saturation;
    uniform vec3 u_tint;

    vec3 applySaturation(vec3 color, float sat) {
      float l = dot(color, vec3(0.299, 0.587, 0.114));
      return mix(vec3(l), color, sat);
    }

    void main() {
      vec4 tex = texture2D(u_texture, v_texCoord);
      vec3 color = tex.rgb + vec3(u_brightness);
      color = (color - 0.5) * vec3(u_contrast) + 0.5;
      color = applySaturation(color, u_saturation);
      color *= u_tint;
      gl_FragColor = vec4(color, 1.0);
    }
  `

  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)
    if (!shader) throw new Error('shader creation failed')
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) ?? 'shader compile error')
    }
    return shader
  }

  const program = gl.createProgram()
  if (!program) throw new Error('program creation failed')
  const vs = compile(gl.VERTEX_SHADER, vertexSrc)
  const fs = compile(gl.FRAGMENT_SHADER, fragmentSrc)
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? 'program link error')
  }
  gl.useProgram(program)

  const positionBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  )
  const aPosition = gl.getAttribLocation(program, 'a_position')
  gl.enableVertexAttribArray(aPosition)
  gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0)

  const texCoordBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer)
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0]),
    gl.STATIC_DRAW,
  )
  const aTexCoord = gl.getAttribLocation(program, 'a_texCoord')
  gl.enableVertexAttribArray(aTexCoord)
  gl.vertexAttribPointer(aTexCoord, 2, gl.FLOAT, false, 0, 0)

  const texture = gl.createTexture()
  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

  const uTexture = gl.getUniformLocation(program, 'u_texture')
  const uBrightness = gl.getUniformLocation(program, 'u_brightness')
  const uContrast = gl.getUniformLocation(program, 'u_contrast')
  const uSaturation = gl.getUniformLocation(program, 'u_saturation')
  const uTint = gl.getUniformLocation(program, 'u_tint')
  gl.uniform1i(uTexture, 0)

  const draw = (adjust: FilterAdjustments) => {
    if (video.videoWidth === 0 || video.videoHeight === 0) return
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      gl.viewport(0, 0, canvas.width, canvas.height)
    }

    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video)

    gl.uniform1f(uBrightness, adjust.brightness)
    gl.uniform1f(uContrast, adjust.contrast)
    gl.uniform1f(uSaturation, adjust.saturation)
    gl.uniform3fv(uTint, adjust.tint)

    gl.drawArrays(gl.TRIANGLES, 0, 6)
  }

  const dispose = () => {
    gl.deleteTexture(texture)
    gl.deleteBuffer(positionBuffer)
    gl.deleteBuffer(texCoordBuffer)
    gl.deleteProgram(program)
  }

  return { draw, dispose }
}

function App() {
  const [tab, setTab] = useState<Tab>('tryon')

  return (
    <div className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">AI ビジュアルエディター (デモ)</p>
          <h1>3つのAI機能をまとめた Webデモ</h1>
        </div>
        <div className="tab-row">
          <button className={`tab ${tab === 'tryon' ? 'tab--active' : ''}`} onClick={() => setTab('tryon')}>
            AI試着
          </button>
          <button className={`tab ${tab === 'plush' ? 'tab--active' : ''}`} onClick={() => setTab('plush')}>
            ぬいぐるみ制作
          </button>
          <button className={`tab ${tab === 'filters' ? 'tab--active' : ''}`} onClick={() => setTab('filters')}>
            顔フィルター
          </button>
        </div>
      </header>

      {tab === 'tryon' && <TryOnModule />}
      {tab === 'plush' && <PlushModule />}
      {tab === 'filters' && <LiveFiltersModule />}

    </div>
  )
}

export default App
