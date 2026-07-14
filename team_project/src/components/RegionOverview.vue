<script setup>
import { onMounted, onBeforeUnmount, watch, ref } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const typeColors = {
  관광지: '#1f77b4',
  레포츠: '#ff7f0e',
  여행코스: '#2ca02c',
  축제공연행사: '#d62728',
  숙박: '#9467bd',
  쇼핑: '#8c564b',
  문화시설: '#17becf',
  기본: '#666'
}

const props = defineProps({
  region: {
    type: Object,
    default: null
  }
})

const mapRef = ref(null)
let map = null
let markersLayer = null
const hasCoords = ref(false)

function parseCoord(value) {
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function getColorForType(type) {
  return typeColors[type] ?? typeColors.기본
}

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
  iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
  shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href
})

function initMap() {
  console.log('DEBUG RegionOverview.initMap — mapRef:', mapRef.value)
  if (!mapRef.value) return
  if (map) map.remove()

  map = L.map(mapRef.value, { preferCanvas: true }).setView([37.5665, 126.9780], 12)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map)

  markersLayer = L.layerGroup().addTo(map)
  updateMarkers()
  setTimeout(() => map.invalidateSize && map.invalidateSize(), 200)
}

function createMarker(point) {
  return L.circleMarker([point.lat, point.lng], {
    radius: 8,
    fillColor: getColorForType(point.type),
    color: '#222',
    weight: 1,
    opacity: 1,
    fillOpacity: 0.85
  }).bindPopup(`
    <strong>${point.name}</strong><br/>
    ${point.type ? `<em>${point.type}</em><br/>` : ''}
    ${point.description || ''}
  `)
}

function updateMarkers() {
  console.log('DEBUG updateMarkers start — region present:', !!props.region)
  if (!markersLayer || !props.region) {
    hasCoords.value = false
    return
  }

  markersLayer.clearLayers()

  const pts = props.region.highlights || []
  const ptsWithCoords = pts
    .map(p => {
      const lat = parseCoord(p.lat)
      const lng = parseCoord(p.lng)
      return lat !== null && lng !== null ? { ...p, lat, lng } : null
    })
    .filter(p => p)

  console.log('DEBUG updateMarkers: ptsWithCoords length:', ptsWithCoords.length)

  hasCoords.value = ptsWithCoords.length > 0
  if (!hasCoords.value) return

  ptsWithCoords.forEach(point => markersLayer.addLayer(createMarker(point)))

  const group = L.featureGroup(markersLayer.getLayers())
  if (ptsWithCoords.length === 1) {
    map.setView([ptsWithCoords[0].lat, ptsWithCoords[0].lng], 14)
  } else if (group.getBounds().isValid()) {
    map.fitBounds(group.getBounds().pad(0.2))
  }
}

onMounted(() => {
  console.log('DEBUG RegionOverview mounted — props.region:', props.region)
  initMap()
})

onBeforeUnmount(() => {
  if (map) {
    map.remove()
    map = null
  }
})

watch(
  () => props.region,
  () => {
    console.log('DEBUG RegionOverview prop change — region present:', !!props.region)
    updateMarkers()
    setTimeout(() => map && map.invalidateSize && map.invalidateSize(), 200)
  },
  { deep: true }
)
</script>

<template>
  <section class="card region-overview">
    <div class="region-header">
      <h2>{{ region?.name }}</h2>
      <p>{{ region?.description }}</p>
    </div>

    <div ref="mapRef" class="map" v-show="hasCoords"></div>

    <div v-if="!hasCoords" class="card no-coords">
      <p>이 권역에 좌표 정보가 없습니다. 지도를 보려면 src/data/sample-region.json의 각 장소에 lat/lng 값을 추가하세요.</p>
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

    <div class="legend" v-if="hasCoords">
      <div class="legend-item" v-for="(color, type) in typeColors" :key="type">
        <span class="legend-dot" :style="{ background: color }"></span>
        <span>{{ type }}</span>
      </div>
    </div>
  </section>
</template>