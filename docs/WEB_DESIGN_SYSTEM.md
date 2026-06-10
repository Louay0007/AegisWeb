# Web Design System

Source scope: `apps/web`.

This document captures the current design language, implementation tokens, component patterns, motion rules, and page-section behavior used by the web app. It is based on the routed Next.js app under `apps/web/app`, the custom sections under `apps/web/components/sections`, the app header, image helper, global CSS, and the shadcn/Radix UI primitives in `apps/web/components/ui`.

## Product Identity

The web app is branded as `MONO` in the interface, while the Next metadata title is `EVASION`. The current visual direction is an editorial architectural landing page for sustainable modular/passive homes. The UI should feel premium, minimal, image-led, cinematic, and quiet.

Primary attributes:

- Monochrome, high contrast, restrained palette.
- Large architectural imagery as the main brand signal.
- Minimal chrome and navigation.
- Scroll-driven image reveals and text transitions.
- Sharp or lightly rounded geometry depending on context.
- Sparse typography with oversized display moments.
- Emphasis on sustainable construction, passive energy, and modular surface options.

## Framework And Libraries

The app uses:

- Next.js App Router.
- React 19.
- Tailwind CSS 4 via CSS `@theme inline`.
- `tw-animate-css` and shadcn animation classes.
- Radix UI primitives through local shadcn-style components.
- `class-variance-authority` for component variants.
- `clsx` and `tailwind-merge` through `cn()`.
- `lucide-react` for icons.
- `next/image` for local image assets.
- `next/font/google` with Inter loaded in `app/layout.tsx`.
- Vercel Analytics.

## Source Files

Key app files:

- `apps/web/app/layout.tsx`: metadata, Inter font loading, global CSS import.
- `apps/web/app/page.tsx`: page composition order.
- `apps/web/app/globals.css`: active design tokens, global theme, custom animation utilities.
- `apps/web/styles/globals.css`: unused/default shadcn global CSS copy. It is not imported by the routed app.
- `apps/web/components/header.tsx`: floating responsive navigation.
- `apps/web/components/fade-image.tsx`: viewport-triggered image fade helper.
- `apps/web/components/sections/*`: landing page sections.
- `apps/web/components/ui/*`: shadcn/Radix primitives.
- `apps/web/lib/utils.ts`: `cn()` utility.

## Page Composition

The home page renders this section order:

1. `Header`
2. `HeroSection`
3. `PhilosophySection`
4. `FeaturedProductsSection`
5. `TechnologySection`
6. `GallerySection`
7. `CollectionSection`
8. `EditorialSection`
9. `TestimonialsSection`
10. `FooterSection`

This means the first viewport is image-first and motion-heavy. Supporting commercial/product information arrives later through image grids, model cards, specs, and footer navigation.

## Color System

The active tokens are defined in `apps/web/app/globals.css`. The design is intentionally grayscale with one destructive red token.

### Light Theme Tokens

| Token | Value | Usage |
| --- | --- | --- |
| `--background` | `#FFFFFF` | Page background |
| `--foreground` | `#0A0A0A` | Main text, dark sections, primary controls |
| `--card` | `#FFFFFF` | Card background |
| `--card-foreground` | `#0A0A0A` | Card text |
| `--popover` | `#FFFFFF` | Floating surfaces |
| `--popover-foreground` | `#0A0A0A` | Floating surface text |
| `--primary` | `#0A0A0A` | Primary UI fill |
| `--primary-foreground` | `#FFFFFF` | Primary UI text |
| `--secondary` | `#F5F5F5` | Secondary surface |
| `--secondary-foreground` | `#0A0A0A` | Secondary text |
| `--muted` | `#F5F5F5` | Muted backgrounds |
| `--muted-foreground` | `#737373` | Secondary body text |
| `--accent` | `#0A0A0A` | Accent fill |
| `--accent-foreground` | `#FFFFFF` | Accent text |
| `--destructive` | `#DC2626` | Destructive actions/errors |
| `--destructive-foreground` | `#FFFFFF` | Destructive text |
| `--border` | `#E5E5E5` | Dividers and borders |
| `--input` | `#F5F5F5` | Input background |
| `--ring` | `#0A0A0A` | Focus ring |

