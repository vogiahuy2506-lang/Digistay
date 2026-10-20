import { GalleryClient } from './GalleryClient'
import type { PublicBlock, PublicImage } from '../PropertySite'
import { cfgText } from '../site-ui'

interface Props {
  block: PublicBlock
  images: PublicImage[]
}

export function GalleryBlock({ block, images }: Props) {
  return <GalleryClient images={images} title={cfgText(block.config, 'galleryTitle', 'title')} />
}
