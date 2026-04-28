const fallbackSecret = 'dev-only-jwt-secret-change-me'

const jwtSecret = process.env.JWT_SECRET || fallbackSecret

if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable is required in production')
  }

  console.warn('JWT_SECRET is not set. Using an insecure development fallback secret.')
}

module.exports = {
  jwtSecret,
}
