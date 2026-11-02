export type AiContentType = 'ROOM_DESCRIPTION' | 'BLOG_POST'

export type AiTone = 'LUXURY' | 'COZY' | 'MODERN' | 'ROMANTIC' | 'FAMILY'

export type AiLanguage = 'vi' | 'en' | 'bilingual'

export interface GenerateContentInput {
  contentType: AiContentType
  keywords: string
  roomName?: string
  bedType?: string
  area?: number | null
  tone?: AiTone
  language?: AiLanguage
  targetAudience?: string
  propertyName?: string
  topic?: string
  apiKey?: string
  model?: string
}

export interface ContentLocalizedOutput {
  title: string
  shortDescription: string
  fullDescription: string
  metaTitle: string
  metaDescription: string
}

export interface GenerateContentOutput extends ContentLocalizedOutput {
  english?: ContentLocalizedOutput
  modelUsed: string
  generatedAt: string
}

export interface AiConfigState {
  hasKey: boolean
  keyMasked?: string | null
  provider: 'GEMINI' | 'OPENAI' | 'HEURISTIC'
  model: string
  source: 'PROPERTY' | 'ENV' | 'NONE'
}
