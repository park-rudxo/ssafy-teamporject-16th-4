<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'

const posts = ref([])

const categories = [
  '맛집·카페',
  '가볼 만한 곳',
  '즐길거리',
  '코스 공유',
  '행사·축제',
  '질문·도움',
  '후기·정보'
]

const form = ref({
  title: '',
  content: '',
  password: '',
  nickname: '',
  category: categories[0] // 기본값: 첫 카테고리
})

const editingId = ref(null)

const searchQuery = ref('')
const searchScope = ref('all')
const showBookmarksOnly = ref(false)
const sortMode = ref('latest') // 'latest' | 'likes' | 'views'
const currentView = ref('list')
const selectedPostId = ref(null)

const deleteTargetId = ref(null)
const deletePassword = ref('')
const deleteError = ref('')

const editorRef = ref(null)
const imageInputRef = ref(null)
const fileInputRef = ref(null)
const passwordInputRef = ref(null)
const errors = ref({
  title: '',
  content: '',
  password: ''
})
const selectedCategoryFilter = ref('all') // 'all' 또는 카테고리 문자열

const fontSizeValue = ref('3')
const textColorValue = ref('#111827')

const showLinkModal = ref(false)
const linkUrl = ref('')
const linkText = ref('')
const savedRange = ref(null)

function getPostLink(post) {
  if (!post) return window.location.href
  const base = window.location.origin + window.location.pathname
  return `${base}?post=${post.id}`
}

async function sharePost(post) {
  if (!post) return
  const link = getPostLink(post)

  if (navigator.share) {
    try {
      await navigator.share({
        title: post.title,
        text: (post.nickname || '익명'),
        url: link
      })
      return
    } catch (err) {
      // 사용자가 공유를 취소했거나 실패하면 복사로 폴백
    }
  }

  // 클립보드 복사 폴백
  try {
    await navigator.clipboard.writeText(link)
    alert('게시글 링크가 클립보드에 복사되었습니다.')
  } catch (err) {
    // 구형 브라우저 폴백 (임시 input)
    const input = document.createElement('input')
    input.value = link
    document.body.appendChild(input)
    input.select()
    document.execCommand('copy')
    document.body.removeChild(input)
    alert('게시글 링크가 복사되었습니다.')
  }
}

function openPostFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search)
    const pid = params.get('post')
    if (pid) {
      const idNum = Number(pid)
      if (!Number.isNaN(idNum)) {
        // posts 로드가 끝난 뒤 실행되어야 함
        const found = posts.value.find(p => p.id === idNum)
        if (found) {
          selectedPostId.value = idNum
          currentView.value = 'detail'
        }
      }
    }
  } catch (e) {
    // noop
  }
}

// onMounted에서 loadPosts() 호출 뒤 openPostFromUrl() 호출
onMounted(() => {
  loadPosts()
  openPostFromUrl()
})

function matchesSearch(post, query) {
  const title = (post.title || '').toLowerCase()
  const content = getPlainText(post.content || '').toLowerCase()
  const nickname = (post.nickname || '익명').toLowerCase()

  if (searchScope.value === 'title') {
    return title.includes(query)
  }

  if (searchScope.value === 'nickname') {
    return nickname.includes(query)
  }

  if (searchScope.value === 'content') {
    return content.includes(query)
  }

  // 'all' 은 이제 제목 + 내용만 검색합니다.
  return title.includes(query) || content.includes(query)
}

const filteredPosts = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()

  const basePosts = showBookmarksOnly.value
    ? posts.value.filter(post => post.bookmarked)
    : posts.value

  if (!query) {
    return basePosts
  }

  return basePosts.filter(post => matchesSearch(post, query))
})

const displayedPosts = computed(() => {
  const base = (showBookmarksOnly.value ? posts.value.filter(p => p.bookmarked) : posts.value)
  const categoryFiltered = selectedCategoryFilter.value === 'all'
    ? base
    : base.filter(p => p.category === selectedCategoryFilter.value)

  const filtered = searchQuery.value.trim()
    ? categoryFiltered.filter(p => matchesSearch(p, searchQuery.value.trim().toLowerCase()))
    : categoryFiltered

  if (sortMode.value === 'likes') {
    return [...filtered].sort((a,b) => (b.likes || 0) - (a.likes || 0))
  }
  if (sortMode.value === 'views') {
    return [...filtered].sort((a,b) => (b.views || 0) - (a.views || 0))
  }
  return [...filtered].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))
})

const searchedPosts = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()

  if (!query) {
    return []
  }

  return posts.value.filter(post => matchesSearch(post, query))
})

const selectedPost = computed(() => {
  return posts.value.find(post => post.id === selectedPostId.value)
})

