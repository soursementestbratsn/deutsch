# Deutsch Quest — Mobile/iPhone Adaptation Plan

## Current State Analysis

**Desktop-first implementation** with minimal mobile support (only 15 lines in `mobile.css`). Key issues:
- Horizontal navigation with dropdown menus (not thumb-friendly)
- 3-column layouts collapse only at 1080px
- Touch targets often < 44×44px
- No safe-area handling for iPhone notch/home indicator
- Modals/settings not full-screen on mobile
- Heavy `backdrop-filter` usage hurts mobile Safari performance
- No PWA manifest for "Add to Home Screen"
- Input zoom on iOS (font-size < 16px)

---

## Phase 1: Foundation & Core CSS (Week 1)

### 1.1 Viewport & Safe Areas
- **File**: `web/index.html` (line 5)
- Add/verify: `viewport-fit=cover` ✓ (already present)
- Add CSS env() variables for safe areas in `glass.css`:
  ```css
  :root {
    --safe-top: env(safe-area-inset-top, 0);
    --safe-bottom: env(safe-area-inset-bottom, 0);
    --safe-left: env(safe-area-inset-left, 0);
    --safe-right: env(safe-area-inset-right, 0);
  }
  ```

### 1.2 Mobile-First Breakpoint System
- **File**: `web/glass.css` (new section at top)
- Define consistent breakpoints:
  ```css
  /* Mobile-first breakpoints */
  --bp-xs: 375px;   /* iPhone SE / small */
  --bp-sm: 430px;   /* iPhone 12/13/14/15/16 standard */
  --bp-md: 768px;   /* iPad portrait */
  --bp-lg: 1024px;  /* iPad landscape / small desktop */
  --bp-xl: 1280px;  /* Desktop */
  ```
- Replace all `@media (max-width: ...)` with mobile-first `@media (min-width: ...)`

### 1.3 Touch Target Standards
- **Files**: `glass.css`, `style.css`, `train.css`, `games.css` (new)
- Minimum 44×44px for all interactive elements:
  ```css
  .btn, .opt, .tr-opt, .ws-opt, .g-tile, .chip, .nav-menu-item,
  .segmented button, .icon-btn, .switch-row, .set-toggle {
    min-height: 44px;
    min-width: 44px;
    touch-action: manipulation; /* prevents 300ms delay */
  }
  ```
- Increase font-size to 16px minimum on inputs to prevent iOS zoom:
  ```css
  .input, .select, .ws-in, .g-input, .tr-input {
    font-size: 16px !important;
  }
  ```

### 1.4 Performance: Reduce Glass Effects on Mobile
- **File**: `glass.css`
- Add media query to disable expensive effects:
  ```css
  @media (max-width: 768px) {
    html:not(.no-glass) .topbar,
    html:not(.no-glass) .modal-card,
    html:not(.no-glass) .settings-card,
    html:not(.no-glass) .nav-menu {
      -webkit-backdrop-filter: blur(8px) saturate(150%);
      backdrop-filter: blur(8px) saturate(150%);
    }
    .glass-light { display: none !important; } /* disable parallax backgrounds */
    .card::after, .tr-card::after { display: none; } /* disable hover glints */
  }
  ```
- Add `prefers-reduced-motion` and `prefers-reduced-transparency` handling ✓ (already in glass.css)

### 1.5 Typography Scale
- **File**: `glass.css`
- Fluid typography using clamp():
  ```css
  :root {
    --fs-xs: clamp(11px, 2.5vw, 12px);
    --fs-sm: clamp(13px, 3vw, 14px);
    --fs-base: clamp(15px, 3.5vw, 16px);
    --fs-lg: clamp(17px, 4vw, 18px);
    --fs-xl: clamp(20px, 4.5vw, 24px);
    --fs-2xl: clamp(24px, 5vw, 30px);
    --fs-3xl: clamp(28px, 6vw, 36px);
  }
  html { font-size: var(--fs-base); }
  ```

---

## Phase 2: Navigation Redesign (Week 1-2)

