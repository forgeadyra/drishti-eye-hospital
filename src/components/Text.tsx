import { Fragment } from 'react'
import { PLACEHOLDER } from '../content/business'

const SPLIT = /(\{\{[A-Z0-9_]+\}\})/g

/** Renders business copy, highlighting any {{PLACEHOLDER}} tokens so they can't ship unnoticed. */
export function Text({ value }: { value: string }) {
  if (!PLACEHOLDER.test(value)) return <>{value}</>
  return (
    <>
      {value.split(SPLIT).map((part, i) =>
        PLACEHOLDER.test(part) ? (
          <span key={i} className="ph" title="Placeholder: owner to supply">
            {part}
          </span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  )
}
