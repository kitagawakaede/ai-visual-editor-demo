# ヘアスタイル診断機能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 本人写真から髪型のみを変えた9パターンを並列生成し、上位3枚をAI採点して「一番似合う／普通×2」を星評価付きで提示する、6個目の機能を追加する。

**Architecture:** 既存 `TimeSlipModule`（9枚並列生成＋性別判定＋QR共有）を下敷きにした新モジュール `HairStyleModule` を追加。プロンプトは `prompts.ts`、採点関数は `api.ts` に集約。`App.tsx` に6個目タブを追加。

**Tech Stack:** React 19 + TypeScript + Vite / Tailwind（既存クラスユーティリティ）/ Gemini（nano-banana）・OpenAI images.edits・gpt-4o vision / Supabase（QR用アップロード）。

## Global Constraints

- 参照画像は渡さない（テキストのみ生成）。本人の顔・輪郭・骨格を保持し髪型のみ変更する。
- 生成は9枚（上位3枚 `scored:true` ＋ その他6枚）。個数は固定。男女それぞれ `promptByGender` で出し分け。
- 星評価は上位3枚のみ・AI採点（gpt-4o vision）。評価項目: 女性=小顔効果・垢抜け度／男性=爽やかさ・垢抜け度。各1〜5の整数。
- 上位3枚は「2項目合計スコア」降順にソート → 1位「一番似合う」（王冠）、2・3位「普通」。
- 既定エンジンは Gemini。`EngineToggle` で OpenAI 切替（切替時は9枚とも OpenAI）。採点は常に gpt-4o。
- 結果枠の背景は白。
- **このリポジトリに単体テスト基盤は無い。** 各タスクの検証は `npm run lint`＋`npm run build`（tsc型チェック）＋`npm run dev` での目視確認で行う。
- コミットメッセージ末尾に `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` を付ける。
- 環境変数（既存）: `VITE_NANO_BANANA_API_KEY`/`VITE_NANO_BANANA_URL`（Gemini）、`VITE_OPENAI_API_KEY`（性別判定・採点・OpenAI生成）、`VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`（QR）。

---

## File Structure

- `src/constants/prompts.ts`（変更）— `HairStyleItem` 型、`hairStyleBase()`、`HAIR_STYLE_ITEMS`、`HAIRSTYLE_SCORE_PROMPT`、`HairScore` 型を追加。
- `src/lib/api.ts`（変更）— `scoreHairstyle(imageBlob, gender)` を追加。既存 `detectGenderFromImage` 流用。
- `src/modules/HairStyleModule.tsx`（新規）— カメラ制御・撮影・診断実行・9枚並列生成・採点・ソート・結果表示・QR。
- `src/App.tsx`（変更）— `Tab` に `'hair'` 追加、`TABS` に6個目、レンダリング分岐追加。

---

## Task 1: 髪型プロンプトデータ（prompts.ts）

**Files:**
- Modify: `src/constants/prompts.ts`（末尾に追記）

**Interfaces:**
- Consumes: なし（新規定義）
- Produces:
  - `export type HairScore = { small: number; refined: number }` … `small`=女性は小顔効果/男性は爽やかさ、`refined`=垢抜け度（各1〜5）
  - `export type HairStyleItem = { id: string; label: string; scored: boolean; promptByGender: { man: string; woman: string } }`
  - `export const HAIR_STYLE_ITEMS: HairStyleItem[]` … 先頭3件が `scored:true`、続く6件が `scored:false`（計9件）
  - `export const HAIRSTYLE_SCORE_PROMPT: (gender: 'man' | 'woman') => string`

- [ ] **Step 1: 型とベースプロンプトを追記**

`src/constants/prompts.ts` の末尾に追記する:

