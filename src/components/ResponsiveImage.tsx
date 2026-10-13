import type { GalleryImage } from '../content/gallery'

/** AVIF → WebP <picture> with srcset, explicit dimensions (no CLS) and lazy loading by default. */
export function ResponsiveImage({
  image,
  sizes,
  className = '',
  eager = false,
}: {
  image: GalleryImage
  sizes: string
  className?: string
  eager?: boolean
}) {
  return (
    <picture>
      <source type="image/avif" srcSet={image.avif} sizes={sizes} />
      <source type="image/webp" srcSet={image.webp} sizes={sizes} />
      <img
        src={image.src}
        alt={image.alt}
        width={image.width}
        height={image.height}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        className={className}
      />
    </picture>
  )
}