### 2.1 Bottom Tab Bar (Mobile) + Dropdown (Desktop)
- **Files**: `web/nav.js`, `web/nav.css`, `web/index.html`
- Add bottom navigation HTML in `index.html` (after `main`):
  ```html
  <nav class="bottom-nav" id="bottomNav" hidden>
    <button data-view="train" class="active"><span class="ico ico-train"></span><span>Тренажёр</span></button>
    <button data-view="lernen"><span class="ico ico-dumbbell"></span><span>Тренировка</span></button>
    <button data-view="games"><span class="ico ico-game"></span><span>Игры</span></button>
    <button data-view="stats"><span class="ico ico-streak"></span><span>Статистика</span></button>
    <button data-view="more"><span class="ico ico-more"></span><span>Ещё</span></button>
  </nav>
  ```
- **CSS** (`nav.css`):
  ```css
  .bottom-nav {
    display: none;
    position: fixed; bottom: 0; left: 0; right: 0;
    padding: 6px env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
    background: color-mix(in srgb, var(--bg2) 90%, transparent);
    backdrop-filter: blur(20px) saturate(180%);
    border-top: 1px solid var(--hairline);
    z-index: 50;
    justify-content: space-around;
  }
  .bottom-nav button {
    display: flex; flex-direction: column; align-items: center; gap: 2px;
    padding: 6px 8px; border: 0; background: transparent; color: var(--dim);
    font-size: 10px; font-weight: 600; min-width: 44px; min-height: 44px;
  }
  .bottom-nav button.active { color: var(--accent); }
  .bottom-nav button .ico { font-size: 20px; line-height: 1; }
  
  @media (max-width: 768px) {
    .bottom-nav { display: flex; }
    .topbar .segmented { display: none; } /* hide horizontal nav on mobile */
    main.wrap { padding-bottom: calc(80px + env(safe-area-inset-bottom)); }
  }
  ```
- **JS** (`nav.js`): Sync bottom nav with `paintActive()`, handle "Ещё" → sheet/drawer

### 2.2 Header Simplification on Mobile
- **File**: `nav.css`
- Hide brand-sub, reduce padding, keep only logo + title + settings/menu
- Ensure sticky header z-index works with bottom nav

---

## Phase 3: View-Specific Layouts (Week 2-3)

### 3.1 Trainer View (`#view-train`)
- **Files**: `web/index.html`, `style.css`, `glass.css`
- Mobile: Single column, side panels become drawers/modals
- Left sidebar (groups) → bottom sheet on mobile
- Right sidebar (stats) → collapsible card at bottom
- Question card: full width, larger touch targets for options
- **CSS**:
  ```css
  @media (max-width: 768px) {
    .train-grid { grid-template-columns: 1fr; gap: 12px; }
    .card.side { order: 3; }
    .card.main { order: 1; min-height: auto; }
    .card.side#sidePanel { display: none; } /* hidden by default */
    .card.side#sidePanel.open { display: block; position: fixed; bottom: 0; left: 0; right: 0; ... }
    .options { grid-template-columns: 1fr; gap: 10px; }
    .opt { padding: 18px 20px; font-size: 17px; }
  }
  ```

### 3.2 Training View (`#view-lernen`)
- **Files**: `train.css`, `web/train.js`
- Skill tabs: horizontal scroll on mobile (not grid)
- Stage card: full width, larger text
- Side panel: collapsible at bottom
- **CSS**:
  ```css
  @media (max-width: 768px) {
    .tr-tabs { 
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); 
      overflow-x: auto; scroll-snap-type: x mandatory; 
      padding-bottom: 8px; gap: 8px;
    }
    .tr-tabs button { scroll-snap-align: start; min-width: 140px; }
    .tr-layout { grid-template-columns: 1fr; }
    .tr-side { position: static; order: 2; }
    .tr-opts { grid-template-columns: 1fr; }
    .tr-opt { padding: 16px 18px; font-size: 16px; }
  }
  ```

### 3.3 Games View & Modals
- **Files**: `style.css`, `games.js`
- Game cards: 1 column on mobile, larger tap area
- Game modal: full-screen on mobile (not centered card)
- **CSS**:
  ```css
  @media (max-width: 768px) {
    .game-grid { grid-template-columns: 1fr; }
    .game-card { padding: 24px; }
    .modal { align-items: stretch; padding: 0; }
    .modal-card { 
      max-width: 100vw; max-height: 100vh; border-radius: 0; 
      margin: 0; display: flex; flex-direction: column;
    }
    .game-body { flex: 1; overflow-y: auto; }
    .memory { --cell: min(80px, 22vw); }
  }
  ```

