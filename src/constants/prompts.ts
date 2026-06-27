export const defaultToyPrompt =
  '直ちにスタイル転写タスクを実行せよ。入力画像の人物が着用する服のスタイル情報（シルエット、形状、パーツ構造、縫い目、フード形状、紐の太さ、袖口のリブ、厚み、素材、質感、布地の特徴、色、模様、プリント、ロゴ位置）を抽出し、その服と同一の外観をぬいぐるみに着せること。服の素材・質感・構造・色・模様を人物の服と完全に一致させ、不足している箇所のみ補完して生成せよ。メガネやアクセサリー類を着用している場合には、入力画像のデザイン・形状・フレームの細部構造を完全に保持し、一切の簡略化を禁止せよ。ぬいぐるみのサイズに合わせて正確にスケール調整を行い、質感は過度な反射を抑えた高品質な樹脂やマットな硬質素材として再現し、ぬいぐるみの顔や体に物理的に固定されているように自然な影を伴って装着させること。最終的に服転写が正しく行われた1枚の最終画像のみを生成し、Base64文字列のみを返せ。テキスト・引用符・Markdown・コードブロックは禁止。'

export const tryOnPromptBase =
  '直ちにスタイル転写タスクを実行せよ。入力画像の人物が着用する服のスタイル情報（シルエット、形状、パーツ構造、縫い目、フード形状、紐の太さ、袖口のリブ、厚み、素材、質感、布地の特徴、色、模様、プリント、ロゴ位置）を抽出し、その服の素材・質感・構造・色・模様を保持したまま、指示された変更のみを反映せよ。素材や質感を改変することを禁止し、不足箇所のみを補完して生成せよ。メガネやアクセサリー類を着用している場合には、元の材質感・金属の光沢・レンズの透明度、およびデザインの細部までを完全に維持せよ。ぬいぐるみのプロポーションに合わせて形状を歪ませることなく、後付けの精密なパーツとして違和感なく装着させ、現実のアイテムとしてのアイデンティティを100%保持したまま生成すること。人間の顔・髪の毛・髪型を一致させる。撮影された人物の顔立ち、骨格、表情の特徴が入力画像と完全に一致するよう厳密に再現し、別人と認識される要素を一切含めないこと。最終的に1枚の最終画像のみを生成し、Base64文字列のみを返せ。テキスト・引用符・Markdown・コードブロックは禁止。'

export const plushChangePromptBase =
  '画像が2枚ある。1枚目は人物写真、2枚目はぬいぐるみの参照スタイル画像である。タスク：1枚目の人物を2枚目と同じスタイルのぬいぐるみに変換して新しい画像を生成せよ。変換後のぬいぐるみに反映すること：①2枚目のフォトリアルな3D布素材の質感・頭身バランス・ライティング・背景スタイル②1枚目の人物の顔の特徴（目・鼻・口の形）③1枚目の髪型（長さ・形・前髪・分け目）と髪色を2枚目のぬいぐるみ素材感で忠実に再現すること④1枚目の服の色とデザイン。生成するのはぬいぐるみの画像であり、人間の写真ではない。Base64文字列のみを返せ。'

export const plushChangePromptWoolFelting =
  '入力画像の人間の顔と体、および人間のプロポーションを完全に破棄し、参照ぬいぐるみ画像の形状・質感・材質へ完全変換せよ。参照ぬいぐるみの原型シルエット・比率・丸み・パーツ配置を厳格に保持し、原型が分からなくなる形状変更を禁止すること。目の形状およびデザインも参照ぬいぐるみ画像と完全に一致させ、参照ぬいぐるみと同一の造形・配置・比率を厳格に保持すること。眼球の色は指定しない。人間の顔や体型は参照ぬいぐるみと同一の丸くディフォルメされたぬいぐるみ体型に置き換え、入力画像に写っていた人間の身体構造・骨格・筋肉・輪郭は最終画像に一切残してはならない。服は入力画像の色・柄・素材感・テクスチャを保持したまま形状のみをぬいぐるみ体型にフィットさせ、デザイン改変や省略を禁止する。髪・肌・顔の質感はすべて人間的要素を排除し、羊毛フェルト特有の繊維感・起毛感・手作業感のある素材として再構成すること。人間の髪の色および髪型は重要な参照情報として扱い、色味・明度・系統を忠実に再現しつつ、羊毛フェルトを盛り上げて成形した立体的な髪パーツとして表現し、毛束の厚み・丸み・ボリューム感が分かる造形とする。メガネやアクセサリー類を着用している場合には、入力画像のデザイン・形状を完全に再現せよ。素材は羊毛フェルトの世界観に合わせつつも、形が崩れることを厳格に禁止し、細いワイヤーワークや樹脂コーティングされたパーツのような精密なハンドメイドパーツとして表現すること。フェルトによる簡略化を禁止し、細部まで実物と同一のディテールを保持して装着させよ。入力画像に写っていた人間は最終画像に一切表示せず、写実的な人肌・人毛・人間らしい輪郭の残留を禁止する。最終的に羊毛フェルト製ぬいぐるみとして一貫した世界観・質感・造形ルールを持つキャラクター1体のみを生成し、出力は1枚の画像のBase64エンコード文字列のみとし、説明文・JSON・改行・余計な文字列は一切含めない。'

