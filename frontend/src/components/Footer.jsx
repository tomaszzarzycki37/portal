import { useTranslation } from '../i18n'

export default function Footer() {
  const { t } = useTranslation()
  const currentYear = new Date().getFullYear()

  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <h3 className="footer-title">{t.footer.about}</h3>
          <p className="footer-muted">
            {t.footer.aboutText}
          </p>
        </div>

        <div>
          <h3 className="footer-title">{t.footer.quickLinks}</h3>
          <ul className="footer-links">
            <li><a href="/">{t.footer.home}</a></li>
            <li><a href="/cars">{t.footer.cars}</a></li>
          </ul>
        </div>

        <div>
          <h3 className="footer-title">{t.footer.contact}</h3>
          <p className="footer-muted">
            {t.footer.email}<br/>
            {t.footer.phone}
          </p>
        </div>
      </div>

      <div className="footer-bottom">
        <p>&copy; {currentYear} China Cars. {t.footer.rights}</p>
      </div>
    </footer>
  )
}
