import { useTranslation } from '../i18n'

export default function HomePage() {
  const { t } = useTranslation()

  return (
    <div className="home-wrap">
      <section className="features-grid">
        <article className="feature-tile feature-tile-red">
          <h3>{t.home.feature1Title}</h3>
          <p>{t.home.feature1Text}</p>
        </article>
        <article className="feature-tile feature-tile-amber">
          <h3>{t.home.feature2Title}</h3>
          <p>{t.home.feature2Text}</p>
        </article>
        <article className="feature-tile feature-tile-slate">
          <h3>{t.home.feature3Title}</h3>
          <p>{t.home.feature3Text}</p>
        </article>
      </section>

      <section className="home-cta">
        <h2>
          {t.home.ctaTitle}
        </h2>
        <p>
          {t.home.ctaText}
        </p>
      </section>
    </div>
  )
}