export const plushChangePromptPixelArt =
  '入力画像の人間の顔と体、および人間のプロポーションを完全に破棄し、参照ぬいぐるみ画像の形状・質感・材質をドット絵表現として完全変換せよ。参照ぬいぐるみの原型シルエット・比率・丸み・パーツ配置をドット単位で厳格に保持し、原型が分からなくなる形状変更を禁止すること。人間の顔や体型はドット絵として表現された丸くディフォルメされたぬいぐるみ体型に置き換え、入力画像に写っていた人間の身体構造・骨格・筋肉・輪郭は最終画像に一切残してはならない。服は入力画像の色・柄を保持しつつ、ドット絵として簡略化されたテクスチャで表現する。髪・肌・顔の質感はすべて人間的要素を排除し、低解像度ピクセルアート特有の階調・色数制限・ドット感で表現すること。人間の髪の色および髪型は重要な参照情報として扱い、色味と特徴を保持したままドット絵として再構成し、立体感ではなくピクセル配置によって髪型を表現する。メガネやアクセサリー類を着用している場合には、実物のデザイン・色・特徴的な形状をドット絵の制約の中で限界まで精密に再現せよ。単なる記号的な表現を禁止し、フレームの厚みやレンズの形、アクセサリーの固有のデザインが識別できるレベルでピクセルを配置し、キャラクターの顔や体に正確にフィットさせて描画すること。背景も人物と同一のドット絵スタイルで統一し、写実的表現や高解像度表現を禁止する。最終的に人物と背景が完全に統一されたドット絵世界観のぬいぐるみキャラクター1体のみを生成し、出力は1枚の画像のBase64エンコード文字列のみとし、説明文・JSON・改行・余計な文字列は一切含めない。'

export const plushChangePromptFlatHair =
  '入力画像の人間の顔と体、および人間のプロポーションを完全に破棄し、参照ぬいぐるみ画像の形状・質感・材質へ完全変換せよ。参照ぬいぐるみの原型シルエット・比率・丸み・パーツ配置を厳格に保持し、原型が分からなくなる形状変更を禁止すること。目の形状およびデザインも参照ぬいぐるみ画像と完全に一致させ、参照ぬいぐるみと同一の造形・配置・比率を厳格に保持すること。眼球の色は指定しない。人間の顔や体型は参照ぬいぐるみと同一の丸くディフォルメされたぬいぐるみ体型に置き換え、入力画像に写っていた人間の身体構造・骨格・筋肉・輪郭は最終画像に一切残してはならない。服は入力画像の色・柄・素材感・テクスチャを保持したまま形状のみをぬいぐるみ体型にフィットさせ、デザイン改変や省略を禁止する。髪・肌・顔の質感はすべて人間的要素を排除し、一般的な布製ぬいぐるみ素材として再構成すること。人間の髪の色および髪型は重要な参照情報として扱い、色味・系統は保持しつつ、立体的に盛り上げず平面的に縫い付けられた布パーツやプリント表現として髪型を再構成する。メガネやアクセサリー類を着用している場合には、入力画像のデザイン・形状を完全に保持し、簡略化された刺繍表現ではなく、独立した硬質パーツや高品質な別布パーツとして立体的に再現せよ。フレームの細さや装飾の細部までを維持し、ぬいぐるみの顔の曲線に合わせて正確にフィットさせ、後付けのオプションパーツのような高い完成度で装着させること。入力画像に写っていた人間は最終画像に一切表示せず、写実的な人肌・人毛・人間らしい輪郭の残留を禁止する。最終的に量産型の一般的なぬいぐるみとして自然な世界観・質感・造形ルールを持つキャラクター1体のみを生成し、出力は1枚の画像のBase64エンコード文字列のみとし、説明文・JSON・改行・余計な文字列は一切含めない。'

