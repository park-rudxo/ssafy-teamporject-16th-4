<script setup>
import { ref } from 'vue'
import RegionOverview from './components/RegionOverview.vue'
import CommunityBoard from './components/CommunityBoard.vue'
import ChatbotPanel from './components/ChatbotPanel.vue'

// Load all JSON files under src/data/서울 at build time
const modules = import.meta.glob('./data/서울/*.json', { eager: true })

// Normalizer: convert various source shapes into { name, lat, lng, description, image, id, type }
function normalizeFromItem(item) {
  if (!item) return null
  const name = item.title || item.name || item.place || ''
  const lat = item.mapy ? Number(item.mapy) : (item.lat ? Number(item.lat) : null)
  const lng = item.mapx ? Number(item.mapx) : (item.lng ? Number(item.lng) : null)
  const description = item.addr1 || item.addr2 || item.description || ''
  const image = item.firstimage || item.firstimage2 || item.image || ''
  const id = item.contentid || item.id || null
  const type = item.contenttype || item.contenttypeid || item.contentType || null
  return { name, lat, lng, description, image, id, type }
}

const seoul = { name: '서울', description: '서울 권역 통합 데이터', highlights: [] }

for (const key in modules) {
  const mod = modules[key]
  const data = mod?.default ?? mod
  if (!data) continue

  // If file follows API envelope with items[]
  if (Array.isArray(data.items)) {
    data.items.forEach(i => {
      const h = normalizeFromItem(i)
      if (h && h.name) seoul.highlights.push(h)
    })
    continue
  }

  // If file is plain array of place objects
  if (Array.isArray(data)) {
    data.forEach(i => {
      const h = normalizeFromItem(i)
      if (h && h.name) seoul.highlights.push(h)
    })
    continue
  }

  // If file has highlights array (your original format)
  if (Array.isArray(data.highlights)) {
    data.highlights.forEach(h0 => {
      if (typeof h0 === 'string') {
        seoul.highlights.push({ name: h0, lat: null, lng: null, description: '' })
      } else {
        const h = normalizeFromItem(h0)
        if (h && h.name) seoul.highlights.push(h)
      }
    })
    continue
  }

  // Single object describing one place
  if (data.name || data.title) {
    const h = normalizeFromItem(data)
    if (h && h.name) seoul.highlights.push(h)
    continue
  }
}

// Deduplicate by id or name+coords
const seen = new Map()
seoul.highlights = seoul.highlights.filter(h => {
  const key = h.id || `${h.name}|${h.lat ?? ''}|${h.lng ?? ''}`
  if (seen.has(key)) return false
  seen.set(key, true)
  return true
})

// Expose region as ref
const currentRegion = ref(seoul)
const activeTab = ref('map') // 'map' | 'community' | 'chat'
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
      <RegionOverview v-if="activeTab === 'map'" :region="currentRegion" />
      <CommunityBoard v-else-if="activeTab === 'community'" />
      <ChatbotPanel v-else />
    </main>
  </div>
</template>