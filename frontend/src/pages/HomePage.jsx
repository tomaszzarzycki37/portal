import { useTranslation } from '../i18n'

export default function HomePage() {
  const { t } = useTranslation()

  return (
    <div className="home-wrap">
      <section className="hero-graphic">
        <div className="hero-glow hero-glow-a" />
        <div className="hero-glow hero-glow-b" />

        <div className="hero-grid">
          <div className="hero-copy">
            <p className="hero-chip">{t.home.chip}</p>
            <h1 className="hero-title">
              {t.home.titleA}
              <span>{t.home.titleB}</span>
            </h1>
            <p className="hero-text">
              {t.home.intro}
            </p>

            <div className="hero-actions">
              <a href="/cars" className="btn btn-primary">{t.home.browseCars}</a>
              <a href="/cars" className="btn btn-secondary">{t.home.readOpinions}</a>
            </div>

            <div className="stats-grid">
              <div className="stat-box">
                <p className="stat-number">100+</p>
                <p className="stat-label">{t.home.models}</p>
              </div>
              <div className="stat-box">
                <p className="stat-number">20+</p>
                <p className="stat-label">{t.home.brands}</p>
              </div>
              <div className="stat-box">
                <p className="stat-number">24/7</p>
                <p className="stat-label">{t.home.updates}</p>
              </div>
            </div>
          </div>

          <div className="hero-visual">
            <div className="graphic-road">
              <div className="road-lines" />
            </div>
            <div className="car-card car-card-red">
              <p className="car-title">BYD Seal</p>
              <p className="car-sub">{t.home.car1Sub}</p>
            </div>
            <div className="car-card car-card-amber">
              <p className="car-title">Geely Coolray</p>
              <p className="car-sub">{t.home.car2Sub}</p>
            </div>
            <div className="car-card car-card-slate">
              <p className="car-title">NIO ET5</p>
              <p className="car-sub">{t.home.car3Sub}</p>
            </div>
          </div>
        </div>
      </section>

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
