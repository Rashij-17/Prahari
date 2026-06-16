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
        // --- Primary Brand: Forest Green ---
        forest: {
          DEFAULT: '#2D5A3D',
          light:   '#4A9268',
          dark:    '#1E3D29',
          mid:     '#3D7A54',
        },

        // --- Brand CTA: Amber ---
        amber: {
          DEFAULT: '#C67C2E',
          dark:    '#9E5F1E',
          light:   '#E09A4A',
        },

        // --- Surface / Background Colours ---
        paper:       '#FEFCF8',
        white:       '#FFFFFF',
        cream:       '#F4EFE6',
        parchment:   '#E8E0D4',

        // --- Text ---
        ink:         '#1A1714',
        muted:       '#5E564E',
        faint:       '#9E968E',
        inverse:     '#FEFCF8',

        // --- Legacy aliases / extensions ---
        sage: {
          DEFAULT: '#4A9268',
          light:   '#7BB899',
          dark:    '#1E3D29',
        },
        teal: {
          DEFAULT: '#2D5A3D',
          dark:    '#1E3D29',
          light:   '#4A9268',
        },
        surface: {
          DEFAULT: '#FEFCF8',
          card:    '#FFFFFF',
          beige:   '#E8E0D4',
        },
        text: {
          primary:   '#1A1714',
          secondary: '#5E564E',
          inverse:   '#FEFCF8',
        },

        // --- Alert / Urgency States ---
        alert: {
          critical:    '#B91C1C',
          criticalBg:  '#FEF2F2',
          moderate:    '#A16207',
          moderateBg:  '#FFFBEB',
          safe:        '#166534',
          safeBg:      '#F0FDF4',
        },

        border:  '#DDD6CB',
        focus:   '#2D5A3D',

        // --- Dark Mode Surface Overrides ---
        dark: {
          surface: '#1A1714',
          card:    '#231F1B',
          beige:   '#2A2520',
          border:  '#3A332C',
          textPrimary:   '#F0EBE4',
          textSecondary: '#9E968E',
        },
      },

      // ---------------------------------------------------------------
      // TYPOGRAPHY SYSTEM
      // Source: FEATURES_AND_STRUCTURE.md § 4.3
      // ---------------------------------------------------------------
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
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
