export const STAMP_TEXTS = [
  'おはようございます',
  'ありがとうございます！',
  '承知しました',
  '了解です！',
  '確認します',
  '少々お待ちください',
  'おつかれさまです',
  'お願いします！',
  '今向かいます',
  'すみません！',
  '完了しました！',
  '考え中…',
] as const

export type StampText = (typeof STAMP_TEXTS)[number]
