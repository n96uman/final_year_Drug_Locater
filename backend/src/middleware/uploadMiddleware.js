const fs = require('fs')
const path = require('path')
const multer = require('multer')
const dir = process.env.VERCEL ? path.join('/tmp', 'uploads') : path.join(process.cwd(), 'uploads')
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

const storage = multer.diskStorage({
  destination: (_r, _f, cb) => cb(null, dir),
  filename: (req, f, cb) => {
    const prefix = f.fieldname === 'licenseImage' ? 'license' : 'profile'
    cb(null, `${prefix}-${Date.now()}-${f.originalname}`)
  },
})
const imageMulter = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_r, f, cb) => cb(null, (f.mimetype || '').startsWith('image/')),
})

exports.uploadProfileImage = imageMulter
exports.uploadRegisterFiles = imageMulter.fields([
  { name: 'profileImage', maxCount: 1 },
  { name: 'licenseImage', maxCount: 1 },
])

