require('dotenv').config()
const express = require('express')
const cors = require('cors')
const path = require('path')
const multer = require('multer')
const connectDB = require('./config/db')

const app = express()
const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
].filter(Boolean)

app.use(cors({
  origin(origin, cb) {
    // Allow non-browser clients and local dev.
    if (!origin || process.env.NODE_ENV !== 'production') return cb(null, true)
    if (allowedOrigins.includes(origin)) return cb(null, true)
    return cb(new Error('CORS not allowed'))
  },
  credentials: true,
}))
app.use(express.json())
app.use('/uploads', express.static(path.join(process.cwd(),'uploads')))

let dbPromise = null
const ensureDb = () => {
  if (!dbPromise) dbPromise = connectDB()
  return dbPromise
}

app.use(async (_req, _res, next) => {
  try {
    await ensureDb()
    next()
  } catch (e) {
    next(e)
  }
})

app.use('/api/auth', require('./routes/authRoutes'))
app.use('/api/medicines', require('./routes/medicineRoutes'))
app.use('/api/orders', require('./routes/orderRoutes'))
app.get('/api/health', (_req,res)=>res.json({status:'ok'}))
app.use((err,_req,res,_next)=>{ if(err instanceof multer.MulterError) return res.status(400).json({message:err.message}); return res.status(400).json({message:err.message||'Error'}) })

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  ensureDb()
    .then(() => app.listen(process.env.PORT || 5000, () => console.log(`Backend running on http://localhost:${process.env.PORT || 5000}`)))
    .catch((e) => {
      console.error(e.message)
      process.exit(1)
    })
}

module.exports = app
