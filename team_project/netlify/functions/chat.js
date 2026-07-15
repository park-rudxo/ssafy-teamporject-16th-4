import fs from 'fs'
import path from 'path'

function getDataFiles() {
  const baseDir = path.resolve(process.cwd(), 'src/data/서울')

  return {
    관광지: path.join(baseDir, '서울_관광지.json'),
    문화시설: path.join(baseDir, '서울_문화시설.json'),
    축제: path.join(baseDir, '서울_축제공연행사.json'),
    여행코스: path.join(baseDir, '서울_여행코스.json'),
    레포츠: path.join(baseDir, '서울_레포츠.json'),
    숙박: path.join(baseDir, '서울_숙박.json'),
    쇼핑: path.join(baseDir, '서울_쇼핑.json'),
    음식점: path.join(baseDir, '서울_음식점.json')
  }
}

function pickDataType(message) {
  const text = message.toLowerCase()

  if (text.includes('맛집') || text.includes('음식') || text.includes('식당')) return '음식점'
  if (text.includes('축제') || text.includes('행사') || text.includes('공연')) return '축제'
  if (text.includes('관광지') || text.includes('명소') || text.includes('여행')) return '관광지'
  if (text.includes('쇼핑') || text.includes('마트') || text.includes('상가')) return '쇼핑'
  if (text.includes('숙박') || text.includes('호텔') || text.includes('펜션')) return '숙박'
  if (text.includes('레포츠') || text.includes('액티비티') || text.includes('운동')) return '레포츠'
  if (text.includes('문화') || text.includes('전시') || text.includes('공연')) return '문화시설'
  if (text.includes('코스') || text.includes('일정')) return '여행코스'

  return '관광지'
}

function loadRelevantData(message) {
  const dataFiles = getDataFiles()
  const type = pickDataType(message)
  const filePath = dataFiles[type]

  if (!filePath || !fs.existsSync(filePath)) {
    return []
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    const parsed = JSON.parse(raw)

    const items = Array.isArray(parsed.items) ? parsed.items : []
    return items.slice(0, 20).map((item) => ({
      title: item.title || '',
      addr1: item.addr1 || '',
      addr2: item.addr2 || '',
      tel: item.tel || '',
      contentid: item.contentid || ''
    }))
  } catch (error) {
    return []
  }
}

function buildContext(message) {
  const data = loadRelevantData(message)
  if (!data.length) return ''

  return `
다음은 서울 데이터에서 찾은 관련 항목입니다.
질문과 가장 관련 있는 항목만 참고해서 답하세요.
데이터:
${JSON.stringify(data, null, 2)}
`
}

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
    const { message, history = [] } = JSON.parse(event.body || '{}')

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

    const context = buildContext(message)

    const messages = [
      {
        role: 'system',
        content: `당신은 LocalHub의 지역 정보/커뮤니티 전문 챗봇입니다. 항상 한국어로 답하세요. 불필요하게 길게 대답하지 말기. 불필요한 꼬리 질문 하지 말기. 대화 맥락을 유지하세요. 지역명이 직접 주소에 쓰이지 않아도, 그 지역과 연관된 주변 동네·구역·지명까지 연결해 해석하세요. 사용자의 질문이 지역/맛집/행사/교통/커뮤니티/관광 관련이면, 먼저 제공된 데이터가 있으면 그 데이터를 우선적으로 참고해서 답하세요. 데이터가 없으면 일반적인 답변을 하되, 지역 정보 앱의 목적에 맞게 짧고 실용적으로 답하세요.`
      },
      ...history.slice(-10).map((item) => ({
        role: item.role,
        content: item.content
      })),
      {
        role: 'user',
        content: `${message}\n\n${context}`
      }
    ]

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        messages
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