function getPlainText(content) {
  return (content || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function loadPosts() {
  try {
    const savedPosts = JSON.parse(
      localStorage.getItem('localhub-posts') || '[]'
    )

    posts.value = savedPosts.map(post => ({
      ...post,
      bookmarked: Boolean(post.bookmarked),
      nickname: (post.nickname || '').trim() || '익명',
      likes: Number(post.likes) || 0,
      liked: Boolean(post.liked),
      views: Number(post.views) || 0,
      category: categories.includes(post.category)
        ? post.category
        : categories[0]
    }))
  } catch (error) {
    console.error('게시글을 불러오지 못했습니다.', error)
    posts.value = []
  }
}

function savePosts() {
  try {
    localStorage.setItem(
      'localhub-posts',
      JSON.stringify(posts.value)
    )
  } catch (error) {
    console.error('게시글을 저장하지 못했습니다.', error)
    alert('게시글을 저장하지 못했습니다. 이미지나 파일 용량을 확인해 주세요.')
  }
}

function onEditorInput() {
  syncEditorContent()
  if (getPlainText(form.value.content)) {
    errors.value.content = ''
  }
}

function setEditorContent(content = '') {
  if (!editorRef.value) {
    return
  }

  editorRef.value.innerHTML = content
}

function syncEditorContent() {
  if (!editorRef.value) {
    return
  }

  form.value.content = editorRef.value.innerHTML
}

function focusEditor(moveCursorToEnd = false) {
  if (!editorRef.value) {
    return
  }

  editorRef.value.focus()

  if (!moveCursorToEnd) {
    return
  }

  const selection = window.getSelection()

  if (!selection) {
    return
  }

  const range = document.createRange()

  range.selectNodeContents(editorRef.value)
  range.collapse(false)

  selection.removeAllRanges()
  selection.addRange(range)
}

async function applyEditorCommand(command, value = null) {
  await nextTick()

  focusEditor()

  document.execCommand(
    command,
    false,
    value === null ? undefined : value
  )

  syncEditorContent()
}

async function applyTextColor(color) {
  await nextTick()

  focusEditor()
  document.execCommand('foreColor', false, color)

  syncEditorContent()
}

async function insertEditorHtml(html) {
  await nextTick()

  focusEditor(true)
  document.execCommand('insertHTML', false, html)

  syncEditorContent()
}

function restoreSelection(range) {
  if (!range) {
    return
  }

  const selection = window.getSelection()

  if (!selection) {
    return
  }

  selection.removeAllRanges()
  selection.addRange(range)
}

function openLinkModal() {
  const selection = window.getSelection()

  if (
    selection &&
    selection.rangeCount > 0 &&
    editorRef.value?.contains(selection.anchorNode)
  ) {
    savedRange.value = selection.getRangeAt(0).cloneRange()
    linkText.value = selection.toString()
  } else {
    savedRange.value = null
    linkText.value = ''
  }

  linkUrl.value = ''
  showLinkModal.value = true
}

async function insertLinkFromModal() {
  const url = linkUrl.value.trim()

  if (!url) {
    alert('링크 주소를 입력해 주세요.')
    return
  }

  await nextTick()

  if (savedRange.value) {
    restoreSelection(savedRange.value)
  } else {
    focusEditor(true)
  }

  const selection = window.getSelection()
  const range =
    selection && selection.rangeCount > 0
      ? selection.getRangeAt(0)
      : null

  const selectedText = range ? range.toString() : ''

  const text =
    linkText.value.trim() ||
    selectedText ||
    url

  const linkElement = document.createElement('a')

  linkElement.href = url
  linkElement.target = '_blank'
  linkElement.rel = 'noopener noreferrer'
  linkElement.textContent = text

  if (range && editorRef.value?.contains(range.commonAncestorContainer)) {
    range.deleteContents()
    range.insertNode(linkElement)

    const newRange = document.createRange()

    newRange.setStartAfter(linkElement)
    newRange.collapse(true)

    selection.removeAllRanges()
    selection.addRange(newRange)
  } else {
    focusEditor(true)
    document.execCommand(
      'insertHTML',
      false,
      linkElement.outerHTML
    )
  }

  syncEditorContent()
  cancelLinkModal()
}

function cancelLinkModal() {
  showLinkModal.value = false
  linkUrl.value = ''
  linkText.value = ''
  savedRange.value = null
}

function triggerImageUpload() {
  imageInputRef.value?.click()
}

function triggerFileUpload() {
  fileInputRef.value?.click()
}

function handleImageUpload(event) {
  const file = event.target.files?.[0]

  if (!file) {
    return
  }

  const reader = new FileReader()

  reader.onload = async () => {
    const imageHtml = `
      <img
        src="${reader.result}"
        alt="${file.name}"
        style="display:block; max-width:100%; margin:8px 0; border-radius:6px;"
      >
    `

    await insertEditorHtml(imageHtml)
  }

  reader.onerror = () => {
    alert('이미지를 불러오지 못했습니다.')
  }

  reader.readAsDataURL(file)
  event.target.value = ''
}

function handleFileUpload(event) {
  const file = event.target.files?.[0]

  if (!file) {
    return
  }

  const reader = new FileReader()

  reader.onload = async () => {
    const attachmentHtml = `
      <a
        href="${reader.result}"
        download="${file.name}"
        style="
          display:inline-block;
          margin:6px 0;
          padding:8px 10px;
          border-radius:6px;
          background-color:#eef6ff;
          color:#4571ec;
          text-decoration:none;
        "
      >
        📎 ${file.name}
      </a>
    `

    await insertEditorHtml(attachmentHtml)
  }

  reader.onerror = () => {
    alert('파일을 불러오지 못했습니다.')
  }

  reader.readAsDataURL(file)
  event.target.value = ''
}

function resetForm() {
  form.value = {
    title: '',
    content: '',
    password: '',
    nickname: '',
    category: categories[0]
  }

  errors.value = {
    title: '',
    content: '',
    password: ''
  }

  editingId.value = null
  fontSizeValue.value = '3'
  textColorValue.value = '#111827'

  closeDeleteModal()
  cancelLinkModal()

  nextTick(() => {
    setEditorContent('')
  })
}

function openPostDetail(post) {
  // increment views once when opening detail
  const target = posts.value.find(p => p.id === post.id)
  if (target) {
    target.views = (target.views || 0) + 1
    savePosts()
  }

  selectedPostId.value = post.id
  currentView.value = 'detail'
  closeDeleteModal()
}

function closePostDetail() {
  selectedPostId.value = null
  currentView.value = 'list'
  closeDeleteModal()
}

function openWriteForm() {
  resetForm()
  currentView.value = 'write'
}

function openListView() {
  resetForm()
  selectedPostId.value = null
  currentView.value = 'list'
}

function openSearchResults() {
  if (!searchQuery.value.trim()) {
    alert('검색어를 입력해 주세요.')
    return
  }

  closeDeleteModal()
  currentView.value = 'search'
}

function openSearchInput() {
  closeDeleteModal()
  currentView.value = 'list'
}

function formatDate(value) {
  if (!value) {
    return ''
  }

  return new Date(value).toLocaleString('ko-KR')
}

function submitPost() {
  syncEditorContent()

  const title = form.value.title.trim()
  const content = form.value.content || ''
  const plainContent = getPlainText(content)
  const password = form.value.password.trim()
  const nickname = form.value.nickname.trim() || '익명'

  if (!title) {
    errors.value.title = '제목을 입력해 주세요.'
    nextTick(() => {
      const el = document.getElementById('post-title')
      el?.focus()
    })
    return
  }

  if (!plainContent) {
    errors.value.content = '내용을 입력해 주세요.'
    nextTick(() => {
      editorRef.value?.focus()
    })
    return
  }

  if (!password) {
    errors.value.password = '수정·삭제용 비밀번호를 입력해 주세요.'
    nextTick(() => {
      passwordInputRef.value?.focus()
    })
    return
  }

  if (editingId.value !== null) {
    const targetPost = posts.value.find(
      post => post.id === editingId.value
    )

    if (!targetPost) {
      alert('수정할 게시글을 찾을 수 없습니다.')
      openListView()
      return
    }

    if (targetPost.password !== password) {
      alert('비밀번호가 맞지 않습니다.')
      return
    }

    targetPost.title = title
    targetPost.content = content.trim()
    targetPost.nickname = nickname
    targetPost.category = form.value.category || categories[0]
    targetPost.updatedAt = new Date().toISOString()
  } else {
    posts.value.unshift({
      id: Date.now(),
      title,
      content: content.trim(),
      password,
      nickname,
      category: form.value.category || categories[0],
      createdAt: new Date().toISOString(),
      bookmarked: false,
      likes: 0,
      liked: false,
      views: 0
    })
  }

  savePosts()
  openListView()
}

function likePost(post) {
  if (!post || post.liked) return
  post.likes = (post.likes || 0) + 1
  post.liked = true
  savePosts()
}

function startEdit(post) {
  editingId.value = post.id

  form.value = {
    title: post.title,
    content: post.content || '',
    password: '',
    nickname: post.nickname || '',
    category: categories.includes(post.category)
      ? post.category
      : categories[0]
  }

  currentView.value = 'write'
  closeDeleteModal()

  nextTick(() => {
    setEditorContent(post.content || '')
  })
}

function openDeleteModal(post) {
  deleteTargetId.value = post.id
  deletePassword.value = ''
  deleteError.value = ''
}

function confirmDelete() {
  if (deleteTargetId.value === null) {
    deleteError.value = '삭제할 게시글을 찾을 수 없습니다.'
    return
  }

  if (!deletePassword.value) {
    deleteError.value = '비밀번호를 입력해 주세요.'
    return
  }

  const postIndex = posts.value.findIndex(
    post => post.id === deleteTargetId.value
  )

  if (postIndex === -1) {
    deleteError.value = '게시글을 찾을 수 없습니다.'
    return
  }

  const post = posts.value[postIndex]

  if (post.password !== deletePassword.value) {
    deletePassword.value = ''
    deleteError.value = '비밀번호가 일치하지 않습니다.'
    return
  }

  const deletedPostId = post.id

  posts.value.splice(postIndex, 1)
  savePosts()
  closeDeleteModal()

  if (selectedPostId.value === deletedPostId) {
    closePostDetail()
  }
}

function closeDeleteModal() {
  deleteTargetId.value = null
  deletePassword.value = ''
  deleteError.value = ''
}

function toggleBookmark(post) {
  post.bookmarked = !post.bookmarked
  savePosts()
}
</script>

<template>
  <section class="card">
    <h3>익명 커뮤니티</h3>

    <!-- 게시글 목록 화면 -->
    <div v-if="currentView === 'list'">
      <div class="search-bar">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="검색어 입력"
          @keyup.enter="openSearchResults"
        >

        <button
          type="button"
          class="btn-search"
          @click="openSearchResults"
        >
          검색
        </button>
      </div>

      <div class="search-scope">
        <label for="search-scope">검색 범위</label>

        <select
          id="search-scope"
          v-model="searchScope"
        >
          <option value="title">제목</option>
          <option value="nickname">닉네임</option>
          <option value="content">내용</option>
          <option value="all">제목 + 내용</option>
        </select>
      </div>

      <div class="list-controls">
        <div class="sort-controls">
          <label for="sort-mode">정렬</label>
          <select id="sort-mode" v-model="sortMode">
            <option value="latest">최신순</option>
            <option value="likes">추천순</option>
            <option value="views">조회수순</option>
          </select>
        </div>

        <div class="category-filter">
          <label for="category-filter">카테고리</label>
          <select id="category-filter" class="custom-select" v-model="selectedCategoryFilter">
            <option value="all">전체</option>
            <option
              v-for="category in categories"
              :key="category"
              :value="category"
            >
              {{ category }}
            </option>
          </select>
        </div>
      </div>

      <label class="bookmark-filter">
        <input
          v-model="showBookmarksOnly"
          type="checkbox"
        >
        북마크만 보기
      </label>

      <button
        type="button"
        class="btn-write"
        @click="openWriteForm"
      >
        글 작성
      </button>

      <div
        v-if="displayedPosts.length"
        class="post-list"
      >
        <div
          v-for="post in displayedPosts"
          :key="post.id"
          class="post"
        >
          <div class="post-header">
            <div>
              <button
                type="button"
                class="post-title-btn"
                @click="openPostDetail(post)"
              >
                {{ post.title }}
              </button>

              <div class="post-meta">
                <span class="nickname">
                  {{ post.nickname || '익명' }}
                </span>

                <span class="category">{{ post.category }}</span>

                <small>
                  {{ formatDate(post.createdAt) }} · 조회 {{ post.views || 0 }} · 추천 {{ post.likes || 0 }}
                </small>
              </div>
            </div>
          </div>

        </div>
      </div>

      <p
        v-else
        class="empty-message"
      >
        표시할 게시글이 없습니다.
      </p>
    </div>

    <!-- 게시글 상세 화면 -->
    <div
      v-else-if="currentView === 'detail'"
      class="detail-view"
    >

      <button
        type="button"
        class="btn-list"
        @click="closePostDetail"
      >
        목록 보기
      </button>

      <div
        v-if="selectedPost"
        class="detail-post"
      >
        <div class="detail-title-area">
          <div>
            <h4>{{ selectedPost.title }}</h4>

            <div class="post-meta">
              <span class="nickname">
                {{ selectedPost.nickname || '익명' }}
              </span>

              <span class="category">{{ selectedPost.category }}</span>

              <small>
                {{ formatDate(selectedPost.createdAt) }} · 조회 {{ selectedPost.views || 0 }} · 추천 {{ selectedPost.likes || 0 }}
              </small>
            </div>
          </div>

          <div class="detail-actions-inline">
            <button type="button" class="detail-share" @click="sharePost(selectedPost)">
              🔗 <span>공유</span>
            </button>

            <button type="button" class="detail-bookmark" @click="toggleBookmark(selectedPost)">
              <span>{{ selectedPost.bookmarked ? '★' : '☆' }}</span>
              <span class="label-text">북마크</span>
            </button>
          </div>
        </div>

        <div
          class="content-body"
          v-html="selectedPost.content"
        ></div>

        <!-- 본문 아래 중앙에 위치하도록 추가 -->
        <div class="detail-like-wrapper">
          <button
            type="button"
            class="detail-like-btn"
            :disabled="selectedPost.liked"
            @click="likePost(selectedPost)"
          >
            👍 추천 {{ selectedPost.likes || 0 }}
          </button>
        </div>

        <div class="actions">
          <button
            type="button"
            @click="startEdit(selectedPost)"
          >
            수정
          </button>

          <button
            type="button"
            @click="openDeleteModal(selectedPost)"
          >
            삭제
          </button>
        </div>

        <div
          v-if="deleteTargetId === selectedPost.id"
          class="delete-password-form"
        >
          <p>게시글 비밀번호를 입력해 주세요.</p>

          <p
            v-if="deleteError"
            class="error-text"
          >
            {{ deleteError }}
          </p>

          <input
            v-model="deletePassword"
            type="password"
            placeholder="비밀번호"
            @keyup.enter="confirmDelete"
          >

          <div class="actions">
            <button
              type="button"
              @click="confirmDelete"
            >
              삭제
            </button>

            <button
              type="button"
              @click="closeDeleteModal"
            >
              취소
            </button>
          </div>
        </div>
      </div>

      <p
        v-else
        class="empty-message"
      >
        게시글을 찾을 수 없습니다.
      </p>
    </div>

    <!-- 검색 결과 화면 -->
    <div
      v-else-if="currentView === 'search'"
      class="search-view"
    >
      <button
        type="button"
        class="btn-list"
        @click="openSearchInput"
      >
        목록 보기
      </button>

      <div class="search-result-header">
        <h4>검색 결과</h4>
        <p>검색어: {{ searchQuery }}</p>
      </div>

      <div v-if="searchedPosts.length">
        <div
          v-for="post in searchedPosts"
          :key="post.id"
          class="post"
        >
          <div class="post-header">
            <div>
              <button
                type="button"
                class="post-title-btn"
                @click="openPostDetail(post)"
              >
                {{ post.title }}
              </button>

              <div class="post-meta">
                <span class="nickname">
                  {{ post.nickname || '익명' }}
                </span>

                <span class="category">{{ post.category }}</span>

                <small>
                  {{ formatDate(post.createdAt) }} · 조회 {{ post.views || 0 }} · 추천 {{ post.likes || 0 }}
                </small>
              </div>
            </div>

            <button
              type="button"
              class="bookmark-btn"
              :aria-label="
                post.bookmarked
                  ? '북마크 해제'
                  : '북마크 추가'
              "
              @click="toggleBookmark(post)"
            >
              {{ post.bookmarked ? '★' : '☆' }}
            </button>
          </div>

          <div
            class="content-body search-content-preview"
            v-html="post.content"
          ></div>

          <div class="actions">
            <button
              type="button"
              @click="openPostDetail(post)"
            >
              자세히 보기
            </button>

            <button
              type="button"
              @click="startEdit(post)"
            >
              수정
            </button>

            <button
              type="button"
              @click="openDeleteModal(post)"
            >
              삭제
            </button>
          </div>

          <div
            v-if="deleteTargetId === post.id"
            class="delete-password-form"
          >
            <p>게시글 비밀번호를 입력해 주세요.</p>

            <p
              v-if="deleteError"
              class="error-text"
            >
              {{ deleteError }}
            </p>

            <input
              v-model="deletePassword"
              type="password"
              placeholder="비밀번호"
              @keyup.enter="confirmDelete"
            >

            <div class="actions">
              <button
                type="button"
                @click="confirmDelete"
              >
                삭제
              </button>

              <button
                type="button"
                @click="closeDeleteModal"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      </div>

      <p
        v-else
        class="empty-message"
      >
        검색 결과가 없습니다.
      </p>
    </div>

    <!-- 글 작성 및 수정 화면 -->
    <div
      v-else
      class="write-view"
    >
      <button
        type="button"
        class="btn-list"
        @click="openListView"
      >
        목록 보기
      </button>

      <form
        class="form"
        @submit.prevent="submitPost"
      >
        <div class="form-group">
          <label for="post-title">제목</label>
          <input id="post-title"
                 v-model="form.title" 
                 type="text" 
                 placeholder="제목을 입력하세요" 
                 @input="errors.title = ''" 
                 />

          <p v-if="errors.title" class="field-error">{{ errors.title }}</p>
        </div>

        <div class="form-group">
          <label for="post-nickname">닉네임</label>

          <input
            id="post-nickname"
            v-model="form.nickname"
            type="text"
            placeholder="닉네임을 입력하지 않으면 익명으로 표시됩니다"
          >
        </div>

        <div class="form-group">
          <label for="post-category">카테고리</label>
          <select id="post-category" class="custom-select" v-model="form.category">
            <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
          </select>
        </div>

        <div class="form-group">
          <span class="editor-label">내용</span>

          <div class="editor-toolbar">
            <button
              type="button"
              title="굵게"
              @click="applyEditorCommand('bold')"
            >
              <strong>B</strong>
            </button>

            <button
              type="button"
              title="기울임"
              @click="applyEditorCommand('italic')"
            >
              <em>I</em>
            </button>

            <button
              type="button"
              title="밑줄"
              @click="applyEditorCommand('underline')"
            >
              <u>U</u>
            </button>

            <button
              type="button"
              title="취소선"
              @click="applyEditorCommand('strikeThrough')"
            >
              <s>S</s>
            </button>

            <select
              v-model="fontSizeValue"
              title="글자 크기"
              @change="
                applyEditorCommand(
                  'fontSize',
                  fontSizeValue
                )
              "
            >
              <option value="1">아주 작게</option>
              <option value="2">작게</option>
              <option value="3">보통</option>
              <option value="4">조금 크게</option>
              <option value="5">크게</option>
              <option value="6">아주 크게</option>
              <option value="7">가장 크게</option>
            </select>

            <input
              v-model="textColorValue"
              type="color"
              class="color-picker"
              title="글자 색상"
              @input="applyTextColor(textColorValue)"
            >

            <button
              type="button"
              title="왼쪽 정렬"
              @click="applyEditorCommand('justifyLeft')"
            >
              ≡
            </button>

            <button
              type="button"
              title="가운데 정렬"
              @click="applyEditorCommand('justifyCenter')"
            >
              ≡
            </button>

            <button
              type="button"
              title="오른쪽 정렬"
              @click="applyEditorCommand('justifyRight')"
            >
              ≡
            </button>

            <button
              type="button"
              title="글머리 기호"
              @click="
                applyEditorCommand(
                  'insertUnorderedList'
                )
              "
            >
              • 글머리 기호
            </button>

            <button
              type="button"
              title="번호 목록"
              @click="
                applyEditorCommand(
                  'insertOrderedList'
                )
              "
            >
              1. 목록 번호
            </button>

            <button
              type="button"
              title="링크 삽입"
              @mousedown.prevent="openLinkModal"
            >
              🔗 링크
            </button>

            <button
              type="button"
              title="이미지 삽입"
              @mousedown.prevent="triggerImageUpload"
            >
              🖼️ 이미지
            </button>

            <button
              type="button"
              title="파일 첨부"
              @mousedown.prevent="triggerFileUpload"
            >
              📁 파일
            </button>

            <button
              type="button"
              title="서식 제거"
              @click="applyEditorCommand('removeFormat')"
            >
              서식 제거
            </button>

            <input
              ref="imageInputRef"
              type="file"
              accept="image/*"
              class="hidden-file-input"
              @change="handleImageUpload"
            >

            <input
              ref="fileInputRef"
              type="file"
              class="hidden-file-input"
              @change="handleFileUpload"
            >
          </div>

          <div ref="editorRef"
              contenteditable="true"
              :class="['editor-area', { 'input-error': errors.content }]"
              data-placeholder="게시글 내용을 입력하세요"
              @input="onEditorInput"
              @blur="syncEditorContent"></div>
          <p v-if="errors.content" class="field-error">{{ errors.content }}</p>
        </div>

        <div class="form-group">
          <label for="post-password">
            수정·삭제용 비밀번호
          </label>

          <input 
            id="post-password"
            ref="passwordInputRef" 
            v-model="form.password" 
            type="password" placeholder="..." 
            @input="errors.password = ''" 
          />
          <p v-if="errors.password" class="field-error">{{ errors.password }}</p>

        </div>

        <div class="actions form-actions">
          <button type="submit">
            {{ editingId !== null ? '수정하기' : '작성하기' }}
          </button>

          <button
            type="button"
            @click="openListView"
          >
            취소
          </button>
        </div>
      </form>
    </div>

    <!-- 링크 삽입 창 -->
    <div
      v-if="showLinkModal"
      class="link-modal"
      @mousedown.self="cancelLinkModal"
    >
      <div
        class="link-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="link-modal-title"
        @mousedown.stop
      >
        <h4 id="link-modal-title">
          링크 삽입
        </h4>

        <label for="link-url">링크 주소</label>

        <input
          id="link-url"
          v-model="linkUrl"
          type="url"
          placeholder="https://example.com"
        >

        <label for="link-text">표시할 글자</label>

        <input
          id="link-text"
          v-model="linkText"
          type="text"
          placeholder="입력하지 않으면 링크 주소가 표시됩니다"
          @keyup.enter="insertLinkFromModal"
        >

        <div class="actions">
          <button
            type="button"
            @click="insertLinkFromModal"
          >
            삽입
          </button>

          <button
            type="button"
            @click="cancelLinkModal"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.card {
  margin: 10px 0;
  padding: 20px;
  border: 1px solid #dddddd;
  border-radius: 8px;
  background-color: #ffffff;
}

.card h3 {
  margin: 0 0 20px;
  color: #333333;
}

button,
input,
select {
  font-family: inherit;
}

button {
  cursor: pointer;
}

input[type='text'],
input[type='password'],
input[type='url'],
.search-bar input {
  width: 100%;
  box-sizing: border-box;
  padding: 10px;
  border: 1px solid #cccccc;
  border-radius: 4px;
  font-size: 14px;
}

input[type='text']:focus,
input[type='password']:focus,
input[type='url']:focus,
select:focus {
  outline: none;
  border-color: #2196f3;
  box-shadow: 0 0 5px rgba(33, 150, 243, 0.3);
}

.btn-write,
.btn-list,
.btn-search {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  color: #ffffff;
  font-weight: 500;
  white-space: nowrap;
  transition:
    background-color 0.2s ease,
    transform 0.2s ease;
}

.btn-write {
  background-color: #4caf50;
}

.btn-write:hover {
  background-color: #45a049;
}

.btn-list {
  margin-bottom: 15px;
  background-color: #2196f3;
}

.btn-list:hover {
  background-color: #0b7dda;
}

.btn-search {
  background-color: #ff9800;
}

.btn-search:hover {
  background-color: #f57c00;
}

.search-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

.search-bar input {
  flex: 1;
}

.search-scope {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 8px 0 12px;
}

.search-scope label {
  color: #555555;
  font-size: 14px;
}

.search-scope select {
  padding: 7px 10px;
  border: 1px solid #cccccc;
  border-radius: 4px;
  background-color: #ffffff;
  font-size: 14px;
}

.list-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 8px 0 12px;
}

.sort-controls,
.category-filter {
  display: flex;
  align-items: center;
  gap: 8px;
}

.sort-controls label,
.category-filter label {
  color: #555555;
  font-size: 14px;
}

.sort-controls select,
.category-filter select {
  padding: 7px 10px;
  border: 1px solid #cccccc;
  border-radius: 4px;
  background-color: #ffffff;
  font-size: 14px;
}

.category {
  display: inline-flex;
  align-items: center;
  padding: 2px 7px;
  border-radius: 999px;
  background-color: #e8f3ff;
  color: #2563eb;
  font-size: 12px;
  font-weight: 600;
}

.custom-select {
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  background-color: #fff;
  border: 1px solid #d1d5db;
  padding: 8px 38px 8px 12px;
  border-radius: 8px;
  font-size: 14px;
  color: #111827;
  background-image: linear-gradient(45deg, transparent 50%, #6b7280 50%),
                    linear-gradient(135deg, #6b7280 50%, transparent 50%),
                    linear-gradient(to right, #f3f4f6, #f3f4f6);
  background-position: calc(100% - 18px) calc(1em + 2px), calc(100% - 12px) calc(1em + 2px), 0 0;
  background-size: 8px 8px, 8px 8px, 100% 100%;
  background-repeat: no-repeat;
  cursor: pointer;
}

.custom-select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59,130,246,0.12);
}

/* 작은 화면 대응 */
@media (max-width: 600px) {
  .custom-select { padding-right: 44px; }
}

.bookmark-filter {
  display: flex;
  align-items: center;
  width: fit-content;
  margin: 10px 0;
  cursor: pointer;
}

.bookmark-filter input {
  margin-right: 8px;
}

.post {
  margin: 15px 0;
  padding: 15px;
  border: 1px solid #eeeeee;
  border-radius: 6px;
  background-color: #f9f9f9;
}

.post-header {
  position: relative;
  display: flex;
  align-items: center; /* 중앙 정렬로 통일 */
  justify-content: space-between;
  min-height: 40px;
  padding-right: 100px; /* 오른쪽 버튼 2개 공간 확보 (필요시 조정) */
}

.post-title-btn {
  padding: 0;
  border: none;
  background: none;
  color: #363636;
  font-size: 16px;
  font-weight: 600;
  text-align: left;
}

.post-title-btn:hover {
  text-decoration: underline;
}

.post-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 5px;
}

.nickname {
  color: #5a5a5a;
  font-size: 13px;
  font-weight: 600;
}

.post-meta small {
  color: #999999;
  font-size: 12px;
}

/* 공통 규칙으로 크기/정렬 통일 */
.bookmark-btn,
.share-btn {
  position: absolute;
  top: 6px; /* 버튼 수직 위치 일치 */
  padding: 0;
  border: none;
  background: transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  font-size: 18px;
  transition: transform 0.12s ease;
}

/* 위치: 오른쪽 끝에 북마크, 그 왼쪽에 공유 */
.bookmark-btn {
  right: 8px;
  color: #f4b400;
}

.share-btn {
  right: 52px; /* 북마크 바로 왼쪽(간격 8px) */
  color: #3b82f6;
}

.bookmark-btn:hover,
.share-btn:hover {
  transform: scale(1.12);
}

.detail-view,
.search-view,
.write-view {
  margin-top: 10px;
}

.detail-post {
  padding: 18px;
  border: 1px solid #eeeeee;
  border-radius: 6px;
  background-color: #fafafa;
}

.detail-title-area {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.detail-title-area h4 {
  margin: 0;
  color: #333333;
  font-size: 21px;
}

.detail-actions-inline {
  display: inline-flex;
  gap: 10px;
  align-items: center;
}

.detail-share,
.detail-bookmark {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  font-size: 15px;
  cursor: pointer;
  color: #111827;
}

.detail-share {
  color: #3b82f6;
  border-color: rgba(59,130,246,0.08);
  background: rgba(59,130,246,0.03);
}

.detail-bookmark {
  color: #f4b400;
  border-color: rgba(244,180,0,0.08);
  background: rgba(244,180,0,0.03);
}

.detail-bookmark .label-text {
  margin-left: 6px;
  font-weight: 600;
  color: inherit;
}

.detail-share:hover,
.detail-bookmark:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

.detail-share span,
.detail-bookmark span {
  font-weight: 600;
}

.detail-like-wrapper {
  margin-top: 18px;
  display: flex;
  justify-content: center;
}

.detail-like-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 8px;
  border: 1px solid #dbdcdd8a;
  background: #ffffff96;
  color: #111827;
  font-weight: 700;
  font-size: 15px;
  cursor: pointer;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}

.detail-like-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0,0,0,0.08);
}