### Dark Theme Tokens

| Token | Value | Usage |
| --- | --- | --- |
| `--background` | `#0A0A0A` | Dark page background |
| `--foreground` | `#FAFAFA` | Main dark-mode text |
| `--card` | `#0A0A0A` | Dark cards |
| `--card-foreground` | `#FAFAFA` | Dark card text |
| `--popover` | `#0A0A0A` | Dark floating surfaces |
| `--popover-foreground` | `#FAFAFA` | Dark floating text |
| `--primary` | `#FAFAFA` | Dark-mode primary fill |
| `--primary-foreground` | `#0A0A0A` | Dark-mode primary text |
| `--secondary` | `#171717` | Dark secondary surface |
| `--secondary-foreground` | `#FAFAFA` | Dark secondary text |
| `--muted` | `#262626` | Dark muted surface |
| `--muted-foreground` | `#A3A3A3` | Dark muted text |
| `--accent` | `#FAFAFA` | Dark accent fill |
| `--accent-foreground` | `#0A0A0A` | Dark accent text |
| `--destructive` | `#DC2626` | Destructive actions/errors |
| `--destructive-foreground` | `#FFFFFF` | Destructive text |
| `--border` | `#262626` | Dark borders |
| `--input` | `#171717` | Dark inputs |
| `--ring` | `#FAFAFA` | Dark focus ring |

### Chart Tokens

Light:

- `--chart-1`: `#0A0A0A`
- `--chart-2`: `#525252`
- `--chart-3`: `#737373`
- `--chart-4`: `#A3A3A3`
- `--chart-5`: `#D4D4D4`

Dark:

- `--chart-1`: `#FAFAFA`
- `--chart-2`: `#A3A3A3`
- `--chart-3`: `#737373`
- `--chart-4`: `#525252`
- `--chart-5`: `#262626`

### Sidebar Tokens

The shadcn sidebar tokens are present even though the landing page does not currently render a sidebar.

Light sidebar:

- `--sidebar`: `#0A0A0A`
- `--sidebar-foreground`: `#FFFFFF`
- `--sidebar-primary`: `#FFFFFF`
- `--sidebar-primary-foreground`: `#0A0A0A`
- `--sidebar-accent`: `#262626`
- `--sidebar-accent-foreground`: `#FFFFFF`
- `--sidebar-border`: `#262626`
- `--sidebar-ring`: `#FFFFFF`

Dark sidebar:

- `--sidebar`: `#171717`
- `--sidebar-foreground`: `#FAFAFA`
- `--sidebar-primary`: `#FAFAFA`
- `--sidebar-primary-foreground`: `#0A0A0A`
- `--sidebar-accent`: `#262626`
- `--sidebar-accent-foreground`: `#FAFAFA`
- `--sidebar-border`: `#262626`
- `--sidebar-ring`: `#FAFAFA`

## Tailwind Theme Mapping

`@theme inline` maps CSS variables to Tailwind tokens:

- `bg-background`, `text-foreground`
- `bg-card`, `text-card-foreground`
- `bg-popover`, `text-popover-foreground`
- `bg-primary`, `text-primary-foreground`
- `bg-secondary`, `text-secondary-foreground`
- `bg-muted`, `text-muted-foreground`
- `bg-accent`, `text-accent-foreground`
- `bg-destructive`, `text-destructive-foreground`
- `border-border`
- `ring-ring`
- `bg-sidebar`, `text-sidebar-foreground`

Use these semantic classes instead of hard-coded grays in new components, unless the intended color is tied to image overlay behavior such as `bg-black/70` or `text-white`.

## Typography

### Font Families

Active font loading:

- `Inter` is loaded from `next/font/google` and assigned to `--font-inter`.
- The body uses `font-sans`.

Theme font tokens:

- `--font-sans`: `'Inter', 'Inter Fallback', system-ui, sans-serif`
- `--font-mono`: `'JetBrains Mono', monospace`
- `--font-display`: `'PP Editorial New', 'Times New Roman', serif`

Important note: `PP Editorial New` and `JetBrains Mono` are referenced in CSS but not imported in the current app. Inter is the only actively loaded external font.

### Type Scale In Use

The landing page uses Tailwind utilities directly:

