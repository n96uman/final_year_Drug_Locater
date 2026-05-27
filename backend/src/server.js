const express = require('express')
const cors = require('cors')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })
const multer = require('multer')
const bcrypt = require('bcryptjs')
const connectDB = require('./config/db')
const User = require('./models/User')
const fs = require('fs')
const { getUploadRoot } = require('./utils/uploadPaths')
const { persistUpload } = require('./utils/storedFiles')

const app = express()

app.use(cors())
app.use(express.json({ limit: '2mb' }))
app.use(express.urlencoded({ extended: true, limit: '2mb' }))
app.use('/uploads', express.static(getUploadRoot()))

let dbPromise = null
const ensureDb = () => {
  if (!dbPromise) dbPromise = connectDB()
  return dbPromise
}

app.use(async (_req, _res, next) => {
  try {
    await ensureDb()
    await seedAdminUser()
    await backfillUploadsToDb()
    next()
  } catch (e) {
    next(e)
  }
})

let uploadBackfillDone = false
async function backfillUploadsToDb() {
  if (uploadBackfillDone || process.env.SKIP_UPLOAD_BACKFILL === '1') return
  uploadBackfillDone = true
  const root = getUploadRoot()
  if (!fs.existsSync(root)) return
  for (const name of fs.readdirSync(root)) {
    if (/^(license|profile|receipt|prescription)-\d+\.(jpe?g|png|gif|webp|jfif)$/i.test(name)) {
      await persistUpload(`/uploads/${name}`).catch(() => {})
    }
  }
}

let adminSeedChecked = false
async function seedAdminUser() {
  if (adminSeedChecked) return
  adminSeedChecked = true
  const has = await User.findOne({ role: 'admin' })
  if (has) return
  await User.create({
    name: 'Administrator',
    email: 'admin',
    password: await bcrypt.hash('finalyear', 10),
    role: 'admin',
    pharmacyApprovalStatus: 'approved',
    profileImage: 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
  })
}

app.use('/api/files', require('./routes/fileRoutes'))
app.use('/api/auth', require('./routes/authRoutes'))
app.use('/api/medicines', require('./routes/medicineRoutes'))
app.use('/api/orders', require('./routes/orderRoutes'))
app.use('/api/admin', require('./routes/adminRoutes'))
app.get('/api/health', (_req,res)=>res.json({status:'ok'}))
app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ message: 'Image too large. Please upload images smaller than 2MB.' })
    }
    return res.status(400).json({ message: err.message })
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Request too large. Please upload smaller images (under 2MB each).' })
  }
  return res.status(400).json({ message: err?.message || 'Error' })
})

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  ensureDb()
    .then(() => app.listen(process.env.PORT || 5000, () => console.log(`Backend running on http://localhost:${process.env.PORT || 5000}`)))
    .catch((e) => {
      console.error(e.message)
      process.exit(1)
    })
}

module.exports = app
