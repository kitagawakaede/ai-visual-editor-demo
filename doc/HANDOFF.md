# セッション引き継ぎドキュメント

> 更新日: 2026-06-27
> ブランチ: `feature/sofubi-prompt-improvement`（作業中・**未コミット多数**）
> ベース: `main`

---

## プロジェクト概要

**TEXTLENDS 27SS展示会向けデモアプリ**
React 19 + TypeScript + Vite。カメラで撮影した人物写真をAIで変換する5機能。

- 開発リリース目標: **6月30日** ／ 社内お披露目: 7月6日 ／ 展示会本番: 7月13日
- 関連ドキュメント: [27SS_new_requirements.md](27SS_new_requirements.md)（今回の追加要望と決定事項）

---

## ⚠️ 最重要・未解決課題（次セッションで最優先）

### タイムスリップで「本人の面影が消える」→ プロンプト修正適用済み（実機での生成確認待ち）
- **症状**: 参考画像（2枚目）に写っている**別人の顔ごとコピー**してしまい、本人に似ない。特に **非行・暴走族（bosozoku）** で顕著。
- **原因**: `timeSlipBase`（[prompts.ts](../src/constants/prompts.ts)）が「2枚目の体型・髪型に合わせろ」「顔以外は2枚目に合わせ」と指示しており、顔・髪・体型まで参考画像（別人）から取ってしまっていた。
- **対策（2026-06-27 適用）**: `timeSlipBase` を以下に書き換え済み：
  - **同一性（顔・髪型・髪色・体型）はすべて1枚目の本人から取る**と絶対厳守で指示。
  - **2枚目は「服装・時代・ポーズ・背景・小物・色調」の参照のみ**。2枚目の人物の顔・髪型・体型・容姿のコピーを固く禁止と明記。
  - 体型を変える必要がある **赤ちゃん・小学一年生** は、各 scene 文言で「この年代だけは例外として体型を変える（顔の面影は残す）」と明示。
  - 髪型を別物に置き換えていた **昭和レトロ／70年代（幾何学柄）** の scene は、「本人の髪型は変えず小物・セットで時代感を出す」表現に修正。
- **未確認**: 実機（カメラ＋参考画像＋API）での生成確認はまだ。特に bosozoku で本人に似るか要チェック。年代別の見え方も全件目視確認が必要。
- 参考: LINEスタンプでは同じ問題を「**参考画像を渡さずテキストのみ生成**」で解決済み。タイムスリップは年代再現のため参考画像が要るので、テキスト指示の分離で対処した。

### 赤ちゃん・小学一年生がGeminiで生成失敗 → プロンプト緩和で対応（実機確認待ち）
- **症状**: この2つは子ども生成のためGeminiが安全ポリシーで拒否し「生成失敗」になる。
- 一度「失敗時にOpenAIへ自動フォールバック」を実装したが、**ユーザー要望で削除済み**（フォールバックなし）。
- **Geminiでの検証結果（2026-06-27・NG確定）**: プロンプト緩和を試したが両立不可と判明。
  - 顔を緩める → 生成は通るが「ガチの赤ちゃん／一般的な子ども顔」で本人が消える。
  - 顔を強く保持 → 「大人の顔×子どもの体」がGeminiの子ども安全ポリシーで拒否され生成失敗。
  - → **Geminiではこの2枚で「本人の顔」と「生成成功」を両立できない**。
- **方針決定（2026-06-27・最終）**: この2枚だけ **OpenAI(gpt-image-1.5) + `moderation:'low'`** で生成。
  - `moderation:'low'` = OpenAIの出力モデレーションを緩める正式パラメータ（[api.ts](../src/lib/api.ts) `requestOpenAIImageEdit` に追加）。
  - [TimeSlipModule.tsx](../src/modules/TimeSlipModule.tsx) `generateOne` で `isChild`(=`TIME_SLIP_NO_REF_IDS`) を判定し、本人写真のみ（era参照なし）でOpenAIへ。残り7枚はGeminiのまま。
  - プロンプトは「顔は写真の大人のまま固定／子ども顔への作り替え禁止」の `timeSlipChildBase` を流用。
- **実機確認済み（2026-06-27・OK）**: OpenAI+`moderation:'low'` でこの2枚が「本人の顔×子どもの体」で生成成功。全9枚そろって生成時間は約27秒。

---

## 機能別の現状（モデル / 生成方式）

| 機能 | モデル | 参考画像 | 出力 | 備考 |
|------|--------|---------|------|------|
| AI試着 | Gemini（.env URL） | あり | - | 今回未変更 |
| ぬいぐるみ作成 | gpt-image-1.5（OpenAI） | あり | 1024² | 今回未変更 |
| LINEスタンプ | **Gemini** | **なし（テキストのみ）** | モデル任せ | 6枚グリッド一括／12種からランダム6種 |
| ソフビ | **Gemini** | あり（ref_sofubi） | モデル任せ | 旧OpenAI→Geminiへ。プロンプト大幅調整 |
| タイムスリップ | **Gemini** | あり（年代別9枚） | モデル任せ | 9枚並列／フィルム表示／QR／性別判定 |

