<script setup>
import { onMounted, onBeforeUnmount, watch, ref, computed } from 'vue'
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
const routeStops = ref([])
const selectedCategory = ref('전체')
const searchQuery = ref('')
const showRouteOnly = ref(false)

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

function toggleRouteOnly() {
  showRouteOnly.value = !showRouteOnly.value
  updateMarkers()
}

function normalizeDisplayItem(item, index) {
  if (typeof item === 'string') {
    return { id: `string-${index}`, name: item, description: '', type: null, lat: null, lng: null }
  }

  const name = item?.name || item?.title || item?.place || '장소'
  const description = item?.description || item?.addr1 || item?.addr2 || ''
  const type = normalizeType(item?.type ?? item?.contentType ?? item?.contentTypeId ?? item?.contenttype ?? null)
  const lat = parseCoord(item?.lat ?? item?.mapy ?? item?.latitude ?? null)
  const lng = parseCoord(item?.lng ?? item?.mapx ?? item?.longitude ?? null)

  return {
    id: item?.id ?? item?.contentid ?? `${name}-${index}`,
    name,
    description,
    type,
    lat,
    lng
  }
}

const availablePlaces = computed(() => {
  const points = Array.isArray(props.region?.highlights) ? props.region.highlights : []
  return points
    .map((p, idx) => normalizeDisplayItem(p, idx))
    .filter(item => item && item.name)
})

const filteredPlaces = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()

  return availablePlaces.value.filter(place => {
    const matchesCategory =
      selectedCategory.value === '전체' || place.type === selectedCategory.value

    const matchesQuery =
      !query ||
      place.name.toLowerCase().includes(query) ||
      place.description.toLowerCase().includes(query)

    return matchesCategory && matchesQuery
  })
})

const routeSummary = computed(() => {
  if (!routeStops.value.length) {
    return '관심 있는 장소를 추가해 경로를 완성해 보세요.'
  }

  return routeStops.value
    .map((stop, idx) => `${idx + 1}. ${stop.name}`)
    .join(' → ')
})

function addToRoute(item) {
  if (!item) return

  const exists = routeStops.value.some(stop => stop.id === item.id)
  if (exists) return

  routeStops.value.push(item)
}

function removeFromRoute(id) {
  routeStops.value = routeStops.value.filter(stop => stop.id !== id)
}

function moveRouteItem(index, direction) {
  const nextIndex = index + direction
  if (nextIndex < 0 || nextIndex >= routeStops.value.length) return

  const updated = [...routeStops.value]
  const [target] = updated.splice(index, 1)
  updated.splice(nextIndex, 0, target)
  routeStops.value = updated
}

function seedRoute() {
  const initial = filteredPlaces.value.slice(0, 3).map(item => ({ ...item }))
  routeStops.value = initial
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

  map = L.map(mapRef.value, { preferCanvas: true }).setView([37.5665, 126.9780], 11)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map)

  markersLayer = L.layerGroup().addTo(map)
  boundsInitialized = false
  updateMarkers()
  setTimeout(() => map.invalidateSize && map.invalidateSize(), 200)
}

function createMarker(point, index = null, routeMode = false) {
  const marker = L.circleMarker([point.lat, point.lng], {
    radius: routeMode ? 10 : 8,
    fillColor: routeMode ? '#0f766e' : getColorForType(point.type),
    color: '#222',
    weight: 1,
    opacity: 1,
    fillOpacity: 0.95
  }).bindPopup(`
    <strong>${point.name}</strong><br/>
    ${point.type ? `<em>${point.type}</em><br/>` : ''}
    ${point.description || ''}
  `)

  if (routeMode && index !== null) {
    marker.bindTooltip(`${index + 1}. ${point.name}`, {
      permanent: false,
      sticky: true
    })
  }

  return marker
}

