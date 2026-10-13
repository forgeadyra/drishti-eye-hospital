import { useEffect } from 'react'
import { domAnimation, LazyMotion, MotionConfig } from 'framer-motion'
import { Cursor } from './components/Cursor'
import { Header } from './components/Header'
import { Intro } from './components/Intro'
import { initScroll } from './lib/scroll'
import { useMounted } from './lib/useMounted'
import { About } from './sections/About'
import { Contact } from './sections/Contact'
import { Footer } from './sections/Footer'
import { Gallery } from './sections/Gallery'
import { Hero } from './sections/Hero'
import { Location } from './sections/Location'
import { Services } from './sections/Services'
import { WhyUs } from './sections/WhyUs'

export function App() {
  const mounted = useMounted()
  useEffect(() => initScroll(), [])

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <a
          href="#main"
          className="sr-only-focusable fixed top-3 left-3 z-[80] rounded-full bg-accent px-4 py-2 text-sm font-semibold text-navy"
        >
          Skip to content
        </a>
        <Intro />
        <Header />
        <main id="main" tabIndex={-1} className="outline-none">
          <Hero />
          <About />
          <Services />
          <Gallery />
          <WhyUs />
          <Location />
          <Contact />
        </main>
        <Footer />
        {mounted && <Cursor />}
      </MotionConfig>
    </LazyMotion>
  )
}