// 参照画像なし版（OpenAIで速度を上げるため Image2 を渡さないテスト用）。
// 画風はテキストのみで指定。Image2 への参照を排除し、入力は本人写真1枚のみ。
export const SOFUBI_PROMPT_NO_REF =
  'One image is provided: the subject person photo. Convert this person into a Japanese sofubi (soft vinyl) toy figure rendered in a cute chibi toy art style. PROPORTIONS: chibi/SD body - total figure is 2.5 to 3 heads tall. Head is large and round. Body and limbs are SHORT and COMPACT. The head-to-body ratio must clearly look like a chibi toy, not a realistic doll. FACE STYLE: simplified CUTE chibi toy face - medium-sized round cute eyes with a glossy dark iris and a small soft white catchlight highlight so they look lively (NOT tiny dot eyes, but also NOT huge oversized anime eyes - keep them moderate and natural for a toy); tiny simple nose, small mouth, round soft cheeks with light pink blush. Keep the features simple, soft and adorable like a real vinyl toy. Do NOT make the face look like a realistic adult human, and do NOT over-sculpt it with strong realistic shadows, defined cheekbones, jawline or brow ridges - that looks creepy and is forbidden. Give it ONLY a gentle soft rounded volume (a softly rounded form with a tiny soft highlight on the nose and very subtle soft shading) so it is not completely flat, while staying clearly a cute, simplified, smooth toy face. Arrange the facial features in a balanced, natural layout - the eyes sit around the vertical middle of the face with comfortable, natural spacing between them, and the nose and mouth follow below; do NOT squish all the features together into the lower half of the head or place the eyes too low. The figure must look like a real physical hard vinyl toy (sofubi): glossy plastic surface with visible light reflections, hard rigid material, subtle specular highlights, paint-on-vinyl coloring. NOT an anime illustration, NOT a CG render - it must look like a photograph of a real toy you can hold. CHARACTER (from the provided photo): 1. HAIR (HIGHEST PRIORITY - study the photo extremely carefully): Copy the EXACT hairstyle from the photo with maximum fidelity - the exact length, the exact point where the hair ends, the cut shape, the parting, and how it falls on each side. CRITICAL LENGTH RULE: do NOT lengthen, extend, or add hair. If the hair in the photo is short, shoulder-length, or partly tied/pulled back, the figure MUST have that same shorter length - it is strictly FORBIDDEN to make the hair long, flowing, or past the chest when the original is not. Do NOT default to long hair. Do NOT default to a round symmetric bob. Faithfully reproduce the real cut including its asymmetry, layers, the side where bangs fall, stray strands, and the overall silhouette so the hair shape matches the photo one-to-one. Black hair stays black, not brown. 2. FACE: Carefully reproduce the distinctive facial features of the person in chibi style - eyebrow shape and thickness, eye shape (monolid/double lid), nose shape, lip shape and color, face shape (oval/round/square). The viewer must be able to recognize this as a chibi version of the specific person in the photo, not a generic face. Keep the cute chibi eye style (round with highlight dot) but reflect the unique features within that style. 3. BODY BUILD: Reflect the actual body type and physique of this specific person from the photo within the chibi proportions - their shoulder width, slimness, and overall silhouette. Keep the body SLIM and slender with a narrow torso and slim limbs - do NOT make it chubby, stocky, sturdy, bulky or wide unless the person is clearly heavy. Match this particular person, not a generic default template. 4. CLOTHING: Reproduce the exact color, graphic print and style of the outfit. The clothing must look like real worn fabric draped on the figure - sculpt natural wrinkles, soft folds and creases, gentle draping, and clearly visible seams, hems, collar and sleeve edges, with a slightly matte cloth-like texture that contrasts with the glossier skin. Do NOT render the clothes as a smooth, rigid, glossy plastic block like a LEGO figure; the shirt and pants should read as soft fabric that bends and folds over the body. 5. ACCESSORIES: Reproduce any necklace, earrings, or jewelry visible in the photo. The figure must be recognizable as a toy version of the person in the photo. IMPORTANT: Even if the photo shows only the upper body, you MUST generate a complete full-body figure including legs, pants/skirt, and shoes. Infer appropriate bottom clothing (dark pants or matching trousers) based on the outfit style visible in the photo. The figure must be fully clothed from head to toe - bare skin on legs is FORBIDDEN. COMPOSITION: Close product shot. Figure height ~80% of image height. Small margins only. Figure must NOT touch any edge. BACKGROUND: Plain white cardboard box behind the figure with a clear window panel. Figure stands in FRONT OF the box. Floor and wall background is warm tan/kraft paper color. Shadow under figure. No text on the box. Output Base64 image string only. No text, no JSON, no Markdown.'

