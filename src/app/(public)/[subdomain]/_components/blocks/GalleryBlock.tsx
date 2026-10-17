import { GalleryClient } from './GalleryClient'
import type { PublicBlock, PublicImage } from '../PropertySite'

interface Props {
  block: PublicBlock
  images: PublicImage[]
}

export function GalleryBlock({ block, images }: Props) {
  return <GalleryClient images={images} title={block.config?.title} />
}