.detail-like-btn:disabled {
  opacity: 0.6;
  cursor: default;
  transform: none;
  box-shadow: none;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0,0,0,0);
  white-space: nowrap;
  border: 0;
}

.content-body {
  margin-top: 18px;
  color: #444444;
  line-height: 1.7;
  overflow-wrap: anywhere;
}

.content-body :deep(img) {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 8px 0;
  border-radius: 6px;
}

.content-body :deep(a) {
  color: #4571ec;
  overflow-wrap: anywhere;
}

.search-content-preview {
  max-height: 180px;
  overflow: hidden;
}

.actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.actions button {
  flex: 1;
  padding: 9px 12px;
  border: none;
  border-radius: 4px;
  background-color: #eeeeee;
  color: #333333;
  font-size: 14px;
  transition: background-color 0.2s ease;
}

.actions button:hover {
  background-color: #dddddd;
}

.delete-password-form {
  margin-top: 12px;
  padding: 12px;
  border: 1px solid #ffc107;
  border-radius: 4px;
  background-color: #fff3cd;
}

.delete-password-form p {
  margin: 0 0 10px;
  color: #856404;
  font-weight: 500;
}

.delete-password-form .error-text {
  color: #b91c1c;
  font-size: 13px;
}

.delete-password-form input {
  margin-bottom: 4px;
}