export const SOFUBI_PROMPT =
  'Two images are provided. Image 1 is the subject person photo. Image 2 is a reference sofubi toy. Use Image 2 for the toy art style. PROPORTIONS: chibi/SD body - total figure is 2.5 to 3 heads tall. Head is large and round. Body and limbs are SHORT and COMPACT. The head-to-body ratio must clearly look like a chibi toy, not a realistic doll. FACE STYLE: simplified CUTE chibi toy face like Image 2 - medium-sized round cute eyes with a glossy dark iris and a small soft white catchlight highlight so they look lively (NOT tiny dot eyes, but also NOT huge oversized anime eyes - keep them moderate and natural for a toy); tiny simple nose, small mouth, round soft cheeks with light pink blush. Keep the features simple, soft and adorable like a real vinyl toy. Do NOT make the face look like a realistic adult human, and do NOT over-sculpt it with strong realistic shadows, defined cheekbones, jawline or brow ridges - that looks creepy and is forbidden. Give it ONLY a gentle soft rounded volume (a softly rounded form with a tiny soft highlight on the nose and very subtle soft shading) so it is not completely flat, while staying clearly a cute, simplified, smooth toy face. Arrange the facial features in a balanced, natural layout like Image 2 - the eyes sit around the vertical middle of the face with comfortable, natural spacing between them, and the nose and mouth follow below; do NOT squish all the features together into the lower half of the head or place the eyes too low. The figure must look like a real physical hard vinyl toy (sofubi): glossy plastic surface with visible light reflections, hard rigid material, subtle specular highlights, paint-on-vinyl coloring. NOT an anime illustration, NOT a CG render - it must look like a photograph of a real toy you can hold. CHARACTER (from Image 1 only): 1. HAIR (HIGHEST PRIORITY - study Image 1 extremely carefully): Copy the EXACT hairstyle from Image 1 with maximum fidelity - the exact length, the exact point where the hair ends, the cut shape, the parting, and how it falls on each side. CRITICAL LENGTH RULE: do NOT lengthen, extend, or add hair. If the hair in Image 1 is short, shoulder-length, or partly tied/pulled back, the figure MUST have that same shorter length - it is strictly FORBIDDEN to make the hair long, flowing, or past the chest when the original is not. Do NOT default to long hair. Do NOT default to a round symmetric bob. Faithfully reproduce the real cut including its asymmetry, layers, the side where bangs fall, stray strands, and the overall silhouette so the hair shape matches Image 1 one-to-one. Black hair stays black, not brown. 2. FACE: Carefully reproduce the distinctive facial features of the person in chibi style - eyebrow shape and thickness, eye shape (monolid/double lid), nose shape, lip shape and color, face shape (oval/round/square). The viewer must be able to recognize this as a chibi version of the specific person in Image 1, not a generic face. Keep the cute chibi eye style (round with highlight dot) but reflect the unique features within that style. 3. BODY BUILD: Reflect the actual body type and physique of this specific person from Image 1 within the chibi proportions - their shoulder width, slimness, and overall silhouette. Keep the body SLIM and slender with a narrow torso and slim limbs - do NOT make it chubby, stocky, sturdy, bulky or wide unless the person is clearly heavy. Match this particular person, not a generic default template. 4. CLOTHING: Reproduce the exact color, graphic print and style of the outfit. The clothing must look like real worn fabric draped on the figure - sculpt natural wrinkles, soft folds and creases, gentle draping, and clearly visible seams, hems, collar and sleeve edges, with a slightly matte cloth-like texture that contrasts with the glossier skin. Do NOT render the clothes as a smooth, rigid, glossy plastic block like a LEGO figure; the shirt and pants should read as soft fabric that bends and folds over the body. 5. ACCESSORIES: Reproduce any necklace, earrings, or jewelry visible in Image 1. The figure must be recognizable as a toy version of the person in Image 1. IMPORTANT: Even if Image 1 shows only the upper body, you MUST generate a complete full-body figure including legs, pants/skirt, and shoes. Infer appropriate bottom clothing (dark pants or matching trousers) based on the outfit style visible in Image 1. The figure must be fully clothed from head to toe - bare skin on legs is FORBIDDEN. COMPOSITION: Close product shot. Figure height ~80% of image height. Small margins only. Figure must NOT touch any edge. BACKGROUND: Plain white cardboard box behind the figure with a clear window panel. Figure stands in FRONT OF the box. Floor and wall background is warm tan/kraft paper color. Shadow under figure. No text on the box. Output Base64 image string only. No text, no JSON, no Markdown.'

