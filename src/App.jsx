import React, { useEffect, useState, useRef } from 'react'
import { supabase } from './supabaseClient'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'

// Fix default marker icons (Vite + Leaflet quirk)
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const GHANA_CENTER = [7.9465, -1.0232]

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
  const fileInputRef = useRef()

  useEffect(() => {
    fetchReports()

    const channel = supabase
      .channel('reports-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reports' }, (payload) => {
        setReports((prev) => [payload.new, ...prev])
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  async function fetchReports() {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    if (!error) setReports(data)
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

  return (
    <div className="app">
      <div className="topbar">
        <div className="mark">Rain<span>Watch</span> Ghana</div>
        <div className="sub"><span className="live-dot" />live community reports</div>
      </div>

      <div className="layout">
        <div className="panel">
          <h2>Report a condition</h2>
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

          <div className="map-wrap">
            <MapContainer center={GHANA_CENTER} zoom={7} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {reports
                .filter((r) => r.lat && r.lng)
                .map((r) => (
                  <Marker key={r.id} position={[r.lat, r.lng]}>
                    <Popup>
                      <strong>{r.location_name || 'Unnamed location'}</strong>
                      <br />
                      {r.description}
                    </Popup>
                  </Marker>
                ))}
            </MapContainer>
          </div>
        </div>

        <div className="feed">
          <div className="feed-header">
            <h2 style={{ margin: 0 }}>Live feed ({reports.length})</h2>
          </div>

          {reports.length === 0 && (
            <div className="empty-state">No reports yet. Be the first to report a condition near you.</div>
          )}

          {reports.map((r) => (
            <div className="report-card" key={r.id}>
              <div className={`severity-bar ${r.severity || 'unspecified'}`} />
              <div className="report-body">
                <div className="report-meta">
                  {r.location_name || (r.lat ? `${r.lat.toFixed(3)}, ${r.lng.toFixed(3)}` : 'Location not provided')}
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
        </div>
      </div>
    </div>
  )
}
