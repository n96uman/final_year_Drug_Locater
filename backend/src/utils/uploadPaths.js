const path = require('path')

function getUploadRoot() {
  return process.env.VERCEL ? path.join('/tmp', 'uploads') : path.join(process.cwd(), 'uploads')
}

module.exports = { getUploadRoot }
