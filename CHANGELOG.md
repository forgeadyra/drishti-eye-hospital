# Changelog

## 1.0.0 — 2026-10-13

First release.

- One-page site: hero, about, services, gallery, why us, location, contact, footer and a custom 404.
- 3D "coming into focus" hero (an iris point cloud behind a glass lens) that reacts to the pointer and to scrolling. It loads lazily and falls back to a static poster when there's no WebGL, the device is low-end, or reduced motion is on.
- Motion: GSAP ScrollTrigger and SplitText for scroll reveals, Lenis for smooth scrolling, and Framer Motion for the menu, lightbox, counters, magnetic buttons, card tilt and the cursor ring. Easing and timing are defined once in `src/motion/config.ts`.
- Performance: the page is prerendered at build time, critical CSS is inlined under a CSP hash, and the JS loads after first paint. Initial JS is 165 KB gzipped.
- Contact function: zod validation, sanitising, a honeypot, Turnstile, an Upstash rate limit and Resend email.
- Strict security headers, generated from `config/headers.ts`.
- SEO: JSON-LD for the clinic (`MedicalClinic`), Open Graph and Twitter cards, a sitemap, robots.txt and a favicon set.
- Build gates (`verify-dist`), browser QA, Lighthouse and function-test scripts, plus CI.
- Deployed to https://drishti-eye-hospital.netlify.app.
