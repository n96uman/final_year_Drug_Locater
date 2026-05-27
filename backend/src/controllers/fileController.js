const path = require('path')
const { readStoredUpload } = require('../utils/storedFiles')
const { sanitizeUploadPath } = require('../utils/sanitizeUploadPath')

const ALLOWED = /^(license|profile|receipt|prescription)-\d+\.(jpe?g|png|gif|webp|jfif)$/i

exports.serveFile = async (req, res) => {
  const rel = sanitizeUploadPath(String(req.query.path || ''))
  if (!rel || !rel.startsWith('/uploads/')) return res.status(400).json({ message: 'Invalid path' })
  const basename = path.basename(rel)
  if (!ALLOWED.test(basename)) return res.status(404).json({ message: 'Invalid path' })

  const stored = await readStoredUpload(rel)
  if (!stored) return res.status(404).json({ message: 'File not found' })

  res.setHeader('Content-Type', stored.mimeType)
  res.setHeader('Cache-Control', 'public, max-age=86400')
  return res.send(stored.data)
}
