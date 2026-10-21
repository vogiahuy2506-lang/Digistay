import { useLocale } from 'next-intl'
import { blockText } from '@/lib/i18n/content'
import { GalleryClient } from './GalleryClient'
import type { PublicBlock, PublicImage } from '../PropertySite'

interface Props {
  block: PublicBlock
  images: PublicImage[]
}

export function GalleryBlock({ block, images }: Props) {
  const locale = useLocale()
  return <GalleryClient images={images} title={blockText(block.config, locale, 'galleryTitle', 'title')} />
}
