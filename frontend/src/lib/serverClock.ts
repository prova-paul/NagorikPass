// Countdowns run against the server's clock, so a wrong clock on this computer can't make a visitor look late.
let offsetMs = 0

export function syncServerClock(serverMs: number) {
  if (!Number.isNaN(serverMs)) offsetMs = serverMs - Date.now()
}

export function serverNow() {
  return Date.now() + offsetMs
}
