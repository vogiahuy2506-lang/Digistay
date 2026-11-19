'use client'

import * as React from 'react'
import { useTranslations, useLocale } from 'next-intl'
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
  Image as ImageIcon,
  PenLine,
  MousePointerClick,
} from 'lucide-react'
import {
  getHelpDocs,
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
  const t = useTranslations('dash.help.articles')
  const locale = useLocale()
  const { helpCategories, helpArticles } = React.useMemo(() => getHelpDocs(locale), [locale])

  const [searchQuery, setSearchQuery] = React.useState('')
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<string>('all')
  const [activeArticle, setActiveArticle] = React.useState<HelpArticle | null>(null)
  const [activeSpotIdx, setActiveSpotIdx] = React.useState<number>(0)
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

  const openArticle = (article: HelpArticle) => {
    setActiveArticle(article)
    setActiveSpotIdx(0)
  }

  const normalizedQuery = searchQuery.trim().toLowerCase()

  const filteredArticles = React.useMemo(() => {
    return helpArticles.filter((article) => {
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
  }, [helpArticles, selectedCategoryId, normalizedQuery])

  // Keep activeArticle synced when locale changes
  React.useEffect(() => {
    if (activeArticle) {
      const updated = helpArticles.find((a) => a.id === activeArticle.id)
      if (updated) setActiveArticle(updated)
    }
  }, [helpArticles]) // eslint-disable-line react-hooks/exhaustive-deps

  const activeSpot = activeArticle?.spots?.[activeSpotIdx]

  return (
    <section className="space-y-6">
      {/* Search Bar */}
      <div className="rounded-2xl border border-line bg-panel p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-fg flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              {t('title', { count: helpArticles.length })}
            </h2>
            <p className="text-xs text-muted mt-0.5">
              {t('subtitle')}
            </p>
          </div>

          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-full h-10 pl-10 pr-20 rounded-xl bg-raised border border-line text-sm text-fg placeholder:text-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-fg p-1"
                aria-label={t('clearSearch')}
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
          {helpCategories.map((cat) => {
            const Icon = CATEGORY_ICONS[cat.iconName]
            const isSelected = selectedCategoryId === cat.id
            const articleCount = helpArticles.filter((a) => a.categoryId === cat.id).length

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
                      {t('articleCount', { count: articleCount })}
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
              ? t('allCategories', { count: filteredArticles.length })
              : t('categoryTitle', {
                  title: helpCategories.find((c) => c.id === selectedCategoryId)?.title ?? '',
                  count: filteredArticles.length,
                })}
          </span>
          {selectedCategoryId !== 'all' && (
            <button
              type="button"
              onClick={() => setSelectedCategoryId('all')}
              className="text-xs font-medium text-primary hover:underline"
            >
              {t('viewAll')}
            </button>
          )}
        </div>

        {filteredArticles.length === 0 ? (
          <div className="p-10 text-center">
            <BookOpen className="w-8 h-8 text-muted mx-auto mb-2 opacity-60" />
            <p className="text-sm font-medium text-fg">{t('notFoundTitle')}</p>
            <p className="text-xs text-muted mt-1">
              {t('notFoundSubtitle')}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {filteredArticles.map((article) => {
              const category = helpCategories.find((c) => c.id === article.categoryId)
              return (
                <button
                  key={article.id}
                  type="button"
                  onClick={() => openArticle(article)}
                  className="w-full text-left p-4 sm:px-5 hover:bg-raised/60 transition-colors flex items-center justify-between gap-4 group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      {category && (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-raised border border-line text-muted">
                          {category.title}
                        </span>
                      )}
                      {article.screenshot && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-acc-soft text-acc border border-acc/20">
                          <ImageIcon className="w-3 h-3" />
                          {t('hasScreenshots')}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted">
                        <Clock className="w-3 h-3" />
                        {t('readTime', { min: article.readTimeMinutes })}
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

      {/* Article Reader Modal with Interactive Annotated Screenshot */}
      {activeArticle && (
        <Modal
          isOpen={Boolean(activeArticle)}
          onClose={() => setActiveArticle(null)}
          size="xl"
        >
          <ModalHeader onClose={() => setActiveArticle(null)}>
            <div className="pr-4">
              <h3 className="text-base sm:text-lg font-bold text-fg">{activeArticle.title}</h3>
              <p className="text-xs text-muted mt-0.5 font-normal">{activeArticle.summary}</p>
            </div>
          </ModalHeader>
          <ModalBody className="space-y-5">
            {/* Interactive Screenshot with Highlighted Callouts */}
            {activeArticle.screenshot && (
              <div className="space-y-2.5">
                <div className="aspect-video w-full rounded-xl overflow-hidden border border-line bg-neutral-950 relative shadow-md select-none">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={activeArticle.screenshot}
                    alt={activeArticle.title}
                    className="w-full h-full object-cover object-top"
                  />
                  <div className="absolute inset-0 bg-black/15 pointer-events-none" />

                  {activeArticle.spots?.map((spot, idx) => {
                    const isCurrent = idx === activeSpotIdx
                    const Icon = spot.kind === 'input' ? PenLine : MousePointerClick
                    return (
                      <button
                        key={spot.id}
                        type="button"
                        onClick={() => setActiveSpotIdx(idx)}
                        style={{
                          left: `${spot.x}%`,
                          top: `${spot.y}%`,
                          width: `${spot.w}%`,
                          height: `${spot.h}%`,
                        }}
                        className={cn(
                          'absolute rounded-lg transition-all duration-200 cursor-pointer focus:outline-none',
                          isCurrent
                            ? 'border-2 border-primary bg-primary/15 ring-4 ring-primary/40 shadow-lg z-20'
                            : 'border-2 border-dashed border-amber-400/80 bg-amber-400/10 hover:bg-amber-400/20 z-10 opacity-85'
                        )}
                      >
                        <div
                          className={cn(
                            'absolute left-0 flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold whitespace-nowrap shadow-md',
                            spot.badgePos === 'bottom' ? 'top-full mt-1' : 'bottom-full mb-1',
                            isCurrent
                              ? 'bg-primary text-white'
                              : 'bg-neutral-900/90 text-amber-300 border border-amber-400/40'
                          )}
                        >
                          <span
                            className={cn(
                              'w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-extrabold',
                              isCurrent ? 'bg-white text-primary' : 'bg-amber-400 text-neutral-950'
                            )}
                          >
                            {spot.id}
                          </span>
                          <Icon className="w-3 h-3 shrink-0" />
                          <span>{spot.label}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>

                {/* Callout Spot Pills & Explanation */}
                {activeArticle.spots && activeArticle.spots.length > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-raised border border-line">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {activeArticle.spots.map((s, idx) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setActiveSpotIdx(idx)}
                          className={cn(
                            'px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors',
                            idx === activeSpotIdx
                              ? 'bg-primary text-on-primary border-transparent'
                              : 'bg-panel border-line text-muted hover:text-fg'
                          )}
                        >
                          #{s.id} {s.label}
                        </button>
                      ))}
                    </div>
                    {activeSpot && (
                      <p className="text-xs font-medium text-fg">
                        👉 <span className="text-primary font-semibold">{activeSpot.label}:</span> {activeSpot.hint}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Text Step-by-Step */}
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
                  <span className="font-semibold text-acc">{t('modalTipTitle')}</span>
                  {activeArticle.tip}
                </div>
              </div>
            )}

            {/* Helpful feedback */}
            <div className="pt-2 border-t border-line flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-muted">{t('feedbackQuestion')}</span>
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
                  <span>{t('feedbackHelpful')}</span>
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
                  <span>{t('feedbackNeedMore')}</span>
                </button>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button onClick={() => setActiveArticle(null)}>{t('close')}</Button>
          </ModalFooter>
        </Modal>
      )}
    </section>
  )
}
