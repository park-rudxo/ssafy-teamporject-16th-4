import test from 'node:test'
import assert from 'node:assert/strict'

import { buildCommunityContext, extractRelevantCommunityPosts } from '../src/services/communityChatContext.js'

test('extractRelevantCommunityPosts returns matching posts by keyword', () => {
  const posts = [
    { id: 1, title: '홍대 맛집 후기', content: '<p>홍대에서 먹기 좋은 식당</p>', nickname: '민수', category: '맛집·카페' },
    { id: 2, title: '한강 산책 코스', content: '<p>한강에서 즐길 수 있는 코스</p>', nickname: '지은', category: '코스 공유' }
  ]

  const result = extractRelevantCommunityPosts('홍대 맛집', posts)

  assert.equal(result.length, 1)
  assert.equal(result[0].title, '홍대 맛집 후기')
})

test('buildCommunityContext returns empty string when there is no match', () => {
  const context = buildCommunityContext('없는 단어', [])

  assert.equal(context, '')
})
