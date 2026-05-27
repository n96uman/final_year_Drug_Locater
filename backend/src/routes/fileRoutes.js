const express = require('express')
const c = require('../controllers/fileController')

const r = express.Router()
r.get('/serve', c.serveFile)

module.exports = r
