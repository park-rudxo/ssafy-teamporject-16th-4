<script setup>
import { onMounted, onBeforeUnmount, watch, ref, computed } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const emit = defineEmits(['selectCourse'])

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

// pagination
const pageSize = ref(8)
const currentPage = ref(1)

const saveModalOpen = ref(false)
const courseName = ref('')
const courseDesc = ref('')
const isSaving = ref(false)

const savedPanelOpen = ref(false)
const savedCourses = ref([])

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

// 전체 버튼: 모두 선택이면 전체 해제, 아니면 전체 선택
function toggleAllTypes() {
  if (selectedTypes.value.size === typeKeys.length) {
    selectedTypes.value = new Set()
  } else {
    selectedTypes.value = new Set(typeKeys)
  }
  updateMarkers()
}

function toggleRouteOnly() {
  showRouteOnly.value = !showRouteOnly.value
  updateMarkers()
}

function normalizeDisplayItem(item, index) {
  if (item && Array.isArray(item.stops) && item.stops.length) {
    const name = item?.name || item?.title || '여행코스'
    const description = item?.description || item?.addr1 || ''
    const id = item?.id || item?.contentid || `course-${index}`
    const stops = item.stops
      .map((s, i) => {
        const lat = parseCoord(s?.lat ?? s?.mapy ?? s?.latitude ?? null)
        const lng = parseCoord(s?.lng ?? s?.mapx ?? s?.longitude ?? null)
        const type = normalizeType(s?.type ?? s?.contentType ?? s?.contenttype ?? null)
        return {
          id: s?.id ?? s?.contentid ?? `${id}-stop-${i}`,
          name: s?.name || s?.title || `정류장 ${i + 1}`,
          description: s?.description || s?.addr1 || '',
          lat,
          lng,
          type,
          raw: s
        }
      })
      .filter(Boolean)

    return {
      id,
      name,
      description,
      type: '여행코스',
      lat: null,
      lng: null,
      raw: item,
      isCourse: true,
      stops
    }
  }

  if (typeof item === 'string') {
    return { id: `string-${index}`, name: item, description: '', type: null, lat: null, lng: null, raw: item }
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
    lng,
    raw: item
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

const totalPages = computed(() => Math.max(1, Math.ceil(filteredPlaces.value.length / pageSize.value)))
const paginatedPlaces = computed(() => {
  const p = Math.max(1, Math.min(currentPage.value, totalPages.value))
  const start = (p - 1) * pageSize.value
  return filteredPlaces.value.slice(start, start + pageSize.value)
})

function goPrevPage() {
  if (currentPage.value > 1) currentPage.value--
}
function goNextPage() {
  if (currentPage.value < totalPages.value) currentPage.value++
}
function goToPage(n) {
  currentPage.value = Math.max(1, Math.min(n, totalPages.value))
}

const routeSummary = computed(() => {
  if (!routeStops.value.length) {
    return '관심 있는 장소를 추가해 경로를 완성해 보세요.'
  }

  return routeStops.value
    .map((stop, idx) => `${idx + 1}. ${stop.name}`)
    .join(' → ')
})

function removeFromRoute(id) {
  routeStops.value = routeStops.value.filter(stop => stop.id !== id)
  updateMarkers()
}

function moveRouteItem(index, direction) {
  const nextIndex = index + direction
  if (nextIndex < 0 || nextIndex >= routeStops.value.length) return

  const updated = [...routeStops.value]
  const [target] = updated.splice(index, 1)
  updated.splice(nextIndex, 0, target)
  routeStops.value = updated
  updateMarkers()
}

function seedRoute() {
  const initial = filteredPlaces.value.slice(0, 3).map(item => ({ ...item }))
  routeStops.value = initial
  initial.forEach(it => emit('selectCourse', it.raw ?? it))
  updateMarkers()
}

function togglePlace(item) {
  if (!item) return

  // 사용자가 장소 누르면 항상 "내 경로" 보기 켜기
  showRouteOnly.value = true

  if (item.isCourse || (item.raw && Array.isArray(item.raw.stops) && item.raw.stops.length)) {
    const stops = item.stops ?? (item.raw?.stops ?? [])
    const stopIds = stops.map((s, idx) => s.id ?? s.contentid ?? `${item.id}-stop-${idx}`)
    const anyInRoute = stopIds.some(id => routeStops.value.some(rs => rs.id === id))

    if (anyInRoute) {
      routeStops.value = routeStops.value.filter(rs => !stopIds.includes(rs.id))
      updateMarkers()
      return
    } else {
      stops.forEach((s, idx) => {
        const stopId = s.id ?? s.contentid ?? `${item.id}-stop-${idx}`
        const exists = routeStops.value.some(stop => stop.id === stopId)
        if (exists) return
        const toAdd = {
          id: stopId,
          name: s.name || s.title || `정류장 ${idx + 1}`,
          description: s.description || s.addr1 || '',
          lat: s.lat ?? parseCoord(s?.mapy ?? s?.latitude ?? null),
          lng: s.lng ?? parseCoord(s?.mapx ?? s?.longitude ?? null),
          type: normalizeType(s?.type ?? s?.contentType ?? s?.contenttype ?? null),
          raw: s.raw ?? s
        }
        if (toAdd.lat == null || toAdd.lng == null) return
        routeStops.value.push(toAdd)
        emit('selectCourse', s.raw ?? s)
      })
      updateMarkers()
      return
    }
  }

  const exists = routeStops.value.some(stop => stop.id === item.id)
  if (exists) {
    removeFromRoute(item.id)
    return
  }

  routeStops.value.push(item)
  emit('selectCourse', item.raw ?? item)
  updateMarkers()
}

/* localStorage utils */
const STORAGE_KEY = 'localhub-courses'

function getSavedCourses() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function saveCoursesList(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list || []))
}

