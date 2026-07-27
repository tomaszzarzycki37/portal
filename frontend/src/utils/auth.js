export function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('current_user') || 'null')
  } catch {
    return null
  }
}

export const AUTH_SESSION_CHANGED_EVENT = 'auth-session-changed'

export function notifyAuthSessionChanged() {
  window.dispatchEvent(new Event(AUTH_SESSION_CHANGED_EVENT))
}

export function isAuthenticatedUser() {
  return !!localStorage.getItem('access_token')
}

export function isApprovedContributor() {
  const user = getCurrentUser()
  if (!user) return false
  if (user.is_staff || user.is_superuser) return true
  return !!user.profile?.is_approved
}

export function isAdminUser() {
  const user = getCurrentUser()
  return !!(user && (user.is_staff || user.is_superuser))
}

const PORTAL_OWNER_USERNAMES = ['toza']

export function isPortalOwner() {
  const user = getCurrentUser()
  if (!user) return false
  if (user.is_portal_owner) return true
  const username = String(user.username || '').trim().toLowerCase()
  return PORTAL_OWNER_USERNAMES.includes(username)
}

export function canEditByAuthorId(authorId) {
  const user = getCurrentUser()
  if (!user) return false
  if (user.is_staff || user.is_superuser) return true
  if (!authorId) return false
  return Number(user.id) === Number(authorId)
}
