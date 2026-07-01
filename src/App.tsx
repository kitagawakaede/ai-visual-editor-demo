import { useState } from 'react'
import { TryOnModule } from './modules/TryOnModule'
import { PlushChangeModule } from './modules/PlushChangeModule'
import { SofubiModule } from './modules/SofubiModule'
import { LineStampModule } from './modules/LineStampModule'
import { TimeSlipModule } from './modules/TimeSlipModule'
import { HairStyleModule } from './modules/HairStyleModule'

type Tab = 'tryon' | 'stamp' | 'plush-change' | 'sofubi' | 'timeslip' | 'hair'

const spBackground = new URL('./assets/UI/UI2/image.png', import.meta.url).href
const wearLogo = new URL('./assets/UI/UI2/wear_am_i_logo-01 1.png', import.meta.url).href
const tclLogo = new URL('./assets/UI/UI2/TCL_logo.png', import.meta.url).href
const titleFrame = new URL('./assets/UI/UI2/image copy.png', import.meta.url).href

// 機能切り替えボタンのアイコン（src/assets/UI/UI2/button/）
const iconStamp = new URL('./assets/UI/UI2/button/image.png', import.meta.url).href
const iconToy = new URL('./assets/UI/UI2/button/image copy.png', import.meta.url).href
const iconFigure = new URL('./assets/UI/UI2/button/image copy 2.png', import.meta.url).href
const iconAlbum = new URL('./assets/UI/UI2/button/image copy 3.png', import.meta.url).href
const iconTryon = new URL('./assets/UI/UI2/button/image copy 4.png', import.meta.url).href
const iconHair = new URL('./assets/髪型/image.png', import.meta.url).href

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'stamp', label: 'LINE STAMP', icon: iconStamp },
  { key: 'plush-change', label: 'TOY', icon: iconToy },
  { key: 'sofubi', label: 'FIGURE', icon: iconFigure },
  { key: 'timeslip', label: 'ALBUM', icon: iconAlbum },
  { key: 'tryon', label: 'AI 試着', icon: iconTryon },
  { key: 'hair', label: 'HAIR', icon: iconHair },
]

function App() {
  const [tab, setTab] = useState<Tab>('tryon')
  // 撮影した写真は全機能で共有（一度撮れば別タブへ引き継ぐ）
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null)
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null)
  const handleCapture = (url: string | null, blob: Blob | null) => {
    setCapturedUrl(url)
    setCapturedBlob(blob)
  }
  const capture = { capturedUrl, capturedBlob, onCapture: handleCapture }

  return (
    <div className="min-h-screen w-full bg-[#efe1ae] flex justify-center text-[#2a1905] leading-[1.4]">
      <div
        className="w-full max-w-[440px] min-h-screen px-4 pt-4 pb-12 shadow-[0_18px_30px_rgba(0,0,0,0.15)]"
        style={{
          backgroundColor: '#7ec8ec',
          backgroundImage: `url(${spBackground})`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center top',
          backgroundSize: 'cover',
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
            <div className="flex justify-center gap-1.5">
              {TABS.map(({ key, label, icon }) => (
                <button
                  key={key}
                  className="flex-1 min-w-0 flex flex-col items-center gap-1 transition active:translate-y-[1px]"
                  onClick={() => setTab(key)}
                >
                  <div
                    className={`relative w-full aspect-square rounded-[10px] overflow-hidden transition ${
                      tab === key
                        ? 'ring-[3px] ring-[#7eb8ff] shadow-[0_4px_8px_rgba(0,0,0,0.2)]'
                        : 'ring-1 ring-black/10'
                    }`}
                  >
                    <img src={icon} alt={label} className="w-full h-full object-cover block" />
                    {/* 未選択は黒を薄く重ねて暗くする（選択中はそのまま） */}
                    {tab !== key && <div className="absolute inset-0 bg-black/40" />}
                  </div>
                </button>
              ))}
            </div>
          </section>

          {tab === 'tryon' && <TryOnModule {...capture} />}
          {tab === 'stamp' && <LineStampModule {...capture} />}
          {tab === 'plush-change' && <PlushChangeModule {...capture} />}
          {tab === 'sofubi' && <SofubiModule {...capture} />}
          {tab === 'timeslip' && <TimeSlipModule {...capture} />}
          {tab === 'hair' && <HairStyleModule {...capture} />}
        </div>
      </div>
    </div>
  )
}

export default App
