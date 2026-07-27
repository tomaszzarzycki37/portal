import { useCallback, useEffect, useMemo, useState } from 'react'
import api from '../services/api'

function SimpleBars({ rows, valueKey = 'hits', labelKey = 'day', maxHeight = 140 }) {
  const maxValue = Math.max(1, ...rows.map((row) => Number(row[valueKey]) || 0))
  return (
    <div
      className="owner-bars"
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: '0.4rem',
        minHeight: maxHeight + 28,
        padding: '0.75rem 0.5rem 0',
        borderBottom: '1px solid rgba(148,163,184,0.35)',
        overflowX: 'auto',
      }}
    >
      {rows.map((row, index) => {
        const value = Number(row[valueKey]) || 0
        const height = Math.max(6, Math.round((value / maxValue) * maxHeight))
        const rawLabel = String(row[labelKey] || '')
        const label = rawLabel.length > 10 ? rawLabel.slice(5, 10) : rawLabel.slice(-5)
        return (
          <div key={`${rawLabel}-${index}`} style={{ flex: '1 0 28px', textAlign: 'center', minWidth: 28 }}>
            <div className="admin-meta" style={{ fontSize: '0.7rem', marginBottom: 4 }}>{value}</div>
            <div
              title={`${rawLabel}: ${value}`}
              style={{
                height,
                background: 'linear-gradient(180deg, #fbbf24, #ea580c)',
                borderRadius: '6px 6px 0 0',
                margin: '0 auto',
                maxWidth: 32,
                boxShadow: '0 0 0 1px rgba(234,88,12,0.25)',
              }}
            />
            <div className="admin-meta" style={{ fontSize: '0.65rem', marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {label}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function StatPill({ label, value }) {
  return (
    <span className="admin-meta">
      <strong>{label}:</strong> {value}
    </span>
  )
}

function formatRate(kbps) {
  const value = Number(kbps) || 0
  if (value >= 1000) return `${(value / 1000).toFixed(2)} Mbps`
  return `${value.toFixed(1)} kbps`
}

function LiveThroughputChart({ labels }) {
  const [live, setLive] = useState(null)
  const [liveError, setLiveError] = useState('')

  useEffect(() => {
    let cancelled = false
    let timer = null

    const poll = async () => {
      const result = await safeGet('/common/owner/traffic/live/?seconds=60')
      if (cancelled) return
      if (result.ok) {
        setLive(result.data)
        setLiveError('')
      } else {
        setLiveError(result.error)
      }
    }

    poll()
    timer = window.setInterval(poll, 1000)
    return () => {
      cancelled = true
      if (timer) window.clearInterval(timer)
    }
  }, [])

  const points = live?.points || []
  const width = 640
  const height = 160
  const padX = 8
  const padY = 12
  const maxKbps = Math.max(1, ...(points.map((p) => Number(p.kbps) || 0)), Number(live?.peak_kbps) || 0)
  const usableW = width - padX * 2
  const usableH = height - padY * 2

  const coords = points.map((point, index) => {
    const x = padX + (points.length <= 1 ? usableW / 2 : (index / (points.length - 1)) * usableW)
    const y = padY + usableH - ((Number(point.kbps) || 0) / maxKbps) * usableH
    return `${x},${y}`
  })
  const polyline = coords.join(' ')
  const areaPath = coords.length > 1
    ? `M ${padX},${padY + usableH} L ${coords.join(' L ')} L ${padX + usableW},${padY + usableH} Z`
    : ''

  return (
    <div className="admin-form-card" style={{ marginBottom: '1rem', background: 'rgba(15,23,42,0.04)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <h3 className="admin-section-caption" style={{ marginBottom: '0.35rem' }}>{labels.ownerLiveTrafficTitle}</h3>
          <p className="admin-meta">{labels.ownerLiveTrafficHint}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, lineHeight: 1.1, color: '#ea580c' }}>
            {formatRate(live?.current_kbps)}
          </div>
          <div className="admin-meta">
            {labels.ownerLivePeak}: {formatRate(live?.peak_kbps)}
            {' • '}
            {labels.ownerLiveHits}: {live?.latest_hits ?? 0}/s
          </div>
        </div>
      </div>

      {liveError ? (
        <p className="form-error" style={{ marginTop: '0.75rem' }}>{liveError}</p>
      ) : (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          height={height}
          role="img"
          aria-label={labels.ownerLiveTrafficTitle}
          style={{ marginTop: '0.75rem', display: 'block', background: 'linear-gradient(180deg, rgba(15,23,42,0.06), transparent)' }}
        >
          {[0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = padY + usableH - ratio * usableH
            return (
              <g key={ratio}>
                <line x1={padX} x2={padX + usableW} y1={y} y2={y} stroke="rgba(148,163,184,0.35)" strokeWidth="1" />
                <text x={padX + 2} y={y - 2} fill="rgba(100,116,139,0.9)" fontSize="10">
                  {formatRate(maxKbps * ratio)}
                </text>
              </g>
            )
          })}
          {areaPath && <path d={areaPath} fill="rgba(249,115,22,0.18)" />}
          {polyline && (
            <polyline
              points={polyline}
              fill="none"
              stroke="#ea580c"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
        </svg>
      )}
      <div className="admin-meta" style={{ marginTop: '0.35rem' }}>
        {labels.ownerLiveWindow}: {live?.window_seconds || 60}s
      </div>
    </div>
  )
}

async function safeGet(url) {
  try {
    const response = await api.get(url)
    return { ok: true, data: response.data }
  } catch (err) {
    const detail = err?.response?.data?.detail || err?.message || 'error'
    return { ok: false, error: String(detail) }
  }
}

export default function OwnerSupervisionPanel({ t }) {
  const [open, setOpen] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [overview, setOverview] = useState(null)
  const [traffic, setTraffic] = useState(null)
  const [security, setSecurity] = useState(null)
  const [health, setHealth] = useState(null)
  const [content, setContent] = useState(null)
  const [adminActivity, setAdminActivity] = useState(null)
  const [godMode, setGodMode] = useState(null)
  const [blockIp, setBlockIp] = useState('')
  const [blockReason, setBlockReason] = useState('')
  const [blocking, setBlocking] = useState(false)
  const [actionSaving, setActionSaving] = useState(false)

  const labels = t.adminPanel

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError('')
    const results = await Promise.all([
      safeGet('/common/owner/overview/'),
      safeGet('/common/owner/traffic/?days=14'),
      safeGet('/common/owner/security/?days=7'),
      safeGet('/common/owner/health/'),
      safeGet('/common/owner/content-intel/?days=14'),
      safeGet('/common/owner/admin-activity/?days=14'),
      safeGet('/common/owner/god-mode/'),
    ])

    const [overviewRes, trafficRes, securityRes, healthRes, contentRes, activityRes, godRes] = results
    if (overviewRes.ok) setOverview(overviewRes.data)
    if (trafficRes.ok) setTraffic(trafficRes.data)
    if (securityRes.ok) setSecurity(securityRes.data)
    if (healthRes.ok) setHealth(healthRes.data)
    if (contentRes.ok) setContent(contentRes.data)
    if (activityRes.ok) setAdminActivity(activityRes.data)
    if (godRes.ok) setGodMode(godRes.data)

    const failed = results.filter((item) => !item.ok)
    if (failed.length === results.length) {
      setError(labels.ownerLoadError || 'Could not load supervision data.')
    } else if (failed.length > 0) {
      setError(`${labels.ownerPartialLoadError || 'Some supervision modules failed.'} (${failed.map((item) => item.error).join('; ')})`)
    }

    setLoading(false)
  }, [labels.ownerLoadError, labels.ownerPartialLoadError])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const trafficBars = useMemo(() => traffic?.by_day || [], [traffic])
  const hourBars = useMemo(() => traffic?.by_hour_24h || [], [traffic])

  const handleBlockIp = async (event) => {
    event.preventDefault()
    if (!blockIp.trim()) return
    setBlocking(true)
    setMessage('')
    setError('')
    try {
      await api.post('/common/owner/blocked-ips/', {
        ip_address: blockIp.trim(),
        reason: blockReason.trim(),
      })
      setBlockIp('')
      setBlockReason('')
      setMessage(labels.ownerIpBlocked)
      await loadAll()
    } catch {
      setError(labels.ownerIpBlockError)
    } finally {
      setBlocking(false)
    }
  }

  const handleUnblock = async (id) => {
    setError('')
    try {
      await api.delete(`/common/owner/blocked-ips/${id}/`)
      setMessage(labels.ownerIpUnblocked)
      await loadAll()
    } catch {
      setError(labels.ownerIpBlockError)
    }
  }

  const runGodAction = async (action) => {
    setActionSaving(true)
    setError('')
    setMessage('')
    try {
      await api.post('/common/owner/god-mode/', { action })
      setMessage(labels.ownerActionDone)
      await loadAll()
    } catch {
      setError(labels.ownerActionError)
    } finally {
      setActionSaving(false)
    }
  }

  return (
    <section className="admin-form-card admin-collapsible-card">
      <button
        type="button"
        className="admin-collapsible-toggle"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        <h2 className="admin-section-heading admin-section-heading-with-badge">
          <span>{labels.ownerSectionTitle}</span>
          <span className="admin-site-badge">{labels.ownerSectionBadge}</span>
        </h2>
        <span className={`admin-inline-toggle admin-inline-gear ${open ? 'is-open' : ''}`} aria-hidden="true">
          <svg className="admin-inline-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.3 7.3 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.49-.42h-3.84a.5.5 0 0 0-.49.42l-.36 2.54c-.58.22-1.12.53-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.7 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.82 14.52a.5.5 0 0 0-.12.64l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.4 1.05.72 1.63.94l.36 2.54a.5.5 0 0 0 .49.42h3.84a.5.5 0 0 0 .49-.42l.36-2.54c.58-.22 1.12-.53 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z" />
          </svg>
        </span>
      </button>

      {open && (
        <div>
          <p className="admin-subtitle">{labels.ownerSectionSubtitle}</p>
          <div className="admin-actions-row" style={{ marginBottom: '0.75rem' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={loadAll} disabled={loading}>
              {loading ? t.pages.loading : labels.ownerRefresh}
            </button>
          </div>
          {message && <p className="form-success">{message}</p>}
          {error && <p className="form-error">{error}</p>}
          {loading && !overview && !traffic ? (
            <p className="admin-meta">{t.pages.loading}</p>
          ) : (
            <>
              <div className="admin-actions-row" style={{ flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
                <StatPill label={labels.ownerTraffic7d} value={overview?.traffic_7d ?? '—'} />
                <StatPill label={labels.ownerUniqueIps} value={overview?.unique_ips_7d ?? '—'} />
                <StatPill label={labels.ownerFailedLogins} value={overview?.failed_logins_24h ?? '—'} />
                <StatPill label={labels.ownerBlockedIps} value={overview?.active_blocked_ips ?? '—'} />
                <StatPill label={labels.ownerPendingUsers} value={overview?.pending_users ?? '—'} />
                <StatPill
                  label={labels.ownerMaintenance}
                  value={overview?.maintenance_mode ? labels.ownerOn : labels.ownerOff}
                />
              </div>

              <div className="admin-form-card" style={{ marginBottom: '1rem' }}>
                <h3 className="admin-section-caption">{labels.ownerTrafficTitle}</h3>
                <LiveThroughputChart labels={labels} />
                <p className="admin-meta" style={{ marginBottom: '0.75rem' }}>
                  {labels.ownerHits}: {traffic?.total_hits ?? 0}
                  {' • '}
                  {labels.ownerAvgMs}: {traffic?.avg_response_ms ?? 0}
                  {' • '}
                  {labels.ownerBots}: {traffic?.bot_hits ?? 0}
                </p>
                <p className="admin-meta" style={{ marginBottom: '0.35rem' }}><strong>{labels.ownerTrafficByDay}</strong></p>
                {trafficBars.length > 0 ? (
                  <SimpleBars rows={trafficBars} labelKey="day" valueKey="hits" />
                ) : (
                  <p className="admin-meta">{labels.ownerNoTraffic}</p>
                )}
                {hourBars.length > 0 && (
                  <>
                    <p className="admin-meta" style={{ margin: '1rem 0 0.35rem' }}><strong>{labels.ownerTrafficByHour}</strong></p>
                    <SimpleBars rows={hourBars} labelKey="hour" valueKey="hits" maxHeight={100} />
                  </>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                  <div>
                    <p className="admin-section-caption">{labels.ownerTopPaths}</p>
                    <ul className="admin-meta" style={{ margin: 0, paddingLeft: '1.1rem' }}>
                      {(traffic?.top_paths || []).slice(0, 8).map((row) => (
                        <li key={row.path}>{row.path} — {row.hits}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="admin-section-caption">{labels.ownerTopReferers}</p>
                    <ul className="admin-meta" style={{ margin: 0, paddingLeft: '1.1rem' }}>
                      {(traffic?.top_referers || []).slice(0, 8).map((row) => (
                        <li key={row.referer}>{row.referer} — {row.hits}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="admin-form-card" style={{ marginBottom: '1rem' }}>
                <h3 className="admin-section-caption">{labels.ownerSecurityTitle}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <p className="admin-meta"><strong>{labels.ownerTopFailedIps}</strong></p>
                    <ul className="admin-meta" style={{ margin: 0, paddingLeft: '1.1rem' }}>
                      {(security?.top_failed_ips || []).slice(0, 8).map((row) => (
                        <li key={row.ip_address}>
                          {row.ip_address} — {row.count}
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ marginLeft: 8 }}
                            onClick={() => {
                              setBlockIp(row.ip_address)
                              setBlockReason('Failed login cluster')
                            }}
                          >
                            {labels.ownerBlock}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="admin-meta"><strong>{labels.ownerRecentSecurity}</strong></p>
                    <ul className="admin-meta" style={{ margin: 0, paddingLeft: '1.1rem', maxHeight: 180, overflow: 'auto' }}>
                      {(security?.recent_events || []).slice(0, 12).map((row) => (
                        <li key={row.id}>
                          {row.event_type} • {row.username_attempted || '—'} • {row.ip_address || '—'}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <form onSubmit={handleBlockIp} className="admin-actions-row" style={{ marginTop: '0.85rem', flexWrap: 'wrap' }}>
                  <input
                    className="form-input"
                    style={{ maxWidth: 180 }}
                    placeholder="IP"
                    value={blockIp}
                    onChange={(e) => setBlockIp(e.target.value)}
                  />
                  <input
                    className="form-input"
                    style={{ maxWidth: 240 }}
                    placeholder={labels.ownerBlockReason}
                    value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                  />
                  <button type="submit" className="btn btn-primary btn-sm" disabled={blocking}>
                    {blocking ? t.pages.loading : labels.ownerBlock}
                  </button>
                </form>
                {(security?.blocked_ips || []).length > 0 && (
                  <ul className="admin-meta" style={{ marginTop: '0.75rem', paddingLeft: '1.1rem' }}>
                    {security.blocked_ips.map((row) => (
                      <li key={row.id}>
                        {row.ip_address} — {row.reason || '—'}
                        <button type="button" className="btn btn-secondary btn-sm" style={{ marginLeft: 8 }} onClick={() => handleUnblock(row.id)}>
                          {labels.ownerUnblock}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="admin-form-card" style={{ marginBottom: '1rem' }}>
                <h3 className="admin-section-caption">{labels.ownerHealthTitle}</h3>
                <div className="admin-actions-row" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
                  <StatPill label="5xx/24h" value={health?.errors_5xx_24h ?? '—'} />
                  <StatPill label="4xx/24h" value={health?.errors_4xx_24h ?? '—'} />
                  <StatPill label={labels.ownerAvgMs} value={health?.avg_response_ms_24h ?? '—'} />
                  <StatPill
                    label={labels.ownerDisk}
                    value={health?.disk ? `${health.disk.used_percent}% (${health.disk.free_gb} GB free)` : '—'}
                  />
                </div>
              </div>

              <div className="admin-form-card" style={{ marginBottom: '1rem' }}>
                <h3 className="admin-section-caption">{labels.ownerContentTitle}</h3>
                <div className="admin-actions-row" style={{ flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <StatPill label={labels.ownerPendingUsers} value={content?.pending_approvals ?? '—'} />
                  <StatPill label={labels.ownerModels} value={content?.models_total ?? '—'} />
                  <StatPill label={labels.ownerOpinions} value={content?.opinions_total ?? '—'} />
                  <StatPill label={labels.ownerReviews} value={content?.reviews_total ?? '—'} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <p className="admin-meta"><strong>{labels.ownerCarsNoOpinions}</strong></p>
                    <ul className="admin-meta" style={{ margin: 0, paddingLeft: '1.1rem', maxHeight: 160, overflow: 'auto' }}>
                      {(content?.cars_without_opinions || []).slice(0, 10).map((car) => (
                        <li key={car.id}>{car.brand} {car.name}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="admin-meta"><strong>{labels.ownerWeakRated}</strong></p>
                    <ul className="admin-meta" style={{ margin: 0, paddingLeft: '1.1rem', maxHeight: 160, overflow: 'auto' }}>
                      {(content?.weak_rated_cars || []).slice(0, 10).map((car) => (
                        <li key={car.id}>{car.brand} {car.name} — {Number(car.avg_rating).toFixed(1)}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="admin-form-card" style={{ marginBottom: '1rem' }}>
                <h3 className="admin-section-caption">{labels.ownerAdminActivityTitle}</h3>
                <p className="admin-meta"><strong>{labels.ownerOnlineAdmins}</strong></p>
                <ul className="admin-meta" style={{ margin: 0, paddingLeft: '1.1rem' }}>
                  {(adminActivity?.online_admins || []).map((user) => (
                    <li key={user.id}>{user.username}{user.is_owner ? ' ★' : ''}</li>
                  ))}
                </ul>
                <p className="admin-meta" style={{ marginTop: '0.75rem' }}><strong>{labels.ownerRecentAdminActions}</strong></p>
                <ul className="admin-meta" style={{ margin: 0, paddingLeft: '1.1rem', maxHeight: 180, overflow: 'auto' }}>
                  {(adminActivity?.recent_actions || []).slice(0, 15).map((row) => (
                    <li key={row.id}>{row.actor_username}: {row.action_type} — {row.object_label}</li>
                  ))}
                </ul>
              </div>

              <div className="admin-form-card">
                <h3 className="admin-section-caption">{labels.ownerGodModeTitle}</h3>
                <p className="admin-meta" style={{ marginBottom: '0.75rem' }}>{labels.ownerGodModeHint}</p>
                <div className="admin-actions-row" style={{ flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={actionSaving}
                    onClick={() => runGodAction(godMode?.maintenance_mode ? 'maintenance_off' : 'maintenance_on')}
                  >
                    {godMode?.maintenance_mode ? labels.ownerMaintenanceOff : labels.ownerMaintenanceOn}
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={actionSaving}
                    onClick={() => {
                      if (window.confirm(labels.ownerForceLogoutConfirm)) {
                        runGodAction('force_logout_all')
                      }
                    }}
                  >
                    {labels.ownerForceLogout}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  )
}