function openSaveModal() {
  if (!routeStops.value.length) {
    alert('저장할 경로가 비어 있습니다. 장소를 먼저 추가하세요.')
    return
  }
  courseName.value = ''
  courseDesc.value = ''
  saveModalOpen.value = true
}

function saveCourse() {
  if (isSaving.value) return
  isSaving.value = true

  try {
    const name = (courseName.value || '').trim() || `내 코스 ${new Date().toLocaleString()}`
    const desc = (courseDesc.value || '').trim()

    const stops = routeStops.value.map(s => ({
      id: s.id,
      name: s.name,
      description: s.description || '',
      lat: s.lat,
      lng: s.lng,
      type: s.type,
      raw: s.raw ?? null
    }))

    const newCourse = {
      id: Date.now(),
      name,
      description: desc,
      stops,
      createdAt: new Date().toISOString()
    }

    const list = getSavedCourses()
    list.unshift(newCourse)
    saveCoursesList(list)

    saveModalOpen.value = false
    loadSavedCourses()
    alert('코스가 저장되었습니다. (로컬스토리지)')
  } catch (err) {
    console.error(err)
    alert('저장 중 오류가 발생했습니다.')
  } finally {
    isSaving.value = false
  }
}

function loadSavedCourses() {
  savedCourses.value = getSavedCourses()
}

function openSavedPanel() {
  loadSavedCourses()
  savedPanelOpen.value = true
}

function closeSavedPanel() {
  savedPanelOpen.value = false
}

function deleteSavedCourse(courseId) {
  if (!confirm('이 코스를 삭제하시겠습니까?')) return
  const list = getSavedCourses().filter(c => c.id !== courseId)
  saveCoursesList(list)
  loadSavedCourses()
}

