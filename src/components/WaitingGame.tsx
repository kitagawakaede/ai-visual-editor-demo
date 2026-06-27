import { useState, useEffect, useRef, useCallback } from 'react'

type GameType = 'mole' | 'timing'

interface Props {
  visible: boolean
  onClose: () => void
}

export function WaitingGame({ visible, onClose }: Props) {
  const [gameType, setGameType] = useState<GameType>('mole')
  const [score, setScore] = useState(0)
  const [finalScore, setFinalScore] = useState<number | null>(null)
  const [round, setRound] = useState(0)
  const prevVisible = useRef(false)

  useEffect(() => {
    if (visible && !prevVisible.current) {
      setGameType(Math.random() < 0.5 ? 'mole' : 'timing')
      setScore(0)
      setFinalScore(null)
      setRound(r => r + 1)
    }
    if (!visible && prevVisible.current) {
      setFinalScore(score)
    }
    prevVisible.current = visible
  }, [visible, score])

  // Show final score overlay after generation
  if (!visible && finalScore !== null) {
    return (
      <div
        className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4"
        style={{ background: 'rgba(0,0,0,0.92)' }}
      >
        <p className="text-white/60 text-[13px]">生成完了！ゲーム結果</p>
        <div className="flex flex-col items-center gap-1">
          <span className="text-[60px] font-bold" style={{ color: '#fcc800' }}>{finalScore}</span>
          <span className="text-white text-[16px]">点</span>
        </div>
        <button
          className="mt-2 px-6 py-2 rounded-full text-[13px] font-bold"
          style={{ background: '#fcc800', color: '#2a1905' }}
          onClick={() => setFinalScore(null)}
        >
          閉じる
        </button>
      </div>
    )
  }

  if (!visible) return null

  return (
    <div className="absolute inset-0 z-20 flex flex-col" style={{ background: 'rgba(0,0,0,0.92)' }}>
      <div className="flex items-center justify-between px-3 pt-2 pb-1 shrink-0">
        <div className="flex flex-col">
          <span className="text-white/60 text-[10px]">生成中... 暇つぶしゲーム</span>
          <span className="text-[15px] font-bold" style={{ color: '#fcc800' }}>スコア: {score}</span>
        </div>
        <button
          className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-[14px]"
          style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <div className="flex-1 flex flex-col min-h-0">
        {gameType === 'mole'
          ? <MoleGame key={`mole-${round}`} score={score} setScore={setScore} />
          : <TimingGame key={`timing-${round}`} score={score} setScore={setScore} />
        }
      </div>
    </div>
  )
}

// ── モグラ叩き（ランダム位置出現・レベルアップ対応）──────────
type Mole = { id: number; x: number; y: number }

function MoleGame({ score, setScore }: { score: number; setScore: React.Dispatch<React.SetStateAction<number>> }) {
  const level = Math.min(Math.floor(score / 8) + 1, 5)
  const numMoles = Math.min(level + 1, 4)
  const [moles, setMoles] = useState<Mole[]>([])
  const [hits, setHits] = useState<{ id: number; x: number; y: number }[]>([])
  const [showLevelUp, setShowLevelUp] = useState(false)
  const prevLevel = useRef(1)
  const nextId = useRef(0)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const speedCfg = useRef({ visible: 1000, gap: 650 })
  speedCfg.current = {
    visible: Math.max(450, 1000 - (level - 1) * 120),
    gap: Math.max(180, 650 - (level - 1) * 100),
  }

  useEffect(() => {
    if (level > prevLevel.current && level > 1) {
      prevLevel.current = level
      setShowLevelUp(true)
      setTimeout(() => setShowLevelUp(false), 1200)
    }
  }, [level])

  const spawnLoop = useCallback(() => {
    const id = nextId.current++
    const x = 8 + Math.random() * 78   // %  （中心アンカー）
    const y = 12 + Math.random() * 74
    setMoles(prev => [...prev, { id, x, y }])
    const hide = setTimeout(() => {
      setMoles(prev => prev.filter(m => m.id !== id))
      const next = setTimeout(spawnLoop, speedCfg.current.gap + Math.random() * 250)
      timersRef.current.push(next)
    }, speedCfg.current.visible + Math.random() * 250)
    timersRef.current.push(hide)
  }, [])

  useEffect(() => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
    setMoles([])
    for (let i = 0; i < numMoles; i++) {
      const t = setTimeout(spawnLoop, 300 + i * 500)
      timersRef.current.push(t)
    }
    return () => { timersRef.current.forEach(clearTimeout); timersRef.current = [] }
  }, [numMoles, spawnLoop])

  const whack = (m: Mole, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation()
    setMoles(prev => prev.filter(x => x.id !== m.id))
    setScore(s => s + 1)
    setHits(prev => [...prev, { id: m.id, x: m.x, y: m.y }])
    setTimeout(() => setHits(prev => prev.filter(h => h.id !== m.id)), 250)
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-center gap-2 h-6 shrink-0 pt-1">
        <span className="text-white/50 text-[10px]">Lv.{level}</span>
        {showLevelUp
          ? <span className="text-[12px] font-bold" style={{ color: '#fcc800' }}>レベルアップ！🔥</span>
          : <span className="text-white/40 text-[10px]">あと{8 - (score % 8)}点でLv.{Math.min(level + 1, 5)}</span>
        }
      </div>
      <p className="text-white/60 text-[10px] text-center shrink-0">モグラが出たらタップ！</p>
      <div className="flex-1 relative" style={{ overflow: 'hidden' }}>
        {showLevelUp && (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none"
            style={{ animation: 'levelUpPop 1200ms ease-out forwards' }}
          >
            <span
              className="font-extrabold text-center leading-none"
              style={{
                fontSize: 52, color: '#fcc800',
                textShadow: '0 0 20px rgba(252,200,0,0.8), 0 4px 12px rgba(0,0,0,0.6)',
              }}
            >
              レベルアップ！
            </span>
            <span style={{ fontSize: 40, marginTop: 4 }}>🔥</span>
            <span className="text-white font-bold mt-1" style={{ fontSize: 22 }}>Lv.{level}</span>
          </div>
        )}
        {hits.map(h => (
          <span
            key={`hit-${h.id}`}
            className="absolute flex items-center justify-center pointer-events-none"
            style={{
              left: `${h.x}%`, top: `${h.y}%`, width: 64, height: 64, fontSize: 36,
              transform: 'translate(-50%, -50%)',
            }}
          >💥</span>
        ))}
        {moles.map(m => (
          <button
            key={m.id}
            onClick={(e) => whack(m, e)}
            onTouchEnd={(e) => whack(m, e)}
            className="absolute flex items-center justify-center rounded-full"
            style={{
              left: `${m.x}%`, top: `${m.y}%`, width: 64, height: 64, fontSize: 36,
              background: '#ff9f43',
              boxShadow: '0 4px 14px rgba(255,159,67,0.55)',
              transform: 'translate(-50%, -50%)',
              touchAction: 'manipulation',
              cursor: 'pointer',
              animation: 'molePop 120ms ease-out',
            }}
          >
            🐹
          </button>
        ))}
      </div>
      <style>{`@keyframes molePop{from{transform:translate(-50%,-50%) scale(0.5);}to{transform:translate(-50%,-50%) scale(1);}}@keyframes levelUpPop{0%{transform:scale(0.3);opacity:0;}15%{transform:scale(1.15);opacity:1;}30%{transform:scale(1);}80%{transform:scale(1);opacity:1;}100%{transform:scale(1.1);opacity:0;}}`}</style>
    </div>
  )
}

