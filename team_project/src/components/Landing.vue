<template>
  <section class="landing-root">
    <header class="hero">
      <div class="hero-inner">
        <div class="hero-copy">
          <h1 class="hero-title">Discover Seoul</h1>
          <p class="hero-sub">인기 관광지와 지역별 추천 명소를 한눈에.</p>

          <div class="hero-actions">
            <button
              :class="['pill', activeCategory === 'all' ? 'pill--primary' : '']"
              @click="setCategory('all')"
            >
              전체
            </button>

            <button
              v-for="cat in categories"
              :key="cat"
              :class="['pill', activeCategory === cat ? 'pill--primary' : '']"
              @click="setCategory(cat)"
            >
              {{ catLabels[cat] || cat }}
            </button>
          </div>
        </div>

        <div class="hero-media" aria-hidden="true">
          <div class="media-grid">
            <div v-for="(it, i) in sampleHero" :key="i" class="media-thumb">
              <img :src="it.image || placeholder" :alt="it.name" />
            </div>
          </div>
        </div>
      </div>
    </header>

    <main class="content">
      <div class="cards-toolbar">
        <div class="results-count">{{ filteredCards.length }}개 항목</div>
      </div>

      <transition-group name="flip" tag="div" class="cards-grid">
        <article
          v-for="card in filteredCards"
          :key="card._uid"
          class="card"
          @click="onCardClick(card)"
        >
          <div class="card-media">
            <img :src="card.image || placeholder" :alt="card.name" />
            <span class="card-type">{{ catLabels[card.type] || card.type || '기타' }}</span>
          </div>
          <div class="card-body">
            <h3 class="card-title">{{ card.name }}</h3>
            <p class="card-desc">{{ card.description || card.addr1 || '' }}</p>
          </div>
        </article>
      </transition-group>

      <div v-if="filteredCards.length === 0" class="empty">
        해당 카테고리에 항목이 없습니다.
        <button class="empty-reset" @click="setCategory('all')">전체 보기</button>
      </div>
    </main>
  </section>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  items: { type: Array, default: () => [] }
})

/* normalize items once */
const normalized = computed(() =>
  (props.items || []).map((i, idx) => {
    const name = i.name || i.title || `무명-${idx}`
    const description = i.description || i.addr1 || ''
    const image = i.image || i.firstimage || i.firstimage2 || ''
    const type = i.type || (i.raw && (i.raw.lclsSystm2 || i.raw.lclsSystm1)) || '기타'
    return { ...i, name, description, image, type, _uid: i._uid ?? `card-${idx}-${i.contentid||i.id||idx}` }
  })
)

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

const activeCategory = ref('all')

function setCategory(cat) {
  activeCategory.value = cat
}

const filteredCards = computed(() => {
  if (activeCategory.value === 'all') return normalized.value
  return groups.value.get(activeCategory.value) ?? []
})

const placeholder = '' // 필요시 경로 지정
const sampleHero = computed(() => normalized.value.slice(0, 8))

function onCardClick(card) {
  // 클릭 후 동작(지도 포커스 / 모달 등) - 필요시 구현
  // 예: emit('select', card)
}
</script>

<style scoped>
:root {
  --bg: #0b1020;
  --card-bg: linear-gradient(180deg, #ffffff, #fbfbff);
  --accent: #ff6b6b;
  --primary: #2563eb;
  --muted: #6b7280;
}

/* layout */
.landing-root {
  max-width: 1200px;
  margin: 32px auto;
  padding: 24px;
  font-family: Inter, "Noto Sans KR", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
  color: #0b1220;
}

/* Hero */
.hero {
  border-radius: 16px;
  padding: 36px;
  background: radial-gradient(1200px 400px at 10% 10%, rgba(37,99,235,0.06), transparent 18%),
              linear-gradient(180deg, rgba(255,255,255,0.98), rgba(249,250,255,0.9));
  box-shadow: 0 18px 40px rgba(2,6,23,0.06);
  margin-bottom: 28px;
}

.hero-inner {
  display: flex;
  gap: 28px;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
}

.hero-copy {
  flex: 1 1 420px;
  min-width: 280px;
}

.hero-title {
  margin: 0 0 8px 0;
  font-size: clamp(1.6rem, 3.6vw, 2.8rem);
  line-height: 1.02;
  font-weight: 800;
  color: #0f172a;
  letter-spacing: -0.02em;
}

.hero-sub {
  margin: 0 0 16px 0;
  color: var(--muted);
  font-size: 1.02rem;
}

/* Pills */
.hero-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 12px;
}

