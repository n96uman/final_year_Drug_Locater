const fs = require('fs')
const path = require('path')
const multer = require('multer')
const { getUploadRoot } = require('../utils/uploadPaths')
const dir = getUploadRoot()
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

const MIME_EXT = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/pjpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/jfif': '.jfif',
}

function extFromMime(mimetype) {
  const m = (mimetype || '').toLowerCase().split(';')[0].trim()
  return MIME_EXT[m] || '.jpg'
}

function safeImageFilename(fieldname, mimetype) {
  const prefix = fieldname === 'licenseImage'
    ? 'license'
    : fieldname === 'receiptImage'
      ? 'receipt'
      : fieldname === 'prescriptionImage'
        ? 'prescription'
        : 'profile'
  const ext = extFromMime(mimetype)
  return `${prefix}-${Date.now()}${ext}`
}

const storage = multer.diskStorage({
  destination: (_r, _f, cb) => cb(null, dir),
  filename: (_req, f, cb) => cb(null, safeImageFilename(f.fieldname, f.mimetype)),
})
const imageMulter = multer({
  storage,
  // Keep uploads below common serverless request-size ceilings.
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_r, f, cb) => cb(null, (f.mimetype || '').startsWith('image/')),
})

exports.uploadProfileImage = imageMulter
exports.uploadLicenseImage = imageMulter.single('licenseImage')
exports.uploadReceiptImage = imageMulter.single('receiptImage')
exports.uploadOrderImages = imageMulter.fields([
  { name: 'receiptImage', maxCount: 1 },
  { name: 'prescriptionImage', maxCount: 1 },
])
exports.uploadRegisterFiles = imageMulter.fields([
  { name: 'profileImage', maxCount: 1 },
  { name: 'licenseImage', maxCount: 1 },
])
