const fallbackSecret = 'dev-only-jwt-secret-change-me'

const jwtSecret = process.env.JWT_SECRET || fallbackSecret

if (!process.env.JWT_SECRET) {
  console.warn('JWT_SECRET is not set. Using an insecure fallback secret.')
}

module.exports = {
  jwtSecret,
}
