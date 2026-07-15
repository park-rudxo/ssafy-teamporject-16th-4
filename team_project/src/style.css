<template>
  <section class="landing-root">
    <div class="landing-hero">
      <div class="hero-content">
        <h1>Discover Seoul</h1>
        <p>인기 관광지와 지역별 추천 명소를 한눈에.</p>
        <div class="hero-actions">
          <button @click="activeCategory = categories[0]" :class="{ primary: true }">주요 명소</button>
          <button @click="scrollToCarousel">둘러보기</button>
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

    <nav class="landing-cats" v-if="categories.length">
      <button
        v-for="cat in categories"
        :key="cat"
        @click="activeCategory = cat"
        :class="{ active: activeCategory === cat }"
      >
        {{ catLabels[cat] || cat }}
      </button>
    </nav>

    <div class="carousels" ref="carouselsRoot">
      <div
        v-for="cat in categories"
        :key="cat"
        class="carousel-wrap"
        :data-active="activeCategory === cat"
      >
        <div class="carousel-header">
          <h2>{{ catLabels[cat] || cat }}</h2>
          <div class="controls">
            <button @click="prev(cat)" aria-label="prev">◀</button>
            <button @click="togglePlay(cat)" :aria-pressed="!isPlaying(cat)">
              {{ isPlaying(cat) ? '⏸' : '▶' }}
            </button>
            <button @click="next(cat)" aria-label="next">▶</button>
          </div>
        </div>

        <div
          class="carousel"
          @mouseenter="pause(cat)"
          @mouseleave="play(cat)"
        >
          <div
            class="track"
            :style="trackStyle(cat)"
            ref="tracks"
            @transitionend="onTransitionEnd(cat)"
          >
            <div
              v-for="(card, idx) in viewItems(cat)"
              :key="card._uid + '-' + idx"
              class="card"
              @click="onCardClick(card)"
            >
              <div class="card-media">
                <img :src="card.image || placeholder" :alt="card.name" />
              </div>
              <div class="card-body">
                <h3>{{ card.name }}</h3>
                <p>{{ card.description || card.addr1 || '' }}</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  items: { type: Array, default: () => [] },
  autoplayMs: { type: Number, default: 3500 }, // 기본 자동 재생 간격
  visibleCards: { type: Number, default: 3 }
})

/* --- normalize items into categories --- */
const items = computed(() => (props.items || []).map((i, idx) => {
  const name = i.name || i.title || `무명-${idx}`
  const desc = i.description || i.addr1 || ''
  const image = i.image || i.firstimage || i.firstimage2 || ''
  const type = i.type || (i.raw && (i.raw.lclsSystm2 || i.raw.lclsSystm1)) || '기타'
  return { ...i, name, description: desc, image, type }
}))

const categories = computed(() => {
  const order = ['12','VE','HS','EX','기타'] // 흔한 타입 우선 예시
  const set = new Set(items.value.map(i => (i.type || '기타')))
  const arr = Array.from(set)
  // prefer order if present
  arr.sort((a,b) => {
    const ai = order.indexOf(a), bi = order.indexOf(b)
    if (ai === -1 && bi === -1) return a.localeCompare(b)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })
  return arr
})

const catLabels = {
  '12': '관광지',
  'VE': '야외 / 공원',
  'HS': '역사 / 문화',
  'EX': '체험 / 산업',
  '기타': '기타'
}

/* --- grouped map --- */
const grouped = computed(() => {
  const m = new Map()
  for (const it of items.value) {
    const k = it.type || '기타'
    if (!m.has(k)) m.set(k, [])
    m.get(k).push(it)
  }
  return m
})

const activeCategory = ref(categories.value[0] || null)
watch(categories, v => { if (!activeCategory.value) activeCategory.value = v[0] || null })

/* --- carousel state per category --- */
const state = ref({})
function ensureState(cat) {
  if (!state.value[cat]) {
    const arr = (grouped.value.get(cat) || []).slice(0)
    // ensure at least visibleCards items by duplicating small sets
    while (arr.length < props.visibleCards + 1) arr.push(...arr.slice(0))
    // add synthetic uid for stable keys
    arr.forEach((a,i)=>a._uid = a._uid ?? `${cat}-${i}-${a.contentid||a.id||i}`)
    state.value[cat] = {
      items: arr,
      index: 0,
      playing: true,
      timer: null,
      transitioning: false
    }
  }
  return state.value[cat]
}

/* helpers */
function viewItems(cat) {
  const s = ensureState(cat)
  // create visible window + duplicates appended for infinite scroll feel
  return [...s.items, ...s.items]
}
function trackStyle(cat) {
  const s = ensureState(cat)
  const w = cardWidth()
  const translate = -(s.index * (w + 16)) // gap 16
  const dur = s.transitioning ? '500ms' : '0ms'
  return { transform: `translateX(${translate}px)`, transitionDuration: dur }
}
function cardWidth() {
  // responsive width: we'll rely on CSS clamp but JS needs approx value
  return window.innerWidth < 700 ? 240 : 300
}

/* autoplay controls */
function play(cat) {
  const s = ensureState(cat)
  if (s.timer) return
  s.playing = true
  s.timer = setInterval(() => next(cat), props.autoplayMs)
}
function pause(cat) {
  const s = ensureState(cat)
  s.playing = false
  if (s.timer) { clearInterval(s.timer); s.timer = null }
}
function togglePlay(cat) {
  const s = ensureState(cat)
  if (s.playing) pause(cat)
  else play(cat)
}
function next(cat) {
  const s = ensureState(cat)
  s.transitioning = true
  s.index = (s.index + 1) % s.items.length
}
function prev(cat) {
  const s = ensureState(cat)
  s.transitioning = true
  s.index = (s.index - 1 + s.items.length) % s.items.length
}
function onTransitionEnd(cat) {
  const s = ensureState(cat)
  s.transitioning = false
  // no extra logic for now (infinite achieved via duplicated rendering)
}