function createRoutePolyline(routePoints) {
  if (routePoints.length < 2) return null

  const latlngs = routePoints.map(point => [point.lat, point.lng])

  const polyline = L.polyline(latlngs, {
    color: '#2563eb',
    weight: 4,
    opacity: 0.9,
    lineCap: 'round',
    lineJoin: 'round'
  })

  const arrowLayers = []
  for (let i = 0; i < latlngs.length - 1; i++) {
    const [startLat, startLng] = latlngs[i]
    const [endLat, endLng] = latlngs[i + 1]

    const midLat = (startLat + endLat) / 2
    const midLng = (startLng + endLng) / 2

    const dx = endLat - startLat
    const dy = endLng - startLng
    const length = Math.hypot(dx, dy) || 0.0001

    const arrowLength = Math.max(0.00025, length * 0.08)

    const arrowStartLat = midLat - (dx / length) * (arrowLength / 2)
    const arrowStartLng = midLng - (dy / length) * (arrowLength / 2)
    const arrowEndLat = midLat + (dx / length) * (arrowLength / 2)
    const arrowEndLng = midLng + (dy / length) * (arrowLength / 2)

    arrowLayers.push(
      L.polyline([[arrowStartLat, arrowStartLng], [arrowEndLat, arrowEndLng]], {
        color: '#0f766e',
        weight: 3,
        opacity: 1
      })
    )
  }

  return { polyline, arrowLayers }
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

  const routePoints = routeStops.value
    .map(stop => {
      const lat = parseCoord(stop.lat)
      const lng = parseCoord(stop.lng)
      const type = normalizeType(stop.type)
      return lat !== null && lng !== null ? { ...stop, lat, lng, type } : null
    })
    .filter(Boolean)

  if (showRouteOnly.value) {
    if (routePoints.length > 1) {
      const routeLine = createRoutePolyline(routePoints)
      if (routeLine) {
        markersLayer.addLayer(routeLine.polyline)
        routeLine.arrowLayers.forEach(layer => markersLayer.addLayer(layer))
      }
    }

    routePoints.forEach((point, index) => {
      markersLayer.addLayer(createMarker(point, index, true))
    })
  } else {
    const visiblePoints = allPoints.filter(p => selectedTypes.value.has(p.type))
    visiblePoints.forEach(point => markersLayer.addLayer(createMarker(point)))

    if (!boundsInitialized && visiblePoints.length > 0) {
      map.setView([37.5665, 126.9780], 11)
      boundsInitialized = true
    }
  }

  if (!boundsInitialized && routePoints.length > 0 && showRouteOnly.value) {
    map.setView([37.5665, 126.9780], 11)
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
    routeStops.value = []
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
      <div>
        <h2>{{ region?.name }}</h2>
        <p>{{ region?.description }}</p>
      </div>
      <div class="route-count-badge" v-if="routeStops.length">
        {{ routeStops.length }}개 경로
      </div>
    </div>

    <div class="route-layout">
      <div class="map-panel">
        <div class="type-filter-bar" v-if="hasCoords">
          <button
            class="type-button all"
            :class="{ active: selectedTypes.size === typeKeys.length && !showRouteOnly }"
            @click="selectAllTypes"
          >
            전체
          </button>

          <button
            v-for="type in typeKeys"
            :key="type"
            class="type-button"
            :class="{ active: selectedTypes.has(type) && !showRouteOnly }"
            :style="{
              borderColor: typeColors[type],
              background: selectedTypes.has(type) && !showRouteOnly ? typeColors[type] : '#fff',
              color: selectedTypes.has(type) && !showRouteOnly ? '#fff' : '#222'
            }"
            @click="toggleType(type)"
          >
            {{ type }}
          </button>

          <button
            class="type-button route-toggle"
            :class="{ active: showRouteOnly }"
            @click="toggleRouteOnly"
          >
            내 경로
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
      </div>

      <aside class="route-planner">
        <div class="planner-header">
          <div>
            <h3>경로 짜기</h3>
            <p>데이터 기반으로 방문 순서를 정리해보세요.</p>
          </div>
          <button class="planner-button" @click="seedRoute">추천 3곳</button>
        </div>

        <div class="route-list">
          <div v-if="routeStops.length === 0" class="empty-state">
            아직 선택한 장소가 없습니다.
          </div>

          <div v-for="(stop, index) in routeStops" :key="stop.id" class="route-step">
            <div class="order-pill">{{ index + 1 }}</div>
            <div class="route-details">
              <strong>{{ stop.name }}</strong>
              <span>{{ stop.description || '방문 예정 장소' }}</span>
            </div>
            <div class="route-actions">
              <button @click="moveRouteItem(index, -1)" :disabled="index === 0">↑</button>
              <button @click="moveRouteItem(index, 1)" :disabled="index === routeStops.length - 1">↓</button>
              <button class="danger" @click="removeFromRoute(stop.id)">삭제</button>
            </div>
          </div>
        </div>

        <div class="place-picker">
          <h4>장소 추가</h4>

          <input
            v-model="searchQuery"
            placeholder="장소 검색"
            class="place-search"
          />

          <div class="category-tabs">
            <button
              class="category-chip"
              :class="{ active: selectedCategory === '전체' }"
              @click="selectedCategory = '전체'"
            >
              전체
            </button>

            <button
              v-for="type in typeKeys"
              :key="type"
              class="category-chip"
              :class="{ active: selectedCategory === type }"
              @click="selectedCategory = type"
            >
              {{ type }}
            </button>
          </div>

          <div class="place-list">
            <button
              v-for="place in filteredPlaces"
              :key="place.id"
              class="place-chip"
              :class="{ selected: routeStops.some(stop => stop.id === place.id) }"
              @click="addToRoute(place)"
            >
              {{ place.name }}
            </button>
          </div>
        </div>

        <div class="planner-footer">
          <p>{{ routeSummary }}</p>
        </div>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.region-overview {
  position: relative;
}

.region-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
}

