import type { ReactNode } from 'react'

export function SectionHeading({ id, eyebrow, children }: { id: string; eyebrow: string; children: ReactNode }) {
  return (
    <header className="mb-10 max-w-2xl md:mb-14">
      <p className="eyebrow" data-reveal>
        {eyebrow}
      </p>
      <h2 id={id} className="h-display mt-3 text-4xl sm:text-5xl md:text-6xl" data-reveal>
        {children}
      </h2>
    </header>
  )
}
