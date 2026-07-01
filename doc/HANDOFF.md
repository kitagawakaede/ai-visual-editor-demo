# セッション引き継ぎドキュメント

> 更新日: 2026-07-01
> 直近ブランチ: `feature/timeslip-label-update`（PR #22 オープン中・未マージ）
> ベース: `main`（PR #15〜#21 反映済み）

---

## プロジェクト概要

**TEXTLENS 27SS展示会向けデモアプリ**
React 19 + TypeScript + Vite。カメラで撮影した人物写真をAIで変換する5機能。

- 開発リリース目標: 6月30日（経過）／ 社内お披露目: 7月6日 ／ 展示会本番: 7月13日
- 関連ドキュメント: [27SS_new_requirements.md](27SS_new_requirements.md)
- デプロイ: Vercel（mainへのpushで自動デプロイ）

---

## 機能別の現状（エンジン / 生成方式）

各機能は画面右上の**アイコントグル（`EngineToggle`）で Gemini ⇔ OpenAI を切替**可能（選択=黒背景／未選択=白背景）。既定は下表。

| 機能(タブ) | 既定エンジン | 参照画像 | OpenAI設定 | 備考 |
|------|--------|---------|------|------|
| LINE STAMP | **OpenAI** | なし（本人写真のみ） | moderation:low / quality:medium | 6枚グリッド一括。文字精度優先でOpenAI |
| TOY(ぬいぐるみ) | OpenAI(gpt-image-1.5) | あり | 未指定(auto) | 今セッション未変更 |
| FIGURE(ソフビ) | **OpenAI** | **なし・パディングなし** | moderation:low / quality:medium | 高速化のため参照/pad廃止 |
| ALBUM(タイムスリップ) | **Gemini** | **なし（全項目テキスト）** | 子ども=low/low, 大人=low/medium | 年代別9枠。詳細は下記 |
| AI試着 | Gemini(.env URL) | あり | - | 今セッション未変更 |

- OpenAI呼び出し `requestOpenAIImageEdit`（[api.ts](../src/lib/api.ts)）に **`moderation`('auto'|'low')** と **`quality`('auto'|'low'|'medium'|'high')** 引数を追加済み。
- 生成エンジンは各モジュール内 `useState` の `useGemini` で保持（旧 `USE_GEMINI` 定数は廃止）。
- 環境変数: `VITE_NANO_BANANA_API_KEY` + `VITE_NANO_BANANA_URL`（Gemini）／`VITE_OPENAI_API_KEY`（性別判定・OpenAI生成）／`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`（QR用アップロード）。

---

## タイムスリップ（年代別リニューアル：現行仕様）

[TimeSlipModule.tsx](../src/modules/TimeSlipModule.tsx) / [prompts.ts](../src/constants/prompts.ts)

**9枠（3×3グリッド・並び順）:**

| | 左 | 中 | 右 |
|---|---|---|---|
| 1段目 | 赤ちゃん時代 | 小学一年生 | 超優秀高校生時代 |
| 2段目 | やんちゃ時代 | 1960's | 1970's |
| 3段目 | 1980's | 1990's | 2000's |

- **全項目テキストのみ生成（参照画像なし）** → 別人の顔が混入せず本人の顔を保持。
- **性別自動判定**（`detectGenderFromImage` @ [api.ts](../src/lib/api.ts)、**gpt-4o**）で年代別に **レディース/メンズを出し分け**。各プロンプト冒頭に「必ず男性/女性として描く」と明記して性別ブレを防止。
- **赤ちゃん・小学一年生**: Geminiの子ども安全ポリシーで生成不可のため、`useGemini` に関わらず**常にOpenAI**（`moderation:low`）。プロンプト `timeSlipChildBase`＝「大人の顔のまま体だけ子ども」。
- **やんちゃ時代**（旧・非行暴走族）: テキスト・性別出し分け。暴力的表現を排除し「レトロなファッションとしての暴走族」に。
- **超優秀高校生時代**: 先方仕様。男女共通（紺ブレ＋ネクタイ＋メガネ＋右手に教科書）、現在の顔＋高校生の体、地味・勉強熱心な印象。
- **1950's は削除済み**。
- 旧9年代（昭和レトロ等）は `TIME_SLIP_ITEMS_LEGACY` として**コードに温存**（未使用）。
- **QR共有画像**: 9枚を canvas合成→Supabaseアップロード→QR。合成は**上端揃え**で頭切れ防止、`maxSize:1440 / quality:0.82` で高解像度アップ。

---

## 生成時間 / エンジン方針（先方に共有済み・提案）

- **ソフビ → OpenAI**（40秒→22秒に短縮・精度維持。Geminiは8秒だが品質が要件未達）
- **タイムスリップ → Gemini（一部OpenAI）**（27秒・精度維持。OpenAI全枚だと47秒）
- **LINEスタンプ → OpenAI**（文字化けせず精度高い・約24秒。Geminiは日本語が大きく崩れる）
- **ヘアスタイル診断 → Gemini**（実測 約14秒。OpenAI/ChatGPTだと約1分）

---

## PR履歴（すべて main 反映済み。#22のみオープン）

- #15: タイムスリップ完成・生成エンジン切替・UIリニューアル（背景/ロゴ UI2、アイコンタブ）
- #16〜#19: LINEスタンプ OpenAI(quality:medium)化の調整
- #20: スタンプ文言「了解！→りょ！」「感謝です→ありがと」
- #21: タイムスリップ年代別リニューアル／男女判定gpt-4o化／QR頭切れ修正／構成変更
- **#22（オープン中）**: ラベル変更（やんちゃ時代／超優秀高校生時代）＋エンジン切替アイコン化（`EngineToggle`）

---

## 主要ファイル

- [prompts.ts](../src/constants/prompts.ts): 全プロンプト。`TIME_SLIP_ITEMS`(新9枠) / `TIME_SLIP_ITEMS_LEGACY`(旧・温存) / `timeSlipEraBase` / `eraItem`(性別出し分け) / `timeSlipChildBase` / `SOFUBI_PROMPT`(_NO_REF) / `buildLineStampGridPrompt` 等
- [api.ts](../src/lib/api.ts): `requestOpenAIImageEdit`(moderation/quality対応) / `requestNanoBanana`(Gemini) / `detectGenderFromImage`(gpt-4o)
- [supabase.ts](../src/lib/supabase.ts): `uploadToSupabase`(maxSize/quality対応)
- [components/EngineToggle.tsx](../src/components/EngineToggle.tsx): エンジン切替アイコン（`src/assets/エンジン/`）
- [components/WaitingGame.tsx](../src/components/WaitingGame.tsx): 生成待機ゲーム

---

## 残タスク / 未決

- [ ] **PR #22 のマージ**（ラベル変更＋エンジンアイコン）
- [ ] エンジンアイコンの **Gemini/OpenAI マスコット割り当て**の最終確認（現状 Gemini=ハリネズミ風／OpenAI=三角生物。逆なら入替）
- [ ] 年代別プロンプトの微調整（先方フィードバック次第）
- [ ] TOY(ぬいぐるみ)・AI試着 のエンジン方針（現状未変更）
- [ ] 各機能確定後の最終UI調整
- [ ] `doc/test_sofubi.py` / `doc/sofubi_test_output*.png`（テスト用・未追跡）はコミット対象外推奨

---

## 起動

```bash
git checkout main && git pull
npm install
npm run dev   # http://localhost:5173
```