- 各モジュール先頭に **`USE_GEMINI` フラグ**あり（`true`=Gemini / `false`=OpenAI）。LINEスタンプ・ソフビ・タイムスリップで切替可能。
- 必要な環境変数: `VITE_NANO_BANANA_API_KEY` + `VITE_NANO_BANANA_URL`（Gemini）／`VITE_OPENAI_API_KEY`（性別判定・OpenAI生成）／`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`（QR用アップロード）。

---

## このセッションでやったこと

### WaitingGame（待機ゲーム）[components/WaitingGame.tsx]（新規）
- **モグラ叩き**: 固定9マス→**ランダム位置出現**、同時最大4匹、**8点ごとLvアップ**、中央に大きな「レベルアップ！」演出、ラウンドごとに`key`を変えて状態リセット。
- 落下タップ→**タイミングタップ**ゲームに差し替え（中央ゾーンでタップ、Lvでゾーン狭小化）。
- モグラ/タイミングを **50/50** で出し分け。
- 全機能（試着・スタンプ・ソフビ・ぬい・タイムスリップ）の生成待機中に表示。

### LINEスタンプ [modules/LineStampModule.tsx]（書き換え）
- 生成を **6枚グリッド一括**（縦長2列×3行）に変更。**12種からランダムで6種**選び生成。
  - 定義: `LINE_STAMP_DEFS`(12) / `pickRandomStamps()` / `buildLineStampGridPrompt()`（[prompts.ts](../src/constants/prompts.ts)）
- **参考画像を渡さず本人写真＋テキストのみ**で生成（参考画像だと別人の顔に引っ張られるため）。
- 画風プロンプトを反復調整 →「本人の再現度を保ちつつ少しゆるキャラ・中くらいの目・なめらか質感」で着地。
- フロントを **LINE購入画面UI** に（QR=MY STAMP、ハート10,000・プレゼント・購入＝ダミー）。**スタンプ部分のみスクロール**。

### タイムスリップ [modules/TimeSlipModule.tsx]（新規）
- `ComingSoonModule` から差し替え（[App.tsx](../src/App.tsx)）。
- **9枚並列生成**（`TIME_SLIP_ITEMS`、参考画像 `src/assets/time/image copy.png`〜`9.png`）。
- フロントは **3×3固定コラージュ（ポラロイド風）**、9枚揃ってから**フェードイン**。
- **QR**: 9枚を1枚のアルバム画像に canvas 合成→Supabaseアップロード→QR生成、ヘッダー右に表示。
- **性別自動判定**（`detectGenderFromImage` @ [api.ts](../src/lib/api.ts)、OpenAI Vision）で **非行・暴走族の参考画像を男女出し分け**（`ギャング/man/image.png` ／ `ギャング/woman/image copy 3.png`）。
- 赤ちゃんプロンプトは安全フィルタ対策で「ベビー服着用・健全」表現に。

### ソフビ [modules/SofubiModule.tsx]（Geminiへ＋プロンプト調整）
- OpenAI→**Gemini**に切替。`SOFUBI_PROMPT`（[prompts.ts](../src/constants/prompts.ts)）を反復調整：
  - 髪の**長さ厳守**（勝手にロング/対称ボブ化を禁止）
  - 顔の立体感を「のっぺり↔リアル過ぎ」の中間に、**目は中くらい＋軽いハイライト**
  - 顔パーツ配置を自然（下半分に寄せない）、**体型はスリム**、**服は布感**（シワ・縫い目、レゴ感禁止）
- ⚠️ プロンプトは**シングルクォート文字列**。英語の `'s` やアポストロフィを入れると構文エラーになるので注意（過去に発生）。

### その他
- [api.ts](../src/lib/api.ts): `detectGenderFromImage()` 追加（失敗時 `woman`）。
- 既存プロンプト（`STAMP_PROMPT_MAP` 等の個別スタンプ、`plushChange*`）は**削除せず温存**（コードのみ残置、未使用化したものあり）。

---

## ファイル変更状況（未コミット）

**変更**: `src/App.tsx` / `src/constants/prompts.ts` / `src/lib/api.ts` / `src/modules/LineStampModule.tsx` / `src/modules/SofubiModule.tsx` / `doc/HANDOFF.md` ／（試着・ぬいは前セッション分の差分）
**新規**: `src/modules/TimeSlipModule.tsx` / `src/components/WaitingGame.tsx` / `doc/27SS_new_requirements.md` / `src/assets/time/`（参考画像・ギャングman/woman）/ `src/assets/スタンプ/image copy 13.png`
**未追跡（要整理）**: `doc/test_sofubi.py` / `doc/sofubi_test_output*.png`（テスト用、コミット対象外推奨）

→ **まだコミット・PRは出していない。** 型チェック・ビルドは通る状態。

---

## 残タスク

- [x] **タイムスリップの本人再現修正**（実機確認OK・別人化なし）
- [x] 赤ちゃん・小学一年生の生成方針決定（OpenAI+moderation:low で本人の顔のまま生成・実機OK）
- [ ] タイムスリップ #4〜#7・#9 の**正式プロンプト**反映（先方待ち）
- [ ] ギャング代表画像の最終確認（man/woman 各3枚から選定済みだが変更可）
- [ ] 各機能確定後の **全体UI修正**
- [ ] コミット・PR作成

---

## 起動

```bash
git checkout feature/sofubi-prompt-improvement
npm install
npm run dev   # http://localhost:5173
```
