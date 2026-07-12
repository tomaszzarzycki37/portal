import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import AdminRoute from './components/AdminRoute'
import { LanguageProvider, useTranslation } from './i18n'
import './App.css'

const HomePage = lazy(() => import('./pages/HomePage'))
const CarsListPage = lazy(() => import('./pages/CarsListPage'))
const BrandDetailPage = lazy(() => import('./pages/BrandDetailPage'))
const ModelFamilyPage = lazy(() => import('./pages/ModelFamilyPage'))
const CarDetailPage = lazy(() => import('./pages/CarDetailPage'))
const CarReviewsPage = lazy(() => import('./pages/CarReviewsPage'))
const OpinionsPage = lazy(() => import('./pages/OpinionsPage'))
const OpinionDetailPage = lazy(() => import('./pages/OpinionDetailPage'))
const ReviewsPage = lazy(() => import('./pages/ReviewsPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const ForcePasswordResetPage = lazy(() => import('./pages/ForcePasswordResetPage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const MyContentPage = lazy(() => import('./pages/MyContentPage'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))

function RouteFallback() {
  const { t } = useTranslation()
  return <div className="page-loading">{t.pages.loading}</div>
}

function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/cars" element={<CarsListPage />} />
          <Route path="/cars/brands/:slug/:modelSlug" element={<ModelFamilyPage />} />
          <Route path="/cars/brands/:slug" element={<BrandDetailPage />} />
          <Route path="/cars/:id" element={<CarDetailPage />} />
          <Route path="/cars/:id/reviews" element={<CarReviewsPage />} />
          <Route path="/opinions/:id" element={<OpinionDetailPage />} />
          <Route path="/opinions" element={<OpinionsPage />} />
          <Route path="/reviews" element={<ReviewsPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/force-password-reset" element={<ForcePasswordResetPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/my-content" element={<MyContentPage />} />
          <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        </Route>
      </Routes>
    </Suspense>
  )
}

function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </LanguageProvider>
  )
}

export default App