- Brand/logo: `text-lg font-medium tracking-tight`
- Nav links: `text-sm`
- Mobile nav links: `text-lg`
- Section title: `text-3xl md:text-4xl font-medium tracking-tight`
- Hero wordmark: `text-[35vw] font-bold leading-[0.8] tracking-tighter`
- Large animated philosophy titles: `text-[8vw] sm:text-[7vw] md:text-[6vw] lg:text-[5vw] font-medium leading-tight tracking-tighter`
- Technology title cycle: `text-5xl md:text-5xl lg:text-7xl font-medium leading-tight tracking-tight`
- Overlay editorial copy: `text-2xl md:text-3xl lg:text-[2.5rem] leading-relaxed lg:leading-snug`
- Technology description: `text-3xl md:text-4xl lg:text-5xl font-semibold leading-snug`
- Specs values: `text-5xl font-medium`
- Specs labels: `text-xs uppercase tracking-widest`
- Footer text: `text-sm` and `text-xs`

### Typography Rules

- Use Inter for all default UI and body text.
- Use very large type only in immersive hero or scroll-driven editorial sections.
- Keep body copy spacious: `leading-relaxed` or `leading-snug` depending on size.
- Use `tracking-tight` for brand-like headings and `tracking-widest` for small uppercase metadata.
- Keep navigation and footer text small and quiet.

## Radius System

The active root radius is:

- `--radius: 0rem`

Theme derived radii:

- `--radius-sm`: `calc(var(--radius) - 4px)`
- `--radius-md`: `calc(var(--radius) - 2px)`
- `--radius-lg`: `var(--radius)`
- `--radius-xl`: `calc(var(--radius) + 4px)`

Because `--radius` is zero, token-based shadcn radii are visually square or near-square. The custom landing page still uses explicit Tailwind radii for specific image and nav treatments:

- Header scrolled state: `rounded-full`
- Header mobile menu: `rounded-b-2xl`
- Product/model image cards: `rounded-2xl`
- Gallery frames: `rounded-xl md:rounded-2xl`
- Featured bento items: `rounded-lg`
- shadcn buttons/badges/inputs: mostly `rounded-md`
- Avatars, sliders, switches: `rounded-full`

Guidance:

- Use square geometry for core architectural framing.
- Use large radius only for floating navigation, image cards, and gallery frames.
- Avoid casual pill shapes except CTAs, header shell, switches, and circular controls.

## Spacing And Layout

### Page Gutters

The main landing sections use a consistent responsive gutter:

- Mobile: `px-6` or `px-4` for dense image grids.
- Tablet: `md:px-12`.
- Desktop: `lg:px-20`.

### Section Vertical Spacing

Common vertical rhythm:

- Standard image/product sections: `py-20 md:py-32`.
- Deep editorial sections: `py-24 md:py-32 lg:py-40`.
- Footer: `py-16 md:py-20`.
- Bottom padding for product carousel: `pb-24`.

### Containers

Common max widths:

- Header: `max-w-3xl`
- Featured bento grid: `max-w-7xl`
- Gallery stack: `max-w-5xl`
- Overlay copy: `max-w-5xl`
- Hero tagline: `max-w-2xl`
- Technology description: `max-w-4xl`
- Footer brand copy: `max-w-xs`

### Grid Patterns

- Featured image bento: `grid-cols-2 md:grid-cols-4`, `auto-rows-[180px] md:auto-rows-[220px]`, `gap-3 md:gap-4`.
- Model cards: mobile horizontal snap carousel, desktop `md:grid-cols-3` with `gap-8`.
- Specs: `grid-cols-2 md:grid-cols-4`, bordered cells.
- Footer: `grid-cols-2 md:grid-cols-4 lg:grid-cols-5`.

## Imagery

The design system is image-led. Images are not decorative; they carry product identity.

### Asset Groups

Hero:

- `/images/hero-mono.png`
- `/images/hero-side-1.png`
- `/images/hero-side-2.png`
- `/images/hero-side-3.png`
- `/images/hero-side-4.png`

Time-of-day architecture sequence:

- `/images/mono-1.png`
- `/images/mono-2.png`
- `/images/mono-3.png`
- `/images/mono-4.png`

