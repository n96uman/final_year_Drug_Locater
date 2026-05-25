/**
 * Stored paths can be corrupted (e.g. original filename contained commas).
 * Keep only a safe /uploads/... prefix for known patterns.
 */
function sanitizeUploadPath(p) {
  if (p == null || typeof p !== 'string') return p
  const s = p.trim()
  if (!s.startsWith('/uploads/')) return s
  const m = s.match(/^(\/uploads\/(?:license|profile|receipt)-\d+\.(?:jpe?g|png|gif|webp|jfif))(?:[,.].*)?$/i)
  if (m) return m[1]
  const cut = s.split(/[,&]/)[0].trim()
  if (cut.startsWith('/uploads/') && /^\/uploads\/[\w.-]+$/i.test(cut)) return cut
  return s
}

module.exports = { sanitizeUploadPath }
