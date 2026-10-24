import { serializeJsonLd } from '@/lib/seo/json-ld'

/** schema.org structured data for crawlers; the text is escaped by serializeJsonLd. */
export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />
}