Material/interior supporting images:

- `/images/interior-view.png`
- `/images/rusted-metal.png`

Featured architecture/sketch grid:

- `/images/4312e1bb-e030-4528-b6df-8a6ea69fe384.png`
- `/images/b2401fa5-4eac-465f-b1f9-014aadc182ee.png`
- `/images/dd1b32a8-3722-4ea2-8808-10d53532809d.png`
- `/images/61af06cc-84d0-4031-a0ed-76fc43b1c1e1.png`
- `/images/249083d2-c49c-4c06-a125-376284d90c42.png`
- `/images/7638f650-8586-4403-8c13-141921a04f9d.png`
- `/images/5b3bdb95-fac7-4d22-aa97-98b5d547b2db.png`
- `/images/634f7bae-77a5-49d0-a0ab-5271a6194e66.png`
- `/images/09ffa8fd-cdd1-453f-9aa2-d6c702a1f4b5.png`
- `/images/040e36b1-d16f-474b-a712-a9979e6ab479.png`

About/testimonial:

- `/images/testimonial-house.png`

Placeholders and icons:

- `/placeholder.svg`
- `/placeholder.jpg`
- `/placeholder-user.jpg`
- `/placeholder-logo.svg`
- `/placeholder-logo.png`
- `/icon.svg`
- `/icon-light-32x32.png`
- `/icon-dark-32x32.png`
- `/apple-icon.png`

### Image Treatment

- Use `next/image` with `fill` for immersive layouts.
- Default image fitting: `object-cover`.
- Hero and technology images are full-bleed or near full-bleed.
- Product/model images use `aspect-[2/3]`.
- Video/editorial media uses `aspect-[16/9] md:aspect-[21/9]`.
- About image uses `aspect-[16/9]`.
- Gallery stack uses `h-[70vh] md:h-[80vh]`.
- Hover zoom on model cards: `group-hover:scale-105`.
- Lazy reveal helper: opacity from `0` to `100`, scale from `1.02` to `1`, duration `700ms`, ease-out.

## Motion System

Motion is a central design feature. It is scroll-driven, cinematic, and mostly opacity/transform based.

### Global Keyframes

Defined in `app/globals.css`:

- `slideUp`: text enters from `translateY(100%)` to `0`, opacity `0` to `1`.
- `float`: vertical float from `0` to `-20px`.
- `reveal-up`: `translateY(60px)` to `0`, opacity `0` to `1`.
- `reveal-left`: `translateX(-60px)` to `0`, opacity `0` to `1`.
- `reveal-right`: `translateX(60px)` to `0`, opacity `0` to `1`.
- `scale-in`: scale `0.9` to `1`, opacity `0` to `1`.
- `grain`: translates a noise layer in stepped movement.
- `fadeIn`: image opacity `0` to `1`, scale `1.02` to `1`.

Utility classes:

- `.animate-float`: `6s ease-in-out infinite`
- `.animate-reveal-up`: `0.8s ease-out forwards`
- `.animate-reveal-left`: `0.8s ease-out forwards`
- `.animate-reveal-right`: `0.8s ease-out forwards`
- `.animate-scale-in`: `0.6s ease-out forwards`
- `.animate-fade-in`: `0.7s ease-out forwards`
- `.animation-delay-100` through `.animation-delay-600`

### Section Motion Patterns

Hero:

- Sticky `h-screen` with `200vh` scroll space.
- Big `MONO` word fades out early.
- Center hero image shrinks from `100%` width to `20%`.
- Side image columns expand from `0%` to `40%` each.
- Side columns translate from off-canvas into view.
- Dynamic gap grows from `0px` to `8px`.
- Tagline is fixed at bottom and fades with the hero text.

Philosophy:

- Sticky `h-screen` within `200vh`.
- Three titles rotate through `rotateX`.
- Description words reveal by opacity and blur as they enter viewport.

Technology:

- Sticky `h-screen` with `400vh` scroll space.
- Center image width transitions from `100%` to `42%`.
- Side columns grow to `22%` each.
- Image padding/gap grows to `16px`.
- Four time-of-day images crossfade.
- Three title cycles reveal and disappear word-by-word through blur and opacity.
- Final description reveals word-by-word over black.

