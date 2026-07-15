<script setup>
import { ref } from 'vue'
import { sendChatMessage } from '../services/chatApi'

const messages = ref([
  { role: 'assistant', content: '안녕하세요! 지역 정보나 커뮤니티 내용을 도와드릴게요.' }
])

const input = ref('')
const isLoading = ref(false)
const statusMessage = ref('')
const isOpen = ref(false)

function buildFallbackReply(text) {
  const lower = text.toLowerCase()

  if (lower.includes('관광지')) return '선택한 권역의 대표 관광지를 추천해 드릴 수 있습니다.'
  if (lower.includes('축제')) return '축제 일정은 지역 데이터에서 확인해 드릴 수 있습니다.'
  if (lower.includes('맛집')) return '모범음식점 위치를 안내해 드릴 수 있습니다.'
  if (lower.includes('게시글')) return '커뮤니티 게시글 제목이나 내용을 기준으로 검색할 수 있습니다.'

  return '원하시는 지역 정보나 커뮤니티 질문을 입력해 주세요.'
}

function toggleChat() {
  isOpen.value = !isOpen.value
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
  <div class="chatbot-widget">
    <button class="chat-float-btn" @click="toggleChat" aria-label="챗봇 열기">
      💬
    </button>

    <div v-if="isOpen" class="chat-panel">
      <div class="chat-header">
        <div>
          <h3>지역 챗봇</h3>
          <p>지역 정보와 커뮤니티를 도와드려요</p>
        </div>
        <button class="close-btn" @click="toggleChat" aria-label="챗봇 닫기">×</button>
      </div>

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
          placeholder="예: 서울 관광지 추천해줘"
        />
        <button :disabled="isLoading" @click="sendMessage">전송</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chatbot-widget {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 1000;
}

.chat-float-btn {
  width: 58px;
  height: 58px;
  border: none;
  border-radius: 50%;
  background: linear-gradient(135deg, #2563eb, #4f46e5);
  color: white;
  font-size: 24px;
  cursor: pointer;
  box-shadow: 0 10px 24px rgba(37, 99, 235, 0.3);
}

.chat-panel {
  width: 340px;
  max-width: calc(100vw - 24px);
  height: 480px;
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.18);
  margin-bottom: 12px;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  background: linear-gradient(135deg, #2563eb, #4f46e5);
  color: white;
}

.chat-header h3 {
  margin: 0;
  font-size: 16px;
}

.chat-header p {
  margin: 2px 0 0;
  font-size: 12px;
  opacity: 0.9;
}

.close-btn {
  border: none;
  background: transparent;
  color: white;
  font-size: 22px;
  cursor: pointer;
}

.chat-box {
  flex: 1;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  background: #f8fafc;
}

.bubble {
  max-width: 85%;
  padding: 10px 12px;
  border-radius: 14px;
  font-size: 14px;
  line-height: 1.4;
  word-break: break-word;
}

.bubble.user {
  align-self: flex-end;
  background: #2563eb;
  color: white;
}

.bubble.assistant {
  align-self: flex-start;
  background: white;
  color: #1f2937;
  border: 1px solid #e5e7eb;
}

.chat-status {
  margin: 0;
  padding: 0 12px 8px;
  font-size: 12px;
  color: #ef4444;
}

.chat-input {
  display: flex;
  gap: 8px;
  padding: 12px;
  border-top: 1px solid #e5e7eb;
  background: white;
}

.chat-input input {
  flex: 1;
  border: 1px solid #d1d5db;
  border-radius: 999px;
  padding: 10px 12px;
  outline: none;
}

.chat-input button {
  border: none;
  border-radius: 999px;
  padding: 10px 14px;
  background: #2563eb;
  color: white;
  cursor: pointer;
}

@media (max-width: 600px) {
  .chat-panel {
    width: calc(100vw - 24px);
    height: 420px;
  }
}
</style>