import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import '@fontsource-variable/fraunces/wght.css'
import '@fontsource-variable/inter/wght.css'
import './styles/index.css'
import './styles/intro.css'
import { App } from './App'

const container = document.getElementById('root')
if (!container) throw new Error('#root missing')

const app = (
  <StrictMode>
    <App />
  </StrictMode>
)

// Production HTML is prerendered at build time (scripts/prerender.mjs) → hydrate.
// The dev server serves an empty #root → render.
if (container.hasChildNodes()) hydrateRoot(container, app)
else createRoot(container).render(app)
