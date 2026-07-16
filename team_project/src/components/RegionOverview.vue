<script setup>
import { onMounted, onBeforeUnmount, watch, ref, computed } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const emit = defineEmits(['selectCourse'])

const typeColors = {
  관광지: '#3b82f6',   
  레포츠: '#10b981',    
  여행코스: '#8b5cf6',   
  축제공연행사: '#f43f5e', 
  숙박: '#f59e0b',       
  쇼핑: '#ec4899',       
  문화시설: '#06b6d4'     
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
const pageSize = ref(6) // 그리드 레이아웃에 맞춰 조금 더 직관적인 개수로 변경
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
  return typeColors[type] ?? '#64748b'
}

function toggleType(type) {
  if (selectedTypes.value.has(type)) {
    selectedTypes.value.delete(type)
  } else {
    selectedTypes.value.add(type)
  }
  updateMarkers()
}

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

/* Google Maps directions URL helper */
function makeGoogleDirectionsUrl(lat1, lng1, lat2, lng2, travelMode = 'walking') {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return ''
  const origin = `${lat1},${lng1}`
  const destination = `${lat2},${lng2}`
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=${encodeURIComponent(travelMode)}`
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

    // 각 연속 구간에 대해 구글 길찾기 링크 생성
    const legs = []
    for (let i = 0; i < stops.length - 1; i++) {
      const a = stops[i]
      const b = stops[i + 1]
      if (parseCoord(a.lat) != null && parseCoord(a.lng) != null && parseCoord(b.lat) != null && parseCoord(b.lng) != null) {
        legs.push({
          originId: a.id,
          originName: a.name,
          destId: b.id,
          destName: b.name,
          url: makeGoogleDirectionsUrl(a.lat, a.lng, b.lat, b.lng, 'walking')
        })
      }
    }

    const newCourse = {
      id: Date.now(),
      name,
      description: desc,
      stops,
      legs, // 추가된 필드: 각 구간의 구글 길찾기 링크들
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

  map = L.map(mapRef.value, { 
    zoomControl: false, // 커스텀 줌 컨트롤 배치를 위해 해제
    preferCanvas: true 
  }).setView([37.5665, 126.9780], 11)
  
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
  }).addTo(map)

  L.control.zoom({
    position: 'bottomright'
  }).addTo(map)

  markersLayer = L.layerGroup().addTo(map)
  updateMarkers()
  setTimeout(() => map.invalidateSize && map.invalidateSize(), 200)
}

function createRouteMarkerIcon(index, color = '#2563eb') {
  const html = `
    <div class="route-step-badge" style="border: 2.5px solid ${color}; color: ${color};">
      ${index + 1}
    </div>
  `
  return L.divIcon({
    html,
    className: '',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -10]
  })
}

function createBadgeMarker(point, index) {
  const color = getColorForType(point.type)
  const badge = L.marker([point.lat, point.lng], {
    icon: createRouteMarkerIcon(index, color),
    interactive: false
  })

  badge.bindTooltip(`${index + 1}. ${point.name}`, {
    permanent: false,
    sticky: true
  })

  return badge
}

function createMarker(point, index = null, routeMode = false) {
  const popupHtml = `
    <div class="map-popup-card">
      <span class="popup-tag" style="background: ${getColorForType(point.type)}">${point.type || '장소'}</span>
      <strong>${point.name}</strong>
      <p>${point.description || '상세 정보가 없습니다.'}</p>
    </div>
  `

  if (routeMode) {
    const color = getColorForType(point.type)
    const marker = L.marker([point.lat, point.lng], {
      icon: createRouteMarkerIcon(index ?? 0, color)
    }).bindPopup(popupHtml)

    marker.bindTooltip(`${index + 1}. ${point.name}`, {
      permanent: false,
      sticky: true
    })
    return marker
  }

  const marker = L.circleMarker([point.lat, point.lng], {
    radius: 9,
    fillColor: getColorForType(point.type),
    color: '#ffffff',
    weight: 2,
    opacity: 1,
    fillOpacity: 0.95
  }).bindPopup(popupHtml)

  return marker
}

function createRoutePolyline(routePoints) {
  if (routePoints.length < 2) return null

  const latlngs = routePoints.map(point => [point.lat, point.lng])

  const polyline = L.polyline(latlngs, {
    color: '#3b82f6',
    weight: 4,
    opacity: 0.8,
    dashArray: '5, 8', // 에어비앤비/트리플 스타일 점선
    lineCap: 'round',
    lineJoin: 'round'
  })

  return { polyline, arrowLayers: [] }
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
      }
    }

    routePoints.forEach((point, index) => {
      markersLayer.addLayer(createMarker(point))
      markersLayer.addLayer(createBadgeMarker(point, index))
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
  <section class="region-overview">
    <!-- 상단: 에어비앤비 스타일 헤더바 -->
    <header class="tab-header">
      <div class="header-titles">
        <h2>{{ region?.name || '서울 명소 탐색' }}</h2>
        <p class="subtitle">{{ region?.description || '가장 트렌디한 서울의 플레이스를 맞춤형 코스로 설계하세요.' }}</p>
      </div>
      <div class="header-actions">
        <button class="btn-action primary" @click="seedRoute">⚡ 추천 코스 자동 생성</button>
        <button class="btn-action secondary" @click="openSavedPanel">📁 내 저장 목록</button>
        <button class="btn-action success" @click="openSaveModal" :disabled="!routeStops.length">💾 현재 코스 저장</button>
      </div>
    </header>

    <div class="trip-workspace">
      <!-- 1. 좌측: 장소 탐색 및 경로 편집 패널 (Scrollable) -->
      <aside class="sidebar-panel">
        
        <!-- 검색 및 카테고리 필터링 영역 -->
        <div class="filter-section card">
          <div class="search-box">
            <span class="search-icon">🔍</span>
            <input
              v-model="searchQuery"
              placeholder="장소를 검색해보세요..."
              class="styled-search-input"
            />
          </div>
          
          <div class="category-scroll-container">
            <button
              class="category-tag-chip"
              :class="{ active: selectedCategory === '전체' }"
              @click="selectedCategory = '전체'; currentPage = 1"
            >
              전체
            </button>
            <button
              v-for="type in typeKeys"
              :key="type"
              class="category-tag-chip"
              :class="{ active: selectedCategory === type }"
              :style="{ 
                borderColor: selectedCategory === type ? typeColors[type] : '#e2e8f0',
                background: selectedCategory === type ? typeColors[type] : 'transparent',
                color: selectedCategory === type ? '#ffffff' : '#475569'
              }"
              @click="() => { selectedCategory = type; currentPage = 1 }"
            >
              {{ type }}
            </button>
          </div>
        </div>

        <!-- 트리플 스타일 타임라인 경로 짜기 영역 -->
        <div class="timeline-planner card">
          <div class="section-title-row">
            <h3>나의 커스텀 여행 동선</h3>
            <span class="badge-count" v-if="routeStops.length">{{ routeStops.length }}개 선정</span>
          </div>

          <div v-if="routeStops.length === 0" class="empty-timeline">
            <div class="empty-icon">📍</div>
            <p>아래 목록에서 원하는 장소를 클릭해 동선에 추가해보세요!</p>
          </div>

          <!-- 세로 형태의 유려한 타임라인 -->
          <div v-else class="timeline-container">
            <div v-for="(stop, index) in routeStops" :key="stop.id" class="timeline-item">
              <div class="timeline-line" v-if="index !== routeStops.length - 1"></div>
              
              <div class="timeline-node" :style="{ backgroundColor: getColorForType(stop.type) }">
                {{ index + 1 }}
              </div>
              
              <div class="timeline-content">
                <div class="timeline-info">
                  <h4>{{ stop.name }}</h4>
                  <p class="desc">{{ stop.description || '등록된 설명이 없습니다.' }}</p>
                </div>
                <div class="timeline-controls">
                  <button class="btn-micro" @click="moveRouteItem(index, -1)" :disabled="index === 0">▲</button>
                  <button class="btn-micro" @click="moveRouteItem(index, 1)" :disabled="index === routeStops.length - 1">▼</button>
                  <button class="btn-micro danger" @click="removeFromRoute(stop.id)">✕</button>
                </div>
              </div>
            </div>
            
            <div class="route-summary-bar">
              <span class="summary-label">요약 루트:</span>
              <p class="summary-text">{{ routeSummary }}</p>
            </div>
          </div>
        </div>

        <!-- 탐색 가능한 장소 목록 카드 영역 -->
        <div class="place-explorer card">
          <div class="explorer-header">
            <h3>방문 가능한 명소</h3>
            <div class="map-view-toggles">
              <button 
                class="view-toggle-btn" 
                :class="{ active: !showRouteOnly }" 
                @click="showRouteOnly = false"
              >
                전체보기
              </button>
              <button 
                class="view-toggle-btn" 
                :class="{ active: showRouteOnly }" 
                @click="showRouteOnly = true"
              >
                경로만
              </button>
            </div>
          </div>

          <div class="modern-place-grid">
            <div
              v-for="place in paginatedPlaces"
              :key="place.id"
              class="modern-place-card"
              :class="{ 
                'selected': routeStops.some(stop => stop.id === place.id),
                'course-type': place.isCourse 
              }"
              @click="togglePlace(place)"
            >
              <div class="card-indicator" :style="{ background: getColorForType(place.type) }"></div>
              <div class="card-details">
                <div class="card-meta">
                  <span class="place-type-label" :style="{ color: getColorForType(place.type) }">
                    {{ place.type || '관광지' }}
                  </span>
                  <span v-if="place.isCourse" class="course-badge">추천코스</span>
                </div>
                <h4>{{ place.name }}</h4>
                <p class="place-desc">{{ place.description }}</p>
              </div>
              <div class="action-check-box">
                <span v-if="routeStops.some(stop => stop.id === place.id)" class="check-icon">✓</span>
                <span v-else class="plus-icon">+</span>
              </div>
            </div>
          </div>

          <!-- 고급화된 페이지네이션 -->
          <div class="modern-pagination" v-if="totalPages > 1">
            <button class="btn-page" @click="goPrevPage" :disabled="currentPage === 1">이전</button>
            <span class="page-indicator"><strong>{{ currentPage }}</strong> / {{ totalPages }}</span>
            <button class="btn-page" @click="goNextPage" :disabled="currentPage === totalPages">다음</button>
          </div>
        </div>

      </aside>

      <!-- 2. 우측: 대화면 인터랙티브 지도 (Sticky-Map) -->
      <main class="map-container-wrap">
        <!-- 지도 상단 플로팅 지도 레이어 토글 칩 -->
        <div class="map-floating-bar">
          <button 
            class="map-chip" 
            :class="{ active: selectedTypes.size === typeKeys.length && !showRouteOnly }"
            @click="toggleAllTypes"
          >
            🧭 전체 타입 필터
          </button>
          <button
            v-for="type in typeKeys"
            :key="type"
            class="map-chip"
            :class="{ active: selectedTypes.has(type) && !showRouteOnly }"
            :style="{
              borderLeft: `4px solid ${typeColors[type]}`
            }"
            @click="toggleType(type)"
          >
            {{ type }}
          </button>
        </div>

        <div ref="mapRef" class="modern-leaflet-map"></div>
      </main>
    </div>

    <!-- 팝업 모달: 내 코스 저장 -->
    <transition name="modal-fade">
      <div v-if="saveModalOpen" class="modal-overlay" @click.self="saveModalOpen = false">
        <div class="modern-modal card">
          <div class="modal-header">
            <h3>🗺️ 여행 코스 저장하기</h3>
            <button class="close-modal-btn" @click="saveModalOpen = false">✕</button>
          </div>
          <div class="modal-body">
            <label>코스 이름</label>
            <input v-model="courseName" placeholder="예: 우정 가득 서울 당일치기 코스" class="modal-input" />
            <label>메모 및 설명</label>
            <textarea v-model="courseDesc" placeholder="이 코스의 주요 팁을 기록해보세요." class="modal-textarea"></textarea>
          </div>
          <div class="modal-footer">
            <button class="btn-modal cancel" @click="saveModalOpen = false">취소</button>
            <button class="btn-modal confirm" @click="saveCourse" :disabled="isSaving">
              {{ isSaving ? '저장하는 중...' : '저장 완료' }}
            </button>
          </div>
        </div>
      </div>
    </transition>

    <!-- 팝업 모달: 저장된 내 코스 목록 불러오기 -->
    <transition name="modal-fade">
      <div v-if="savedPanelOpen" class="modal-overlay" @click.self="closeSavedPanel">
        <div class="modern-modal large card">
          <div class="modal-header">
            <h3>📁 저장된 내 코스</h3>
            <button class="close-modal-btn" @click="closeSavedPanel">✕</button>
          </div>
          <div class="modal-body scrollable">
            <div v-if="!savedCourses.length" class="empty-state">
              <span class="empty-icon">📁</span>
              <p>아직 저장한 나만의 코스가 없습니다.</p>
            </div>
            
            <ul class="saved-list-modern" v-else>
              <li v-for="c in savedCourses" :key="c.id" class="saved-course-card">
                <div class="course-meta">
                  <h4>{{ c.name }}</h4>
                  <p class="description">{{ c.description || '상세 내용 없음' }}</p>
                  <small class="date">📅 {{ new Date(c.createdAt).toLocaleDateString() }}</small>

                  <!-- 각 구간 링크 표시 -->
                  <div v-if="c.legs && c.legs.length" class="saved-legs" style="margin-top:8px; display:flex; flex-direction:column; gap:6px;">
                    <div v-for="(leg, i) in c.legs" :key="i">
                      <a :href="leg.url" target="_blank" rel="noopener" style="text-decoration:none; color:#0f172a; font-weight:700;">
                        🚶 {{ leg.originName }} → {{ leg.destName }}
                      </a>
                    </div>
                  </div>
                </div>
                <div class="course-actions-group">
                  <button class="btn-action-small import-replace" @click="loadSavedCourse(c, true)">덮어쓰기</button>
                  <button class="btn-action-small import-add" @click="loadSavedCourse(c, false)">추가하기</button>
                  <button class="btn-action-small delete danger" @click="deleteSavedCourse(c.id)">삭제</button>
                </div>
              </li>
            </ul>
          </div>
          <div class="modal-footer">
            <button class="btn-modal cancel" @click="closeSavedPanel">닫기</button>
          </div>
        </div>
      </div>
    </transition>
  </section>
</template>

<style scoped>
/* 1. 레이아웃 구조 정의 */
.region-overview {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
  color: #1e293b;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

/* 2. 에어비앤비 스타일 헤더 */
.tab-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1.5px solid #f1f5f9;
  flex-wrap: wrap;
  gap: 16px;
}
.header-titles h2 {
  font-size: 1.5rem;
  font-weight: 800;
  color: #0f172a;
  margin: 0 0 4px 0;
}
.subtitle {
  color: #64748b;
  font-size: 0.95rem;
  margin: 0;
}
.header-actions {
  display: flex;
  gap: 10px;
}

/* 버튼 통합 가이드 */
.btn-action {
  padding: 10px 16px;
  border-radius: 10px;
  font-size: 0.88rem;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.2s ease;
}
.btn-action.primary { background: #2563eb; color: #fff; }
.btn-action.primary:hover { background: #1d4ed8; }
.btn-action.secondary { background: #f1f5f9; color: #475569; border-color: #e2e8f0; }
.btn-action.secondary:hover { background: #e2e8f0; }
.btn-action.success { background: #10b981; color: #fff; }
.btn-action.success:hover { background: #059669; }
.btn-action.success:disabled { background: #cbd5e1; cursor: not-allowed; }

/* 3. 워크스페이스 구조 (2열 스플릿 레이아웃) */
.trip-workspace {
  display: flex;
  gap: 20px;
  height: calc(100vh - 180px);
  min-height: 600px;
  align-items: stretch;
}

/* 3-1. 좌측 컨트롤 사이드바 */
.sidebar-panel {
  flex: 0 0 400px;
  width: 400px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  padding-right: 6px;
}
/* 사이드바 스크롤바 미려하게 다듬기 */
.sidebar-panel::-webkit-scrollbar { width: 6px; }
.sidebar-panel::-webkit-scrollbar-track { background: transparent; }
.sidebar-panel::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }

.card {
  background: #ffffff;
  border-radius: 16px;
  padding: 18px;
  border: 1px solid rgba(148, 163, 184, 0.12);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.02);
}

/* 검색 필터 */
.search-box {
  display: flex;
  align-items: center;
  background: #f8fafc;
  border: 1.5px solid #e2e8f0;
  border-radius: 12px;
  padding: 8px 14px;
  gap: 10px;
  margin-bottom: 12px;
  transition: all 0.2s ease;
}
.search-box:focus-within {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  background: #ffffff;
}
.styled-search-input {
  border: none;
  background: transparent;
  outline: none;
  font-size: 0.92rem;
  width: 100%;
}
.category-scroll-container {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
}
.category-scroll-container::-webkit-scrollbar { height: 4px; }
.category-scroll-container::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 2px; }

.category-tag-chip {
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  border: 1.5px solid #e2e8f0;
  background: transparent;
  transition: all 0.15s ease;
}
.category-tag-chip.active { background: #2563eb !important; border-color: #2563eb !important; color: #fff !important; }

/* 트리플 스타일 타임라인 설계 */
.timeline-planner {
  background: #fafcff;
  border: 1.5px dashed rgba(59, 130, 246, 0.2);
}
.section-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}
.section-title-row h3 { font-size: 1rem; font-weight: 800; margin: 0; }
.badge-count { background: #dbeafe; color: #1e40af; font-size: 0.75rem; font-weight: 700; padding: 4px 8px; border-radius: 20px; }

.empty-timeline {
  text-align: center;
  padding: 24px;
  color: #94a3b8;
}
.empty-icon { font-size: 1.8rem; margin-bottom: 6px; }

.timeline-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.timeline-item {
  position: relative;
  display: flex;
  gap: 12px;
  align-items: flex-start;
}
.timeline-line {
  position: absolute;
  left: 12px;
  top: 24px;
  bottom: -16px;
  width: 2.5px;
  background: #e2e8f0;
  z-index: 1;
}
.timeline-node {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  color: #fff;
  font-size: 0.75rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 2;
  box-shadow: 0 2px 6px rgba(0,0,0,0.1);
}
.timeline-content {
  flex: 1;
  background: #ffffff;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 2px 8px rgba(0,0,0,0.01);
}
.timeline-info h4 { font-size: 0.88rem; font-weight: 700; margin: 0 0 2px 0; }
.timeline-info .desc { font-size: 0.78rem; color: #64748b; margin: 0; }
.timeline-controls { display: flex; gap: 4px; }
.btn-micro {
  padding: 4px 6px;
  border-radius: 6px;
  background: #f1f5f9;
  border: none;
  cursor: pointer;
  font-size: 0.7rem;
}
.btn-micro:hover { background: #e2e8f0; }
.btn-micro.danger { color: #f43f5e; background: #fff1f2; }
.btn-micro.danger:hover { background: #ffe4e6; }

.route-summary-bar {
  margin-top: 10px;
  background: #f1f5f9;
  padding: 10px;
  border-radius: 8px;
}
.summary-label { font-size: 0.75rem; font-weight: 800; color: #475569; }
.summary-text { font-size: 0.8rem; margin: 2px 0 0 0; color: #1e293b; font-weight: 600; line-height: 1.4; }

/* 장소 탐색 목록 그리드 */
.place-explorer {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.explorer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.explorer-header h3 { font-size: 1rem; font-weight: 800; margin: 0; }
.map-view-toggles { display: flex; gap: 4px; background: #f1f5f9; padding: 3px; border-radius: 8px; }
.view-toggle-btn {
  border: none;
  padding: 4px 10px;
  font-size: 0.78rem;
  border-radius: 6px;
  cursor: pointer;
  background: transparent;
  color: #64748b;
  font-weight: 600;
  transition: all 0.15s ease;
}
.view-toggle-btn.active {
  background: #ffffff;
  color: #0f172a;
  box-shadow: 0 2px 6px rgba(0,0,0,0.06);
}

.modern-place-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 16px;
}
.modern-place-card {
  display: flex;
  background: #ffffff;
  border: 1px solid #f1f5f9;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  align-items: center;
  transition: all 0.18s ease;
}
.modern-place-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0,0,0,0.03);
  border-color: #cbd5e1;
}
.modern-place-card.selected {
  background: #fafcff;
  border-color: #3b82f6;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.05);
}
.modern-place-card.course-type { border-style: dashed; }

.card-indicator {
  width: 6px;
  align-self: stretch;
}
.card-details {
  flex: 1;
  padding: 12px;
}
.card-meta { display: flex; gap: 6px; margin-bottom: 2px; }
.place-type-label { font-size: 0.72rem; font-weight: 800; }
.course-badge { background: #f43f5e; color: #fff; font-size: 0.65rem; padding: 1px 4px; border-radius: 4px; font-weight: 700; }
.card-details h4 { font-size: 0.9rem; font-weight: 700; margin: 0 0 4px 0; }
.place-desc { font-size: 0.8rem; color: #64748b; margin: 0; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; }

.action-check-box {
  padding: 0 16px;
  font-size: 1.2rem;
  color: #cbd5e1;
  font-weight: 700;
}
.modern-place-card.selected .action-check-box { color: #3b82f6; }

.modern-pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  margin-top: auto;
}
.btn-page {
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 600;
}
.btn-page:disabled { color: #cbd5e1; cursor: not-allowed; }
.page-indicator { font-size: 0.82rem; color: #64748b; }

/* 3-2. 우측 지도 컨테이너 */
.map-container-wrap {
  flex: 1;
  position: relative;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.04);
  border: 1px solid #e2e8f0;
}
.modern-leaflet-map {
  width: 100%;
  height: 100%;
  z-index: 5;
}

/* 지도 위 플로팅 타입 필터 */
.map-floating-bar {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 10;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-width: calc(100% - 32px);
}
.map-chip {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(226, 232, 240, 0.8);
  border-radius: 30px;
  padding: 6px 12px;
  font-size: 0.76rem;
  font-weight: 700;
  color: #334155;
  cursor: pointer;
  box-shadow: 0 4px 10px rgba(0,0,0,0.06);
  transition: all 0.2s ease;
}
.map-chip.active {
  background: #0f172a;
  color: #ffffff;
  border-color: #0f172a;
}

/* 4. 모달 스타일링 */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(4px);
  z-index: 1500;
  display: grid;
  place-items: center;
}
.modern-modal {
  width: 90%;
  max-width: 500px;
  display: flex;
  flex-direction: column;
  animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.modern-modal.large { max-width: 650px; }

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  border-bottom: 1px solid #f1f5f9;
  padding-bottom: 10px;
}
.modal-header h3 { font-size: 1.1rem; font-weight: 800; margin: 0; }
.close-modal-btn { border: none; background: transparent; font-size: 1.1rem; cursor: pointer; color: #94a3b8; }

.modal-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.modal-body.scrollable { max-height: 400px; overflow-y: auto; }
.modal-body label { font-size: 0.85rem; font-weight: 700; color: #475569; margin-top: 4px; }
.modal-input { padding: 10px; border-radius: 8px; border: 1.5px solid #e2e8f0; outline: none; }
.modal-input:focus { border-color: #3b82f6; }
.modal-textarea { padding: 10px; border-radius: 8px; border: 1.5px solid #e2e8f0; outline: none; height: 100px; resize: none; }
.modal-textarea:focus { border-color: #3b82f6; }

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}
.btn-modal { padding: 10px 16px; border-radius: 8px; font-weight: 700; cursor: pointer; border: none; }
.btn-modal.cancel { background: #f1f5f9; color: #475569; }
.btn-modal.confirm { background: #2563eb; color: #fff; }

/* 스타일 계속 동일 (생략 가능) */
/* 저장한 코스 리스트 */
.saved-list-modern { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 12px; }
.saved-course-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f8fafc;
  padding: 12px 16px;
  border-radius: 12px;
  border: 1.5px solid #e2e8f0;
}
.saved-course-card .course-meta h4 { margin: 0 0 2px 0; font-size: 0.95rem; }
.saved-course-card .course-meta .description { font-size: 0.8rem; color: #64748b; margin: 0; }
.saved-course-card .course-meta .date { font-size: 0.72rem; color: #94a3b8; }
.course-actions-group { display: flex; gap: 6px; }
.btn-action-small { padding: 6px 10px; border-radius: 6px; border: none; font-size: 0.75rem; font-weight: 700; cursor: pointer; }
.btn-action-small.import-replace { background: #dbeafe; color: #1e40af; }
.btn-action-small.import-add { background: #e0f2fe; color: #0369a1; }
.btn-action-small.delete { background: #ffe4e6; color: #be123c; }

/* 지도 팝업 카드 */
:deep(.map-popup-card) {
  padding: 6px 2px;
  font-family: inherit;
}
:deep(.popup-tag) {
  display: inline-block;
  color: #fff;
  font-size: 0.65rem;
  font-weight: 800;
  padding: 1px 6px;
  border-radius: 4px;
  margin-bottom: 6px;
}
:deep(.map-popup-card strong) {
  display: block;
  font-size: 0.95rem;
  font-weight: 800;
  color: #0f172a;
  margin-bottom: 2px;
}
:deep(.map-popup-card p) {
  font-size: 0.78rem;
  color: #475569;
  margin: 0;
  line-height: 1.35;
}

/* 5. 지도 핀 배지 디자인 개선 */
:deep(.route-step-badge) {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #ffffff;
  display: grid;
  place-items: center;
  font-weight: 800;
  font-size: 12px;
  box-shadow: 0 3px 10px rgba(0,0,0,0.15);
  line-height: 1;
}

/* 트랜지션 애니메이션 */
@keyframes slideUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
.modal-fade-enter-active, .modal-fade-leave-active { transition: opacity 0.2s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; }

/* 반응형 모바일 대응 */
@media (max-width: 1024px) {
  .trip-workspace { flex-direction: column; height: auto; }
  .sidebar-panel { width: 100%; flex: none; }
  .map-container-wrap { height: 400px; min-height: auto; }
}
</style>