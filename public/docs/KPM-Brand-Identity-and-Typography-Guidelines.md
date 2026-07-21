# KPM Brand Identity & Typography Guidelines

## 1. Executive Summary
KPM (Kapuletu Project Management) is a core product within the broader Kapuletu ecosystem. This document serves as the single source of truth for the KPM brand identity. It ensures that KPM inherits and extends the established Kapuletu visual language—maintaining consistency, trust, and a professional, cohesive appearance across the entire product suite without introducing unrelated colors or typography.

## 2. Brand Philosophy
KPM is designed around minimalism, precision, and modern utility. It stands as an enterprise-grade project management tool that seamlessly fits into the Kapuletu family. The brand emphasizes:
- **Trust and Professionalism:** Achieved through deep, stable colors.
- **Minimalism:** Avoiding clutter, relying on generous spacing.
- **Scalability:** Built on precise geometric foundations that translate well from mobile interfaces to large desktop displays.

## 3. Relationship to Kapuletu
KPM is **not** a new company or an independent identity. It is a sub-brand of Kapuletu Systems. 
Like Kapuletu Treasury, Kapuletu Payments, or Kapuletu Analytics, KPM must immediately be recognizable as a Kapuletu product. The wordmark reflects this relationship structurally: the primary focus is on "KPM", physically supported by a smaller "by Kapuletu" signature, utilizing identical typographic proportions and stroke widths as the parent brand.

## 4. Existing Brand Audit
An exhaustive audit of the existing Kapuletu repository reveals a highly structured brand:
- **Primary Logo:** A horizontal layout combining the geometric mark and the "Kapuletu" wordmark.
- **Icon Mark:** A distinct vertical monogram/symbol constructed from precise SVG vector paths.
- **Brand Colors:**
  - Kapuletu Green: `#097255`
  - Kapuletu Orange: `#ec7b23`
  - Kapuletu Navy Blue: `#1b4580`
- **Typography:** Built around the **Geist** typeface family (`Geist` Sans and `Geist_Mono` for monospace needs), ensuring high legibility and a modern software aesthetic.

## 5. Logo System
The KPM logo system derives directly from the Kapuletu foundation:
- **Primary Logo:** The Kapuletu icon mark placed to the left of the "KPM" wordmark.
- **Secondary Logo:** "KPM" stacked vertically above "by Kapuletu", accompanied by the icon mark.
- **Icon Only:** The Kapuletu icon mark used in isolation for avatars, favicons, and constrained spaces.
- **Geometry:** Inherits the Kapuletu mark's strict mathematical proportions and stroke weights. No stretching, skewing, or reshaping is permitted.

## 6. Typography System
KPM strictly utilizes the fonts established in the Kapuletu ecosystem.
- **Primary Font:** Geist Sans (for all UI, body text, headings, and landing pages).
- **Secondary / Monospace Font:** Geist Mono (for code snippets, data tables, and technical readouts).

**Scale (Responsive - Desktop/Tablet/Mobile):**
- **Hero Typography:** 48px / 40px / 32px (Weight: 700, Tracking: -0.02em)
- **Heading Scale (H1-H6):** 36px to 16px (Weights: 600-700)
- **Body Scale:** 16px (Base), 14px (Secondary) (Weight: 400, Line-height: 1.5)
- **Caption Scale:** 12px (Weight: 400, Line-height: 1.4)
- **Navigation/Button:** 14px (Weight: 500, Tracking: 0.01em)
- **Table/Form:** 14px (Weight: 400, Geist Sans or Mono depending on data)

## 7. Color System
KPM inherits the Kapuletu color tokens seamlessly without introducing new unapproved hues.
- **Primary:** Kapuletu Green (`#097255`)
- **Secondary:** Kapuletu Navy Blue (`#1b4580`)
- **Accent:** Kapuletu Orange (`#ec7b23`)
- **Success:** `#059669` (derived from primary green spectrum)
- **Warning:** `#d97706` (derived from accent orange spectrum)
- **Danger:** `#dc2626`
- **Info:** `#2563eb` (derived from secondary blue spectrum)
- **Neutral / Background (Light Mode):** `#ffffff` (Foreground: `#171717`)
- **Neutral / Background (Dark Mode):** `#0a0a0a` (Foreground: `#ededed`)
- **Surface:** `#f9fafb` (Light) / `#171717` (Dark)
- **Border:** `#e5e7eb` (Light) / `#262626` (Dark)

