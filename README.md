# AIビジュアルエディター (デモ)

React + TypeScript + Vite で構築した、3つのAI機能をまとめた Web デモアプリです。

- AI試着：Whisper で音声指示 → 撮影 → nano-banana で色変更
- ぬいぐるみ制作：人物とぬいぐるみを撮影し、服を転写
- 顔フィルター：MediaPipe FaceLandmarker + CSS/Canvas でリアルタイムフィルター

## セットアップ

```bash
npm install
cp .env.example .env
```

`.env` に以下を設定してください。

- `VITE_NANO_BANANA_URL` / `VITE_NANO_BANANA_API_KEY`：nano-banana の画像編集API
- `VITE_WHISPER_URL` / `VITE_WHISPER_API_KEY`：Whisper API（録音後の音声文字起こしに使用）
- `VITE_FACE_REGION` / `VITE_FACE_API_KEY`：リアルタイム顔フィルター用 Azure Face-like API（`https://{REGION}.api.cognitive.microsoft.com/face/v1.0/process_attributes`）

※ フロントから直接APIキーを使うため、デモ用途限定です。

## 開発サーバー

```bash
npm run dev
```

ブラウザを開くとカメラ/マイクの許可を求められます。各タブごとに機能を切り替え可能です。