.route-count-badge {
  padding: 6px 10px;
  border-radius: 999px;
  background: #2563eb;
  color: #fff;
  font-size: 0.9rem;
  font-weight: 700;
  white-space: nowrap;
}

.route-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(320px, 0.95fr);
  gap: 16px;
  align-items: start;
}

.map-panel {
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

.type-button.route-toggle {
  background: #eff6ff;
  color: #1d4ed8;
  border-color: #93c5fd;
}

.route-planner {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
}

.planner-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.planner-header h3 {
  margin: 0 0 4px;
  font-size: 1rem;
}

.planner-header p {
  margin: 0;
  font-size: 0.9rem;
  color: #64748b;
}

.planner-button {
  border: none;
  background: #2563eb;
  color: #fff;
  padding: 8px 10px;
  border-radius: 999px;
  cursor: pointer;
  font-size: 0.85rem;
  white-space: nowrap;
}

.route-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 260px;
  overflow-y: auto;
}

.empty-state {
  padding: 12px;
  border: 1px dashed #cbd5e1;
  border-radius: 12px;
  color: #64748b;
  text-align: center;
  background: #fff;
}

.route-step {
  display: grid;
  grid-template-columns: 34px 1fr auto;
  gap: 8px;
  align-items: center;
  padding: 10px;
  border-radius: 12px;
  background: #fff;
  border: 1px solid #e2e8f0;
}

.order-pill {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: #dbeafe;
  color: #1d4ed8;
  font-weight: 700;
}

.route-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.route-details span {
  font-size: 0.85rem;
  color: #64748b;
}

.route-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.route-actions button {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #fff;
  color: #334155;
  padding: 4px 6px;
  cursor: pointer;
}

.route-actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.route-actions .danger {
  color: #dc2626;
  border-color: #fecaca;
}

.place-picker {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.place-search {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
}

.category-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.category-chip {
  border: 1px solid #cbd5e1;
  background: #fff;
  color: #334155;
  padding: 6px 10px;
  border-radius: 999px;
  cursor: pointer;
  font-size: 0.8rem;
}

.category-chip.active {
  background: #2563eb;
  color: #fff;
  border-color: #2563eb;
}

.place-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  max-height: 260px;
  overflow-y: auto;
}

.place-chip {
  border: 1px solid #cbd5e1;
  border-radius: 999px;
  background: #fff;
  color: #334155;
  padding: 6px 10px;
  cursor: pointer;
  font-size: 0.85rem;
}

.place-chip.selected {
  background: #dbeafe;
  border-color: #60a5fa;
  color: #1d4ed8;
}

.planner-footer {
  padding-top: 4px;
  border-top: 1px solid #e2e8f0;
  color: #475569;
  font-size: 0.92rem;
}

@media (max-width: 900px) {
  .route-layout {
    grid-template-columns: 1fr;
  }

  .route-planner {
    position: static;
  }
}
</style>