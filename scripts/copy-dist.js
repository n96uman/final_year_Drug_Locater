const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const src = path.join(root, 'vite-project', 'dist')
const dest = path.join(root, 'dist')

if (!fs.existsSync(src)) {
  console.error('Missing vite-project/dist. Run vite build first.')
  process.exit(1)
}
fs.rmSync(dest, { recursive: true, force: true })
fs.mkdirSync(dest, { recursive: true })
fs.cpSync(src, dest, { recursive: true })
console.log('Copied vite-project/dist -> dist/')