```typescript
// ── ヘアスタイル診断（6個目の機能）────────────────────────────
// 本人の顔・輪郭・骨格を保持し、髪型だけを変える。参照画像は渡さずテキストのみ生成
// （別人の顔が混入せず本人を保てる。TimeSlip と同方針）。性別で出し分ける。
export type HairScore = { small: number; refined: number }

export type HairStyleItem = {
  id: string
  label: string
  scored: boolean // true=上位3枚（AI採点対象）
  promptByGender: { man: string; woman: string }
}

const hairStyleBase = (scene: string) =>
  `1枚の人物写真をもとに、その人物の髪型だけを変えた実写風のヘアカタログ写真を作る。【最重要・本人の同一性】写真の本人の顔（顔立ち・輪郭・骨格・目鼻口の形と配置・眉・肌の色と質感・表情の癖）と、首から下の体格・体型・服装は忠実に保持し、本人だと一目で分かるようにすること。別人の顔に置き換えないこと。年齢・性別も現在の本人のまま。${scene}。変えてよいのは髪型（髪の長さ・毛流れ・前髪・分け目・毛先・ボリューム・軽いカラー）だけで、それ以外（顔・体・服）は写真のまま保つこと。明るい無地の背景で、正面〜ややバストアップの構図。合成感のない実写風の1枚に自然に仕上げること。最終的に1枚の画像のみを生成し、Base64文字列のみを返せ。テキスト・JSON・Markdownは禁止。`
```

- [ ] **Step 2: 髪型リストを追記**

同ファイルに続けて追記する（女性・男性の文言を両方定義。先頭3件が採点対象）:

```typescript
const hairItem = (
  id: string,
  label: string,
  scored: boolean,
  woman: string,
  man: string,
): HairStyleItem => ({
  id,
  label,
  scored,
  promptByGender: {
    woman: hairStyleBase(`完成画像の人物は必ず女性として描くこと（男性化させない）。髪型は「${woman}」にすること`),
    man: hairStyleBase(`完成画像の人物は必ず男性として描くこと（女性化させない）。髪型は「${man}」にすること`),
  },
})

export const HAIR_STYLE_ITEMS: HairStyleItem[] = [
  // 上位3枚（AI採点対象・scored:true）
  hairItem('feat1', 'くびれミディ×シースルーバング', true,
    'あごから鎖骨あたりの長さの、首元でくびれるレイヤーの効いたミディアム。毛先は軽く外ハネ、前髪は隙間の見えるシースルーバング',
    'ナチュラルな爽やかマッシュに、隙間の見えるシースルーバング。清潔感のある毛流れ'),
  hairItem('feat2', 'ナチュラルボブ×軽め外ハネ', true,
    'あご下ラインの丸みのあるナチュラルボブ。毛先を軽く外ハネにした抜け感のあるスタイル',
    '短めのナチュラルショート。毛先を軽く外に流した、清潔感のある好青年スタイル'),
  hairItem('feat3', 'ゆる巻きセミロング', true,
    '鎖骨より下のセミロングを、ゆるく大きめに巻いたやわらかいウェーブ。透明感のある明るめカラー',
    '前髪を上げたセンターパートに、毛先へ向けてゆるい束感を出したこなれスタイル'),
  // その他6枚（scored:false）
  hairItem('other1', '外ハネボブ', false,
    'あごラインの外ハネボブ。毛先を全体的に外にはねさせた軽快なスタイル',
    'サイドを刈り上げたツーブロックの短髪。トップは短く整えたすっきりスタイル'),
  hairItem('other2', '耳かけボブ', false,
    '片側を耳にかけたすっきりボブ。タイトで大人っぽい印象',
    '前髪を立ち上げたアップバング。おでこを出した男らしいショート'),
  hairItem('other3', 'ハーフアップ', false,
    'トップをふんわりまとめたハーフアップ。残りの髪は軽く巻いて華やかに',
    '韓国風の重ためマッシュ。厚めの前髪で目元まわりを包む柔らかいスタイル'),
  hairItem('other4', '低めポニー', false,
    'うなじで結んだ低めのポニーテール。後れ毛を出した抜け感のあるまとめ髪',
    'トップに動きを出したソフトモヒカン。サイドは短く、中央を立ち上げた躍動スタイル'),
  hairItem('other5', '韓国風ミディ', false,
    '顔まわりにレイヤーを入れた韓国風ヨシンモリ。большими巻きの華やかなミディアム',
    'かき上げ前髪のミディアム。大人っぽく色気のある毛流れ'),
  hairItem('other6', 'センターパートロング', false,
    '真ん中分けのストレートロング。毛先だけ軽く内巻きにした清楚なスタイル',
    'パーマで束感を出したショート。全体にランダムな動きのある今どきスタイル'),
]
```

