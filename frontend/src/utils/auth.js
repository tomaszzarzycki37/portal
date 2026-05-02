export function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('current_user') || 'null')
  } catch {
    return null
  }
}

export function isAuthenticatedUser() {
  return !!localStorage.getItem('access_token')
}

export function isAdminUser() {
  const user = getCurrentUser()
  return !!(user && (user.is_staff || user.is_superuser))
}

export function canEditByAuthorId(authorId) {
  const user = getCurrentUser()
  if (!user || !authorId) return false
  if (user.is_staff || user.is_superuser) return true
  return Number(user.id) === Number(authorId)
}
