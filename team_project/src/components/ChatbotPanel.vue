<script setup>
import { ref } from 'vue'
import { sendChatMessage } from '../services/chatApi'

const messages = ref([
  { role: 'assistant', content: '안녕하세요! 지역 정보나 커뮤니티 내용을 도와드릴게요.' }
])

const input = ref('')
const isLoading = ref(false)
const statusMessage = ref('')

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
  if (!text || isLoading.value) return

  messages.value.push({ role: 'user', content: text })
  input.value = ''
  statusMessage.value = ''
  isLoading.value = true

  try {
    const answer = await sendChatMessage(text)
    messages.value.push({ role: 'assistant', content: answer })
  } catch (error) {
    const fallbackReply = buildFallbackReply(text)
    messages.value.push({ role: 'assistant', content: fallbackReply })
    statusMessage.value = error.message || '챗봇 응답을 가져오지 못했습니다.'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <section class="card chatbot">
    <h3>지역 챗봇</h3>

    <div class="chat-box">
      <div v-for="(message, index) in messages" :key="index" class="bubble" :class="message.role">
        {{ message.content }}
      </div>
      <div v-if="isLoading" class="bubble assistant loading">답변을 생성하는 중입니다...</div>
    </div>

    <p v-if="statusMessage" class="chat-status">{{ statusMessage }}</p>

    <div class="chat-input">
      <input
        v-model="input"
        @keyup.enter="sendMessage"
        :disabled="isLoading"
        placeholder="예: 광주/전라의 관광지 추천해줘"
      />
      <button :disabled="isLoading" @click="sendMessage">{{ isLoading ? '전송 중' : '전송' }}</button>
    </div>
  </section>
</template>