### 3.4 Worksheets / Reading / Tables
- **Files**: `style.css`, `reading.css`, `train.css`
- Cards stack vertically
- Tables: horizontal scroll with sticky first column
- **CSS**:
  ```css
  @media (max-width: 768px) {
    .ws-grid, .stat-grid { grid-template-columns: 1fr; }
    .ws-task { padding: 16px; }
    .ws-in { width: 100%; min-width: 0; }
    .tbl-sections { overflow-x: auto; }
    .tbl-sections table { min-width: 600px; }
  }
  ```

### 3.5 Settings Panel
- **Files**: `settings.js`, `glass.css`, `style.css`
- Mobile: Bottom sheet (full width, rounded top corners)
- Navigation: tabs at top, content scrolls
- **CSS**:
  ```css
  @media (max-width: 768px) {
    .settings-overlay { padding: 0; align-items: flex-end; }
    .settings-card { 
      max-width: 100vw; max-height: 85vh; border-radius: 24px 24px 0 0;
      margin: 0; animation: slideUp 0.3s cubic-bezier(.2,.9,.3,1);
    }
    @keyframes slideUp { from { transform: translateY(100%); } to { transform: none; } }
    .settings-split { grid-template-columns: 1fr; }
    .settings-nav { 
      display: flex; overflow-x: auto; flex-wrap: nowrap; 
      padding: 12px; border-bottom: 1px solid var(--set-line);
      scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch;
    }
    .set-nav-item { 
      flex: 0 0 auto; scroll-snap-align: start; white-space: nowrap;
      padding: 8px 16px; font-size: 14px;
    }
    .settings-body { padding: 16px; max-height: calc(85vh - 100px); }
  }
  ```

### 3.6 Stats View
- **Files**: `stats.css` (embedded in style.css), `glass.css`
- Cards: 2-column grid on mobile
- Charts: responsive width
- **CSS**:
  ```css
  @media (max-width: 768px) {
    .stat-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
    .stat-card { padding: 14px; }
    .stat-card b { font-size: 20px; }
    .stat-cols { grid-template-columns: 1fr; }
  }
  ```

---

## Phase 4: PWA & Installability (Week 3)

### 4.1 Web App Manifest
- **New file**: `web/manifest.json`
```json
{
  "name": "Deutsch Quest",
  "short_name": "DQ",
  "description": "Learn German with games, training, and spaced repetition",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#000000",
  "theme_color": "#0a84ff",
  "orientation": "portrait-primary",
  "icons": [
    { "src": "images/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "images/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ],
  "categories": ["education", "productivity"],
  "lang": "ru"
}
```
- Add to `index.html`: `<link rel="manifest" href="manifest.json">`
- Add Apple touch icons in `index.html`

### 4.2 Service Worker (Offline Support)
- **New file**: `web/sw.js` (basic cache-first for static assets)
- Register in `dq.js` init:
  ```js
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  ```

### 4.3 iOS Meta Tags (verify/enhance)
- **File**: `index.html` (lines 5-7) ✓ already present
- Add: `<meta name="apple-mobile-web-app-title" content="Deutsch Quest">`

---

## Phase 5: Touch Interactions & UX Polish (Week 3-4)

### 5.1 Swipe Gestures
- **Files**: `dq.js`, `nav.js`, `train.js`
- Swipe left/right on question card → next/previous (optional)
- Swipe down on modals/sheets → dismiss
- Use passive event listeners for performance

### 5.2 Haptic Feedback
- **File**: `sound.js` or new `haptics.js`
- Use `navigator.vibrate()` for correct/wrong answers (respects `haptics` setting)
- iOS: requires user interaction first, works in PWA mode

### 5.3 Pull-to-Refresh / Pull-to-Dismiss
- **Files**: `dq.js`, `extras.js`
- Pull down on main views → refresh data
- Pull down on modals/sheets → close

### 5.4 Keyboard Handling
- **Files**: `dq.js`, `train.js`
- Virtual keyboard detection (visualViewport API)
- Adjust layout when keyboard opens (especially for typing mode)
- `inputmode="text"` on German inputs, `inputmode="numeric"` for numbers

