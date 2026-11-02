import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from './route'

vi.mock('@/lib/ai/chatbot', () => ({
  answerHotelChatbotQuestion: vi.fn().mockResolvedValue({
    reply: 'Giờ nhận phòng từ 14:00 và trả phòng trước 12:00.',
    suggestions: ['Quy định mang thú cưng?', 'Xem các hạng phòng?'],
    modelUsed: 'mock-test',
  }),
}))

describe('POST /api/public/chatbot/message', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects empty propertyId', async () => {
    const req = new NextRequest('http://localhost:3000/api/public/chatbot/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-real-ip': '1.2.3.4' },
      body: JSON.stringify({ propertyId: '', message: 'Check in time?' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('rejects empty message', async () => {
    const req = new NextRequest('http://localhost:3000/api/public/chatbot/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-real-ip': '1.2.3.4' },
      body: JSON.stringify({ propertyId: 'prop_123', message: '   ' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('successfully returns answer and suggestions', async () => {
    const req = new NextRequest('http://localhost:3000/api/public/chatbot/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-real-ip': '1.2.3.5' },
      body: JSON.stringify({
        propertyId: 'prop_123',
        message: 'Khách sạn mấy giờ nhận phòng?',
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.reply).toContain('14:00')
    expect(json.data.suggestions).toHaveLength(2)
  })
})