Gallery:

- Sticky `h-screen`.
- Images stack upward with `translateY`, `scale`, and opacity.
- Last image expands toward fullscreen with eased cubic progress.
- Border radius decreases during expansion.

Editorial:

- Video parallax uses `scale(1.15)` and vertical translate from roughly `-15px` to `15px`.

### Motion Rules

- Prefer transform and opacity over layout-affecting animation.
- Use `will-change` only on active animated elements.
- Use `requestAnimationFrame` for scroll handlers in heavier sections.
- Keep text reveal blur maximum at `40px` where matching existing patterns.
- Use passive scroll listeners.
- For future work, add reduced-motion fallbacks for sticky/scroll animations.

## Navigation

The header is a centered floating nav:

- Position: `fixed top-4 left-1/2 -translate-x-1/2 z-50`.
- Width: `w-[90%] max-w-3xl`.
- Default: transparent.
- Scrolled after `window.scrollY > 50`: `bg-background/80 backdrop-blur-md rounded-full`.
- Scrolled shadow is a layered low-opacity blue-gray box shadow.
- Internal layout: `flex items-center justify-between px-2 pl-5 py-2`.
- Brand: `MONO`, `text-lg font-medium tracking-tight`.
- Desktop nav gap: `gap-10`.
- Desktop CTA: rounded full inverse pill, `px-4 py-2 text-sm font-medium bg-foreground text-background`.
- Mobile button uses lucide `Menu` and `X`.
- Mobile menu: border top, `bg-background`, `px-6 py-8`, `rounded-b-2xl`.

Nav targets:

- `#technology`: Design
- `#gallery`: Gallery
- `#accessories`: Models
- `#about`: About
- `#reserve`: Contact, but there is no matching `id="reserve"` section in the current page.

## Component Primitives

The `components/ui` folder is a broad shadcn/Radix component set. Most components follow this visual grammar:

- Semantic color tokens.
- `rounded-md` for controls.
- `text-sm` for interactive surfaces.
- `shadow-xs`, `shadow-sm`, `shadow-md`, or `shadow-lg` depending on elevation.
- `focus-visible:ring-ring/50 focus-visible:ring-[3px]`.
- Disabled state: `disabled:pointer-events-none disabled:opacity-50`.
- Icons default to `size-4` when no explicit size is provided.
- Popovers/dialogs use shadcn `animate-in`, `animate-out`, fade, zoom, and slide classes.

### Button

Variants:

- `default`: `bg-primary text-primary-foreground hover:bg-primary/90`
- `destructive`: red destructive fill, white text
- `outline`: border, background, `shadow-xs`, hover accent
- `secondary`: secondary fill
- `ghost`: hover accent only
- `link`: underline on hover

Sizes:

- `default`: `h-9 px-4 py-2`
- `sm`: `h-8 px-3`
- `lg`: `h-10 px-6`
- `icon`: `size-9`
- `icon-sm`: `size-8`
- `icon-lg`: `size-10`

### Badge

Variants:

- `default`
- `secondary`
- `destructive`
- `outline`

Base shape: `rounded-md border px-2 py-0.5 text-xs font-medium`.

### Card

Base:

- `bg-card text-card-foreground`
- `flex flex-col gap-6`
- `rounded-xl border py-6 shadow-sm`

Subcomponents:

- `CardHeader`: grid layout, `px-6`.
- `CardTitle`: `leading-none font-semibold`.
- `CardDescription`: `text-muted-foreground text-sm`.
- `CardContent`: `px-6`.
- `CardFooter`: `flex items-center px-6`.

### Form And Input Controls

Common shape:

- `rounded-md`
- `border-input`
- `bg-transparent` or `dark:bg-input/30`
- `px-3 py-2`
- `h-9` for default controls
- `text-sm` on desktop, `text-base md:text-sm` for inputs/textareas where mobile zoom prevention matters
- Invalid state uses destructive border/ring.

### Overlay Components

Dialogs, sheets, select menus, dropdowns, context menus, hover cards, popovers, and tooltips use:

- `bg-background` or `bg-popover`.
- Token foreground colors.
- Border and shadow.
- `rounded-md` or `rounded-lg`.
- Enter/exit animation classes.
- Overlay backgrounds commonly use `bg-black/50`.