const stampBase = (pose: string, text: string) =>
  `画像が2枚ある。1枚目は変換対象の人物写真、2枚目はスタイル参照用のLINEスタンプサンプルである。1枚目の人物の顔・髪型・服装・雰囲気を読み取り、2枚目のスタンプと完全に同じLINEスタンプスタイルで描き直せ。スタイルは2枚目に厳密に従うこと：ちびキャラ・かわいい丸みのある頭身（SD体型）、シンプルでポップなイラスト調、リアルな描写・半リアルアニメ風・詳細すぎる表現は禁止。色彩は明るくビビッド、キャラクター全体を白いステッカー縁取りで囲むこと。${pose}スタンプ下部に日本語テキスト「${text}」を描くこと。文字スタイルは2枚目を参考に：太くて丸みのあるバブルレター体、もくもく雲のようにふっくら膨らんだ輪郭、白いふわふわした縁取り、ドロップシャドウで立体感を出すこと。文字色はカラフルで鮮やかな色にすること。背景はクリーム色または薄い暖色系の単色とすること。最終的に1枚のスタンプ画像のみを生成し、Base64文字列のみを返せ。テキスト・JSON・Markdownは禁止。`

export const LINE_STAMP_PROMPT_BASE = stampBase('', 'テキスト')

export const STAMP_PROMPT_MAP: Record<string, string> = {
  'おはようございます': stampBase('キャラクターは笑顔で元気よく手を振る朝の挨拶ポーズを取ること。明るく爽やかな表情で目を細めて微笑むこと。', 'おはようございます'),
  'ありがとうございます！': stampBase('キャラクターは両手を胸の前で合わせて感謝するポーズを取ること。うれしそうな笑顔で目をキラキラさせること。', 'ありがとうございます！'),
  '承知しました': stampBase('キャラクターはサムズアップ（親指を立てる）ポーズを取ること。自信に満ちた落ち着いた表情でプロフェッショナルな雰囲気を出すこと。', '承知しました'),
  '了解です！': stampBase('キャラクターは額に手を当てる敬礼ポーズを取ること。元気いっぱいの笑顔でOK!という雰囲気を出すこと。', '了解です！'),
  '確認します': stampBase('キャラクターは真剣に何かを確認・チェックするポーズを取ること。集中した表情で少し眉をひそめる感じにすること。', '確認します'),
  '少々お待ちください': stampBase('キャラクターは片手を前に出して「少し待って」とジェスチャーするポーズを取ること。申し訳なさそうな笑顔で丁寧な雰囲気にすること。', '少々お待ちください'),
  'おつかれさまです': stampBase('キャラクターはリラックスしたポーズで温かく微笑むこと。一日の終わりの達成感とほっとした表情にすること。', 'おつかれさまです'),
  'お願いします！': stampBase('キャラクターは両手を合わせてかわいくお願いするポーズを取ること。悲しい・暗い・深刻な表情は禁止。笑顔または上目遣いのキュートな表情で、ハートや星のデコレーションを周りに添えること。', 'お願いします！'),
  '今向かいます': stampBase('キャラクターは前に向かって元気よく走っているポーズを取ること。笑顔で明るく楽しそうな表情にし、怖い顔・怒り顔は禁止。躍動感のある構図にすること。', '今向かいます'),
  'すみません！': stampBase('キャラクターは申し訳なさそうに頭を下げるポーズを取ること。少し慌てた様子で額に汗をかいているような表情にすること。', 'すみません！'),
  '完了しました！': stampBase('キャラクターは両手を上げてガッツポーズするか親指を立てるポーズを取ること。達成感いっぱいの笑顔で誇らしげな表情にすること。', '完了しました！'),
  '考え中…': stampBase('キャラクターは顎に手を当てて考え込むポーズを取ること。少し首を傾げて真剣に何かを考えているような表情にすること。', '考え中…'),
}

