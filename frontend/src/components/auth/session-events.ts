// Tells the session listener that the person chose to sign out, so it does not report "session expired".
let intentional = false

export function markSigningOut(value: boolean) {
  intentional = value
}

export function isSigningOut() {
  return intentional
}
