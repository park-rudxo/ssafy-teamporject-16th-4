<script setup>
import { ref } from 'vue'

const messages = ref([
  { role: 'assistant', content: '안녕하세요! 지역 정보나 커뮤니티 내용을 도와드릴게요.' }
])

const input = ref('')

function buildFallbackReply(text) {
  const lower = text.toLowerCase()

  if (lower.includes('관광지')) return '선택한 권역의 대표 관광지를 추천해 드릴 수 있습니다.'
  if (lower.includes('축제')) return '축제 일정은 지역 데이터에서 확인해 드릴 수 있습니다.'
  if (lower.includes('맛집')) return '모범음식점 위치를 안내해 드릴 수 있습니다.'
  if (lower.includes('게시글')) return '커뮤니티 게시글 제목이나 내용을 기준으로 검색할 수 있습니다.'

  return '원하시는 지역 정보나 커뮤니티 질문을 입력해 주세요.'
}

async function sendMessage() {
  const text = input.value.trim()
  if (!text) return

  messages.value.push({ role: 'user', content: text })
  input.value = ''

  const answer = buildFallbackReply(text)
  messages.value.push({ role: 'assistant', content: answer })
}
</script>

<template>
  <section class="card chatbot">
    <h3>지역 챗봇</h3>

    <div class="chat-box">
      <div v-for="(message, index) in messages" :key="index" class="bubble" :class="message.role">
        {{ message.content }}
      </div>
    </div>

    <div class="chat-input">
      <input v-model="input" @keyup.enter="sendMessage" placeholder="예: 광주/전라의 관광지 추천해줘" />
      <button @click="sendMessage">전송</button>
    </div>
  </section>
</template>