// ── LINEスタンプ 6枚グリッド一括生成 ───────────────────────
// 参考画像は渡さず、本人写真1枚＋テキストのみで生成（Gemini）。
// 12種のうち毎回ランダムで6種を選び、その6種でプロンプトを組み立てる。
export type StampDef = { text: string; pose: string }

export const LINE_STAMP_DEFS: StampDef[] = [
  { text: 'ヤッホー！', pose: '両手を上げて元気に挨拶するポーズ' },
  { text: 'おはよー', pose: '笑顔で片手を振る朝の挨拶ポーズ' },
  { text: 'よろしく', pose: '軽く会釈するか手を差し出す親しみやすいポーズ' },
  { text: '了解！', pose: '敬礼またはサムズアップのOKポーズ' },
  { text: 'OK！', pose: '指でOKサインを作る元気なポーズ' },
  { text: 'すごい！', pose: '目を輝かせて両手で拍手し感心するポーズ' },
  { text: 'ありがとう', pose: '両手を胸の前で合わせて感謝する笑顔のポーズ' },
  { text: 'ごめんね', pose: '申し訳なさそうに手を合わせ、少し困った表情で謝るポーズ' },
  { text: 'ありがと', pose: '両手で大きなハートを抱えて差し出す感謝のポーズ' },
  { text: '頑張るぞ！', pose: 'ぐっと拳を握ったガッツポーズで気合いの入った表情' },
  { text: 'おつかれ', pose: 'リラックスして労う、ほっとしたやさしい笑顔のポーズ' },
  { text: 'バイバイ', pose: '笑顔で大きく手を振って別れを告げるポーズ' },
]

// 配列から重複なくランダムにn件選ぶ
export function pickRandomStamps(n = 6, pool: StampDef[] = LINE_STAMP_DEFS): StampDef[] {
  const arr = [...pool]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr.slice(0, n)
}

// 選ばれた6種でLINEスタンプ6枚グリッド生成プロンプトを組み立てる
export function buildLineStampGridPrompt(selected: StampDef[]): string {
  const content = selected
    .map((s, i) => `${i + 1}「${s.text}」＝${s.pose}。`)
    .join('')
  return (
    '1枚の人物写真をもとに、その人物のLINEスタンプ風イラストを6種類、1枚の画像にまとめて生成せよ。【最重要・人物の同一性】キャラクターは写真の本人だと明確に分かる似顔絵にすること。顔立ち（輪郭・目の形・鼻・口）、髪型・髪の長さ・前髪の形・分け目・髪色、目の色、肌の色、服装と服の色は、すべて写真に忠実に再現すること。特に髪は写真の長さと形を守り、勝手にロングヘアにしないこと。目の色も写真どおりにし、勝手に青や明るい色に変えないこと。一般的なアニメ美少女やテンプレ顔に寄せず、本人の個性を残すこと。【画風】プロが作った公式LINEスタンプのような、作り込まれた完成度の高いちびキャラ（SD体型・頭が大きく丸みのある2.5〜3頭身）イラストにすること。最優先は本人の特徴の再現で、その再現度（髪型・顔立ち・雰囲気で本人と分かること）を保ったまま、全体の印象を少しだけ親しみやすい「ゆるキャラ」風に和らげること。具体的には、顔をもう一段まるく可愛くデフォルメし、頭身もやや低めのぽってりした体型にして、マスコットのような愛嬌のある雰囲気にする（ただし本人と分からなくなるほど崩したり、テンプレ的なキャラ顔にしたりはしないこと）。目は通常より一回り大きく丸く、黒目がちにして、はっきりした明るいハイライト（キャッチライト）を入れてうるっとキラッとさせ、生き生きと愛らしい表情にする（ただし瞳の色は写真の本人を守ること）。頬にはほんのり赤みのチークを入れて可愛らしくする。塗りはなめらかで艶のあるセル塗り＋柔らかいグラデーションで立体感を出し、髪はツヤ感のあるハイライトを入れて束感を表現する。輪郭線はくっきりと太めでクリーンにし、キャラクター全体を太くふんわりした白いステッカー縁取りで個別に囲むこと。色彩は明るくビビッドにする。ざらつき・ノイズ・粗いタッチ・リアルすぎる描写・半リアル写真風・のっぺりした平面的な塗りは禁止。【レイアウト】縦長の画像とし、2列×3行のグリッドに6個のスタンプを均等に配置する。背景はクリーム色または薄い暖色系の単色で全体を統一する。【6枚の内容】次の6個のスタンプを、それぞれ指定の日本語テキストとポーズで作ること：' +
    content +
    '文字は太くて丸みのあるバブルレター体、ふっくら膨らんだ輪郭、白いふわふわした縁取り、ドロップシャドウで立体感を出し、文字色はカラフルで鮮やかにすること。最終的に6枚のスタンプが2列×3行に並んだ縦長の1枚画像のみを生成し、Base64文字列のみを返せ。テキスト・JSON・Markdownは禁止。'
  )
}

