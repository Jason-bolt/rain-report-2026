import React, { useEffect, useState, useRef } from 'react'
import { supabase } from './supabaseClient'

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function App() {
  const [reports, setReports] = useState([])
  const [description, setDescription] = useState('')
  const [severity, setSeverity] = useState('unspecified')
  const [locationName, setLocationName] = useState('')
  const [coords, setCoords] = useState(null)
  const [file, setFile] = useState(null)
  const [status, setStatus] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [severityFilter, setSeverityFilter] = useState('all')
  const [sortOrder, setSortOrder] = useState('newest')
  const [pageSize, setPageSize] = useState(20)
  const [page, setPage] = useState(0)
  const fileInputRef = useRef()

  useEffect(() => {
    fetchReports()

    const channel = supabase
      .channel('reports-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reports' }, (payload) => {
        setReports((prev) => [payload.new, ...prev])
      })
      .subscribe((status) => {
        console.log('[realtime]', status)
      })

    // Fallback poll every 15 s in case the realtime socket drops
    const poll = setInterval(fetchReports, 15000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(poll)
    }
  }, [])

  async function fetchReports() {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    if (!error) {
      setReports((prev) => {
        if (prev.length === 0) return data
        const existingIds = new Set(prev.map((r) => r.id))
        const newOnes = data.filter((r) => !existingIds.has(r.id))
        return newOnes.length > 0 ? [...newOnes, ...prev] : prev
      })
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setStatus('Location not supported on this device.')
      return
    }
    setStatus('Getting your location…')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setStatus('Location captured.')
      },
      () => setStatus('Could not get location. You can type it manually instead.')
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!description.trim() && !file) {
      setStatus('Add a description or a photo/video before submitting.')
      return
    }
    setSubmitting(true)
    setStatus('Submitting report…')

    let media_url = null
    let media_type = null

    try {
      if (file) {
        const ext = file.name.split('.').pop()
        const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('report-media')
          .upload(path, file)
        if (uploadError) throw uploadError
        const { data: urlData } = supabase.storage.from('report-media').getPublicUrl(path)
        media_url = urlData.publicUrl
        media_type = file.type.startsWith('video') ? 'video' : 'image'
      }

      const { error: insertError } = await supabase.from('reports').insert({
        description: description.trim() || null,
        media_url,
        media_type,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        location_name: locationName.trim() || null,
        severity,
      })
      if (insertError) throw insertError

      setStatus('Report submitted. Thank you.')
      setDescription('')
      setLocationName('')
      setSeverity('unspecified')
      setCoords(null)
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      console.error(err)
      setStatus('Something went wrong — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const filteredReports = reports
    .filter((r) => severityFilter === 'all' || r.severity === severityFilter)
    .sort((a, b) =>
      sortOrder === 'newest'
        ? new Date(b.created_at) - new Date(a.created_at)
        : new Date(a.created_at) - new Date(b.created_at)
    )

  const totalPages = Math.max(1, Math.ceil(filteredReports.length / pageSize))
  const currentPage = Math.min(page, totalPages - 1)
  const visibleReports = filteredReports.slice(
    currentPage * pageSize,
    currentPage * pageSize + pageSize
  )

  return (
    <div className="app">
      <div className="topbar">
        <div className="mark">Rain<span>Watch</span> Ghana</div>
        <div className="sub"><span className="live-dot" />live community reports</div>
      </div>

      <div className="layout">
        <div className="panel">
          <h2>Report a condition</h2>
          <p className="panel-note">
            Your report helps emergency responders see what's happening and where, in real time so they can prioritize and reach affected areas faster.
          </p>
          <form onSubmit={handleSubmit}>
            <textarea
              placeholder="What's happening? e.g. Road flooded near Tema roundabout, knee-deep water."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />

            <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
              <option value="unspecified">Severity — not specified</option>
              <option value="minor">Minor — passable with care</option>
              <option value="moderate">Moderate — difficult to pass</option>
              <option value="severe">Severe — impassable / dangerous</option>
            </select>

            <input
              type="text"
              placeholder="Location name (e.g. Tema Community 9)"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
            />

            <button type="button" className="loc-btn" onClick={useMyLocation}>
              {coords ? `📍 Location set (${coords.lat.toFixed(3)}, ${coords.lng.toFixed(3)})` : '📍 Use my current location'}
            </button>

            <label className="file-btn">
              {file ? `Selected: ${file.name}` : '📷 Attach photo or video (optional)'}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                style={{ display: 'none' }}
                onChange={(e) => setFile(e.target.files[0] || null)}
              />
            </label>

            <button type="submit" className="submit-btn" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit report'}
            </button>
            <div className="status-line">{status}</div>
          </form>
        </div>

        <div className="feed">
          <div className="feed-header">
            <h2 style={{ margin: 0 }}>Live feed ({visibleReports.length})</h2>
            <div className="feed-controls">
              <select
                value={severityFilter}
                onChange={(e) => {
                  setSeverityFilter(e.target.value)
                  setPage(0)
                }}
              >
                <option value="all">All severities</option>
                <option value="unspecified">Severity unknown</option>
                <option value="minor">Minor</option>
                <option value="moderate">Moderate</option>
                <option value="severe">Severe</option>
              </select>
              <select
                value={sortOrder}
                onChange={(e) => {
                  setSortOrder(e.target.value)
                  setPage(0)
                }}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setPage(0)
                }}
              >
                <option value={20}>20 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
              </select>
            </div>
          </div>

          {visibleReports.length === 0 && (
            <div className="empty-state">
              {reports.length === 0
                ? 'No reports yet. Be the first to report a condition near you.'
                : 'No reports match the current filter.'}
            </div>
          )}

          {visibleReports.map((r) => (
            <div className="report-card" key={r.id}>
              <div className={`severity-bar ${r.severity || 'unspecified'}`} />
              <div className="report-body">
                <div className="report-meta">
                  {r.lat && r.lng ? (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="location-link"
                    >
                      {r.location_name || `${r.lat.toFixed(3)}, ${r.lng.toFixed(3)}`}
                    </a>
                  ) : (
                    r.location_name || 'Location not provided'
                  )}
                  {' · '}
                  {timeAgo(r.created_at)}
                  {' · '}
                  {r.severity !== 'unspecified' ? r.severity : 'severity unknown'}
                </div>
                {r.description && <div className="report-desc">{r.description}</div>}
                {r.media_url && (
                  <div className="report-media">
                    {r.media_type === 'video' ? (
                      <video src={r.media_url} controls />
                    ) : (
                      <img src={r.media_url} alt="Reported condition" />
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {filteredReports.length > 0 && (
            <div className="pagination">
              <button
                type="button"
                disabled={currentPage === 0}
                onClick={() => setPage(currentPage - 1)}
              >
                ← Previous
              </button>
              <span>Page {currentPage + 1} of {totalPages}</span>
              <button
                type="button"
                disabled={currentPage >= totalPages - 1}
                onClick={() => setPage(currentPage + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </div>
      </div>

      <footer className="footer">
        <a href="https://github.com/Jason-bolt" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.57.1.78-.25.78-.55 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.75 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.23-1.28-5.23-5.7 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.18a10.9 10.9 0 0 1 5.74 0c2.19-1.49 3.15-1.18 3.15-1.18.62 1.58.23 2.75.11 3.04.74.81 1.18 1.84 1.18 3.1 0 4.43-2.69 5.41-5.25 5.69.41.36.78 1.06.78 2.14 0 1.55-.01 2.79-.01 3.17 0 .3.21.66.79.55A11.5 11.5 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5Z" />
          </svg>
        </a>
        <a href="https://www.linkedin.com/in/jason-appiatu/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.38-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.56V9h3.56v11.45Z" />
          </svg>
        </a>
      </footer>
    </div>
  )
}