> 注: Step 2 の `other5` woman 文面内の非ASCII混入（"большими"）は誤記。実装時は「大きめ巻きの華やかなミディアム」に直すこと。

- [ ] **Step 3: 採点プロンプトを追記**

```typescript
// 上位3枚の生成画像を gpt-4o(vision) で採点するプロンプト。
// 2項目を各1〜5の整数で JSON 返答させる。small=女性:小顔効果/男性:爽やかさ、refined=垢抜け度。
export const HAIRSTYLE_SCORE_PROMPT = (gender: 'man' | 'woman'): string => {
  const firstLabel = gender === 'man' ? '爽やかさ(freshness)' : '小顔効果(small-face effect)'
  return `You are a professional hair stylist judging how well this hairstyle suits the person in the photo. Rate two aspects, each an integer from 1 to 5 (5 = best). Aspect "small": ${firstLabel}. Aspect "refined": 垢抜け度 (how polished/stylish/refined they look). Reply with ONLY a compact JSON object and nothing else, e.g. {"small":4,"refined":5}.`
}
```

- [ ] **Step 4: lint と型チェック**

Run: `npm run lint && npm run build`
Expected: エラーなしで完了（`HAIR_STYLE_ITEMS` が9件・先頭3件 scored の定義がコンパイルを通る）。`other5` の非ASCII修正を忘れているとビルドは通るが文面が壊れるため Step 2 の修正を必ず反映すること。

- [ ] **Step 5: 件数の目視確認**

Run: `grep -c "hairItem(" src/constants/prompts.ts`
Expected: `9`（`hairItem(` の定義呼び出しが9件）。

- [ ] **Step 6: コミット**

```bash
git add src/constants/prompts.ts
git commit -m "feat: ヘアスタイル診断のプロンプト・髪型リスト・採点プロンプト追加

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: 採点API（api.ts）

**Files:**
- Modify: `src/lib/api.ts`（`detectGenderFromImage` の直後に追記）

**Interfaces:**
- Consumes:
  - `OPENAI_KEY`（既存 export）、`OPENAI_CHAT_URL`（既存の module-local 定数）
  - `blobToBase64`（既存 import 済み）
  - `HAIRSTYLE_SCORE_PROMPT`, `HairScore`（Task 1、`../constants/prompts` から import）
- Produces:
  - `export async function scoreHairstyle(imageBlob: Blob, gender: 'man' | 'woman'): Promise<HairScore>` … 失敗時は `{ small: 3, refined: 3 }` を返す（例外を投げない）

- [ ] **Step 1: import を追加**

`src/lib/api.ts` の先頭 import 群に追記:

```typescript
import { HAIRSTYLE_SCORE_PROMPT, type HairScore } from '../constants/prompts'
```

- [ ] **Step 2: scoreHairstyle を実装**

`detectGenderFromImage` 関数の直後に追記する（`OPENAI_CHAT_URL` は既に module 内で定義済みなので流用）:

```typescript
// 上位3枚の生成画像を gpt-4o で採点し、2項目（各1〜5）を返す。
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
```

- [ ] **Step 3: lint と型チェック**

Run: `npm run lint && npm run build`
Expected: エラーなし。`scoreHairstyle` が `HairScore` を返す形でコンパイルを通る。

- [ ] **Step 4: コミット**

```bash
git add src/lib/api.ts
git commit -m "feat: 髪型のAI採点関数 scoreHairstyle を追加

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: HairStyleModule — 生成コア

**Files:**
- Create: `src/modules/HairStyleModule.tsx`

**Interfaces:**
- Consumes: `captureStill`,`base64ToBlob`,`isValidBase64Image`,`videoConstraints`（image）/ `requestOpenAIImageEdit`,`requestNanoBanana`,`detectGenderFromImage`,`scoreHairstyle`,`OPENAI_KEY`,`NANO_KEY`（api）/ `HAIR_STYLE_ITEMS`,`HairStyleItem`,`HairScore`（prompts）/ `EngineToggle`,`WaitingGame`,`useOmikujiOverlay`,`logError`,`uploadToSupabase`,`generateQrDataUrl`
- Produces:
  - `export function HairStyleModule(): JSX.Element`
  - module 内型 `type HairSlot = { id: string; label: string; url: string | null; scored: boolean; score: HairScore | null; category: '一番似合う' | '普通' | null }`