### 5.5 Focus Management
- Visible focus rings for keyboard navigation
- Trap focus in modals
- Restore focus on close

---

## Phase 6: Testing & Validation (Week 4)

### 6.1 Device Testing Matrix
| Device | Viewport | Test Focus |
|--------|----------|------------|
| iPhone SE (375×667) | 375px | Small screen layout |
| iPhone 14/15/16 (390×844) | 390px | Standard iPhone |
| iPhone 14/15/16 Plus (428×926) | 428px | Large iPhone |
| iPad Mini (768×1024) | 768px | Tablet portrait |
| iPad Pro (1024×1366) | 1024px | Tablet landscape |

### 6.2 Automated Checks
- **Script**: `scripts/check_mobile.py` (new)
  - Verify all interactive elements ≥ 44×44px
  - Check font-size ≥ 16px on inputs
  - Validate safe-area usage
  - Confirm no horizontal overflow
  - Test viewport meta tag

### 6.3 Playwright Smoke Tests
- **File**: `tests/_smoke_mobile.mjs` (new)
  - Test navigation on mobile viewport
  - Verify bottom tab bar appears
  - Check modals are full-screen
  - Test settings bottom sheet
  - Validate trainer flow

### 6.4 Performance Budgets
- Target: < 3s LCP on 3G
- Target: < 100ms interaction latency
- Reduce `backdrop-filter` usage on mobile
- Lazy-load non-critical images

---

## File Change Summary

| File | Changes |
|------|---------|
| `web/index.html` | Add manifest link, bottom nav HTML, PWA meta tags |
| `web/glass.css` | **Major**: breakpoints, touch targets, typography, performance, safe areas |
| `web/nav.css` | **Major**: bottom nav, header simplification |
| `web/nav.js` | **Major**: bottom nav sync, "Ещё" drawer |
| `web/style.css` | View-specific mobile overrides |
| `web/train.css` | Training view mobile layout |
| `web/settings.js` | Bottom sheet behavior |
| `web/games.js` | Full-screen modal on mobile |
| `web/dq.js` | Touch gestures, keyboard handling, SW registration |
| `web/sound.js` | Haptic feedback integration |
| `web/manifest.json` | **New**: PWA manifest |
| `web/sw.js` | **New**: Service worker |
| `scripts/check_mobile.py` | **New**: Automated mobile checks |
| `tests/_smoke_mobile.mjs` | **New**: Playwright mobile tests |

---

## Implementation Order

1. **Foundation** (glass.css breakpoints, touch targets, typography, safe areas)
2. **Navigation** (bottom nav, header simplification)
3. **Core Views** (trainer, training, games, settings)
4. **Secondary Views** (worksheets, reading, tables, stats, extras)
5. **PWA** (manifest, service worker, icons)
6. **Polish** (gestures, haptics, keyboard, focus)
7. **Testing** (automated checks, device testing, performance)

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Glass effects kill mobile FPS | Disable `backdrop-filter` on < 768px; add `no-glass` class toggle in settings |
| Navigation conflict (top + bottom) | Hide top segmented on mobile; keep dropdown for desktop |
| Settings panel too tall | Bottom sheet with max-height 85vh; scrollable content |
| Virtual keyboard covers inputs | Listen to `visualViewport` resize; scroll input into view |
| PWA caching breaks updates | Versioned cache names; `skipWaiting` + `clients.claim` |
| iOS Safari bugs | Test on real devices; use `@supports` for feature detection |

---

## Success Criteria

- [ ] All interactive elements ≥ 44×44px on mobile
- [ ] No horizontal scrolling on any viewport 375px+
- [ ] Bottom tab bar works on iPhone/iPad
- [ ] Settings opens as bottom sheet on mobile
- [ ] Game modals are full-screen on mobile
- [ ] Trainer flows work thumb-friendly
- [ ] PWA installs on iOS (Add to Home Screen)
- [ ] Works offline (cached assets)
- [ ] LCP < 3s on 3G throttling
- [ ] No iOS zoom on input focus
- [ ] Safe areas respected (notch, home indicator)
- [ ] All existing desktop functionality preserved
