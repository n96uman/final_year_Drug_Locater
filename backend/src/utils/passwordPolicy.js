const STRONG =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{}|;:,.<>?]).{8,128}$/

exports.isStrongPassword = (password) => typeof password === 'string' && STRONG.test(password)

exports.strongPasswordMessage =
  'Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character (!@#$%^&* etc.).'