// ── タイムスリップ（9枚並列生成）────────────────────────────
// 1枚目=変換対象の「本人」の写真 / 2枚目=年代別の参照画像。
// 【重要】2枚目には別人が写っているため、その人物の顔・髪型・体型を絶対にコピー
// させてはいけない（コピーすると本人の面影が消える）。2枚目はあくまで
// 「服装・時代・ポーズ・背景・小物・色調」の参照としてのみ使い、本人の同一性
// （顔・髪・体型）はすべて1枚目から取る、という分離をプロンプトで強く指示する。
// 年齢を変える年代（赤ちゃん・小学一年生）など体型を変える必要がある場合のみ、
// 各 scene 文言で明示的に上書きする。
// 文章仕様が未提供の年代は、当面 time/ 配下の参照画像を再現する内容にしている
// （正式プロンプトが先方から届き次第ここを差し替える）。
const timeSlipBase = (scene: string) =>
  `画像が2枚ある。1枚目は変換対象の「本人」の写真、2枚目は再現したい年代・スタイルの参照画像である。【絶対厳守・本人の同一性】完成画像の人物は、必ず1枚目の本人と同一人物だと一目で分かること。顔（顔立ち・輪郭・骨格・目鼻口の形と配置・眉・肌の色と質感・表情の癖）、髪型・髪の長さ・前髪・分け目・髪色、目の色、体格・体型は、すべて1枚目の本人を忠実に保持し、別人と認識される要素を一切含めないこと。【2枚目の扱い】2枚目は「服装・時代/年代の雰囲気・ポーズ・背景・小物・全体の色調」を参照するためだけに使う。2枚目に写っている人物の顔・髪型・髪色・体型・容姿は一切コピーしないこと（別人の顔や髪を本人に持ち込むことを固く禁止する）。${scene}。本人の顔・髪・体型は1枚目のまま保ちつつ、服装・背景・小物・色調だけを年代に合わせて作り込み、顔と体の接続部に違和感が出ないよう自然に馴染ませ、合成感のない実写風の1枚の写真として仕上げること。最終的に1枚の画像のみを生成し、Base64文字列のみを返せ。テキスト・JSON・Markdownは禁止。`

// 赤ちゃん・小学一年生は Gemini の子ども安全ポリシーで弾かれやすいため、専用の
// 緩めたプロンプトを使う：
//  (1) 「全年齢向けの健全な家族アルバム記念写真」として強くフレーミングする
//  (2) 同一性は「完全保持」ではなく「面影をやさしく残す」程度に緩める
//      （実写の子どもをそっくり再現する指示は安全トリガーになりやすい）
//  (3) 全身を服で覆い肌の露出をなくす
// あわせて TimeSlipModule 側でこの2件は参照画像を渡さずテキストのみで生成する
// （別の子どもの顔を持ち込まない＋子ども参照画像による安全トリガーを回避）。
export const TIME_SLIP_NO_REF_IDS = ['baby', 'elementary'] as const

const timeSlipChildBase = (scene: string) =>
  `1枚の人物写真をもとに、家族アルバムに飾る、ほのぼのとした全年齢向けの健全な記念写真を作る。【最重要・顔は写真の大人の顔のまま固定】写真に写っている人物の顔を、年齢も造形も一切変えずにそのまま使うこと。顔を赤ちゃん顔・子ども顔に作り替えること（丸く幼い赤ちゃん顔や、無個性で平均的な子どもの顔にすること）を固く禁止する。顔の輪郭・骨格・目鼻口の形と大きさと配置・眉・肌・表情は、写真の大人の顔と完全に同一にし、その大人の顔がそのまま乗っているように見せること。${scene}。ただし顔だけは絶対に幼くせず写真のまま——変えてよいのは体型・服装・背景・小物だけ。顔だけを見れば写真の本人（大人）だと完全に分かること。全身をきちんと服で覆って肌の露出をなくし、健全で微笑ましい実写風の家族写真として自然に仕上げること。最終的に1枚の画像のみを生成し、Base64文字列のみを返せ。テキスト・JSON・Markdownは禁止。`

