<script setup>
import { ref } from 'vue'
import RegionOverview from './components/RegionOverview.vue'
import CommunityBoard from './components/CommunityBoard.vue'
import ChatbotPanel from './components/ChatbotPanel.vue'

// 모든 JSON을 로드하고 서울 폴더만 사용
const modules = import.meta.glob('./data/**/*.json', { eager: true })

function asNumber(v) {
  if (v === undefined || v === null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function normalizeFromItem(item, fallbackType = null) {
  if (!item) return null

  const name = item.title || item.name || item.place || ''
  const lat = asNumber(item.mapy ?? item.lat ?? item.latitude ?? null)
  const lng = asNumber(item.mapx ?? item.lng ?? item.longitude ?? null)
  const description = item.addr1 || item.addr2 || item.description || ''
  const image = item.firstimage || item.firstimage2 || item.image || ''
  const id = item.contentid || item.id || null

  const itemType = item.contentType ?? item.contenttype ?? item.contentTypeId ?? item.contenttypeId ?? fallbackType
  const type = itemType === null ? null : String(itemType)

  return { name, lat, lng, description, image, id, type }
}

const seoul = { name: '서울', description: '서울 권역 통합 데이터', highlights: [] }

for (const key in modules) {
  if (!key.includes('/서울/')) continue

  const mod = modules[key]
  const data = mod?.default ?? mod
  if (!data) continue

  const fallbackType = data.contentType ?? data.contentTypeId ?? data.contenttype ?? data.contenttypeid ?? null
  let entries = []

  if (Array.isArray(data.items)) {
    entries = data.items
  } else if (Array.isArray(data)) {
    entries = data
  } else if (Array.isArray(data.highlights)) {
    entries = data.highlights
  } else if (data.name || data.title) {
    entries = [data]
  }

  const normalized = entries
    .map(e => {
      if (typeof e === 'string') return { name: e, lat: null, lng: null, description: '' }
      return normalizeFromItem(e, fallbackType)
    })
    .filter(Boolean)

  normalized.forEach(h => {
    if (h && h.name) seoul.highlights.push(h)
  })
}

const seen = new Map()
seoul.highlights = seoul.highlights.filter(h => {
  const key = h.id || `${h.name}|${h.lat ?? ''}|${h.lng ?? ''}`
  if (seen.has(key)) return false
  seen.set(key, true)
  return true
})

const currentRegion = ref(seoul)
const activeTab = ref('map')
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <div>
        <h1>LocalHub</h1>
        <p>익명 커뮤니티와 지역 정보 챗봇 (서울)</p>
      </div>
    </header>

    <nav class="tabs">
      <button :class="{ active: activeTab === 'map' }" @click="activeTab = 'map'">지도</button>
      <button :class="{ active: activeTab === 'community' }" @click="activeTab = 'community'">커뮤니티</button>
      <button :class="{ active: activeTab === 'chat' }" @click="activeTab = 'chat'">챗봇</button>
    </nav>

    <main class="main-area">
      <div class="map-tab-shell" v-if="activeTab === 'map'">
        <RegionOverview :region="currentRegion" />
      </div>
      <CommunityBoard v-else-if="activeTab === 'community'" />
      <ChatbotPanel v-else />
    </main>
  </div>
</template>