- [ ] **Step 1: モジュールの骨格（カメラ・撮影）を作成**

`src/modules/HairStyleModule.tsx` を新規作成。`TimeSlipModule.tsx` の 1〜124行（import群・カメラ useEffect・handleCapture）を土台にし、以下の差分で書く:

```tsx
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
  scored: boolean
  score: HairScore | null
  category: '一番似合う' | '普通' | null
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

  // 以降 Step 2〜3 で generateOne / handleGenerate / handleCloseResult / return を追加する
  return null
}
```

- [ ] **Step 2: 1枚生成関数を追加**

`handleCapture` の直後に追加（TimeSlip の `generateOne` を土台に、子ども分岐を除去。髪型は男女とも `promptByGender` を使う）:

```tsx
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
```

- [ ] **Step 3: 診断本体（並列生成→採点→ソート）を追加**

`generateOne` の直後に追加:

```tsx
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
      // 上位3枚（scored かつ生成成功）のみ採点
      const scoreByIndex = new Map<number, HairScore>()
      await Promise.all(
        HAIR_STYLE_ITEMS.map(async (item, i) => {
          if (!item.scored || !urls[i]) return
          const resp = await fetch(urls[i] as string)
          const blob = await resp.blob()
          scoreByIndex.set(i, await scoreHairstyle(blob, g))
        }),
      )
      // 上位3枚を合計スコア降順でソートし、カテゴリを割り当て
      const scoredIdx = HAIR_STYLE_ITEMS
        .map((item, i) => ({ item, i }))
        .filter(({ item, i }) => item.scored && urls[i])
        .sort((a, b) => {
          const sa = scoreByIndex.get(a.i) ?? { small: 0, refined: 0 }
          const sb = scoreByIndex.get(b.i) ?? { small: 0, refined: 0 }
          return sb.small + sb.refined - (sa.small + sa.refined)
        })
      const categoryByIndex = new Map<number, '一番似合う' | '普通'>()
      scoredIdx.forEach(({ i }, rank) => categoryByIndex.set(i, rank === 0 ? '一番似合う' : '普通'))

      const slots: HairSlot[] = HAIR_STYLE_ITEMS.map((item, i) => ({
        id: item.id,
        label: item.label,
        url: urls[i],
        scored: item.scored,
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
      // QR（後追い）: 9枚を Task 4 の buildHairComposite で合成
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
```

> `buildHairComposite` と `return` の JSX は Task 4 で追加する。この時点では未定義参照でビルドが通らないので、Task 4 まで一括で進めてから型チェックする。`gender` state は Task 4 の評価項目ラベル出し分けで使用する。

- [ ] **Step 4: コミット（WIP・ビルド未通過を明記）**

```bash
git add src/modules/HairStyleModule.tsx
git commit -m "feat(wip): HairStyleModule 生成コア（撮影・並列生成・採点・ソート）

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: HairStyleModule — 結果レイアウト・合成・QR

**Files:**
- Modify: `src/modules/HairStyleModule.tsx`

**Interfaces:**
- Consumes: Task 3 の `HairSlot`, state 群, `handleCapture`, `handleGenerate`, `handleCloseResult`, `gender`, `useGemini`
- Produces:
  - module 内 `async function buildHairComposite(slots: HairSlot[]): Promise<Blob | null>`（3×3コラージュ・白枠）
  - `HairStyleModule` の `return` JSX（比較カード＋グリッド＋星＋QR＋操作パネル）

- [ ] **Step 1: コラージュ合成関数を追加**

ファイル冒頭（`export function HairStyleModule` の前）に、TimeSlip の `loadImage`/`buildAlbumComposite` を土台に追加する（白背景・白枠）:

```tsx
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
```

- [ ] **Step 2: 星表示ヘルパーと評価項目ラベルを追加**

`export function HairStyleModule` 内、`return` の直前に追加:

```tsx
  // 評価項目ラベル（女性=小顔効果、男性=爽やかさ／共通=垢抜け度）
  const smallLabel = gender === 'man' ? '爽やかさ' : '小顔効果'
  const stars = (n: number) => '★★★★★☆☆☆☆☆'.slice(5 - Math.min(5, Math.max(0, n)), 10 - Math.min(5, Math.max(0, n)))

  const featured = results ? results.filter((s) => s.scored) : []
  const others = results ? results.filter((s) => !s.scored) : []
  // featured は category（一番似合う→普通）順で並べる
  const featuredSorted = [...featured].sort((a, b) => {
    const rank = (c: HairSlot['category']) => (c === '一番似合う' ? 0 : c === '普通' ? 1 : 2)
    return rank(a.category) - rank(b.category)
  })
