const fs = require('fs')
const path = require('path')
const StoredFile = require('../models/StoredFile')
const { getUploadRoot } = require('./uploadPaths')
const { sanitizeUploadPath } = require('./sanitizeUploadPath')

const MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.jfif': 'image/jfif',
}

function mimeFromPath(relPath) {
  const ext = path.extname(relPath).toLowerCase()
  return MIME[ext] || 'image/jpeg'
}

async function persistUpload(relPath) {
  const clean = sanitizeUploadPath(relPath)
  if (!clean || !clean.startsWith('/uploads/')) return clean

  const basename = path.basename(clean)
  const abs = path.resolve(getUploadRoot(), basename)
  if (!fs.existsSync(abs)) return clean

  const data = fs.readFileSync(abs)
  const mimeType = mimeFromPath(clean)
  await StoredFile.findOneAndUpdate(
    { path: clean },
    { path: clean, mimeType, data },
    { upsert: true, new: true }
  )
  return clean
}

async function readStoredUpload(relPath) {
  const clean = sanitizeUploadPath(relPath)
  if (!clean || !clean.startsWith('/uploads/')) return null

  const basename = path.basename(clean)
  const abs = path.resolve(getUploadRoot(), basename)
  if (fs.existsSync(abs)) {
    return { data: fs.readFileSync(abs), mimeType: mimeFromPath(clean) }
  }

  const doc = await StoredFile.findOne({ path: clean }).lean()
  if (!doc?.data) return null
  return { data: doc.data, mimeType: doc.mimeType || mimeFromPath(clean) }
}

async function deleteStoredUpload(relPath) {
  const clean = sanitizeUploadPath(relPath)
  if (!clean || !clean.startsWith('/uploads/')) return
  await StoredFile.deleteOne({ path: clean })
}

module.exports = { persistUpload, readStoredUpload, deleteStoredUpload, mimeFromPath }
