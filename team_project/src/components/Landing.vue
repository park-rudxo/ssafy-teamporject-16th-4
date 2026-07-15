<template>
  <section class="landing-root">
    <header class="hero">
      <div class="hero-inner">
        <div class="hero-left">
          <h1 class="title">Discover Seoul</h1>
          <p class="subtitle">인기 관광지와 지역별 추천 명소를 한눈에.</p>

          <div class="pills">
            <button
              :class="['pill', activeCategory === 'all' ? 'pill--active' : '']"
              @click="setCategory('all')"
            >
              전체
            </button>

            <button
              v-for="cat in categories"
              :key="cat"
              :class="['pill', activeCategory === cat ? 'pill--active' : '']"
              @click="setCategory(cat)"
            >
              {{ catLabels[cat] || cat }}
            </button>
          </div>
        </div>

        <div class="hero-right" aria-hidden="true">
          <div class="collage">
            <div
              v-for="(it, idx) in sampleHero"
              :key="idx"
              class="collage-item"
              :style="{ '--i': idx }"
            >
              <img :src="it.image || placeholder" :alt="it.name" />
            </div>
          </div>
        </div>
      </div>
    </header>

    <main class="content">
      <div class="toolbar">
        <div class="count">{{ filteredCards.length }}개 항목</div>
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
            <span class="badge">{{ catLabels[card.type] || card.type || '기타' }}</span>
          </div>
          <div class="card-body">
            <h3 class="card-title">{{ card.name }}</h3>
            <p class="card-desc">{{ card.description || card.addr1 || '' }}</p>
          </div>
        </article>
      </transition-group>

      <div v-if="filteredCards.length === 0" class="empty">
        해당 카테고리에 항목이 없습니다.
        <button class="empty-btn" @click="setCategory('all')">전체 보기</button>
      </div>
    </main>
  </section>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  items: { type: Array, default: () => [] }
})

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

const categories = computed(() => Array.from(groups.value.keys()).slice(0, 8))

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
const sampleHero = computed(() => normalized.value.slice(0, 9))

function onCardClick(card) {
  // 필요한 동작: emit('select', card) 등으로 확장 가능
}
</script>

<style scoped>
/* Variables */
:root {
  --bg: #0f1724;
  --panel: #ffffff;
  --muted: #6b7280;
  --accent: #1f2937;
  --primary: #ff6b6b;
  --shadow-1: 0 18px 40px rgba(2,6,23,0.06);
}

/* Container */
.landing-root {
  max-width: 1200px;
  margin: 40px auto;
  padding: 24px;
  font-family: Inter, "Noto Sans KR", system-ui, -apple-system, "Segoe UI", Roboto, Arial;
  color: #0b1220;
}

/* Hero (reference style: large left copy, right image collage) */
.hero {
  background: linear-gradient(180deg, rgba(250,250,252,0.95), rgba(245,247,250,0.95));
  border-radius: 20px;
  padding: 40px;
  box-shadow: var(--shadow-1);
  margin-bottom: 28px;
  overflow: visible;
}

.hero-inner {
  display: flex;
  gap: 32px;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
}

/* Left copy */
.hero-left {
  flex: 1 1 540px;
  min-width: 280px;
}

.title {
  margin: 0 0 10px 0;
  font-size: clamp(1.8rem, 4.5vw, 3.6rem);
  line-height: 1.02;
  font-weight: 900;
  color: #0b1220;
  letter-spacing: -0.02em;
}

.subtitle {
  margin: 0 0 18px 0;
  color: var(--muted);
  font-size: 1.05rem;
}

/* Pills (category buttons) */
.pills {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.pill {
  background: transparent;
  border: 1px solid rgba(15, 23, 42, 0.06);
  padding: 10px 14px;
  border-radius: 999px;
  cursor: pointer;
  font-weight: 800;
  color: #213145;
  transition: all 180ms ease;
}
.pill:hover { transform: translateY(-3px); }
.pill--active {
  background: #111827;
  color: white;
  border-color: #111827;
  box-shadow: 0 14px 36px rgba(17,24,39,0.12);
}

/* Right collage (staggered grid like reference) */
.hero-right {
  width: 420px;
  max-width: 46%;
  min-width: 220px;
  display: flex;
  justify-content: flex-end;
}

.collage {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  width: 420px;
  height: 140px;
  position: relative;
}

.collage-item {
  border-radius: 12px;
  overflow: hidden;
  background: linear-gradient(180deg,#eef2ff,#fff);
  box-shadow: 0 10px 28px rgba(2,6,23,0.06);
  transform-origin: center;
  transition: transform 220ms ease, box-shadow 220ms ease;
}
.collage-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* subtle stagger using css var index */
.collage-item { transform: translateY(calc(var(--i) * -2px)); }
.collage-item:hover { transform: translateY(-6px) scale(1.02); box-shadow: 0 20px 48px rgba(2,6,23,0.12); }

/* Toolbar */
.toolbar {
  display:flex;
  justify-content:space-between;
  align-items:center;
  margin-bottom:12px;
}
.count { color: var(--muted); font-weight:700; }

/* Cards Grid */
.cards-grid {
  display:grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap:18px;
}

/* Card */
.card {
  background: linear-gradient(180deg,#fff,#fbfbff);
  border-radius: 14px;
  overflow:hidden;
  cursor:pointer;
  transition: transform 240ms cubic-bezier(.2,.9,.2,1), box-shadow 240ms;
  box-shadow: 0 12px 30px rgba(2,6,23,0.06);
  border: 1px solid rgba(15,23,42,0.04);
  display:flex;
  flex-direction:column;
}
.card:hover {
  transform: translateY(-10px) scale(1.01);
  box-shadow: 0 28px 64px rgba(2,6,23,0.12);
}

.card-media {
  position: relative;
  height: 160px;
  background: #eef2ff;
  overflow:hidden;
}
.card-media img { width:100%; height:100%; object-fit:cover; display:block; }

/* badge like reference */
.badge {
  position: absolute;
  left: 12px;
  bottom: 12px;
  background: rgba(0,0,0,0.66);
  color: #fff;
  padding:6px 10px;
  border-radius: 999px;
  font-size:0.78rem;
  font-weight:700;
}

/* body */
.card-body { padding:14px; }
.card-title { margin:0 0 8px 0; font-size:1.02rem; line-height:1.1; font-weight:800; }
.card-desc { margin:0; color:var(--muted); font-size:0.94rem; }

/* empty state */
.empty { padding:36px; text-align:center; color:var(--muted); }
.empty-btn {
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

/* Responsive */
@media (max-width: 960px) {
  .hero-right { width: 320px; max-width: 48%; }
  .collage { height: 128px; }
}
@media (max-width: 720px) {
  .hero {
    padding:20px;
  }
  .hero-inner { flex-direction: column-reverse; align-items:stretch; gap:18px; }
  .hero-right { width:100%; max-width:100%; }
  .collage { width:100%; grid-template-columns: repeat(3, 1fr); height: 96px; gap:8px; }
  .card-media { height:140px; }
}
</style>