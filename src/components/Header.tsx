import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { business, telHref } from '../content/business'
import { lockScroll, scrollToSection } from '../lib/scroll'
import { curves, duration, stagger } from '../motion/config'
import { CloseIcon, EyeMark, PhoneIcon } from './Icons'

export const NAV = [
  { id: 'about', label: 'About' },
  { id: 'services', label: 'Services' },
  { id: 'gallery', label: 'Gallery' },
  { id: 'why-us', label: 'Why us' },
  { id: 'location', label: 'Location' },
  { id: 'contact', label: 'Contact' },
] as const

function onNav(e: MouseEvent<HTMLAnchorElement>, id: string, after?: () => void) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
  e.preventDefault()
  after?.()
  scrollToSection(id)
}

export function Header() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [hidden, setHidden] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let lastY = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      setScrolled(y > 24)
      setHidden(y > 240 && y > lastY)
      lastY = y
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    lockScroll(open)
  }, [open])

  const close = () => {
    setOpen(false)
    menuButton.current?.focus()
  }

  return (
    <>
      <header
        className={[
          'fixed inset-x-0 top-0 z-40 transition-[transform,background-color,border-color] duration-500 ease-(--ease-out)',
          scrolled ? 'border-b border-white/10 bg-ink/80 backdrop-blur-md' : 'border-b border-transparent',
          hidden && !open ? '-translate-y-full' : 'translate-y-0',
        ].join(' ')}
      >
        <div className="container-x flex h-16 items-center justify-between gap-4">
          <a href="#top" onClick={(e) => onNav(e, 'top')} className="flex items-center gap-2.5 font-display text-lg">
            <EyeMark className="size-7 text-accent" />
            <span>{business.name}</span>
          </a>

          <nav aria-label="Primary" className="hidden lg:block">
            <ul className="flex items-center gap-7 text-sm text-muted">
              {NAV.map((n) => (
                <li key={n.id}>
                  <a
                    href={`#${n.id}`}
                    onClick={(e) => onNav(e, n.id)}
                    className="relative py-2 transition-colors hover:text-cream after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:scale-x-0 after:bg-accent after:transition-transform after:duration-500 after:ease-(--ease-out) hover:after:scale-x-100"
                  >
                    {n.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-2">
            <a href={telHref ?? '#contact'} className="btn-primary hidden min-h-10 px-4 sm:inline-flex">
              <PhoneIcon className="size-4" /> Call
            </a>
            <button
              ref={menuButton}
              type="button"
              className="grid size-11 place-items-center rounded-full border border-white/15 lg:hidden"
              aria-expanded={open}
              aria-controls="mobile-menu"
              aria-label={open ? 'Close menu' : 'Open menu'}
              onClick={() => setOpen((o) => !o)}
            >
              <span aria-hidden="true" className="relative block h-3 w-5">
                <span
                  className={`absolute left-0 block h-px w-5 bg-current transition-transform duration-300 ${open ? 'top-1.5 rotate-45' : 'top-0'}`}
                />
                <span
                  className={`absolute left-0 block h-px w-5 bg-current transition-transform duration-300 ${open ? 'top-1.5 -rotate-45' : 'top-3'}`}
                />
              </span>
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>{open && <MobileMenu onClose={close} />}</AnimatePresence>
    </>
  )
}

function MobileMenu({ onClose }: { onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = panel.current
    if (!el) return
    const focusables = () => Array.from(el.querySelectorAll<HTMLElement>('a[href], button'))
    focusables()[0]?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key !== 'Tab') return
      const list = focusables()
      const first = list[0]
      const last = list[list.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last?.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <m.div
      ref={panel}
      id="mobile-menu"
      role="dialog"
      aria-modal="true"
      aria-label="Site menu"
      className="fixed inset-0 z-50 flex flex-col bg-navy lg:hidden"
      initial={{ clipPath: 'circle(0% at calc(100% - 2.5rem) 2rem)' }}
      animate={{ clipPath: 'circle(150% at calc(100% - 2.5rem) 2rem)' }}
      exit={{ clipPath: 'circle(0% at calc(100% - 2.5rem) 2rem)' }}
      transition={{ duration: duration.base, ease: curves.inOut }}
    >
      <div className="container-x flex h-16 items-center justify-end">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close menu"
          className="grid size-11 place-items-center rounded-full border border-white/15"
        >
          <CloseIcon />
        </button>
      </div>
      <nav aria-label="Mobile" className="container-x flex flex-1 flex-col justify-center">
        <m.ul
          className="space-y-2"
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: stagger.base, delayChildren: 0.15 } } }}
        >
          {NAV.map((n) => (
            <m.li
              key={n.id}
              variants={{
                hidden: { opacity: 0, y: 24 },
                show: { opacity: 1, y: 0, transition: { duration: duration.base, ease: curves.out } },
              }}
            >
              <a href={`#${n.id}`} onClick={(e) => onNav(e, n.id, onClose)} className="h-display block py-2 text-4xl">
                {n.label}
              </a>
            </m.li>
          ))}
        </m.ul>
      </nav>
    </m.div>
  )
}
