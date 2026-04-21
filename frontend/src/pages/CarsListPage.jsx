import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { useTranslation } from '../i18n'
import { getBrandLogoOrPlaceholder } from '../utils/brandLogos'

export default function CarsListPage() {
  const [brands, setBrands] = useState([])
  const [cars, setCars] = useState([])
  const [loading, setLoading] = useState(true)
  const { t, lang } = useTranslation()

  useEffect(() => {
    fetchCatalog()
  }, [])

  const fetchCatalog = async () => {
    try {
      setLoading(true)
      const [carsResponse, brandsResponse] = await Promise.all([
        api.get('/cars/?page_size=200'),
        api.get('/cars/brands/'),
      ])
      const list = carsResponse.data.results || carsResponse.data
      const brandsList = brandsResponse.data.results || brandsResponse.data || []
      setBrands(brandsList)
      setCars(list)
    } catch (error) {
      console.error('Error fetching cars:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1 className="page-title">{t.pages.carsCatalog}</h1>
      <p className="admin-subtitle">{t.pages.brandCatalogIntro}</p>

      {loading ? (
        <div className="page-loading">{t.pages.loading}</div>
      ) : (
        <div className="brand-catalog-list">
          {brands.map((brand) => {
            const brandLogo = getBrandLogoOrPlaceholder(brand.logo || '', brand.name)
            const modelCount = Number.isFinite(Number(brand.model_count)) ? Number(brand.model_count) : 0
            const brandDescription = lang === 'pl'
              ? (brand.description_pl || brand.description_en || brand.description)
              : (brand.description_en || brand.description)

            return (
              <section key={brand.slug || brand.name} className="brand-catalog-card">
                <div className="brand-catalog-header brand-catalog-header-static">
                  <div className="brand-catalog-identity">
                    <img src={brandLogo} alt={brand.name} className="brand-catalog-logo" />

                    <div>
                      <div className="brand-catalog-title-row">
                        <h2 className="brand-catalog-title">{brand.name}</h2>
                        <span className="brand-catalog-badge">{modelCount} {t.pages.modelsLabel}</span>
                      </div>
                      {brandDescription && (
                        <p className="brand-catalog-description">{brandDescription}</p>
                      )}
                      <div className="brand-catalog-meta-row">
                        {brand.founded_year && (
                          <span className="brand-catalog-meta-pill">{t.pages.brandFounded}: {brand.founded_year}</span>
                        )}
                        <span className="brand-catalog-meta-pill">{modelCount} {t.pages.modelsLabel}</span>
                      </div>
                    </div>
                  </div>
                  <div className="brand-catalog-actions">
                    <Link to={`/cars/brands/${brand.slug}`} className="catalog-action-btn">
                      {t.pages.openBrand}
                    </Link>
                  </div>
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
