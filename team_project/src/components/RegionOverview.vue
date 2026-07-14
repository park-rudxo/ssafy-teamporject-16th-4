<script setup>
import { onMounted, onBeforeUnmount, watch, ref } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const props = defineProps({
  region: Object
})

const mapRef = ref(null)
let map = null
let markersLayer = null
const hasCoords = ref(false)

// Leaflet icon fix for Vite
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
  iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
  shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href
})

function initMap() {
  if (!mapRef.value) return
  if (map) map.remove()

  map = L.map(mapRef.value, {preferCanvas: true}).setView([37.5665, 126.9780], 12)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map)

  markersLayer = L.layerGroup().addTo(map)
  updateMarkers()
  // ensure proper sizing if container was hidden/shown
  setTimeout(() => map.invalidateSize && map.invalidateSize(), 200)
}

function updateMarkers() {
  if (!markersLayer || !props.region) {
    hasCoords.value = false
    return
  }
  markersLayer.clearLayers()

  const pts = props.region.highlights || []
  // accept either objects with lat/lng or ignore strings
  const ptsWithCoords = pts.filter(p => p && typeof p.lat === 'number' && typeof p.lng === 'number')
  hasCoords.value = ptsWithCoords.length > 0

  if (!hasCoords.value) return

  ptsWithCoords.forEach(p => {
    const marker = L.marker([p.lat, p.lng])
      .bindPopup(`<strong>${p.name}</strong><br/>${p.description || ''}`)
    markersLayer.addLayer(marker)
  })

  const group = L.featureGroup(ptsWithCoords.map(p => L.marker([p.lat, p.lng])))
  if (ptsWithCoords.length === 1) {
    map.setView([ptsWithCoords[0].lat, ptsWithCoords[0].lng], 14)
  } else {
    map.fitBounds(group.getBounds().pad(0.2))
  }
}

onMounted(() => initMap())

onBeforeUnmount(() => {
  if (map) {
    map.remove()
    map = null
  }
})

watch(() => props.region, () => {
  // when region changes, update markers and resize map
  updateMarkers()
  setTimeout(() => map && map.invalidateSize && map.invalidateSize(), 200)
}, { deep: true })
</script>

<template>
  <section class="card region-overview">
    <div class="region-header">
      <h2>{{ region?.name }}</h2>
      <p>{{ region?.description }}</p>
    </div>

    <div v-if="hasCoords" ref="mapRef" class="map"></div>

    <div v-else class="card no-coords">
      <p>이 권역에 좌표 정보가 없습니다. 지도를 보려면 `src/data/sample-region.json`의 각 장소에 `lat`/`lng` 값을 추가하세요.</p>
      <div class="highlights" v-if="region?.highlights?.length">
        <h3>장소 목록</h3>
        <ul>
          <li v-for="(h, idx) in region.highlights" :key="idx">
            <strong>{{ typeof h === 'string' ? h : h.name }}</strong>
            <span v-if="h.description"> — {{ h.description }}</span>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>