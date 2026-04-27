import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import CarsListPage from './pages/CarsListPage'
import BrandDetailPage from './pages/BrandDetailPage'
import CarDetailPage from './pages/CarDetailPage'
import CarReviewsPage from './pages/CarReviewsPage'
import OpinionsPage from './pages/OpinionsPage'
import ReviewsPage from './pages/ReviewsPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ProfilePage from './pages/ProfilePage'
import AdminDashboard from './pages/AdminDashboard'
import AdminRoute from './components/AdminRoute'
import { LanguageProvider } from './i18n'
import './App.css'

function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/cars" element={<CarsListPage />} />
            <Route path="/cars/brands/:slug" element={<BrandDetailPage />} />
            <Route path="/cars/:id" element={<CarDetailPage />} />
            <Route path="/cars/:id/reviews" element={<CarReviewsPage />} />
            <Route path="/opinions" element={<OpinionsPage />} />
            <Route path="/reviews" element={<ReviewsPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
  )
}

export default App
