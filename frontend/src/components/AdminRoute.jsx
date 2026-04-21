import { Navigate } from 'react-router-dom'
import { isAdminUser } from '../utils/auth'

export default function AdminRoute({ children }) {
  const token = localStorage.getItem('access_token')
  if (!token || !isAdminUser()) {
    return <Navigate to="/login" replace />
  }
  return children
}
