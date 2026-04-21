import { useTranslation } from '../i18n'

export default function RegisterPage() {
  const { t } = useTranslation()
  return <div className="page-card">{t.pages.register}</div>
}
