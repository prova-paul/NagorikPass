export const MIN_PASSWORD_LENGTH = 8

export function passwordProblem(password: string, confirm: string): { password?: string; confirm?: string } | null {
  if (password === '') return { password: 'Choose a password.' }
  if (password.length < MIN_PASSWORD_LENGTH) return { password: `Use at least ${MIN_PASSWORD_LENGTH} characters.` }
  if (password.length > 72) return { password: 'Use at most 72 characters.' }
  if (confirm !== password) return { confirm: 'The two passwords do not match.' }
  return null
}