// ── タイミングタップ ────────────────────────────────────
function TimingGame({ score, setScore }: { score: number; setScore: React.Dispatch<React.SetStateAction<number>> }) {
  const [pos, setPos] = useState(0)              // 0〜100 のバー位置
  const [flash, setFlash] = useState<'hit' | 'miss' | null>(null)
  const dir = useRef(1)
  // スコアが上がるほどゾーンが狭く・バーが速くなる
  const cfg = useRef({ zoneHalf: 16, speed: 1.2 })
  cfg.current = {
    zoneHalf: Math.max(5, 16 - score * 0.7),
    speed: Math.min(3.2, 1.2 + score * 0.13),
  }

  useEffect(() => {
    const t = setInterval(() => {
      setPos(p => {
        let np = p + dir.current * cfg.current.speed
        if (np >= 100) { np = 100; dir.current = -1 }
        if (np <= 0) { np = 0; dir.current = 1 }
        return np
      })
    }, 16)
    return () => clearInterval(t)
  }, [])

  const tap = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const hit = Math.abs(pos - 50) <= cfg.current.zoneHalf
    if (hit) setScore(s => s + 1)
    setFlash(hit ? 'hit' : 'miss')
    setTimeout(() => setFlash(null), 280)
  }

  const zoneHalf = cfg.current.zoneHalf

  return (
    <button
      onClick={tap}
      onTouchStart={tap}
      className="flex-1 relative flex flex-col items-center justify-center gap-5"
      style={{ overflow: 'hidden', touchAction: 'manipulation', cursor: 'pointer', background: 'transparent' }}
    >
      <p className="text-white/60 text-[11px]">中央の黄色ゾーンでタップ！</p>

      {/* トラック */}
      <div
        className="relative rounded-full"
        style={{ width: '80%', height: 26, background: 'rgba(255,255,255,0.12)' }}
      >
        {/* 中央ゾーン */}
        <div
          className="absolute top-0 bottom-0 rounded-full"
          style={{
            left: `${50 - zoneHalf}%`,
            width: `${zoneHalf * 2}%`,
            background: 'rgba(252,200,0,0.85)',
            boxShadow: '0 0 12px rgba(252,200,0,0.6)',
          }}
        />
        {/* 動くマーカー */}
        <div
          className="absolute top-1/2 rounded-full"
          style={{
            left: `${pos}%`,
            width: 10, height: 38,
            background: '#fff',
            transform: 'translate(-50%, -50%)',
            boxShadow: '0 0 8px rgba(255,255,255,0.9)',
          }}
        />
      </div>

      <span
        className="font-bold"
        style={{
          fontSize: 18,
          minHeight: 24,
          color: flash === 'hit' ? '#fcc800' : flash === 'miss' ? '#ff6b6b' : 'transparent',
        }}
      >
        {flash === 'hit' ? 'ナイス！+1' : flash === 'miss' ? 'ミス…' : '　'}
      </span>
    </button>
  )
}
