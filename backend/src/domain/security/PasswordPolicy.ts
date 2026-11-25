export interface PasswordValidationResult {
  valid: boolean
  errors: string[]
}

const RULES = [
  { test: (p: string) => p.length >= 12,              message: 'Au moins 12 caractères' },
  { test: (p: string) => /[A-Z]/.test(p),             message: 'Au moins une lettre majuscule' },
  { test: (p: string) => /[a-z]/.test(p),             message: 'Au moins une lettre minuscule' },
  { test: (p: string) => /[0-9]/.test(p),             message: 'Au moins un chiffre' },
  { test: (p: string) => /[@$!%*?&#^()_+=.\-]/.test(p), message: 'Au moins un caractère spécial (@$!%*?&#^()_+=.-)'  },
]

export function validatePassword(password: string): PasswordValidationResult {
  const errors = RULES.filter(r => !r.test(password)).map(r => r.message)
  return { valid: errors.length === 0, errors }
}

/** Retourne un message d'erreur unique lisible ou null si valide */
export function passwordError(password: string): string | null {
  const { valid, errors } = validatePassword(password)
  if (valid) return null
  return errors.join(' · ')
}
