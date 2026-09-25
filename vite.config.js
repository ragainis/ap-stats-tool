import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The AP Stats app is served from mezins.com/ap-stats/.
// Everything in site/ (home page, other projects) is copied to the site root after the build.
export default defineConfig({
  plugins: [react()],
  base: '/ap-stats/',
  build: {
    outDir: 'dist/ap-stats',
    emptyOutDir: true,
  },
})
