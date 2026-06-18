import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.js',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.jsx', 'src/**/*.js'],
      exclude: [
        'src/main.jsx', 
        'src/setupTests.js', 
        'src/__tests__/**',
        'src/pages/LoginPage.jsx',
        'src/pages/PocketClinicianPage.jsx',
        'src/pages/SentinelSettingsPage.jsx',
        'src/pages/SubscribePage.jsx',
        'src/components/triage/TriageChatbot.jsx',
        'src/hooks/useAuth.jsx',
        'src/services/supabase.js',
        'src/services/crypto.js'
      ],
      thresholds: {
        statements: 70,
        branches: 70,
        functions: 70,
        lines: 70
      }
    },
  },
})
