export function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('current_user') || 'null')
  } catch {
    return null
  }
}

export function isAdminUser() {
  const user = getCurrentUser()
  return !!(user && (user.is_staff || user.is_superuser))
}
