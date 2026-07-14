<script setup>
import { computed, ref } from 'vue'
import RegionOverview from './components/RegionOverview.vue'
import CommunityBoard from './components/CommunityBoard.vue'
import ChatbotPanel from './components/ChatbotPanel.vue'
import regionData from './data/sample-region.json'

const regions = ['서울', '대전/충청', '구미/경북', '광주/전라', '부산']
const selectedRegion = ref('광주/전라')
const activeTab = ref('overview')

const currentRegionData = computed(() => regionData[selectedRegion.value] || null)
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <div>
        <h1>LocalHub</h1>
        <p>익명 커뮤니티와 지역 정보 챗봇</p>
      </div>
      <select v-model="selectedRegion">
        <option v-for="region in regions" :key="region" :value="region">
          {{ region }}
        </option>
      </select>
    </header>

    <nav class="tabs">
      <button :class="{ active: activeTab === 'overview' }" @click="activeTab = 'overview'">
        지역 정보
      </button>
      <button :class="{ active: activeTab === 'community' }" @click="activeTab = 'community'">
        커뮤니티
      </button>
      <button :class="{ active: activeTab === 'chat' }" @click="activeTab = 'chat'">
        챗봇
      </button>
    </nav>

    <main>
      <RegionOverview v-if="activeTab === 'overview' && currentRegionData" :region="currentRegionData" />
      <CommunityBoard v-else-if="activeTab === 'community'" />
      <ChatbotPanel v-else />
    </main>
  </div>
</template>