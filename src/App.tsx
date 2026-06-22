import { useState } from 'react'
import { TryOnModule } from './modules/TryOnModule'
import { PlushChangeModule } from './modules/PlushChangeModule'
import { SofubiModule } from './modules/SofubiModule'
import { LineStampModule } from './modules/LineStampModule'
import { ComingSoonModule } from './modules/ComingSoonModule'

type Tab = 'tryon' | 'stamp' | 'plush-change' | 'sofubi' | 'timeslip'

const spBackground = new URL('./assets/UI/sp_bg.png', import.meta.url).href
const wearLogo = new URL('./assets/UI/wear_am_i_logo-01 1.png', import.meta.url).href
const tclLogo = new URL('./assets/UI/TCL_logo.png', import.meta.url).href
const titleFrame = new URL('./assets/UI/Frame 2.png', import.meta.url).href

const TABS: { key: Tab; label: string }[] = [
  { key: 'tryon', label: 'AI試着' },
  { key: 'stamp', label: 'LINEスタンプ' },
  { key: 'plush-change', label: 'ぬいぐるみ作成' },
  { key: 'sofubi', label: 'ソフビ' },
  { key: 'timeslip', label: 'タイムスリップ' },
]

function App() {
  const [tab, setTab] = useState<Tab>('tryon')

  return (
      <div
        className="px-4 pt-4 pb-12 shadow-[0_18px_30px_rgba(0,0,0,0.15)]"
        style={{
          position: 'relative',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '440px',
          minHeight: '100vh',
          backgroundColor: '#fcc800',
          backgroundImage: `url(${spBackground})`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center 100px',
          backgroundSize: '440px auto',
        }}
      >
        <div className="flex flex-col gap-3.5">
          <header className="grid grid-cols-[1fr_auto_1fr] items-center text-[11px] font-bold uppercase tracking-[0.08em]">
            <div className="inline-flex items-center gap-1.5">
              <img className="h-[20px] w-auto" src={wearLogo} alt="wear am i logo" />
            </div>
            <div className="flex items-center justify-center">
              <img className="h-[26px] w-auto" src={titleFrame} alt="text lens frame" />
            </div>
            <div className="inline-flex items-center gap-1.5 justify-end text-right">
              <img className="h-[20px] w-auto" src={tclLogo} alt="toyousu creation lab logo" />
            </div>
          </header>

          <section className="bg-[#ffedab] rounded-[16px] px-3 py-2 shadow-[0_10px_20px_rgba(0,0,0,0.18)] flex flex-col gap-2">
            <div>
              <p className="text-[12px] font-bold">テキストレンズ</p>
              <p className="font-['Bebas_Neue'] text-[22px] tracking-[0.08em]">TRY ON CHARENGE</p>
            </div>
            <div className="flex flex-wrap justify-center gap-1.5">
              {TABS.map(({ key, label }) => (
                <button
                  key={key}
                  className={`w-[calc(33.333%-6px)] border-2 rounded-[8px] py-2 px-1.5 text-[11px] font-medium transition active:translate-y-[1px] ${
                    tab === key
                      ? 'bg-[#7eb8ff] text-[#0b1b3a] border-transparent'
                      : 'bg-transparent border-[#2a1905]'
                  }`}
                  onClick={() => setTab(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          {tab === 'tryon' && <TryOnModule />}
          {tab === 'stamp' && <LineStampModule />}
          {tab === 'plush-change' && <PlushChangeModule />}
          {tab === 'sofubi' && <SofubiModule />}
          {tab === 'timeslip' && <ComingSoonModule />}
        </div>
      </div>
  )
}

export default App