```

> `stars(4)` は `"★★★★☆"` を返す（先頭に★をn個、残りを☆）。

- [ ] **Step 3: return の JSX を追加（ヘッダ・カメラ枠）**

`return null` を以下に置き換える。まずヘッダとカメラ枠（TimeSlip 216〜266行を土台に文言変更）:

```tsx
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
      </div>

      {/* 結果セクション（Step 4） */}
      {/* 操作パネル（Step 5） */}
    </section>
  )
```

- [ ] **Step 4: 結果セクション（比較カード＋グリッド）を追加**

`{/* 結果セクション（Step 4） */}` の位置に挿入:

```tsx
      {results && !isLoading && (
        <div className="rounded-[16px] bg-white/95 p-2.5 shadow-[0_8px_16px_rgba(0,0,0,0.15)] transition-opacity duration-700 ease-out" style={{ opacity: resultVisible ? 1 : 0 }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-extrabold text-black">診断結果</span>
            <div className="flex items-center gap-2">
              {resultQr ? <img className="w-9 h-9 bg-white p-0.5 rounded border border-black/10" src={resultQr} alt="QRコード" /> : <span className="text-black/40 text-[9px]">QR生成中…</span>}
              <button className="w-6 h-6 rounded-full border border-black/30 text-black/70 text-[13px] leading-none" onClick={handleCloseResult} aria-label="close result">✕</button>
            </div>
          </div>

          {/* 上段：上位3枚 比較カード */}
          <div className="grid grid-cols-3 gap-1.5">
            {featuredSorted.map((slot) => (
              <div key={slot.id} className="flex flex-col bg-white border border-black/10 rounded-[10px] overflow-hidden shadow-sm">
                <div className="text-center py-1 text-[10px] font-bold text-black">
                  {slot.category === '一番似合う' ? '👑 一番似合う' : slot.category}
                </div>
                <div className="aspect-square bg-[#eee] overflow-hidden">
                  {slot.url ? <img className="w-full h-full object-cover block" src={slot.url} alt={slot.label} /> : <div className="w-full h-full grid place-items-center text-[8px] text-[#999]">生成失敗</div>}
                </div>
                <p className="text-center text-[8px] text-[#444] mt-0.5 px-0.5 leading-tight truncate">{slot.label}</p>
                <div className="px-1 pb-1 text-[7px] text-[#c8a013] leading-tight">
                  <div className="flex justify-between"><span className="text-[#666]">{smallLabel}</span><span>{slot.score ? stars(slot.score.small) : '—'}</span></div>
                  <div className="flex justify-between"><span className="text-[#666]">垢抜け度</span><span>{slot.score ? stars(slot.score.refined) : '—'}</span></div>
                </div>
              </div>
            ))}
          </div>

          {/* 下段：その他6枚グリッド */}
          <div className="grid grid-cols-3 gap-1.5 mt-2">
            {others.map((slot) => (
              <div key={slot.id} className="flex flex-col bg-white border border-black/10 rounded-[8px] overflow-hidden">
                <div className="aspect-square bg-[#eee] overflow-hidden">
                  {slot.url ? <img className="w-full h-full object-cover block" src={slot.url} alt={slot.label} /> : <div className="w-full h-full grid place-items-center text-[8px] text-[#999]">生成失敗</div>}
                </div>
                <p className="text-center text-[7px] text-[#444] py-0.5 px-0.5 leading-tight truncate">{slot.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}
```

- [ ] **Step 5: 操作パネル（エンジン切替・ボタン・ステータス）を追加**

`{/* 操作パネル（Step 5） */}` の位置に挿入（TimeSlip 315〜342行を土台にボタン文言変更）:

```tsx
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
```

- [ ] **Step 6: lint と型チェック**

Run: `npm run lint && npm run build`
Expected: エラーなしで完了。未使用変数・未定義参照がないこと（`buildHairComposite`,`stars`,`featuredSorted` などがすべて解決）。

- [ ] **Step 7: コミット**

```bash
git add src/modules/HairStyleModule.tsx
git commit -m "feat: HairStyleModule 結果レイアウト・コラージュ合成・QRを実装

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: App.tsx にタブ追加

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `HairStyleModule`（Task 3/4）
- Produces: `Tab` 型に `'hair'` 追加、`TABS` に6個目、レンダリング分岐

- [ ] **Step 1: import とタブ定義を追加**

`src/App.tsx:6` の import 群に追加:

```tsx
import { HairStyleModule } from './modules/HairStyleModule'
```

`Tab` 型（`src/App.tsx:8`）を更新:

```tsx
type Tab = 'tryon' | 'stamp' | 'plush-change' | 'sofubi' | 'timeslip' | 'hair'
```

- [ ] **Step 2: タブアイコン（暫定プレースホルダ）を定義**

`src/App.tsx:20` の `iconTryon` 定義の直後に追加（**6個目のアイコン素材は未入手のため暫定で既存の album アイコンを流用**。素材入手後に差し替える）:

```tsx
// TODO(素材差し替え): 6個目アイコン素材が未入手のため暫定で album アイコンを流用
const iconHair = iconAlbum
```

`TABS` 配列（`src/App.tsx:22-28`）の末尾に1件追加:

```tsx
  { key: 'tryon', label: 'AI 試着', icon: iconTryon },
  { key: 'hair', label: 'HAIR', icon: iconHair },
]
```

- [ ] **Step 3: レンダリング分岐を追加**

`src/App.tsx:90`（`{tab === 'timeslip' && <TimeSlipModule />}`）の直後に追加:

```tsx
          {tab === 'hair' && <HairStyleModule />}
```

- [ ] **Step 4: lint と型チェック**

Run: `npm run lint && npm run build`
Expected: エラーなし。`Tab` union に `'hair'` が入り分岐が型を通る。

- [ ] **Step 5: 目視確認（dev）**

Run: `npm run dev`（http://localhost:5173）
Expected:
- タブが6個表示され、6個目「HAIR」に切り替えられる。
- HAIR タブでカメラ枠が表示され、シャッター→「診断」で「診断中...」表示になる。
- （API鍵設定済みなら）9枚が生成され、上段に3枚の比較カード（王冠＋一番似合う/普通＋星2項目）、下段に6枚グリッドが表示される。
- 右上QRから9枚コラージュ画像が開ける。
- Gemini⇔OpenAI トグルが切り替わる。

- [ ] **Step 6: コミット**

```bash
git add src/App.tsx
git commit -m "feat: ヘアスタイル診断タブ(HAIR)をAppに追加

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review 結果（作成者チェック済み）

- **Spec coverage:** 9枚生成=Task1/3、上位3枚AI採点=Task2/3、スコア順ソート＋一番似合う/普通=Task3、結果レイアウト（3カード＋6グリッド＋白枠）=Task4、QR=Task4、エンジン切替=Task4、タブ追加=Task5、性別判定=Task3。全項目にタスク対応あり。
- **Placeholder scan:** `iconHair` の暫定流用は Global Constraints / Spec 第9章で明示済みの意図的プレースホルダ。`other5` 非ASCII混入は Task1 Step2 に修正指示を明記。その他の「TBD/後で」なし。
- **Type consistency:** `HairScore{small,refined}`・`HairStyleItem{id,label,scored,promptByGender}`・`HairSlot{...,category}`・`scoreHairstyle(blob,gender):HairScore`・`stars(n)`・`buildHairComposite(slots)` はタスク間で名称・シグネチャ一致を確認。

## 既知の注意点

- 単体テスト基盤が無いため検証は型チェック＋lint＋目視。API鍵未設定の環境では生成・採点・QRは動かないが、UI遷移とフォールバック（星 `—`／プレースホルダ）は確認できる。
- Task 3 は単独ではビルドが通らない（`buildHairComposite`/`return` が Task 4 依存）。Task 3→4 を連続実行してから型チェックすること（Task 3 のコミットは WIP 明記）。
