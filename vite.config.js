import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// Writes every built file into dist/sw.js so the service worker precaches the whole app.
const precache = () => ({
  name: 'precache',
  apply: 'build',
  writeBundle(opts, bundle) {
    const files = Object.keys(bundle).map(f => `/${f}`)
    const sw = join(opts.dir, 'sw.js')
    writeFileSync(sw, readFileSync(sw, 'utf8')
      .replace('[] /*__ASSETS__*/', JSON.stringify(files))
      .replace("'japan-dev' /*__CACHE__*/", JSON.stringify(`japan-${Date.now()}`)))
  },
})

export default defineConfig({
  plugins: [react(), tailwindcss(), precache()],
  build: { outDir: 'dist', rollupOptions: { input: { main: 'index.html', journal: 'journal.html' } } },
})
