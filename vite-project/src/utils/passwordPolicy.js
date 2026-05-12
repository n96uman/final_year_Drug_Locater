const STRONG =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{}|;:,.<>?]).{8,128}$/

export function isStrongPassword(password) {
  return typeof password === 'string' && STRONG.test(password)
}

export const strongPasswordHint =
  'At least 8 characters with uppercase, lowercase, a number, and a special character (!@#$%^&* etc.).'
