# 27SS 追加機能 設計仕様書

> 作成日: 2026-06-22
> リリース目標: 2026-06-30（全機能同時リリース）

---

## 概要

TEXTLENDS 27SS展示会向けに以下の機能を追加・整理する。

| 機能 | 種別 |
|------|------|
| AI試着 | 既存継続 |
| LINEスタンプ作成 | 新規 |
| ぬいぐるみ作成 | 既存継続（PlushChangeModule） |
| ソフビ風フィギュア作成 | 新規 |
| タイムスリップアルバム | Coming Soon表示 |
| ぬいぐるみ試着 | 非表示（コード維持） |

---

## ファイル構成

現在の `src/App.tsx`（1436行）を以下に分割する。

```
src/
  App.tsx                    # タブ切り替えのみ
  modules/
    TryOnModule.tsx          # AI試着（既存移動）
    PlushModule.tsx          # ぬいぐるみ試着（非表示・コード維持）
    PlushChangeModule.tsx    # ぬいぐるみ作成（既存移動）
    SofubiModule.tsx         # ソフビ風フィギュア（新規）
    LineStampModule.tsx      # LINEスタンプ（新規）
    ComingSoonModule.tsx     # タイムスリップ用プレースホルダー
  lib/
    api.ts                   # requestNanoBanana, transcribeWithWhisper
    image.ts                 # captureStill, compressImage, normalizeImageToSize等
    supabase.ts              # uploadToSupabase, generateQrDataUrl
  hooks/
    useOmikuji.ts            # useOmikujiOverlay
  components/
    OmikujiOverlay.tsx
  constants/
    prompts.ts               # 全プロンプト定数
    stamps.ts                # LINEスタンプ テキスト一覧
```

---

## タブ構成

```tsx
type Tab = 'tryon' | 'stamp' | 'plush-change' | 'sofubi' | 'timeslip'
// 'plush' は非表示だがコード・コンポーネントは維持
```

| タブキー | 表示名 | 状態 |
|---------|--------|------|
| `tryon` | AI試着 | 表示 |
| `stamp` | LINEスタンプ | 表示 |
| `plush-change` | ぬいぐるみ作成 | 表示 |
| `sofubi` | ソフビ | 表示 |
| `timeslip` | タイムスリップ | 表示（Coming Soon） |
| `plush` | ぬいぐるみ試着 | 非表示 |

UIデザイン未確定のため、タブは現行スタイルに合わせたシンプルな折り返しグリッドで実装する。

---

## 各モジュール仕様

### TryOnModule（既存）
変更なし。ファイル分割のみ。

### PlushChangeModule（既存 → ぬいぐるみ作成）
変更なし。ファイル分割のみ。タブ表示名を「ぬいぐるみ作成」とする。

### LineStampModule（新規）

**フロー:**
1. カメラ撮影（`captureStill()` 流用）
2. テキスト一覧から選択（またはランダムボタン）
3. Gemini APIへ「テキスト込みスタンプ風イラスト」として1枚生成リクエスト
4. Supabaseアップロード → QRコード生成・表示

**テキスト一覧（`constants/stamps.ts`）:**
```ts
export const STAMP_TEXTS = [
  'おはようございます',
  'ありがとうございます！',
  '承知しました',
  '了解です！',
  '確認します',
  '少々お待ちください',
  'おつかれさまです',
  'お願いします！',
  '今向かいます',
  'すみません！',
  '完了しました！',
  '考え中…',
]
```

**プロンプト方針:**
- AIにテキスト込みで1枚生成させる（Bプラン）
- テキストが誤字・崩れる場合はCプラン（デザイナー作成テキスト素材のオーバーレイ）またはAプラン（Canvas装飾テキスト）を提案
- スタイル：資料のイラスト風（ポップ・白縁・丸みキャラクター）

**初期実装は1枚ずつ生成**で検証。品質・精度を確認後に複数枚一括生成を検討。

### SofubiModule（新規）

**フロー:** LineStampModule同様（テキスト選択UIなし）

**実装方針:** `PlushChangeModule` はぬいぐるみ作成機能としてそのまま維持する。`SofubiModule` は `PlushChangeModule` の構造を**参考に**した**独立した新規コンポーネント**として実装する。スタイル選択UI（3択）はなし、単一スタイル構成。

**プロンプト（暫定）:**
```
入力画像の人物の顔・髪型・服装・雰囲気を保持したまま、昭和レトロなソフビ風コレクタブルフィギュアとして変換せよ。
全身をやや頭でっかちにデフォルメし、ツヤ感のある硬質ビニール素材感・彩色のはっきりした輪郭線・影の少ない均一な塗装表現で再現すること。
箱入りパッケージや限定版トイのような商品感を持たせ、雑貨・アートトイの世界観で仕上げよ。
人間の写実的な皮膚・毛髪・質感は一切残さず、すべてソフビフィギュアの造形・塗装として解釈すること。
最終的に1体のソフビフィギュアのみを生成し、Base64文字列のみを返せ。テキスト・JSON・Markdownは禁止。
```

### ComingSoonModule（新規）
タイムスリップアルバムのプレースホルダー。「Coming Soon」テキストと簡単な説明のみ表示。カメラ・API呼び出しなし。

---

## lib/ の責務分割

### `lib/api.ts`
- `requestNanoBanana(prompt, imageBlob, refBlob?)`
- `transcribeWithWhisper(audioBlob)`

### `lib/image.ts`
- `captureStill(video)`
- `compressImage(blob, maxSize?, quality?)`
- `normalizeImageToSize(blob, targetWidth?, targetHeight?, quality?)`
- `blobToBase64(blob)`
- `base64ToBlob(base64, mime?)`
- `base64ToObjectUrl(base64)`
- `isLikelyBase64(text)`
- `isValidBase64Image(base64)`

### `lib/supabase.ts`
- `uploadToSupabase(blob, prefix, opts?)`
- `generateQrDataUrl(text)`

### `hooks/useOmikuji.ts`
- `useOmikujiOverlay()` → `{ omikujiUrl, omikujiVisible, omikujiKey, triggerOmikuji, resetOmikuji }`

### `components/OmikujiOverlay.tsx`
- `OmikujiOverlay({ url, visible, fadeKey, onClose })`

### `constants/prompts.ts`
- 既存の全プロンプト定数を移動
- `SOFUBI_PROMPT` を追加
- `LINE_STAMP_PROMPT_BASE` を追加

---

## 共通仕様（変更なし）

- Supabase経由QRコード導線：継続
- 画像フォーマット：JPEG（Base64）
- APIエンドポイント：Gemini 2.5 Flash（`VITE_NANO_BANANA_URL`）
- エラー時：再生成ボタンを表示
- おみくじオーバーレイ：各モジュールに継続実装

---

## 非表示機能の扱い

`PlushModule`（ぬいぐるみ試着）はコンポーネントとしてファイルに残すが、`App.tsx` のタブ一覧から除外する。先方UIデザイン確定後に表示・非表示を切り替えられる状態にしておく。
