// deps: none
// Shared design tokens for Prahari (v3.0 "Warm Rx" + Clinical Dark Theme)

export const DESIGN_TOKENS = {
  // Warm Rx Editorial Theme (Default for general layouts)
  warmRx: {
    colors: {
      paper: '#FEFCF8',       // Main background (warm off-white)
      white: '#FFFFFF',       // Card background
      cream: '#F4EFE6',       // Section background
      parchment: '#E8E0D4',   // Tags / tertiary surfaces
      forest: '#2D5A3D',      // Primary actions / green
      forestDark: '#1E3D29',
      forestMid: '#3D7A54',
      forestLight: '#4A9268',
      forestSubtle: 'rgba(45, 90, 61, 0.07)',
      forestGlow: 'rgba(45, 90, 61, 0.18)',
      amber: '#C67C2E',       // Secondary / CTA
      amberDark: '#9E5F1E',
      amberLight: '#E09A4A',
      amberSubtle: 'rgba(198, 124, 46, 0.08)',
      amberGlow: 'rgba(198, 124, 46, 0.28)',
      ink: '#1A1714',         // Typography primary (near-black)
      muted: '#5E564E',       // Typography secondary
      faint: '#9E968E',       // Borders/placeholders
      border: '#DDD6CB',
      borderStrong: '#C4BBB0',
    }
  },

  // Clinical Dark Theme (Optimized for Pill Scan, Timeline & Dashboard charts)
  clinicalDark: {
    colors: {
      background: '#0A1628',   // Deep clinical navy
      surface: '#0D1F33',      // Glass/card background
      surfaceHeader: '#122B47',
      accent: '#00D4AA',       // Medical teal
      accentHover: '#00B38F',
      accentSubtle: 'rgba(0, 212, 170, 0.08)',
      accentGlow: 'rgba(0, 212, 170, 0.20)',
      warning: '#FF6B35',      // Alert orange
      warningSubtle: 'rgba(255, 107, 53, 0.10)',
      critical: '#EF4444',     // Critical red
      criticalBg: '#1C0808',
      safe: '#22C55E',         // Safe green
      safeBg: '#031A0C',
      ink: '#F0EBE4',          // Text primary
      muted: '#8899BB',        // Text secondary
      faint: '#1E3A5F',        // Borders/grid lines
      border: '#1E3A5F',
    }
  },

  // Global Alert State Colors (Unified)
  alerts: {
    safe: {
      text: '#166534',
      bg: '#F0FDF4',
      border: '#86EFAC'
    },
    warning: {
      text: '#A16207',
      bg: '#FFFBEB',
      border: '#FDE68A'
    },
    critical: {
      text: '#B91C1C',
      bg: '#FEF2F2',
      border: '#FCA5A5'
    }
  },

  // Typography Scale
  typography: {
    fontDisplay: "'Fraunces', 'Georgia', serif",
    fontSans: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
    fontMono: "'JetBrains Mono', 'Courier New', monospace",
    sizes: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem',
    }
  },

  // Layout Spacing
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
  },

  // Transitions
  transitions: {
    fast: 'all 140ms ease',
    standard: 'all 210ms cubic-bezier(0.4, 0, 0.2, 1)',
    slow: 'all 360ms cubic-bezier(0.4, 0, 0.2, 1)',
    bounce: 'all 280ms cubic-bezier(0.34, 1.56, 0.64, 1)',
  },

  // Custom shadows
  shadows: {
    sm: '0 2px 6px rgba(26, 23, 20, 0.06)',
    md: '0 4px 14px rgba(26, 23, 20, 0.08)',
    lg: '0 8px 26px rgba(26, 23, 20, 0.10)',
    teal: '0 4px 14px rgba(0, 212, 170, 0.25)',
    orange: '0 4px 14px rgba(255, 107, 53, 0.25)',
  }
};