.delete-password-form .actions button:first-child {
  background-color: #ffc107;
}

.delete-password-form .actions button:first-child:hover {
  background-color: #ffb300;
}

.search-result-header {
  margin-bottom: 12px;
}

.search-result-header h4 {
  margin: 0 0 4px;
}

.search-result-header p {
  margin: 0;
  color: #666666;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.form-group label,
.editor-label {
  color: #444444;
  font-size: 14px;
  font-weight: 600;
}

.editor-toolbar {
  position: relative;
  z-index: 20;
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  padding: 8px;
  border: 1px solid #dddddd;
  border-radius: 6px 6px 0 0;
  background-color: #f8f9fa;
}

.editor-toolbar button,
.editor-toolbar select,
.editor-toolbar input[type='color'] {
  min-height: 34px;
  padding: 6px 10px;
  border: 1px solid #cccccc;
  border-radius: 4px;
  background-color: #ffffff;
  font-size: 14px;
}

.editor-toolbar button:hover {
  background-color: #eeeeee;
}

.color-picker {
  width: 42px;
  height: 34px;
  padding: 2px !important;
}

.editor-area {
  position: relative;
  z-index: 10;
  min-height: 200px;
  max-height: 420px;
  padding: 12px;
  overflow-y: auto;
  border: 1px solid #cccccc;
  border-top: none;
  border-radius: 0 0 6px 6px;
  background-color: #ffffff;
  line-height: 1.7;
  overflow-wrap: anywhere;
}

.editor-area:focus {
  outline: none;
  border-color: #2196f3;
  box-shadow: 0 2px 5px rgba(33, 150, 243, 0.2);
}

.editor-area:empty::before {
  color: #999999;
  content: attr(data-placeholder);
  pointer-events: none;
}

.editor-area :deep(img) {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 8px 0;
  border-radius: 6px;
}

.hidden-file-input {
  display: none;
}

.form-actions {
  margin-top: 2px;
}

.form-actions button {
  padding: 12px;
  font-weight: 600;
}

.form-actions button:first-child {
  background-color: #4caf50;
  color: #ffffff;
}

.form-actions button:first-child:hover {
  background-color: #45a049;
}

.form-actions button:last-child {
  background-color: #f44336;
  color: #ffffff;
}

.form-actions button:last-child:hover {
  background-color: #da190b;
}

.link-modal {
  position: fixed;
  z-index: 1000;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  background-color: rgba(0, 0, 0, 0.4);
}

.link-dialog {
  width: 360px;
  max-width: 100%;
  padding: 18px;
  border-radius: 8px;
  background-color: #ffffff;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
}

.link-dialog h4 {
  margin: 0 0 15px;
  color: #333333;
  font-size: 18px;
}

.link-dialog label {
  display: block;
  margin-top: 10px;
  color: #555555;
  font-size: 13px;
  font-weight: 600;
}

.link-dialog input {
  margin-top: 5px;
}

.empty-message {
  margin: 18px 0;
  padding: 20px;
  border-radius: 6px;
  background-color: #f7f7f7;
  color: #777777;
  text-align: center;
}

.input-error {
  border-color: #f44336 !important;
  box-shadow: 0 0 0 3px rgba(244,67,54,0.08);
}

.field-error {
  margin: 4px 0 0;
  color: #b91c1c;
  font-size: 15px;
  font-weight: 700;
}

@media (max-width: 600px) {
  .card {
    padding: 14px;
  }

  .search-bar {
    flex-direction: column;
  }

  .btn-search {
    width: 100%;
  }

  .search-scope {
    align-items: stretch;
    flex-direction: column;
  }

  .list-controls,
  .sort-controls,
  .category-filter {
    align-items: stretch;
    flex-direction: column;
  }

  .sort-controls select,
  .category-filter select {
    width: 100%;
  }

  .editor-toolbar button,
  .editor-toolbar select {
    flex-grow: 1;
  }

  .actions {
    flex-direction: column;
  }

  .detail-title-area {
    align-items: flex-start;
  }

}
</style>