export type TimeSlipItem = { id: string; label: string; prompt: string }

export const TIME_SLIP_ITEMS: TimeSlipItem[] = [
  {
    id: 'baby',
    label: '赤ちゃん時代',
    prompt: timeSlipChildBase(
      '体型はよちよち期の幼児（赤ちゃん）にすること。ぷっくりした手足の、長袖・長ズボンのかわいいベビー服またはロンパースを全身にきちんと着せ、明るくやわらかい室内（ベビールーム）でおすわりしてにこにこ笑っている、微笑ましい家族写真のような構図にする',
    ),
  },
  {
    id: 'elementary',
    label: '小学一年生',
    prompt: timeSlipChildBase(
      '体型は小学一年生の小さな体にすること。黄色い通学帽をかぶり、ランドセルを背負う（男の子は黒いランドセル＋白い半袖シャツ＋ネイビーのハーフパンツ、女の子は赤いランドセル＋白い半袖シャツ＋ネイビーのプリーツスカート）、白い靴下に黒い革靴。新学期の通学路を背景にした明るい屋外で笑っている構図',
    ),
  },
  {
    id: 'bosozoku',
    label: '非行・暴走族時代',
    prompt: timeSlipBase(
      '現在の顔のままで、高校時代の反動で非行に走った暴走族時代にすること。革ジャンまたは特攻服風の上着を着た不良の出で立ちで、夜の街やバイクにまたがる構図。「喧嘩上等」なやんちゃで攻撃的な雰囲気。はちまき・バット・バイクなどの小物はあってもなくてもよい',
    ),
  },
  {
    id: 'showa-retro',
    label: '昭和レトロ女性',
    prompt: timeSlipBase(
      '本人の顔・髪型のままで昭和レトロな装いにすること。赤い水玉模様のワンピースに白いカーディガンを羽織る。本人の髪型・髪の長さは変えず、軽く時代風にセットする程度に留める。1950年代風の街並みを背景に、色あせたフィルム写真調の暖かい色味で仕上げる',
    ),
  },
  {
    id: 'seventies-a',
    label: '70年代風（幾何学柄）',
    prompt: timeSlipBase(
      '本人の顔・髪型のままで1970年代風の装いにすること。オレンジ系の幾何学模様のワンピースにヘアバンドを合わせる。本人の髪型・髪の長さは変えず、ヘアバンドなどの小物で時代感を出す程度に留める。賑やかなレトロな街頭を背景に、70年代らしいくすんだ色調で仕上げる',
    ),
  },
  {
    id: 'seventies-b',
    label: '70年代風（マスタード）',
    prompt: timeSlipBase(
      '現在の顔のままで1970年代風の装いにすること。マスタード色のジャケットにオレンジのリブニット、ハイウエストのデニム、ブラウンのベルトとショルダーバッグ。秋らしいレトロな街並みを背景に、ヴィンテージな色味で仕上げる',
    ),
  },
  {
    id: 'harajuku',
    label: '派手・原宿系',
    prompt: timeSlipBase(
      '現在の顔のままで派手な原宿系ストリートスタイルにすること。カラフルなチェック柄の上着に明るく華やかなメイク、夜の繁華街を背景に。1980〜90年代風のポップでカラフルな雰囲気で仕上げる',
    ),
  },
  {
    id: 'honor-student',
    label: '超優秀高校生（陰キャ）',
    prompt: timeSlipBase(
      '現在の顔のままで超優秀だが地味な高校生（陰キャ）にすること。紺色のブレザーにネクタイ、メガネをかけ、右手に教科書を持つ。勉強しか興味がなくコミュニケーションが苦手そうな、真面目で地味な印象。図書室や教室を背景にする',
    ),
  },
  {
    id: 'yankee',
    label: 'ヤンキー・ギャル',
    prompt: timeSlipBase(
      '現在の顔のままでヤンキー／ギャル風の装いにすること。ピンクのジャケットにデニムパンツ、夜の街頭を背景に。やんちゃで派手な、強気な雰囲気で仕上げる',
    ),
  },
]