.pill {
  background: transparent;
  border: 1px solid rgba(15,23,42,0.06);
  padding: 9px 14px;
  border-radius: 999px;
  cursor: pointer;
  font-weight: 700;
  color: #24324a;
  transition: all 180ms ease;
  box-shadow: none;
}
.pill:hover { transform: translateY(-3px); }
.pill--primary {
  background: var(--primary);
  color: white;
  border-color: var(--primary);
  box-shadow: 0 10px 28px rgba(37,99,235,0.12);
}

/* Hero media grid */
.hero-media {
  width: 420px;
  max-width: 45%;
  min-width: 220px;
}

.media-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  align-items: stretch;
}

.media-thumb {
  height: 88px;
  border-radius: 10px;
  overflow: hidden;
  background: linear-gradient(180deg,#eef2ff,#fff);
  box-shadow: 0 6px 20px rgba(2,6,23,0.06);
  border: 1px solid rgba(15,23,42,0.03);
}
.media-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display:block;
}

/* Content area */
.content {
  min-height: 320px;
}

/* toolbar */
.cards-toolbar {
  display:flex;
  justify-content:space-between;
  align-items:center;
  margin-bottom:12px;
}
.results-count { color: var(--muted); font-weight:700; }

/* cards grid */
.cards-grid {
  display:grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap:18px;
}

.card {
  background: var(--card-bg);
  border-radius: 14px;
  overflow:hidden;
  cursor:pointer;
  transition: transform 220ms cubic-bezier(.2,.9,.2,1), box-shadow 220ms;
  box-shadow: 0 14px 36px rgba(2,6,23,0.06);
  border: 1px solid rgba(15,23,42,0.04);
  display:flex;
  flex-direction:column;
}
.card:hover {
  transform: translateY(-10px) scale(1.01);
  box-shadow: 0 26px 60px rgba(2,6,23,0.10);
}

.card-media {
  position: relative;
  height: 160px;
  background: #eef2ff;
  overflow:hidden;
}
.card-media img { width:100%; height:100%; object-fit:cover; display:block; }
.card-type {
  position: absolute;
  left: 12px;
  bottom: 12px;
  background: rgba(0,0,0,0.64);
  color: #fff;
  padding:6px 10px;
  border-radius:999px;
  font-size:0.78rem;
  font-weight:700;
}

/* body */
.card-body { padding:14px; }
.card-title { margin:0 0 8px 0; font-size:1.03rem; line-height:1.1; }
.card-desc { margin:0; color:var(--muted); font-size:0.94rem; }

/* empty */
.empty { padding:36px; text-align:center; color:var(--muted); }
.empty-reset {
  margin-top:12px;
  padding:8px 14px;
  border-radius:10px;
  border:1px solid rgba(15,23,42,0.06);
  background:transparent;
  cursor:pointer;
}

/* transitions */
.flip-move { transition: transform 420ms cubic-bezier(.2,.9,.2,1); }
.flip-enter-from, .flip-leave-to { opacity:0; transform: translateY(12px); }
.flip-enter-active, .flip-leave-active { transition: all 320ms cubic-bezier(.2,.9,.2,1); }

/* responsive */
@media (max-width: 960px) {
  .hero-inner { gap:16px; }
  .hero-media { width: 320px; max-width: 48%; }
}
@media (max-width: 720px) {
  .hero {
    padding:20px;
  }
  .hero-inner { flex-direction: column-reverse; align-items:stretch; }
  .hero-media { width:100%; max-width:100%; }
  .media-thumb { height:84px; }
  .card-media { height:140px; }
}
</style>