### Tabs And Toggles

Tabs:

- List: `bg-muted text-muted-foreground h-9 rounded-lg p-[3px]`.
- Trigger: active background, active shadow, `rounded-md`.

Toggle:

- Variants: default and outline.
- Sizes: default, sm, lg.
- Active state: `data-[state=on]:bg-accent data-[state=on]:text-accent-foreground`.

### Sidebar

Sidebar primitives are present and tokenized, but not used in the landing page. They support:

- Offcanvas, icon, and floating variants.
- Width variables: `--sidebar-width`, `--sidebar-width-icon`.
- Sidebar-specific foreground, accent, border, and ring tokens.

## Section Specs

### HeroSection

Purpose: first-viewport cinematic brand/product reveal.

Visual ingredients:

- Sticky full-screen image composition.
- Large behind-image `MONO` wordmark.
- Bottom fixed tagline: "Lightweight, durable and adventure-ready."
- Five hero images arranged into central and side columns.

Important implementation details:

- Scroll progress measured against `window.innerHeight * 2`.
- Text opacity fades out over first `20%` of progress.
- Image transformation uses the remaining `80%`.
- Center image goes from full width to narrow central column.
- Side images are hidden at start, then slide into a bento-like row.

### PhilosophySection

Purpose: communicate sustainability positioning.

Text sequence:

- "Sustainable Architecture."
- "Built for Tomorrow."
- "Eco-Responsible."

Description:

- "A design home that combines contemporary aesthetics and energy performance. Built with eco-friendly materials, it minimizes carbon footprint while offering optimal comfort."

Visual behavior:

- 3D title rotation on scroll.
- Word-by-word blur reveal for description.

### FeaturedProductsSection

Purpose: visual proof/gallery grid.

Pattern:

- 10-image bento layout.
- Desktop: 4 columns.
- Mobile: 2 columns.
- Mixed spans: large, small, tall, wide.
- `rounded-lg border border-gray-200`.

Note: `border-gray-200` is a hard-coded color. Prefer `border-border` for future consistency unless the lighter border is intentional.

### TechnologySection

Purpose: explain passive-energy and sustainable material strategy through cinematic scroll.

Title cycles:

- "Design & Sustainability."
- "Passive Energy."
- "Bio-sourced Construction."

Description:

- "Passive architecture reimagining modern living. Triple glazing, reinforced insulation and natural ventilation combine with solar panels to create an energy-autonomous home. Bio-sourced materials like solid wood and hemp wool ensure healthy indoor air and minimal ecological footprint."

Visual behavior:

- Black section, white text.
- Center architectural image sequence.
- Side images show interior/material cues.
- Crossfades through four architecture images.
- Word-level blur reveal/disappear.

Implementation note:

- `grayscaleAmount` is computed but unused.

### GallerySection

Purpose: immersive time-of-day image stack.

Visual behavior:

- Black background.
- Sticky stacked images.
- Last image expands toward fullscreen.
- Uses `max-w-5xl h-[70vh] md:h-[80vh]`.

### CollectionSection

Purpose: present model/surface options.

Section title:

- "Surface Options"

Items:

- Compact Model: `120m2 living space with optimal energy efficiency`, `$285,000`
- Standard Model: `180m2 perfect balance of space and sustainability`, `$395,000`
- Premium Model: `250m2 expansive design with maximum comfort`, `$525,000`

Layout:

- Mobile horizontal snap carousel, `w-[75vw]`.
- Desktop 3-column grid.
- Images use `aspect-[2/3] rounded-2xl bg-secondary`.

Encoding note:

- The source file currently contains mojibake for square-meter symbols (`mÂ²`). In visible copy, this should be corrected to `m2` or `m²` consistently.

### EditorialSection

Purpose: video proof point and technical specs.

Media:

- Full-width remote MP4 background/video.
- Parallax movement with slight scale.

Specs:

- Surface Area: `180m2`
- Energy Use: `15 kWh/m2`
- Solar Panels: `40 m2`
- Carbon Balance: `-20%`

Layout:

- Video aspect: `16:9`, then `21:9` at desktop.
- Specs grid: 2 columns mobile, 4 columns desktop.
- Cells use border dividers and centered text.