/* lifecycle */
onMounted(() => {
  for (const cat of categories.value) {
    const s = ensureState(cat)
    play(cat)
  }
  window.addEventListener('resize', onResize)
})
onBeforeUnmount(() => {
  for (const k in state.value) {
    const s = state.value[k]
    if (s && s.timer) clearInterval(s.timer)
  }
  window.removeEventListener('resize', onResize)
})
function onResize() {
  // placeholder for potential responsive recalculation
}

/* UI helpers */
const placeholder = '' // 옵션: '/src/assets/placeholder.jpg'
const tracks = ref(null)
const carouselsRoot = ref(null)
function onCardClick(card) {
  // 추천: 클릭 시 상세 또는 지도 포커스 처리 (여기선 이벤트 발생)
  // emit not available in <script setup> unless defineEmits; user can customize
  // console.log('clicked', card)
}

/* small hero thumbnails */
const sampleHero = computed(() => (items.value.slice(0,9)))
function scrollToCarousel() {
  if (!carouselsRoot.value) return
  const el = carouselsRoot.value
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/* utility: check playing state */
function isPlaying(cat) { return ensureState(cat).playing }

/* Expose for template usage */
const viewItemsRef = viewItems
</script>

<style scoped>
:root {
  --accent: #2563eb;
  --muted: #6b7280;
  --card-bg: linear-gradient(180deg, rgba(255,255,255,0.96), rgba(250,250,250,0.96));
  --glass: rgba(255,255,255,0.6);
}

.landing-root { max-width: 1280px; margin: 0 auto; padding: 20px; }

.landing-hero {
  display:flex;
  gap:20px;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(180deg, rgba(37,99,235,0.08), rgba(255,255,255,0.02));
  border-radius: 16px;
  padding: 28px;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(2,6,23,0.06);
}
.hero-content {
  max-width: 55%;
}
.hero-content h1 {
  margin:0 0 8px 0;
  font-size: clamp(1.6rem, 2.6vw, 2.4rem);
  color: #0f172a;
}
.hero-content p { margin:0 0 12px 0; color: var(--muted); font-size:1rem; }
.hero-actions button {
  margin-right:8px; padding:10px 14px; border-radius:10px; border:none; cursor:pointer; font-weight:700;
}
.hero-actions .primary { background:var(--accent); color:#fff; box-shadow:0 6px 18px rgba(37,99,235,0.18); }
.hero-visual { width: 46%; display:flex; justify-content:flex-end; }
.hero-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; filter: drop-shadow(0 6px 18px rgba(2,6,23,0.08)); }
.hero-thumb { border-radius:10px; overflow:hidden; width:96px; height:64px; background:#f3f4f6; }
.hero-thumb img { width:100%; height:100%; object-fit:cover; display:block; }

.landing-cats { display:flex; gap:8px; margin:18px 0; flex-wrap:wrap; }
.landing-cats button {
  background:transparent; border:1px solid #e6eefc; padding:8px 12px; border-radius:999px; cursor:pointer; font-weight:600;
}
.landing-cats button.active { background:var(--accent); color:#fff; border-color:var(--accent); box-shadow:0 6px 18px rgba(37,99,235,0.12); }

.carousels { display:flex; flex-direction:column; gap:28px; }
.carousel-wrap { display:block; opacity:0.0; transform:translateY(6px); transition: all 320ms ease; }
.carousel-wrap[data-active="true"] { opacity:1; transform:none; }

.carousel-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; }
.carousel-header h2 { margin:0; font-size:1.1rem; color:#0b1220; }
.controls button { margin-left:6px; background:#fff; border:1px solid #e6eefc; padding:6px 8px; border-radius:8px; cursor:pointer; }

.carousel {
  overflow:hidden;
  background: var(--glass);
  padding: 12px;
  border-radius: 12px;
  box-shadow: 0 6px 18px rgba(6,8,23,0.04);
  border: 1px solid rgba(15,23,42,0.04);
}
.track {
  display:flex;
  gap:16px;
  align-items:stretch;
  transition-timing-function: cubic-bezier(.2,.9,.2,1);
  will-change: transform;
}
.card {
  width: clamp(220px, 26vw, 320px);
  flex: 0 0 auto;
  background: var(--card-bg);
  border-radius: 12px;
  overflow:hidden;
  cursor: pointer;
  display:flex;
  flex-direction:column;
  box-shadow: 0 6px 18px rgba(2,6,23,0.06);
  border: 1px solid rgba(15,23,42,0.04);
}
.card-media { height: 180px; overflow:hidden; background:#eef2ff; display:flex; align-items:center; justify-content:center; }
.card-media img { width:100%; height:100%; object-fit:cover; display:block; }
.card-body { padding:12px 14px; }
.card-body h3 { margin:0 0 6px 0; font-size:1rem; color:#091026; }
.card-body p { margin:0; color:var(--muted); font-size:0.9rem; }

/* mobile */
@media (max-width: 900px) {
  .landing-hero { flex-direction:column; gap:14px; }
  .hero-content { max-width:100%; }
  .hero-visual { width:100%; justify-content:flex-start; }
  .hero-grid { grid-template-columns:repeat(4,1fr); }
  .card-media { height: 140px; }
}
</style>