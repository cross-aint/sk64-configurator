import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative paths, so the built site works from any folder, such as GitHub Pages'
  // https://cross-aint.github.io/sk64-configurator/.
  base: './',
  plugins: [react()],
})
