import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { isLocale } from '@/i18n/locales'
import { cn } from '@/lib/utils'
import { MarketingHeader } from './MarketingHeader'
import { DigisoLogo } from './DigisoLogo'
import { frame, lineButton } from './styles'
import { LEGAL_DOCS, LEGAL_COMPANY, type LegalDoc } from '@/lib/marketing/legal-docs'

interface LegalDocViewerProps {
  slug: string
}

export async function LegalDocViewer({ slug }: LegalDocViewerProps) {
  const current = await getLocale()
  const locale = isLocale(current) ? current : 'vi'
  const isEn = locale === 'en'

  const entry = LEGAL_DOCS[slug]
  const doc: LegalDoc = entry ? entry[isEn ? 'en' : 'vi'] : LEGAL_DOCS.terms[isEn ? 'en' : 'vi']

  // List of all other docs for the sidebar / navigation pill list
  const allDocs = Object.keys(LEGAL_DOCS).map((key) => ({
    slug: key,
    title: LEGAL_DOCS[key][isEn ? 'en' : 'vi'].shortTitle,
    category: LEGAL_DOCS[key][isEn ? 'en' : 'vi'].category,
    active: key === slug,
  }))

  const policyDocs = allDocs.filter((d) => d.category === 'policy')
  const legalDocs = allDocs.filter((d) => d.category === 'legal')

  return (
    <>
      <MarketingHeader />
      <main className={cn(frame, 'pt-10 pb-20 lg:pt-14 lg:pb-28')}>
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-2 text-xs text-muted">
          <Link href="/" className="hover:text-fg transition-colors">
            {isEn ? 'Home' : 'Trang chủ'}
          </Link>
          <span>/</span>
          <span className="text-fg font-medium">{doc.shortTitle}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-10 lg:gap-14 items-start">
          {/* Left Sidebar: Document Switcher */}
          <aside className="space-y-6 lg:sticky lg:top-24">
            <div className="rounded-box border border-line bg-panel p-5 space-y-4 shadow-2xs">
              <div className="border-b border-line/70 pb-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                  {isEn ? 'Transaction & Policies' : 'Chính sách & Giao dịch'}
                </span>
                <ul className="mt-2 space-y-1">
                  {policyDocs.map((item) => (
                    <li key={item.slug}>
                      <Link
                        href={`/${item.slug}`}
                        className={cn(
                          'block rounded-ctl px-2.5 py-1.5 text-xs transition-colors',
                          item.active
                            ? 'bg-primary/10 text-primary font-semibold border-l-2 border-primary pl-2'
                            : 'text-muted hover:text-fg hover:bg-fg/5'
                        )}
                      >
                        {item.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                  {isEn ? 'Legal & Compliance' : 'Pháp lý & Quy chế'}
                </span>
                <ul className="mt-2 space-y-1">
                  {legalDocs.map((item) => (
                    <li key={item.slug}>
                      <Link
                        href={`/${item.slug}`}
                        className={cn(
                          'block rounded-ctl px-2.5 py-1.5 text-xs transition-colors',
                          item.active
                            ? 'bg-primary/10 text-primary font-semibold border-l-2 border-primary pl-2'
                            : 'text-muted hover:text-fg hover:bg-fg/5'
                        )}
                      >
                        {item.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Entity Verification Card */}
            <div className="rounded-box border border-line bg-panel p-5 space-y-3 text-xs text-muted shadow-2xs">
              <div className="flex items-center gap-2">
                <DigisoLogo size="sm" />
              </div>
              <p className="font-semibold text-fg text-xs">{isEn ? LEGAL_COMPANY.nameEn : LEGAL_COMPANY.name}</p>
              <div className="space-y-1.5 pt-2 border-t border-line/60">
                <p>
                  <span className="font-medium text-fg">{isEn ? 'Tax ID / License:' : 'Mã số thuế / GPKD:'}</span>{' '}
                  {LEGAL_COMPANY.taxId}
                </p>
                <p>
                  <span className="font-medium text-fg">{isEn ? 'Hotline:' : 'Hotline hỗ trợ:'}</span>{' '}
                  <a href={`tel:${LEGAL_COMPANY.hotline.replace(/\D/g, '')}`} className="text-primary hover:underline font-semibold">
                    {LEGAL_COMPANY.hotline}
                  </a>
                </p>
                <p>
                  <span className="font-medium text-fg">Email:</span>{' '}
                  <a href={`mailto:${LEGAL_COMPANY.email}`} className="text-primary hover:underline">
                    {LEGAL_COMPANY.email}
                  </a>
                </p>
              </div>
            </div>
          </aside>

          {/* Right Canvas: Article Content */}
          <article className="min-w-0 rounded-box border border-line bg-panel p-6 sm:p-10 lg:p-12 shadow-2xs space-y-8">
            <header className="border-b border-line/70 pb-6 space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[11px] font-semibold text-primary">
                <span>{isEn ? 'Official Decree Compliance' : 'Văn bản ban hành chính thức'}</span>
              </div>
              <h1 className="font-serif text-[28px] sm:text-[36px] lg:text-[40px] font-medium leading-[1.15] text-fg tracking-[-0.02em]">
                {doc.title}
              </h1>
              <p className="text-sm sm:text-base text-muted leading-relaxed max-w-[760px]">
                {doc.summary}
              </p>
              <p className="text-[12px] text-muted pt-1">
                {isEn ? 'Effective date & last updated:' : 'Ngày cập nhật & có hiệu lực:'}{' '}
                <span className="font-medium text-fg">{doc.lastUpdated}</span>
              </p>
            </header>

            {/* Sections */}
            <div className="space-y-8 text-sm sm:text-[15px] leading-relaxed text-fg/90">
              {doc.sections.map((sec, idx) => (
                <section key={idx} className="space-y-3">
                  <h2 className="font-serif text-lg sm:text-xl font-semibold text-fg">
                    {sec.heading}
                  </h2>
                  <div className="space-y-2.5 text-muted leading-relaxed">
                    {sec.paragraphs.map((p, pIdx) => (
                      <p key={pIdx}>{p}</p>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            {/* Official Certification Footer within Document */}
            <footer className="border-t border-line/70 pt-6 mt-10 space-y-3 text-xs text-muted">
              <p className="font-semibold text-fg uppercase tracking-wider text-[11px]">
                {isEn ? 'DIGISO Digital Solutions Co., Ltd. Legal Office' : 'Văn phòng Pháp chế Công ty TNHH Giải pháp số DIGISO'}
              </p>
              <p>{isEn ? LEGAL_COMPANY.nameEn : LEGAL_COMPANY.name} · {LEGAL_COMPANY.address}</p>
              <p>{isEn ? 'Complaints & Inquiries:' : 'Tiếp nhận phản ánh & giải quyết khiếu nại:'} {LEGAL_COMPANY.email} · {LEGAL_COMPANY.hotline}</p>
            </footer>
          </article>
        </div>
      </main>
    </>
  )
}

