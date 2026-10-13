import { useEffect, useRef } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { lockScroll } from '../lib/scroll'
import { curves, duration } from '../motion/config'
import { ChevronIcon, CloseIcon } from './Icons'
import type { GalleryImage } from '../content/gallery'
import { ResponsiveImage } from './ResponsiveImage'

interface Props {
  images: GalleryImage[]
  index: number | null
  onChange: (index: number | null) => void
}

/** Accessible lightbox: focus-trapped dialog, Esc / ← / → keys, focus returns to the opener. */
export function Lightbox({ images, index, onChange }: Props) {
  const dialog = useRef<HTMLDivElement>(null)
  const opener = useRef<HTMLElement | null>(null)
  const open = index !== null
  const image = open ? images[index] : undefined

  useEffect(() => {
    if (!open) return
    opener.current = document.activeElement as HTMLElement | null
    lockScroll(true)
    dialog.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    return () => {
      lockScroll(false)
      opener.current?.focus()
    }
  }, [open])

  useEffect(() => {
    if (index === null) return
    const n = images.length
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onChange(null)
      else if (e.key === 'ArrowRight') onChange((index + 1) % n)
      else if (e.key === 'ArrowLeft') onChange((index - 1 + n) % n)
      else if (e.key === 'Tab') {
        const f = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button') ?? [])
        const first = f[0]
        const last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last?.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first?.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [index, images.length, onChange])

  return (
    <AnimatePresence>
      {image && index !== null && (
        <m.div
          ref={dialog}
          role="dialog"
          aria-modal="true"
          aria-label={`Image ${index + 1} of ${images.length}: ${image.alt}`}
          className="fixed inset-0 z-50 grid place-items-center bg-ink/95 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: duration.fast, ease: curves.out }}
          onClick={(e) => e.target === e.currentTarget && onChange(null)}
        >
          <m.figure
            key={image.src}
            className="max-h-[80svh] max-w-5xl"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: duration.base, ease: curves.out }}
          >
            <ResponsiveImage image={image} sizes="(min-width: 1024px) 64rem, 100vw" className="max-h-[75svh] w-auto rounded-2xl object-contain" eager />
            <figcaption className="mt-3 text-center text-sm text-muted">{image.alt}</figcaption>
          </m.figure>
          <button data-autofocus type="button" onClick={() => onChange(null)} aria-label="Close image viewer" className="absolute top-4 right-4 grid size-12 place-items-center rounded-full border border-white/20 bg-navy">
            <CloseIcon />
          </button>
          {images.length > 1 && (
            <>
              <button type="button" aria-label="Previous image" onClick={() => onChange((index - 1 + images.length) % images.length)} className="absolute left-4 grid size-12 place-items-center rounded-full border border-white/20 bg-navy">
                <ChevronIcon className="rotate-180" />
              </button>
              <button type="button" aria-label="Next image" onClick={() => onChange((index + 1) % images.length)} className="absolute right-4 grid size-12 place-items-center rounded-full border border-white/20 bg-navy">
                <ChevronIcon />
              </button>
            </>
          )}
        </m.div>
      )}
    </AnimatePresence>
  )
}
