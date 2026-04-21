# UI/UX Pro Max — Design Intelligence Skill

## Activation
Use this skill whenever a task changes how a feature **looks, feels, moves, or is interacted with**.

**Must use:** New pages, UI components, color/typography systems, UX/accessibility review, navigation, animations, product-level design decisions.
**Skip:** Pure backend logic, API/DB design, performance unrelated to UI, infrastructure, non-visual scripts.

---

## Priority Rules (apply in order)

### 1. Accessibility — CRITICAL
- Contrast ratio ≥ 4.5:1 (text), ≥ 3:1 (large text/UI components)
- All interactive elements have visible focus states (`focus-visible:ring-2`)
- Alt text on all images; ARIA labels on icon-only buttons
- Keyboard navigable: Tab order logical, Enter/Space activate buttons

### 2. Touch & Interaction — CRITICAL
- Minimum tap target: 44×44px (use `min-h-[44px] min-w-[44px]`)
- Touch targets ≥ 8px apart
- Loading feedback within 100ms of any async action
- Never block user input during animation

### 3. Performance — HIGH
- Images: WebP/AVIF, `next/image` with proper `sizes`
- Lazy load below-fold content
- Prevent layout shift: reserve space for async content (Skeleton components)
- CLS < 0.1

### 4. Style Selection — HIGH
- Match visual style to product domain (B2B industrial = clean, data-dense, trustworthy)
- This project uses: **shadcn/ui + Tailwind CSS dark-mode-ready tokens**
- Consistent icon family: use `lucide-react` exclusively
- No emoji as icons in production UI

### 5. Layout & Responsive — HIGH
- Mobile-first: design for 375px, then scale up
- Systematic breakpoints: `sm:` (640px), `md:` (768px), `lg:` (1024px)
- No horizontal scroll on any viewport
- Grid: prefer `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` patterns

### 6. Typography & Color — MEDIUM
- Line-height: 1.5–1.75 for body text
- Line length: 65–75 characters max for reading text
- Use semantic color tokens: `text-foreground`, `text-muted-foreground`, `bg-muted`, `border-border`
- Never hardcode hex colors — use CSS variables via Tailwind tokens

### 7. Animation — MEDIUM
- Duration: 150–300ms for UI transitions
- Only animate `transform` and `opacity` (GPU-accelerated)
- Respect `prefers-reduced-motion`: wrap with `motion-safe:` modifier
- `transition-all` is acceptable for shadcn components

### 8. Forms & Feedback — MEDIUM
- Labels always visible (not placeholder-only)
- Inline error messages below the field, `text-destructive text-xs`
- Success states: brief toast or inline badge (not modal)
- Progressive disclosure: show advanced options only when needed

### 9. Navigation — HIGH
- Max 5 items in bottom/primary nav
- Predictable back behavior (browser back = previous state)
- Active nav item clearly highlighted (`bg-accent text-accent-foreground`)
- Deep link support: every view has a shareable URL

### 10. Data Visualization — MEDIUM
- Match chart type to data: time series → line, comparison → bar, composition → stacked
- Accessible color palettes: never convey info by color alone (add icon/label)
- Always include legends and tooltips
- Empty states with actionable CTAs, not just "No data"

---

## Matec Radar B2B Design System

**Domain:** Industrial B2B SaaS — financial signals, investment intelligence, LATAM market
**Tone:** Professional, data-dense, trustworthy, efficient
**Avoid:** Consumer-grade playfulness, excessive gradients, decorative animations

**Color strategy (Tailwind tokens):**
- Primary actions: `bg-primary text-primary-foreground`
- Signals activos: `text-green-700 dark:text-green-400` / `bg-green-500/10`
- Signals descartados: `text-muted-foreground`
- Errors: `text-destructive bg-destructive/10`
- Costs/money: `text-amber-600 dark:text-amber-400`

**Component patterns:**
- KPI cards: `Card p-4` with icon top-right, value `text-2xl font-bold`, subtitle `text-xs text-muted-foreground`
- Status badges: `Badge variant="outline"` with colored dot prefix
- Tables: shadcn `Table` with `hover:bg-muted/20` rows, right-aligned numbers
- Empty states: centered icon (muted, size 32), short text, primary CTA button

---

## Pre-Delivery Checklist

- [ ] No layout shift when data loads (Skeleton used)
- [ ] All interactive elements keyboard accessible
- [ ] Mobile viewport tested (375px)
- [ ] Dark mode contrast verified
- [ ] Loading, error, and empty states all handled
- [ ] No hardcoded colors
- [ ] Consistent icon family (lucide-react only)
- [ ] Tap targets ≥ 44px
- [ ] Animations ≤ 300ms, respect reduced-motion
