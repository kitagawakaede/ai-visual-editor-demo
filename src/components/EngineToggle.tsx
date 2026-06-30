// 生成エンジン切替アイコン（Gemini / OpenAI）。
// 画像は選択=黒背景／未選択=白背景の2種を出し分ける。
// Gemini=ハリネズミ風マスコット、OpenAI=三角生物マスコット。
const engineGeminiOff = new URL('../assets/エンジン/image.png', import.meta.url).href // 白背景（未選択）
const engineGeminiOn = new URL('../assets/エンジン/image copy.png', import.meta.url).href // 黒背景（選択）
const engineOpenaiOn = new URL('../assets/エンジン/image copy 2.png', import.meta.url).href // 黒背景（選択）
const engineOpenaiOff = new URL('../assets/エンジン/image copy 3.png', import.meta.url).href // 白背景（未選択）

type Props = {
  useGemini: boolean
  onChange: (useGemini: boolean) => void
  disabled?: boolean
}

export function EngineToggle({ useGemini, onChange, disabled }: Props) {
  return (
    <div className="flex justify-end items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(true)}
        disabled={disabled}
        aria-label="Gemini"
        aria-pressed={useGemini}
        className="w-8 h-8 disabled:opacity-60"
      >
        <img src={useGemini ? engineGeminiOn : engineGeminiOff} alt="Gemini" className="w-full h-full object-contain" />
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        disabled={disabled}
        aria-label="OpenAI"
        aria-pressed={!useGemini}
        className="w-8 h-8 disabled:opacity-60"
      >
        <img src={!useGemini ? engineOpenaiOn : engineOpenaiOff} alt="OpenAI" className="w-full h-full object-contain" />
      </button>
    </div>
  )
}
