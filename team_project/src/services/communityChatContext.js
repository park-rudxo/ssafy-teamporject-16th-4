function getPlainText(content = '') {
  return String(content || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeText(value = '') {
  return String(value || '').toLowerCase().trim()
}

export function extractRelevantCommunityPosts(query, posts = []) {
  const normalizedQuery = normalizeText(query)
  if (!normalizedQuery) return []

  const terms = normalizedQuery.split(/\s+/).filter(Boolean)
  if (!terms.length) return []

  const scoredPosts = (Array.isArray(posts) ? posts : [])
    .map((post) => {
      const title = String(post?.title || '')
      const content = getPlainText(post?.content || '')
      const nickname = String(post?.nickname || '')
      const category = String(post?.category || '')
      const searchableText = `${title} ${content} ${nickname} ${category}`.toLowerCase()

      let score = 0
      for (const term of terms) {
        if (searchableText.includes(term)) score += 1
        if (title.toLowerCase().includes(term)) score += 2
        if (content.toLowerCase().includes(term)) score += 1
      }

      return { score, post }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)

  return scoredPosts.map(({ post }) => ({
    id: post?.id ?? null,
    title: post?.title || '',
    category: post?.category || '',
    nickname: post?.nickname || '익명',
    createdAt: post?.createdAt || '',
    content: getPlainText(post?.content || '').slice(0, 300)
  }))
}

export function buildCommunityContext(query, posts = []) {
  const relevantPosts = extractRelevantCommunityPosts(query, posts)
  if (!relevantPosts.length) return ''

  return `
다음은 커뮤니티에서 찾은 관련 게시글입니다.
질문과 가장 관련 있는 게시글만 참고해서 답하세요.
커뮤니티 데이터:
${JSON.stringify(relevantPosts, null, 2)}
`
}
