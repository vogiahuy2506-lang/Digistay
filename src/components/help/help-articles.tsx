'use client'

import * as React from 'react'
import {
  Search,
  ConciergeBell,
  BedDouble,
  Globe,
  Wallet,
  Share2,
  ShieldCheck,
  BookOpen,
  Clock,
  ChevronRight,
  Lightbulb,
  ThumbsUp,
  ThumbsDown,
  X,
} from 'lucide-react'
import {
  HELP_CATEGORIES,
  HELP_ARTICLES,
  type HelpArticle,
  type HelpCategory,
} from '@/lib/help/help-docs'
import { Modal, ModalHeader, ModalBody, ModalFooter, Button } from '@/components/ui'
import { cn } from '@/lib/utils'

const CATEGORY_ICONS: Record<HelpCategory['iconName'], React.ComponentType<{ className?: string }>> = {
  concierge: ConciergeBell,
  bed: BedDouble,
  globe: Globe,
  wallet: Wallet,
  share: Share2,
  shield: ShieldCheck,
}

export function HelpArticles() {
  const [searchQuery, setSearchQuery] = React.useState('')
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<string>('all')
  const [activeArticle, setActiveArticle] = React.useState<HelpArticle | null>(null)
  const [feedbackMap, setFeedbackMap] = React.useState<Record<string, 'up' | 'down'>>({})
  const searchInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const normalizedQuery = searchQuery.trim().toLowerCase()

  const filteredArticles = React.useMemo(() => {
    return HELP_ARTICLES.filter((article) => {
      const matchesCategory =
        selectedCategoryId === 'all' || article.categoryId === selectedCategoryId
      if (!matchesCategory) return false

      if (!normalizedQuery) return true

      return (
        article.title.toLowerCase().includes(normalizedQuery) ||
        article.summary.toLowerCase().includes(normalizedQuery) ||
        article.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery)) ||
        article.steps.some(
          (s) =>
            s.heading.toLowerCase().includes(normalizedQuery) ||
            s.detail.toLowerCase().includes(normalizedQuery)
        )
      )
    })
  }, [selectedCategoryId, normalizedQuery])

  return (
    <section className="space-y-6">
      {/* Search Bar */}
      <div className="rounded-2xl border border-line bg-panel p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-fg flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              Thư viện tài liệu hướng dẫn chi tiết
            </h2>
            <p className="text-xs text-muted mt-0.5">
              Tìm kiếm nhanh quy trình thao tác hoặc chọn theo từng nhóm nghiệp vụ khách sạn.
            </p>
          </div>

          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm hướng dẫn (VD: check-in, vietqr, website...)"
              className="w-full h-10 pl-10 pr-20 rounded-xl bg-raised border border-line text-sm text-fg placeholder:text-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-fg p-1"
                aria-label="Xóa từ khóa"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <kbd className="hidden sm:inline-flex items-center gap-0.5 absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] font-mono text-muted bg-panel border border-line rounded">
                Ctrl K
              </kbd>
            )}
          </div>
        </div>

        {/* 6 Category Filter Pills */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-5">
          {HELP_CATEGORIES.map((cat) => {
            const Icon = CATEGORY_ICONS[cat.iconName]
            const isSelected = selectedCategoryId === cat.id
            const articleCount = HELP_ARTICLES.filter((a) => a.categoryId === cat.id).length

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategoryId(isSelected ? 'all' : cat.id)}
                className={cn(
                  'text-left p-3.5 rounded-xl border transition-all flex items-start gap-3',
                  isSelected
                    ? 'bg-acc-soft border-acc/40 shadow-2xs'
                    : 'bg-raised/40 border-line hover:bg-raised hover:border-fg/20'
                )}
              >
                <div
                  className={cn(
                    'w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border',
                    isSelected
                      ? 'bg-acc text-on-acc border-transparent'
                      : 'bg-panel text-primary border-line'
                  )}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-fg truncate">{cat.title}</span>
                    <span className="text-[11px] font-medium text-muted bg-panel px-1.5 py-0.5 rounded border border-line shrink-0">
                      {articleCount} bài
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-1 line-clamp-2 leading-relaxed">
                    {cat.description}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Articles List */}
      <div className="rounded-2xl border border-line bg-panel overflow-hidden shadow-xs">
        <div className="px-5 py-3.5 border-b border-line bg-raised/60 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">
            {selectedCategoryId === 'all'
              ? `Tất cả bài viết (${filteredArticles.length})`
              : `${HELP_CATEGORIES.find((c) => c.id === selectedCategoryId)?.title ?? ''} (${filteredArticles.length})`}
          </span>
          {selectedCategoryId !== 'all' && (
            <button
              type="button"
              onClick={() => setSelectedCategoryId('all')}
              className="text-xs font-medium text-primary hover:underline"
            >
              Xem tất cả danh mục
            </button>
          )}
        </div>

        {filteredArticles.length === 0 ? (
          <div className="p-10 text-center">
            <BookOpen className="w-8 h-8 text-muted mx-auto mb-2 opacity-60" />
            <p className="text-sm font-medium text-fg">Không tìm thấy hướng dẫn phù hợp</p>
            <p className="text-xs text-muted mt-1">
              Thử từ khóa khác hoặc liên hệ trực tiếp chuyên viên hỗ trợ Digistay bên dưới.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {filteredArticles.map((article) => {
              const category = HELP_CATEGORIES.find((c) => c.id === article.categoryId)
              return (
                <button
                  key={article.id}
                  type="button"
                  onClick={() => setActiveArticle(article)}
                  className="w-full text-left p-4 sm:px-5 hover:bg-raised/60 transition-colors flex items-center justify-between gap-4 group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      {category && (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-raised border border-line text-muted">
                          {category.title}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted">
                        <Clock className="w-3 h-3" />
                        {article.readTimeMinutes} phút đọc
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold text-fg group-hover:text-primary transition-colors">
                      {article.title}
                    </h3>
                    <p className="text-xs text-muted mt-1 line-clamp-2">{article.summary}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Article Reader Modal */}
      {activeArticle && (
        <Modal
          isOpen={Boolean(activeArticle)}
          onClose={() => setActiveArticle(null)}
          size="lg"
        >
          <ModalHeader onClose={() => setActiveArticle(null)}>
            <div className="pr-4">
              <h3 className="text-base sm:text-lg font-bold text-fg">{activeArticle.title}</h3>
              <p className="text-xs text-muted mt-0.5 font-normal">{activeArticle.summary}</p>
            </div>
          </ModalHeader>
          <ModalBody className="space-y-4">
            <div className="space-y-3">
              {activeArticle.steps.map((step, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-raised/60 border border-line space-y-1.5"
                >
                  <h4 className="text-sm font-bold text-fg">{step.heading}</h4>
                  <p className="text-xs sm:text-sm text-fg/85 leading-relaxed">{step.detail}</p>
                </div>
              ))}
            </div>

            {activeArticle.tip && (
              <div className="p-4 rounded-xl bg-acc-soft/50 border border-acc/30 flex items-start gap-3">
                <Lightbulb className="w-4 h-4 text-acc shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm text-fg leading-relaxed">
                  <span className="font-semibold text-acc">Mẹo vận hành: </span>
                  {activeArticle.tip}
                </div>
              </div>
            )}

            {/* Helpful feedback */}
            <div className="pt-2 border-t border-line flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-muted">Hướng dẫn này có giúp ích cho bạn không?</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setFeedbackMap((prev) => ({ ...prev, [activeArticle.id]: 'up' }))
                  }
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                    feedbackMap[activeArticle.id] === 'up'
                      ? 'bg-ok-soft text-ok border-ok/30'
                      : 'bg-panel border-line text-muted hover:text-fg'
                  )}
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                  <span>Hữu ích</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setFeedbackMap((prev) => ({ ...prev, [activeArticle.id]: 'down' }))
                  }
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                    feedbackMap[activeArticle.id] === 'down'
                      ? 'bg-warn-soft text-warn border-warn/30'
                      : 'bg-panel border-line text-muted hover:text-fg'
                  )}
                >
                  <ThumbsDown className="w-3.5 h-3.5" />
                  <span>Cần chi tiết hơn</span>
                </button>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button onClick={() => setActiveArticle(null)}>Đóng</Button>
          </ModalFooter>
        </Modal>
      )}
    </section>
  )
}
