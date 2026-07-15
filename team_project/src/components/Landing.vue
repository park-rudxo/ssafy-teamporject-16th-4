<template>
  <section class="landing-root">
    <div class="landing-hero">
      <div class="hero-content">
        <h1>Discover Seoul</h1>
        <p>인기 관광지와 지역별 추천 명소를 한눈에.</p>

        <div class="hero-actions">
          <button
            :class="{ primary: activeCategory === 'all' }"
            @click="setCategory('all')"
          >
            전체
          </button>

          <button
            v-for="cat in categories"
            :key="cat"
            :class="{ active: activeCategory === cat }"
            @click="setCategory(cat)"
          >
            {{ catLabels[cat] || cat }}
          </button>
        </div>
      </div>

      <div class="hero-visual" aria-hidden="true">
        <div class="hero-grid">
          <div v-for="(it, i) in sampleHero" :key="i" class="hero-thumb">
            <img :src="it.image || placeholder" :alt="it.name" />
          </div>
        </div>
      </div>
    </div>

    <div class="cards-wrap">
      <transition-group name="flip" tag="div" class="cards-grid">
        <article
          v-for="card in filteredCards"
          :key="card._uid"
          class="card"
          @click="onCardClick(card)"
        >
          <div class="card-media">
            <img :src="card.image || placeholder" :alt="card.name" />
          </div>
          <div class="card-body">
            <h3>{{ card.name }}</h3>
            <p>{{ card.description || card.addr1 || '' }}</p>
            <small class="muted">{{ catLabels[card.type] || card.type || '기타' }}</small>
          </div>
        </article>
      </transition-group>

      <div v-if="filteredCards.length === 0" class="empty">
        해당 카테고리에 항목이 없습니다.
        <button @click="setCategory('all')">전체 보기</button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const props = defineProps({
  items: { type: Array, default: () => [] }
})

/* normalize items once */
const normalized = computed(() =>
  (props.items || []).map((i, idx) => {
    const name = i.name || i.title || `무명-${idx}`
    const description = i.description || i.addr1 || ''
    const image = i.image || i.firstimage || i.firstimage2 || ''
    // use explicit type if present, else fallback to vendor codes or '기타'
    const type = i.type || (i.raw && (i.raw.lclsSystm2 || i.raw.lclsSystm1)) || '기타'
    return { ...i, name, description, image, type, _uid: i._uid ?? `card-${idx}-${i.contentid||i.id||idx}` }
  })
)

/* build stable groups once to keep clicks light */
const groups = computed(() => {
  const m = new Map()
  for (const it of normalized.value) {
    const k = it.type || '기타'
    if (!m.has(k)) m.set(k, [])
    m.get(k).push(it)
  }
  return m
})

const categories = computed(() => Array.from(groups.value.keys()))

const catLabels = {
  '12': '관광지', 'VE': '야외/공원', 'HS': '역사/문화', 'EX': '체험/산업', '기타': '기타'
}

/* active category state - starts as 'all' */
const activeCategory = ref('all')

function setCategory(cat) {
  activeCategory.value = cat
  // light-weight: no heavy reordering, computed filteredCards will update
}

/* filteredCards is computed and cheap to update */
const filteredCards = computed(() => {
  if (activeCategory.value === 'all') return normalized.value
  return groups.value.get(activeCategory.value) ?? []
})

const placeholder = '' // 필요시 '/src/assets/placeholder.jpg'
const sampleHero = computed(() => normalized.value.slice(0, 9))

function onCardClick(card) {
  // 클릭 후 동작(지도 포커스 / 모달 등)을 여기에 구현하세요.
}
</script>

<style scoped>
.landing-root { max-width:1280px; margin:0 auto; padding:20px; }
.landing-hero { display:flex; gap:20px; align-items:center; justify-content:space-between; background:linear-gradient(180deg, rgba(37,99,235,0.06), rgba(255,255,255,0.02)); border-radius:12px; padding:20px; box-shadow:0 8px 24px rgba(2,6,23,0.04); }
.hero-content h1 { margin:0 0 6px 0; font-size:clamp(1.3rem,2.2vw,2rem); }
.hero-actions { display:flex; gap:8px; margin-top:8px; flex-wrap:wrap; }
.hero-actions button { padding:8px 12px; border-radius:999px; border:1px solid #e6eefc; cursor:pointer; background:transparent; font-weight:700; }
.hero-actions button.primary { background:#2563eb; color:#fff; border-color:#2563eb; box-shadow:0 8px 20px rgba(37,99,235,0.12); }
.hero-actions button.active { background:#2563eb; color:#fff; border-color:#2563eb; }

/* cards */
.cards-wrap { margin-top:18px; max-height:65vh; overflow:auto; padding-right:6px; }
.cards-grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap:18px; align-items:start; }

.card { background: linear-gradient(180deg,#fff,#fbfbff); border-radius:12px; overflow:hidden; box-shadow:0 8px 18px rgba(3,7,18,0.06); border:1px solid rgba(15,23,42,0.04); display:flex; flex-direction:column; cursor:pointer; transition: transform 180ms ease; }
.card:hover { transform: translateY(-6px); }
.card-media { height:160px; background:#eef2ff; display:flex; align-items:center; justify-content:center; overflow:hidden; }
.card-media img { width:100%; height:100%; object-fit:cover; display:block; }
.card-body { padding:12px; }
.card-body h3 { margin:0 0 6px 0; font-size:1rem; }
.card-body p { margin:0 0 8px 0; color:#6b7280; font-size:0.92rem; }
.muted { color:#94a3b8; font-size:0.8rem; }

/* empty */
.empty { padding:28px; text-align:center; color:#6b7280; }
.empty button { margin-top:10px; padding:8px 12px; border-radius:8px; }

/* transition-group FLIP move */
.flip-move { transition: transform 420ms cubic-bezier(.2,.9,.2,1); }
.flip-enter-from, .flip-leave-to { opacity:0.01; transform: translateY(8px); }
.flip-enter-active, .flip-leave-active { transition: all 320ms cubic-bezier(.2,.9,.2,1); }

@media (max-width:900px) {
  .landing-hero { flex-direction:column; gap:12px; }
  .hero-visual { width:100%; justify-content:flex-start; }
  .card-media { height:140px; }
}
</style>