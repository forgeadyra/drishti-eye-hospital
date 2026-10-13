import type { AnchorHTMLAttributes } from 'react'

/** The ONLY place target="_blank" is allowed (enforced by ESLint). Always rel="noopener noreferrer". */
export function ExternalLink({ children, ...props }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'target' | 'rel'>) {
  return (
    <a {...props} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  )
}
