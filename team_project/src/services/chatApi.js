// src/services/chatApi.js
const CHAT_ENDPOINT = '/.netlify/functions/chat'

export async function sendChatMessage(message, history = []) {
  const response = await fetch(CHAT_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ message, history })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`챗봇 응답 실패: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  return data.reply || ''
}