## 8. Logo Specifications
- **Primary Logo:** Full color on a white/light background.
- **Monochrome:** Solid black (`#171717`) or Solid white (`#ffffff`) depending on contrast requirements.
- **Clear Space:** Minimum clear space around the logo must be equal to 50% of the logo mark's height.
- **Minimum Size:** 
  - Print: 15mm width
  - Digital: 80px width

## 9. Icon Specifications
The Kapuletu/KPM icon mark is the standalone symbol.
- **Favicon:** Minimum 16x16px, optimized for pixel grids.
- **App Icon:** 1024x1024px safe area, background filled with Kapuletu Navy Blue or White.
- **Social Avatar:** Center-aligned inside a circle mask, ensuring edges of the mark do not clip the mask.

## 10. SVG Construction Guidance
SVG logos must be generated programmatically to ensure precision:
- Use `viewBox` coordinates that allow for perfect pixel mapping (e.g., matching the original `0 0 829.98 1184.9`).
- Maintain existing vector paths (`<path>`).
- Use CSS classes for fill colors (`.cls-1{fill:#097255;}`, etc.) to allow easy theming and dark mode injection.
- Ensure all paths are closed and optimized.

## 11. Export Guidelines
- **Web:** SVG format preferred for infinite scalability.
- **Presentations/Social:** PNG format (2x resolution) with transparent backgrounds.
- **Print:** PDF or EPS using CMYK color approximations.

## 12. PNG Guidelines
- Always export at a minimum of 2000px on the longest edge for master files.
- Enable anti-aliasing.
- Ensure transparent background unless a solid fill is required for specific app store assets.

## 13. Print Guidelines
- Convert HEX colors to CMYK before sending to print.
  - Green (`#097255`): C:88 M:29 Y:76 K:15
  - Orange (`#ec7b23`): C:4 M:62 Y:97 K:0
  - Navy (`#1b4580`): C:97 M:79 Y:24 K:9
- Minimum 300 DPI resolution.

## 14. Digital Guidelines
- Use SVG inline wherever possible to reduce HTTP requests and allow CSS manipulation.
- Utilize CSS variables for colors (e.g., `--color-primary`, `--color-accent`) referencing the defined hex codes.

## 15. Accessibility
- Ensure a minimum contrast ratio of 4.5:1 for all text against backgrounds. 
- Kapuletu Navy Blue (`#1b4580`) on White (`#ffffff`) passes AAA contrast requirements.
- Kapuletu Green (`#097255`) on White (`#ffffff`) passes AA contrast requirements.
- Do not use Kapuletu Orange for small body text; use it exclusively for UI accents, borders, or large graphical elements.

## 16. Responsive Branding
- **Desktop:** Full horizontal Primary Logo.
- **Tablet:** Full horizontal Primary Logo.
- **Mobile:** Icon Mark only (to preserve navbar real estate).

## 17. Do's and Don'ts
- **DO** use the designated Kapuletu colors.
- **DO** maintain the original geometric proportions of the mark.
- **DO** use the Geist font family for all text.
- **DON'T** stretch, skew, or distort the logo.
- **DON'T** introduce new typography or competing visual languages.
- **DON'T** place the full-color logo on complex photographic backgrounds (use the white monochrome version instead).

## 18. Examples
- **Kapuletu KPM:** (Primary product signature)
- **Kapuletu Treasury:** (Ecosystem sibling)
- **Kapuletu Analytics:** (Ecosystem sibling)
These should visually align side-by-side perfectly, functioning as a united family.

## 19. Future Extensions
Any future Kapuletu products must follow this exact methodology: isolating the core brand colors, utilizing the primary icon mark, and adhering to the Geist typographic scale. The scripts provided for KPM logo generation can be easily adapted to render "Kapuletu [New Product]" dynamically.

## 20. Appendix
- **Primary Source Files:** `/public/logos/`
- **SVG Generation Scripts:** `/scripts/generate-kpm-logos.js`
- **CSS Tokens:** `/app/globals.css`
