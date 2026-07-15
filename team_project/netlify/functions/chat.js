// netlify/functions/chat.js
export async function handler(event) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type'
  }

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    }
  }

  try {
    const { message } = JSON.parse(event.body || '{}')

    if (typeof message !== 'string' || !message.trim()) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '메시지가 비어 있습니다.' })
      }
    }

    const apiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY

    if (!apiKey || apiKey.includes('your_api_key_here')) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'OpenAI API 키가 설정되지 않았습니다.' })
      }
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant for a local community and regional information site. Reply in Korean, concise and practical.'
          },
          {
            role: 'user',
            content: message
          }
        ],
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ error: `OpenAI 요청 실패: ${errorText}` })
      }
    }

    const data = await response.json()
    const reply = data.choices?.[0]?.message?.content?.trim() || '응답을 생성하지 못했습니다.'

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ reply })
    }
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || '서버 오류가 발생했습니다.' })
    }
  }
}