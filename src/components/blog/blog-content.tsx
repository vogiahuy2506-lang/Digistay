import * as React from 'react'

interface BlogContentProps {
  content: string
  className?: string
}

/**
 * Safely parses inline markdown (bold, italic, links, inline code) into React elements.
 */
function parseInline(text: string): React.ReactNode[] {
  // Regex matches:
  // 1. Link: [title](url)
  // 2. Bold: **text**
  // 3. Italic: *text*
  // 4. Inline code: `code`
  const tokenRegex = /(!?\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g
  const parts = text.split(tokenRegex)

  return parts.map((part, idx) => {
    if (!part) return null

    // Image ![alt](url)
    if (part.startsWith('![') && part.includes('](') && part.endsWith(')')) {
      const alt = part.slice(2, part.indexOf(']('))
      const url = part.slice(part.indexOf('](') + 2, -1)
      return (
        <span key={idx} className="my-6 block overflow-hidden rounded-box border border-line bg-page text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={alt} className="w-full object-cover max-h-[500px]" />
          {alt && <span className="block py-2 text-center text-xs text-muted italic">{alt}</span>}
        </span>
      )
    }

    // Link [title](url)
    if (part.startsWith('[') && part.includes('](') && part.endsWith(')')) {
      const label = part.slice(1, part.indexOf(']('))
      const url = part.slice(part.indexOf('](') + 2, -1)
      const isExternal = url.startsWith('http') || url.startsWith('//')
      return (
        <a
          key={idx}
          href={url}
          target={isExternal ? '_blank' : undefined}
          rel={isExternal ? 'noopener noreferrer' : undefined}
          className="text-acc font-medium underline underline-offset-4 hover:opacity-85 transition-opacity"
        >
          {label}
        </a>
      )
    }

    // Bold **text**
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-fg">
          {part.slice(2, -2)}
        </strong>
      )
    }

    // Italic *text*
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return (
        <em key={idx} className="italic">
          {part.slice(1, -1)}
        </em>
      )
    }

    // Code `code`
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code key={idx} className="rounded bg-fg/10 px-1.5 py-0.5 text-xs font-mono text-fg">
          {part.slice(1, -1)}
        </code>
      )
    }

    return <React.Fragment key={idx}>{part}</React.Fragment>
  })
}

/**
 * Renders blog content written in simple Markdown (headings, lists, blockquotes, images, bold, links).
 */
export function BlogContent({ content, className = '' }: BlogContentProps) {
  if (!content) return null

  // Normalize newlines and split into blocks by blank lines
  const rawBlocks = content.replace(/\r\n/g, '\n').split(/\n\s*\n/)

  return (
    <div className={`space-y-6 text-body leading-[1.8] text-fg/90 ${className}`}>
      {rawBlocks.map((block, bIdx) => {
        const trimmed = block.trim()
        if (!trimmed) return null

        const lines = trimmed.split('\n').map((l) => l.trim())

        // Heading 1 (# ...)
        if (lines[0].startsWith('# ') && lines.length === 1) {
          return (
            <h2 key={bIdx} className="font-site text-2xl sm:text-3xl font-bold text-fg mt-10 mb-4 pb-2 border-b border-line">
              {parseInline(lines[0].slice(2))}
            </h2>
          )
        }

        // Heading 2 (## ...)
        if (lines[0].startsWith('## ') && lines.length === 1) {
          return (
            <h2 key={bIdx} className="font-site text-xl sm:text-2xl font-semibold text-fg mt-8 mb-3 pb-1 border-b border-line/60">
              {parseInline(lines[0].slice(3))}
            </h2>
          )
        }

        // Heading 3 (### ...)
        if (lines[0].startsWith('### ') && lines.length === 1) {
          return (
            <h3 key={bIdx} className="font-site text-lg sm:text-xl font-semibold text-fg mt-6 mb-2">
              {parseInline(lines[0].slice(4))}
            </h3>
          )
        }

        // Blockquote (> ...)
        if (lines.every((l) => l.startsWith('> ') || l === '>')) {
          const quoteText = lines.map((l) => l.replace(/^>\s?/, '')).join(' ')
          return (
            <blockquote key={bIdx} className="my-6 border-l-4 border-acc bg-panel/70 p-4 sm:p-5 rounded-r-ctl italic text-muted text-body sm:text-[17px] leading-relaxed">
              {parseInline(quoteText)}
            </blockquote>
          )
        }

        // Unordered list (- ... or * ...)
        if (lines.every((l) => l.startsWith('- ') || l.startsWith('* '))) {
          return (
            <ul key={bIdx} className="my-4 list-disc list-inside space-y-2 pl-2 text-fg/90">
              {lines.map((item, lIdx) => (
                <li key={lIdx} className="leading-relaxed">
                  {parseInline(item.slice(2))}
                </li>
              ))}
            </ul>
          )
        }

        // Ordered list (1. ..., 2. ...)
        if (lines.every((l) => /^\d+\.\s/.test(l))) {
          return (
            <ol key={bIdx} className="my-4 list-decimal list-inside space-y-2 pl-2 text-fg/90">
              {lines.map((item, lIdx) => (
                <li key={lIdx} className="leading-relaxed">
                  {parseInline(item.replace(/^\d+\.\s/, ''))}
                </li>
              ))}
            </ol>
          )
        }

        // Paragraph with line breaks preserved
        return (
          <p key={bIdx} className="my-4 leading-relaxed text-[16px] sm:text-[17px]">
            {lines.map((line, lIdx) => (
              <React.Fragment key={lIdx}>
                {parseInline(line)}
                {lIdx < lines.length - 1 && <br />}
              </React.Fragment>
            ))}
          </p>
        )
      })}
    </div>
  )
}