function loadSavedCourse(course, replace = true) {
  if (!course || !Array.isArray(course.stops)) return
  const stops = course.stops
    .map((s, idx) => ({
      id: s.id ?? `${course.id}-stop-${idx}`,
      name: s.name || `정류장 ${idx + 1}`,
      description: s.description || '',
      lat: parseCoord(s.lat),
      lng: parseCoord(s.lng),
      type: s.type ?? null,
      raw: s.raw ?? null
    }))
    .filter(s => s.lat != null && s.lng != null)

  if (!stops.length) {
    alert('선택한 코스에 지도 좌표가 포함되어 있지 않습니다.')
    return
  }

  if (replace) {
    routeStops.value = [...stops]
  } else {
    stops.forEach(s => {
      if (!routeStops.value.some(r => r.id === s.id)) routeStops.value.push(s)
    })
  }
  stops.forEach(s => emit('selectCourse', s.raw ?? s))
  updateMarkers()
  closeSavedPanel()
}

/* map setup and markers */
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
  updateMarkers()
  setTimeout(() => map.invalidateSize && map.invalidateSize(), 200)
}

function createRouteMarkerIcon(index) {
  return L.divIcon({
    html: `<div class="route-step-badge">${index + 1}</div>`,
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -10]
  })
}

function createMarker(point, index = null, routeMode = false) {
  const popupHtml = `
    <strong>${point.name}</strong><br/>
    ${point.type ? `<em>${point.type}</em><br/>` : ''}
    ${point.description || ''}
  `

  if (routeMode) {
    const marker = L.marker([point.lat, point.lng], {
      icon: createRouteMarkerIcon(index ?? 0)
    }).bindPopup(popupHtml)

    marker.bindTooltip(`${index + 1}. ${point.name}`, {
      permanent: false,
      sticky: true
    })
    return marker
  }

  const marker = L.circleMarker([point.lat, point.lng], {
    radius: 8,
    fillColor: getColorForType(point.type),
    color: '#222',
    weight: 1,
    opacity: 1,
    fillOpacity: 0.95
  }).bindPopup(popupHtml)

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
    .flatMap(p => {
      if (p && Array.isArray(p.stops) && p.stops.length) {
        return []
      }
      const lat = parseCoord(p.lat)
      const lng = parseCoord(p.lng)
      const type = normalizeType(p.type)
      return lat !== null && lng !== null && type ? [{ ...p, lat, lng, type }] : []
    })
    .filter(Boolean)

  hasCoords.value = allPoints.length > 0
  if (!hasCoords.value && routeStops.value.length === 0) return

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
  loadSavedCourses()
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

watch(
  () => routeStops.value,
  () => {
    updateMarkers()
  },
  { deep: true }
)

watch(
  () => showRouteOnly.value,
  () => {
    updateMarkers()
  }
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
        <div class="type-filter-bar" v-if="hasCoords || routeStops.length">
          <button
            class="type-button all"
            :class="{ active: selectedTypes.size === typeKeys.length && !showRouteOnly }"
            @click="toggleAllTypes"
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

        <div ref="mapRef" class="map" v-show="hasCoords || routeStops.length"></div>

        <div v-if="!hasCoords && routeStops.length === 0" class="card no-coords">
          <p>이 권역에 좌표 정보가 없습니다. 지도를 보려면 src/data/sample-region.json의 각 장소에 lat/lng 값을 추가하세요.</p>
          <div class="highlights" v-if="region?.highlights?.length">
            <h3>장소 목록</h3>
            <ul>
              <li
                v-for="(h, idx) in region.highlights"
                :key="idx"
                @click="() => emit('selectCourse', h)"
                style="cursor: pointer;"
              >
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
          <div style="display:flex; gap:8px; align-items:center;">
            <button class="planner-button" @click="seedRoute">추천 3곳</button>
            <button class="planner-button" @click="openSavedPanel">저장한 코스</button>
          </div>
        </div>

        <div class="picker-grid">
          <div class="place-panel">
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
                @click="selectedCategory = '전체'; currentPage = 1"
              >
                전체
              </button>

              <button
                v-for="type in typeKeys"
                :key="type"
                class="category-chip"
                :class="{ active: selectedCategory === type }"
                @click="() => { selectedCategory = type; currentPage = 1 }"
              >
                {{ type }}
              </button>
            </div>

            <div class="place-list">
              <button
                v-for="place in paginatedPlaces"
                :key="place.id"
                class="place-chip"
                :class="{ selected: routeStops.some(stop => stop.id === place.id), course: place.isCourse }"
                @click="togglePlace(place)"
              >
                {{ place.name }} <span v-if="place.isCourse"> (코스)</span>
              </button>
            </div>

            <div class="pagination" v-if="totalPages > 1">
              <button @click="goPrevPage" :disabled="currentPage === 1">◀</button>
              <span>{{ currentPage }} / {{ totalPages }}</span>
              <button @click="goNextPage" :disabled="currentPage === totalPages">▶</button>
            </div>
          </div>

          <div class="course-panel">
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

            <div class="planner-footer">
              <p>{{ routeSummary }}</p>
              <div class="planner-actions">
                <button class="save-course-btn" @click="openSaveModal">코스 저장</button>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>

    <!-- 저장 모달 -->
    <div v-if="saveModalOpen" class="modal-backdrop" @click.self="saveModalOpen = false">
      <div class="modal">
        <h4>코스 저장</h4>
        <input v-model="courseName" placeholder="코스 이름 (선택)" />
        <textarea v-model="courseDesc" placeholder="코스 설명 (선택)"></textarea>
        <div class="modal-actions">
          <button @click="saveModalOpen = false">취소</button>
          <button class="primary" @click="saveCourse" :disabled="isSaving">{{ isSaving ? '저장중...' : '저장' }}</button>
        </div>
      </div>
    </div>

    <!-- 저장된 코스 패널 -->
    <div v-if="savedPanelOpen" class="modal-backdrop" @click.self="closeSavedPanel">
      <div class="modal large">
        <h4>저장한 내 코스</h4>
        <div v-if="!savedCourses.length" class="empty-state">저장된 코스가 없습니다.</div>
        <ul class="saved-list">
          <li v-for="c in savedCourses" :key="c.id" class="saved-item">
            <div class="saved-meta">
              <strong>{{ c.name }}</strong>
              <small>{{ c.description }}</small>
              <div class="saved-created">{{ new Date(c.createdAt).toLocaleString() }}</div>
            </div>
            <div class="saved-actions">
              <button @click="loadSavedCourse(c, true)">불러오기(대체)</button>
              <button @click="loadSavedCourse(c, false)">불러오기(추가)</button>
              <button class="danger" @click="deleteSavedCourse(c.id)">삭제</button>
            </div>
          </li>
        </ul>
        <div class="modal-actions">
          <button @click="closeSavedPanel">닫기</button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.region-overview { position: relative; }

/* 기존 스타일 유지 + 추가 레이아웃 스타일 */
.route-layout {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

/* 맵 패널은 좌측에, 플래너는 우측에 고정 너비 */
.map-panel {
  flex: 1 1 0;
  min-width: 0;
}
.route-planner {
  width: 420px;
  box-sizing: border-box;
}

/* picker-grid: 장소 패널(좌) / 코스 패널(우) */
.picker-grid {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 12px;
  margin-top: 12px;
}
.place-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.course-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* 장소 리스트 스크롤 영역 한정 (페이지네이션과 결합) */
.place-list {
  display: grid;
  gap: 8px;
  max-height: 280px;
  overflow: auto;
  padding-right: 6px;
}

/* 장소칩 */
.place-chip {
  text-align: left;
  padding: 8px;
  border-radius: 8px;
  border: 1px solid #e6e6e6;
  background: #fff;
  cursor: pointer;
}
.place-chip.course {
  border-style: dashed;
}
.place-chip.selected {
  background: linear-gradient(180deg, #e6f7ff, #ffffff);
  border-color: #60a5fa;
}

/* 코스 목록 스크롤 */
.route-list {
  max-height: 360px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* pagination */
.pagination {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: center;
  margin-top: 8px;
}

/* 기타 스타일은 기존에서 재사용 */
.modal-backdrop {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(0,0,0,0.35);
  z-index: 1200;
}

/* 보존: 기존 모달 / 저장 스타일 등 (중복 생략 가능) */
</style>