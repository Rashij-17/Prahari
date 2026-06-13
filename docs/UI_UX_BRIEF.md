# Prahari — UI/UX Design Brief

**Version:** 1.0.0  
**Design System:** Vigilant Sage (v2.0)

---

## 1. Design Vision & Philosophy

Prahari serves patients who may be under immediate physical stress or have low health literacy. Therefore, the design system values **clarity, reassurance, and speed** above all:

```
THE DESIGN SYSTEM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COLORS:      Clinical Sage Green (Healing) + Deep Indigo/Teal (Authority)
             Soft warm off-white surfaces to prevent glare and screen fatigue.

TYPOGRAPHY:  DM Serif Display (Heads) / Inter (UI text) / IBM Plex Mono (Data)

LAYOUTS:     Dual-Viewport Layouts:
             - Mobile: Single-hand reach bottom bar, full slide-in drawer menu.
             - Desktop: Centered grid pages, floating side header dashboard.

ANIMATIONS:  Spring physics and subtle micro-animations:
             - Pulse-ring on camera capture.
             - Staggered cards float-in on loading HomePage.
             - Fade-in-up on search results lists.
```

---

## 2. Color Token Registry

Defined as native CSS variables in `frontend/src/index.css`:

```css
:root {
  /* Backgrounds & Surfaces */
  --color-bg:                  #fbfbf9;   /* Reassuring, warm paper tint */
  --color-surface:             #ffffff;   /* Primary cards & modal background */
  --color-surface-card:        #f5f4ef;   /* Low-contrast details blocks */
  --color-border:              #e3e1d5;   /* Subtle divider lines */

  /* Text Tiers */
  --color-text-primary:        #181c1b;   /* Off-black for high legibility */
  --color-text-secondary:      #555e5c;   /* Slate gray for secondary details */
  --color-text-muted:          #899290;   /* Muted labels & timestamps */

  /* Clinical Accents */
  --color-sage:                #7a9e87;   /* Sage green - primary healing accent */
  --color-sage-light:          #a4c0ae;   /* Hover / subtle highlights */
  --color-teal:                #2a7f8c;   /* Precise brand teal - secondary actions */
  --color-teal-subtle:         #eaf2f3;   /* Highlight block backgrounds */

  /* Urgency / Severity Badges */
  --color-alert-safe:          #3d8b5a;   /* Safe / Self-care advised */
  --color-alert-moderate:      #d48d2a;   /* Same-day GP / Moderate warnings */
  --color-alert-critical:      #c24b3c;   /* Immediate emergency / Boxed warnings */
}
```

---

## 3. Typography Scale & Hierarchy

Imported via Google Fonts in `frontend/index.html`:
```html
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

### 3.1 CSS Typography Classes
```css
/* DM Serif Display — Header / Branding font */
.font-display {
  font-family: 'DM Serif Display', serif;
  font-weight: 400;
  letter-spacing: -0.01em;
}

/* Inter — Standard interface text */
.font-sans {
  font-family: 'Inter', sans-serif;
  font-weight: 400;
  line-height: 1.5;
}

/* IBM Plex Mono — Chemical codes & scientific weights */
.font-mono {
  font-family: 'IBM Plex Mono', monospace;
  font-weight: 500;
}
```

---

## 4. Layout Breakpoints & Viewport Adaptation

To ensure a seamless experience on both smartphones and wide displays, Prahari handles layouts dynamically via matchMedia queries:

- **Mobile Viewport ($< 768px$):**
  - Displays top header bar with Hamburger Menu trigger.
  - Sidebar links slide out from the right (`MobileDrawer`).
  - Active bottom navigation bar is fixed at the base of the viewport for single-thumb navigation.
- **Desktop Viewport ($\ge 768px$):**
  - Left persistent navigation header with brand logo.
  - Centered content container maximized at `760px` to maintain comfortable reading line-lengths.
  - Footer aligns as a two-column grid showing developer details and API credits.

---

## 5. Micro-Animations & Spring Physics

Prahari uses custom CSS transitions and animations declared in `index.css`:

### 5.1 Hover Lift Effect
```css
.card-hover-lift {
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease-in-out;
}
.card-hover-lift:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 30px rgba(42, 127, 140, 0.15);
}
```

### 5.2 Pulse Ring Animation (Camera Viewfinder)
Used in the Visual Label Scanner during active focus capture:
```css
@keyframes pulse-ring {
  0% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(122, 158, 135, 0.5);
  }
  70% {
    transform: scale(1);
    box-shadow: 0 0 0 10px rgba(122, 158, 135, 0);
  }
  100% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(122, 158, 135, 0);
  }
}
```
