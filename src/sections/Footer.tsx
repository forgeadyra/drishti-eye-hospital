import { business, real } from '../content/business'
import { ExternalLink } from '../components/ExternalLink'
import { EyeMark } from '../components/Icons'
import { Text } from '../components/Text'
import { NAV } from '../components/Header'
import { Hours } from './Location'

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-ink py-16">
      <div className="container-x grid gap-12 md:grid-cols-3">
        <div>
          <p className="flex items-center gap-2.5 font-display text-xl">
            <EyeMark className="size-7 text-accent" /> {business.name}
          </p>
          <p className="mt-3 text-sm text-muted">{business.doctor}</p>
        </div>
        <div>
          <h2 className="eyebrow">Hours</h2>
          <Hours className="mt-4 text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-8">
          <nav aria-label="Footer">
            <h2 className="eyebrow">Explore</h2>
            <ul className="mt-4 space-y-2 text-sm text-muted">
              {NAV.map((n) => (
                <li key={n.id}>
                  <a href={`#${n.id}`} className="hover:text-cream">
                    {n.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div>
            <h2 className="eyebrow">Follow</h2>
            <ul className="mt-4 space-y-2 text-sm text-muted">
              {business.socials.map((s) => (
                <li key={s.label}>
                  {real(s.url) ? (
                    <ExternalLink href={s.url} className="hover:text-cream" aria-label={`${s.label} (opens in a new tab)`}>
                      {s.label}
                    </ExternalLink>
                  ) : (
                    <span>
                      {s.label}: <Text value={s.url} />
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <div className="container-x mt-14 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs text-muted sm:flex-row sm:justify-between">
        <p>
          © {__BUILD_YEAR__} {business.name}. All rights reserved.
        </p>
        <p>Website content is general information, not medical advice.</p>
      </div>
    </footer>
  )
}
