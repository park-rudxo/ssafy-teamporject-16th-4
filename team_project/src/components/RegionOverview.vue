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
  문화시설: '#17becf'
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
let boundsInitialized = false
const hasCoords = ref(false)

const typeKeys = Object.keys(typeColors)
const selectedTypes = ref(new Set(typeKeys))

function parseCoord(value) {
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function normalizeType(type) {
  if (!type) return null
  const normalized = String(type).trim()
  return typeColors[normalized] ? normalized : null
}

function getColorForType(type) {
  return typeColors[type] ?? '#222'
}

function toggleType(type) {
  if (selectedTypes.value.has(type)) {
    selectedTypes.value.delete(type)
  } else {
    selectedTypes.value.add(type)
  }
  updateMarkers()
}

function selectAllTypes() {
  selectedTypes.value = new Set(typeKeys)
  updateMarkers()
}

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
  iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
  shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href
})

function initMap() {
  if (!mapRef.value) return
  if (map) map.remove()

  map = L.map(mapRef.value, { preferCanvas: true }).setView([37.5665, 126.9780], 12)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map)

  markersLayer = L.layerGroup().addTo(map)
  boundsInitialized = false
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
  if (!markersLayer || !props.region) {
    hasCoords.value = false
    return
  }

  markersLayer.clearLayers()

  const points = Array.isArray(props.region.highlights) ? props.region.highlights : []
  const allPoints = points
    .map(p => {
      const lat = parseCoord(p.lat)
      const lng = parseCoord(p.lng)
      const type = normalizeType(p.type)
      return lat !== null && lng !== null && type ? { ...p, lat, lng, type } : null
    })
    .filter(Boolean)

  hasCoords.value = allPoints.length > 0
  if (!hasCoords.value) return

  const visiblePoints = allPoints.filter(p => selectedTypes.value.has(p.type))
  visiblePoints.forEach(point => markersLayer.addLayer(createMarker(point)))

  if (!boundsInitialized && visiblePoints.length > 0) {
    if (visiblePoints.length === 1) {
      map.setView([visiblePoints[0].lat, visiblePoints[0].lng], 14)
    } else {
      const group = L.featureGroup(markersLayer.getLayers())
      if (group.getBounds().isValid()) {
        map.fitBounds(group.getBounds().pad(0.2))
      }
    }
    boundsInitialized = true
  }
}

onMounted(() => {
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
    boundsInitialized = false
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

    <div class="type-filter-bar" v-if="hasCoords">
      <button
        class="type-button all"
        :class="{ active: selectedTypes.size === typeKeys.length }"
        @click="selectAllTypes"
      >
        전체
      </button>

      <button
        v-for="type in typeKeys"
        :key="type"
        class="type-button"
        :class="{ active: selectedTypes.has(type) }"
        :style="{
          borderColor: typeColors[type],
          background: selectedTypes.has(type) ? typeColors[type] : '#fff',
          color: selectedTypes.has(type) ? '#fff' : '#222'
        }"
        @click="toggleType(type)"
      >
        {{ type }}
      </button>
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
  </section>
</template>

<style scoped>
.region-overview {
  position: relative;
}

.type-filter-bar {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 900;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 14px;
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.12);
}

.type-button {
  min-width: 64px;
  border: 1px solid #ccc;
  border-radius: 999px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.16s ease;
  background: #fff;
  color: #222;
}

.type-button.active {
  color: #fff;
}

.type-button.all {
  font-weight: 700;
}
</style>