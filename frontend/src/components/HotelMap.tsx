import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, ZoomControl } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Marqueur doré personnalisé — SVG inline, pas d'assets externes
const goldMarker = L.divIcon({
  html: `<svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.35))">
    <path d="M15 0C6.716 0 0 6.716 0 15c0 11.25 15 25 15 25S30 26.25 30 15C30 6.716 23.284 0 15 0z" fill="#B8860B"/>
    <circle cx="15" cy="15" r="7" fill="white"/>
    <circle cx="15" cy="15" r="4" fill="#B8860B"/>
  </svg>`,
  className: '',
  iconSize: [30, 40],
  iconAnchor: [15, 40],
  popupAnchor: [0, -44],
})

// Animation douce au chargement
function FlyIn({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => {
    map.flyTo([lat, lng], 16, { duration: 1.4, easeLinearity: 0.25 })
  }, [map, lat, lng])
  return null
}

interface Props {
  lat: number
  lng: number
  name: string
  address: string
  phone?: string
}

export default function HotelMap({ lat, lng, name, address, phone }: Props) {
  const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`

  return (
    <MapContainer
      center={[lat, lng]}
      zoom={14}
      scrollWheelZoom={false}
      zoomControl={false}
      style={{ height: '100%', width: '100%' }}
      attributionControl={true}
    >
      {/* Tuiles CartoDB Positron — plus épurées, sans clé API */}
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a>'
        maxZoom={19}
      />
      {/* Contrôles zoom en bas à droite */}
      <ZoomControl position="bottomright" />
      {/* Animation FlyIn */}
      <FlyIn lat={lat} lng={lng} />
      <Marker position={[lat, lng]} icon={goldMarker}>
        <Popup>
          <div style={{ minWidth: 190, fontFamily: 'inherit' }}>
            <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 14, color: '#B8860B' }}>{name}</p>
            <p style={{ margin: '0 0 2px', fontSize: 12, color: '#555' }}>📍 {address}</p>
            {phone && <p style={{ margin: '0 0 8px', fontSize: 12, color: '#555' }}>📞 {phone}</p>}
            <a
              href={gmapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block', marginTop: 4, padding: '4px 10px',
                background: '#B8860B', color: 'white', borderRadius: 6,
                fontSize: 11, textDecoration: 'none', fontWeight: 600,
              }}
            >
              Ouvrir dans Google Maps →
            </a>
          </div>
        </Popup>
      </Marker>
    </MapContainer>
  )
}
