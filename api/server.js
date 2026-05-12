/**
 * Vercel serverless entry: forwards all /api/* and /uploads/* traffic to the Express app.
 * Static UI is served from root `dist/` via outputDirectory (see vercel.json).
 */
module.exports = require('../backend/src/server.js')
