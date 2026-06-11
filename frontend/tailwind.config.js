/** @type {import('tailwindcss').Config} */

/**
 * Prahari — "Vigilant Sage" Tailwind CSS Theme Configuration
 * ===========================================================
 * This config extends Tailwind with the exact design tokens specified
 * in FEATURES_AND_STRUCTURE.md § 4.2 (Colour Palette) and § 4.3 (Typography).
 *
 * Design Philosophy:
 * The palette sits at the intersection of clinical authority and
 * accessible warmth — sage greens and teals replace cold clinical blues,
 * warm off-whites replace sterile whites, and every colour is chosen to
 * maintain WCAG AA (4.5:1) contrast ratios.
 */

export default {
  // Enable class-based dark mode (toggled by adding 'dark' class to <html>)
  darkMode: 'class',

  // Tailwind scans these files to generate only the CSS classes actually used.
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],

  theme: {
    extend: {

      // ---------------------------------------------------------------
      // COLOUR SYSTEM — "Vigilant Sage" Palette
      // Source: FEATURES_AND_STRUCTURE.md § 4.2
      // ---------------------------------------------------------------
      colors: {
        // --- Primary Brand: Sage Green ---
        // Used for: CTAs, safe/routine indicators, progress fills
        sage: {
          DEFAULT: '#7A9E87',
          light:   '#B8D4C0',
          dark:    '#5C8069',
        },

        // --- Secondary Accent: Teal ---
        // Used for: interactive elements, links, map markers, info alerts
        teal: {
          DEFAULT: '#2A7F8C',
          dark:    '#1C5C66',
          light:   '#4FAABA',
        },

        // --- Surface / Background Colours ---
        surface: {
          DEFAULT: '#F7F5F0',  // Primary page background — warm off-white
          card:    '#FFFFFF',  // Card and modal backgrounds
          beige:   '#D4C5A9',  // Secondary surface; tag backgrounds; disabled states
        },

        // --- Text Colours ---
        text: {
          primary:   '#1A1A2E',  // Headings and primary body copy
          secondary: '#5A5A72',  // Captions, labels, secondary metadata
          inverse:   '#F7F5F0',  // Text on dark/coloured backgrounds
        },

        // --- Alert / Urgency States ---
        alert: {
          critical:    '#C0392B',  // T1 — Critical drug interaction, emergency triage
          criticalBg:  '#FDECEA',
          moderate:    '#D4860A',  // T2 — Moderate interaction, same-day appointment
          moderateBg:  '#FDF3E0',
          safe:        '#2E7D52',  // T3 — Safe/routine, self-care
          safeBg:      '#E8F5EE',
        },

        // --- Borders & Focus ---
        border:  '#E2DCCF',
        focus:   '#2A7F8C',  // 3px focus ring, 2px offset

        // --- Dark Mode Surface Overrides ---
        // Used in conjunction with darkMode: 'class'
        dark: {
          surface: '#12141A',
          card:    '#1E2029',
          beige:   '#2A2D38',
          border:  '#2D303A',
          textPrimary:   '#EDF0F5',
          textSecondary: '#9099AB',
        },
      },

      // ---------------------------------------------------------------
      // TYPOGRAPHY SYSTEM
      // Source: FEATURES_AND_STRUCTURE.md § 4.3
      // ---------------------------------------------------------------
      fontFamily: {
        // Display / Headings — DM Serif Display (imported via Google Fonts)
        display: ['"DM Serif Display"', 'Georgia', 'serif'],

        // Body & UI — Inter (imported via Google Fonts)
        sans: ['Inter', 'system-ui', 'sans-serif'],

        // Drug names, RxCUI codes, chemical nomenclature
        mono: ['"IBM Plex Mono"', 'Courier New', 'monospace'],
      },

      fontSize: {
        // Fluid display size for hero/page titles
        display: ['clamp(2rem, 5vw, 3.5rem)', { lineHeight: '1.1' }],

        // Standard heading scale
        h1: ['1.75rem', { lineHeight: '1.25', fontWeight: '400' }],
        h2: ['1.5rem',  { lineHeight: '1.3',  fontWeight: '400' }],
        h3: ['1.25rem', { lineHeight: '1.35', fontWeight: '400' }],

        // Label / metadata — uppercase, tracked
        label: ['0.75rem', { lineHeight: '1.4', letterSpacing: '0.04em' }],
      },

      // ---------------------------------------------------------------
      // SPATIAL SYSTEM — Base unit 4px
      // Source: FEATURES_AND_STRUCTURE.md § 4.4
      // ---------------------------------------------------------------
      spacing: {
        // Standard 4px grid is Tailwind's default (1 unit = 4px).
        // These are additional named tokens for the Prahari system:
        'section-desktop': '64px',  // Major section vertical spacing
        'section-mobile':  '40px',
        'card-desktop':    '24px',  // Card internal padding
        'card-mobile':     '16px',
      },

      borderRadius: {
        card:   '12px',  // Cards and modals
        button: '8px',   // Buttons and inputs
        chip:   '4px',   // Chips and badges
        full:   '9999px',
      },

      // ---------------------------------------------------------------
      // RESPONSIVE BREAKPOINTS — Mobile-First
      // Source: FEATURES_AND_STRUCTURE.md § 4.4
      // ---------------------------------------------------------------
      screens: {
        'xs': '360px',
        'sm': '480px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
      },

      maxWidth: {
        container: '1100px',  // Global content max-width — centred
      },

      // ---------------------------------------------------------------
      // TRANSITIONS — as specified in § 4.5
      // ---------------------------------------------------------------
      transitionTimingFunction: {
        standard: 'ease-in-out',
      },

      transitionDuration: {
        standard: '150ms',
        modal:    '200ms',
      },

      // ---------------------------------------------------------------
      // BOX SHADOW — Elevation system
      // ---------------------------------------------------------------
      boxShadow: {
        card:       '0 2px 12px rgba(26, 26, 46, 0.06)',
        'card-hover': '0 8px 24px rgba(26, 26, 46, 0.12)',
        nav:        '0 1px 0 rgba(226, 220, 207, 0.6)',
      },

      // ---------------------------------------------------------------
      // BACKDROP FILTER — for sticky nav glassmorphism
      // Source: FEATURES_AND_STRUCTURE.md § 4.5 (Navigation)
      // ---------------------------------------------------------------
      backdropBlur: {
        nav: '12px',
      },

    },
  },

  plugins: [],
}
