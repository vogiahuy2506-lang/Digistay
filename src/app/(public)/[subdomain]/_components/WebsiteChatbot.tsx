'use client'

import * as React from 'react'
import {
  Bot,
  Sparkles,
  Send,
  X,
  Minimize2,
  Maximize2,
  MessageSquare,
  RefreshCw,
} from 'lucide-react'
import { useLocale } from 'next-intl'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  suggestions?: string[]
}

interface WebsiteChatbotProps {
  propertyId: string
  hotelName: string
}

export function WebsiteChatbot({ propertyId, hotelName }: WebsiteChatbotProps) {
  const locale = useLocale()
  const isEn = locale === 'en'

  const [isOpen, setIsOpen] = React.useState(false)
  const [isMinimized, setIsMinimized] = React.useState(false)
  const [messages, setMessages] = React.useState<ChatMessage[]>([])
  const [input, setInput] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(false)
  const [hasInteracted, setHasInteracted] = React.useState(false)

  const messagesEndRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const defaultWelcomeVi = `Dạ em chào quý khách! Em là Trợ lý AI của ${hotelName}. Em có thể giải đáp 24/7 về giờ check-in, thực đơn ăn uống, quy định thú cưng hoặc thông tin các hạng phòng. Quý khách cần hỗ trợ gì ạ?`
  const defaultWelcomeEn = `Welcome to ${hotelName}! I am your 24/7 AI Receptionist. I can instantly help you with check-in/out times, room types, pet policies, and dining options. How may I assist you today?`

  const defaultSuggestionsVi = [
    '⏰ Giờ nhận & trả phòng?',
    '🐾 Có được mang thú cưng không?',
    '🍜 Thực đơn ăn uống & ăn sáng?',
    '🛏️ Các hạng phòng và giá?',
  ]

  const defaultSuggestionsEn = [
    '⏰ Check-in & check-out times?',
    '🐾 Are pets allowed?',
    '🍜 Breakfast & dining menu?',
    '🛏️ Room types & prices?',
  ]

  // Initialize welcome message when opened
  React.useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: isEn ? defaultWelcomeEn : defaultWelcomeVi,
          createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          suggestions: isEn ? defaultSuggestionsEn : defaultSuggestionsVi,
        },
      ])
    }
  }, [isOpen, messages.length, isEn, hotelName])

  // Auto scroll to bottom
  React.useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isLoading, isOpen, isMinimized])

  // Focus input on open
  React.useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 200)
    }
  }, [isOpen, isMinimized])

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || input).trim()
    if (!text || isLoading) return

    setHasInteracted(true)
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    try {
      const historyPayload = messages
        .filter((m) => m.id !== 'welcome')
        .slice(-4)
        .map((m) => ({ role: m.role, content: m.content }))

      const res = await fetch('/api/public/chatbot/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          message: text,
          history: historyPayload,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Lỗi khi gửi câu hỏi')
      }

      const botMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: data.data.reply,
        createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestions: data.data.suggestions,
      }

      setMessages((prev) => [...prev, botMsg])
    } catch (err: any) {
      const fallbackMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: isEn
          ? 'Sorry, I am temporarily unable to answer. Please contact our front desk directly!'
          : 'Dạ xin lỗi quý khách, hệ thống phản hồi đang bận. Quý khách vui lòng liên hệ trực tiếp lễ tân khách sạn để được hỗ trợ nhanh nhất ạ!',
        createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages((prev) => [...prev, fallbackMsg])
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetChat = () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content: isEn ? defaultWelcomeEn : defaultWelcomeVi,
        createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestions: isEn ? defaultSuggestionsEn : defaultSuggestionsVi,
      },
    ])
  }

  // Format simple markdown into bold and linebreaks
  const renderMessageContent = (content: string) => {
    const lines = content.split('\n')
    return (
      <div className="space-y-1.5 text-xs sm:text-small leading-relaxed">
        {lines.map((line, idx) => {
          if (!line.trim()) return <div key={idx} className="h-1" />

          // Replace **bold** with <strong>
          const parts = line.split(/(\*\*.*?\*\*)/g)
          return (
            <p key={idx}>
              {parts.map((part, pIdx) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                  return <strong key={pIdx} className="font-semibold text-fg">{part.slice(2, -2)}</strong>
                }
                return part
              })}
            </p>
          )
        })}
      </div>
    )
  }

  return (
    <>
      {/* Floating Trigger Button */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-40 group flex items-center gap-2.5 px-4 py-3 rounded-full bg-ink text-on-ink shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-200 border border-white/10"
          aria-label={isEn ? 'Open AI Hotel Assistant' : 'Mở Trợ lý AI khách sạn'}
        >
          <div className="relative flex items-center justify-center">
            <Bot className="w-5 h-5 text-acc" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-ok ring-2 ring-ink animate-pulse" />
          </div>
          <span className="text-small font-medium tracking-tight pr-1">
            {isEn ? 'AI Assistant' : 'Trợ lý AI 24/7'}
          </span>
          <span className="hidden sm:inline-flex items-center text-[11px] text-on-ink/70 bg-white/10 px-2 py-0.5 rounded-full">
            Online
          </span>
        </button>
      )}

      {/* Floating Chat Window */}
      {isOpen && (
        <div
          className={`fixed z-50 transition-all duration-200 ease-out shadow-2xl rounded-2xl border border-line bg-panel overflow-hidden flex flex-col ${
            isMinimized
              ? 'bottom-20 right-4 sm:bottom-6 sm:right-6 w-72 h-14'
              : 'bottom-20 right-4 sm:bottom-6 sm:right-6 w-[calc(100vw-2rem)] sm:w-[390px] h-[520px] max-h-[82vh]'
          }`}
        >
          {/* Header */}
          <div className="px-4 py-3 bg-ink text-on-ink flex items-center justify-between shrink-0 select-none border-b border-white/10">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative w-8 h-8 rounded-full bg-acc/20 border border-acc/40 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-acc" />
                <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-ok ring-2 ring-ink" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs sm:text-small font-semibold truncate leading-tight">
                  {isEn ? 'AI Receptionist' : 'Lễ tân ảo AI 24/7'}
                </h4>
                <p className="text-[11px] text-on-ink/70 truncate leading-none mt-0.5">
                  {hotelName}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 text-on-ink/80">
              <button
                type="button"
                onClick={handleResetChat}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                title={isEn ? 'Reset chat' : 'Bắt đầu cuộc trò chuyện mới'}
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsMinimized((prev) => !prev)}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                title={isMinimized ? (isEn ? 'Maximize' : 'Phóng to') : (isEn ? 'Minimize' : 'Thu nhỏ')}
              >
                {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                title={isEn ? 'Close chat' : 'Đóng khung chat'}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Chat Body (Hidden when minimized) */}
          {!isMinimized && (
            <>
              {/* Message History */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-page/40">
                {messages.map((msg) => {
                  const isUser = msg.role === 'user'
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 shadow-xs ${
                          isUser
                            ? 'bg-ink text-on-ink rounded-tr-xs'
                            : 'bg-panel border border-line text-fg rounded-tl-xs'
                        }`}
                      >
                        {renderMessageContent(msg.content)}
                      </div>

                      <span className="text-[10px] text-muted px-1 mt-1">
                        {msg.createdAt}
                      </span>

                      {/* Suggestions for assistant messages */}
                      {!isUser && msg.suggestions && msg.suggestions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2 max-w-[95%]">
                          {msg.suggestions.map((sug, sIdx) => (
                            <button
                              key={sIdx}
                              type="button"
                              onClick={() => handleSendMessage(sug.replace(/^[^\w\s\u00C0-\u1EF9]+/g, '').trim())}
                              className="text-[11px] px-2.5 py-1 rounded-full bg-panel border border-line hover:border-acc/60 hover:bg-acc/5 text-fg transition-colors"
                            >
                              {sug}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Typing Indicator */}
                {isLoading && (
                  <div className="flex items-start gap-2">
                    <div className="bg-panel border border-line px-4 py-3 rounded-2xl rounded-tl-xs flex items-center gap-1.5 shadow-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce [animation-delay:-0.3s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce [animation-delay:-0.15s]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce" />
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input Footer */}
              <div className="p-3 border-t border-line bg-panel shrink-0">
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    handleSendMessage()
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={
                      isEn
                        ? 'Ask check-in time, menu, pet rules...'
                        : 'Hỏi giờ check-in, thực đơn, thú cưng...'
                    }
                    className="flex-1 bg-page border border-line rounded-xl px-3.5 py-2 text-xs sm:text-small text-fg placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-acc"
                    disabled={isLoading}
                  />
                  <button
                    type="submit"
                    disabled={isLoading || !input.trim()}
                    className="p-2.5 rounded-xl bg-ink text-on-ink disabled:opacity-40 hover:bg-ink/90 transition-colors shrink-0"
                    aria-label={isEn ? 'Send' : 'Gửi'}
                  >
                    <Send className="w-4 h-4 text-acc" />
                  </button>
                </form>

                <div className="mt-2 flex items-center justify-between text-[10px] text-muted px-1">
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-acc" />
                    {isEn ? 'Powered by Gemini 3.1 Flash-Lite' : 'Tích hợp Gemini 3.1 Flash-Lite'}
                  </span>
                  <span>{isEn ? 'Instant answers 24/7' : 'Phản hồi 24/7'}</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}

