# セッション引き継ぎドキュメント

> 作成日: 2026-06-23
> ブランチ: `feature/27ss-features`
> ベース: `main`

---

## プロジェクト概要

**TEXTLENDS 27SS展示会向けデモアプリ**
React 19 + TypeScript + Vite。カメラで撮影した人物写真をAIで変換する機能群。

- 開発リリース目標: **6月30日**
- 先方社内お披露目: 7月6日
- 展示会本番: 7月13日

---

## 現在のブランチ状態

`feature/27ss-features` で作業中。まだ main にマージしていない。

---

## 実装済み機能（このブランチで追加）

### ファイル構成（App.tsxから分割済み）

```
src/
  App.tsx                      # タブ切り替えのみ（87行）
  modules/
    TryOnModule.tsx            # AI試着（既存・継続）
    PlushModule.tsx            # ぬいぐるみ試着（非表示・コード維持）
    PlushChangeModule.tsx      # ぬいぐるみ作成（既存・継続）
    SofubiModule.tsx           # ソフビ風フィギュア（新規）
    LineStampModule.tsx        # LINEスタンプ（新規）
    ComingSoonModule.tsx       # タイムスリップ Coming Soon
  lib/
    api.ts                     # requestNanoBanana, requestOpenAIImageEdit, transcribeWithWhisper
    image.ts                   # 画像処理ユーティリティ
    supabase.ts                # Supabaseアップロード + QR生成
    error.ts                   # logError
  constants/
    prompts.ts                 # 全プロンプト定数（日本語・英語混在）
    stamps.ts                  # LINEスタンプテキスト12種
  hooks/
    useOmikuji.ts              # おみくじオーバーレイ hook
  components/
    OmikujiOverlay.tsx
```

### タブ構成

| タブキー | 表示名 | API |
|---------|--------|-----|
| `tryon` | AI試着 | Gemini 2.5 Flash |
| `stamp` | LINEスタンプ | OpenAI gpt-image-1 |
| `plush-change` | ぬいぐるみ作成 | Gemini 2.5 Flash |
| `sofubi` | ソフビ | OpenAI gpt-image-1 |
| `timeslip` | タイムスリップ | Coming Soon表示のみ |

---

## 環境変数（.env）

```
VITE_NANO_BANANA_URL=https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent
VITE_NANO_BANANA_API_KEY=...      # Gemini API キー
VITE_WHISPER_API_KEY=...          # OpenAI Whisper用
VITE_OPENAI_API_KEY=...           # OpenAI gpt-image-1用（ソフビ・LINEスタンプ）
VITE_SUPABASE_ANON_KEY=...
VITE_SUPABASE_URL=...
```

---

## 各機能の実装詳細

### ソフビ（SofubiModule）

- **API**: OpenAI `/v1/images/edits`、モデル `gpt-image-1`、サイズ `1024x1536`
- **参照画像**: `src/assets/ref_sofubi.png`（箱入りフィギュア画像、テキスト部クロップ済み）
- **入力画像前処理**: カメラキャプチャの下に80%のベージュ余白を追加（`padImageForFullBody`）→ 上半身のみ撮影でも全身フィギュアを生成
- **プロンプト**: 英語（`SOFUBI_PROMPT`）。2枚画像の役割を明示、全身・箱前・白箱+タン背景を指示
- **結果表示**: `object-fit: contain` でフレーム内に収める（クロップなし）

### LINEスタンプ（LineStampModule）

- **API**: OpenAI `/v1/images/edits`、モデル `gpt-image-1`
- **参照画像**: `src/assets/ref_stamp.png`（12枚スタンプグリッド、テキスト部クロップ済み）
- **テキスト方式**: AIはキャラクターのみ生成（テキストなし）→ Canvas APIでテキストをオーバーレイ（`overlayTextOnStamp`）
- **テキスト一覧**: `src/constants/stamps.ts`（12種固定、ランダムボタンあり）
- **プロンプト**: `LINE_STAMP_PROMPT_BASE`（日本語。`{TEXT}`プレースホルダーなし）

### ぬいぐるみ作成（PlushChangeModule）

- **API**: Gemini 2.5 Flash（`requestNanoBanana`）
- 既存の `PlushChangeModule` をそのまま維持。スタイル3択UI（羊毛フェルト/ドット絵/布製）

---

## 現在未解決の問題

### 🔴 アプリの横位置がずれている（重要）

デスクトップブラウザで表示すると、黄色パネルが画面中央よりやや**右寄り**に表示される。

**これまで試したこと（すべて効果なし）:**
- `flex justify-center` on `#root`
- `mx-auto` / `margin: 0 auto`
- `calc(50vw - 220px)` / `calc(50vw - 228px)`
- `width: 100vw` wrapper with flex
- `position: relative; left: 50%; transform: translateX(-50%)` ← **現在の実装**

**根本原因の仮説:**
- Tailwind v4 CDN（`https://cdn.tailwindcss.com` がindex.htmlに含まれる）が何らかのスタイルを上書きしている可能性
- ブラウザのスクロールバー幅の影響

**推奨される次のアプローチ:**
1. Chrome DevToolsで実際に `#root` と黄色パネルの `left` / `margin` 値を確認
2. Tailwind CDNを外してみる（`index.html` の `<script src="https://cdn.tailwindcss.com">` を削除）
3. または、`overflow-x: hidden` を `html` に設定してスクロールバーを排除してから試す

**現在のApp.tsx該当コード（27-40行）:**
```tsx
<div
  style={{
    position: 'relative',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '440px',
    minHeight: '100vh',
    ...
  }}
>
```

---

## 先方への未確認事項

`doc/27SS_features_implementation.md` の打ち合わせアジェンダを参照。
主な残確認事項：
- 使用デバイス・画面サイズ
- 展示会場のネットワーク環境
- UIデザイン確定時期
- LINEスタンプのテキスト最終確定リスト
- おみくじ演出の継続/更新可否

---

## 起動方法

```bash
git checkout feature/27ss-features
npm install
npm run dev
# → http://localhost:5173
```

---

## 参考ファイル

| ファイル | 内容 |
|---------|------|
| `doc/27SS_features_implementation.md` | 機能仕様・確認事項・スケジュール |
| `docs/superpowers/specs/2026-06-22-27ss-features-design.md` | 設計仕様書 |
| `docs/superpowers/plans/2026-06-22-27ss-features.md` | 実装プラン |
| `doc/test_sofubi.py` | ソフビAPIテストスクリプト（doc/sofubi_test_output*.pngを出力） |
