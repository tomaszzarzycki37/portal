import { Outlet } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'

export default function Layout() {
  return (
    <div className="site-shell">
      <Header />
      <main className="site-main container">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
