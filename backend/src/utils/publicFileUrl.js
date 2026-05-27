function getPublicOrigin(req) {
  const env = process.env.PUBLIC_ORIGIN?.trim()
  if (env) return env.replace(/\/+$/, '')
  const xfProto = req.get('x-forwarded-proto')
  const xfHost = req.get('x-forwarded-host')
  const proto = (xfProto || req.protocol || 'http').split(',')[0].trim()
  const host = (xfHost || req.get('host') || '').split(',')[0].trim()
  if (!host) return ''
  return `${proto}://${host}`
}

function filePublicUrl(req, p) {
  if (p == null || p === '') return p
  const s = String(p)
  if (/^https?:\/\//i.test(s)) return s
  const rel = s.startsWith('/') ? s : `/${s}`
  if (rel.startsWith('/uploads/')) {
    const apiPath = `/api/files/serve?path=${encodeURIComponent(rel)}`
    const origin = getPublicOrigin(req)
    return origin ? `${origin}${apiPath}` : apiPath
  }
  const origin = getPublicOrigin(req)
  return origin ? `${origin}${rel}` : rel
}

module.exports = { filePublicUrl, getPublicOrigin }
