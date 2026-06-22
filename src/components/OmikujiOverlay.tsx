export function OmikujiOverlay({
  url,
  visible,
  fadeKey,
  onClose,
}: {
  url: string | null
  visible: boolean
  fadeKey?: number
  onClose?: () => void
}) {
  if (!url) return null
  return (
    <div
      key={fadeKey}
      className="absolute inset-0 flex items-center justify-center z-20"
      style={{
        opacity: visible ? 1 : 0,
        animation: visible ? 'omikujiFade 900ms ease forwards' : 'none',
      }}
    >
      {onClose && (
        <button
          className="absolute top-3 right-3 w-9 h-9 rounded-full border border-white/30 bg-[rgba(0,0,0,0.55)] text-white text-lg font-bold shadow-md"
          onClick={onClose}
          aria-label="おみくじを閉じる"
        >
          ×
        </button>
      )}
      <img
        className="max-w-[92%] max-h-[92%] object-contain rounded-[16px]"
        src={url}
        alt="おみくじ"
      />
    </div>
  )
}