Encoding note:

- The source file currently contains mojibake for square-meter symbols (`mÂ²`).

### TestimonialsSection

Purpose: closing emotional/about statement.

Pattern:

- Full-width `16:9` image.
- Gradient overlay from black at bottom to transparent.
- Bottom-aligned centered text.

Copy:

- "A passive house that combines contemporary design with environmental respect - built for those who refuse to choose between modern comfort and ecological responsibility."

Encoding note:

- The source file currently contains mojibake for an em dash (`â€”`). Use a hyphen or a proper em dash consistently.

### FooterSection

Purpose: brand summary and site links.

Layout:

- Top border.
- Responsive grid.
- Brand column spans 2 columns on mobile and large desktop.
- Three link groups: Explore, About, Service.
- Bottom bar with copyright and social links.

Footer links:

- Explore: Products, Technology, Gallery, Accessories.
- About: Our Story, Team, Careers, Contact.
- Service: FAQ, Shipping, Returns, Warranty.
- Social: Instagram, Twitter, YouTube.

## Accessibility Notes

Strengths:

- Images have descriptive `alt` text.
- Header mobile button has `aria-label="Toggle menu"`.
- Radix primitives provide strong accessibility defaults.
- Focus-visible ring patterns are defined across UI primitives.
- Semantic `header`, `nav`, `main`, `section`, and `footer` elements are used.

Risks and improvements:

- The hero section links to `#hero`, but the hero section has no `id="hero"`.
- The CTA links to `#reserve`, but no matching section exists.
- Several scroll-driven animations should respect `prefers-reduced-motion`.
- Fixed hero tagline may overlap content during scroll on smaller devices.
- Some large white overlay text depends on image contrast; keep dark overlays when using new imagery.
- Mobile carousel uses `scrollbar-hide`, but there is no visible scroll affordance.
- The active body font is Inter; display and mono font tokens are referenced but not loaded.

## Implementation Guidelines For New Work

Use these rules when extending the web app:

- Build from semantic tokens in `app/globals.css`.
- Keep the palette monochrome unless adding a purposeful status color.
- Prefer full-bleed or large-format real product/architecture media.
- Use `next/image` with stable aspect ratios.
- Use `px-6 md:px-12 lg:px-20` as the default page gutter.
- Use `py-20 md:py-32` for normal sections and larger vertical padding for editorial moments.
- Keep controls small, quiet, and token-based.
- Use lucide icons for icon buttons.
- Keep hover states subtle: opacity, color token shift, or slight image scale.
- Use `requestAnimationFrame` for scroll-driven transforms.
- Add reduced-motion fallbacks for new animation-heavy sections.
- Avoid adding decorative gradients or ornamental blobs.
- Avoid making marketing cards inside cards; sections should stay full-width and image-led.

## Known Consistency Issues

- `apps/web/styles/globals.css` is not imported and conflicts with the active `app/globals.css` token values. Treat it as unused unless the app routing changes.
- The metadata title `EVASION` and UI brand `MONO` do not match.
- Metadata description says "outdoor gear", while the page content is about architectural/passive homes.
- `#hero` and `#reserve` anchors are referenced but not defined.
- Some visible strings contain mojibake (`mÂ²`, `â€”`) in source files.
- `PP Editorial New` and `JetBrains Mono` are defined as theme fonts but are not loaded.
- `FeaturedProductsSection` uses hard-coded `border-gray-200` instead of the `border-border` token.
- `TechnologySection` computes `grayscaleAmount` but does not use it.

## Quick Token Reference

```css
:root {
  --background: #FFFFFF;
  --foreground: #0A0A0A;
  --primary: #0A0A0A;
  --primary-foreground: #FFFFFF;
  --secondary: #F5F5F5;
  --muted-foreground: #737373;
  --border: #E5E5E5;
  --destructive: #DC2626;
  --radius: 0rem;
}

.dark {
  --background: #0A0A0A;
  --foreground: #FAFAFA;
  --primary: #FAFAFA;
  --primary-foreground: #0A0A0A;
  --secondary: #171717;
  --muted-foreground: #A3A3A3;
  --border: #262626;
}
```

