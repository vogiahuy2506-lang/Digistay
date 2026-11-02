import { describe, it, expect } from 'vitest'
import { generateHeuristicContent, generateHospitalityContent } from './content-generator'
import { GenerateContentInput } from './types'

describe('AI Content Generator', () => {
  it('generates high-converting room copy with bilingual output', () => {
    const input: GenerateContentInput = {
      contentType: 'ROOM_DESCRIPTION',
      roomName: 'Deluxe Pool View',
      keywords: '30m2, view hồ bơi, yên tĩnh, bồn tắm nằm cao cấp, ban công đón nắng',
      bedType: 'KING',
      area: 30,
      tone: 'LUXURY',
      language: 'bilingual',
      propertyName: 'Digistay Luxury Villa',
    }

    const result = generateHeuristicContent(input)

    expect(result.title).toContain('Deluxe Pool View')
    expect(result.shortDescription).toBeTruthy()
    expect(result.shortDescription.length).toBeGreaterThan(20)
    expect(result.fullDescription).toContain('## Trải Nghiệm Nghỉ Dưỡng Tại')
    expect(result.fullDescription).toContain('30m²')
    expect(result.metaTitle.length).toBeLessThanOrEqual(60)
    expect(result.metaDescription.length).toBeLessThanOrEqual(160)

    // English copy verification
    expect(result.english).toBeDefined()
    expect(result.english?.title).toContain('Deluxe Pool View')
    expect(result.english?.fullDescription).toContain('Welcome to')
    expect(result.english?.metaTitle.length).toBeLessThanOrEqual(60)
  })

  it('generates blog article marketing copy', () => {
    const input: GenerateContentInput = {
      contentType: 'BLOG_POST',
      topic: 'Top 5 quán hải sản tươi ngon gần khách sạn',
      keywords: 'hải sản tươi sống, giá bình dân, gần biển, mở cửa đêm',
      tone: 'COZY',
      language: 'vi',
      propertyName: 'Digistay Seaside',
    }

    const result = generateHeuristicContent(input)

    expect(result.title).toBe('Top 5 quán hải sản tươi ngon gần khách sạn')
    expect(result.fullDescription).toContain('hải sản tươi sống')
    expect(result.english).toBeUndefined()
  })

  it('falls back seamlessly to heuristic engine when no external API key is configured', async () => {
    delete process.env.GEMINI_API_KEY
    delete process.env.OPENAI_API_KEY

    const input: GenerateContentInput = {
      contentType: 'ROOM_DESCRIPTION',
      roomName: 'Standard Room',
      keywords: 'tiện nghi cơ bản, giá tốt',
      tone: 'MODERN',
    }

    const result = await generateHospitalityContent(input)
    expect(result.title).toBe('Standard Room')
    expect(result.modelUsed).toBe('heuristic-engine-v1')
  })
})

