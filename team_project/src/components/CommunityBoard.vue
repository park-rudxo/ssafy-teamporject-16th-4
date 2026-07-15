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

  try {
    await navigator.clipboard.writeText(link)
    alert('게시글 링크가 클립보드에 복사되었습니다.')
  } catch (err) {
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

onMounted(() => {
  loadPosts()
  openPostFromUrl()
})

function matchesSearch(post, query) {
  const title = (post.title || '').toLowerCase()
  const content = getPlainText(post.content || '').toLowerCase()
  const nickname = (post.nickname || '익명').toLowerCase()

  if (searchScope.value === 'title') return title.includes(query)
  if (searchScope.value === 'nickname') return nickname.includes(query)
  if (searchScope.value === 'content') return content.includes(query)

  return title.includes(query) || content.includes(query)
}

const filteredPosts = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  const basePosts = showBookmarksOnly.value
    ? posts.value.filter(post => post.bookmarked)
    : posts.value

  if (!query) return basePosts
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
  return [...filtered].sort((a, b) => (b.likes || 0) - (a.likes || 0))
  }
  if (sortMode.value === 'views') {
    return [...filtered].sort((a, b) => (b.views || 0) - (a.views || 0))
  }
  if (sortMode.value === 'oldest') {
    return [...filtered].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
  }
  // default: latest
  return [...filtered].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
})

const searchedPosts = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return []
  return posts.value.filter(post => matchesSearch(post, query))
})

const selectedPost = computed(() => posts.value.find(post => post.id === selectedPostId.value))

function getPlainText(content) {
  return (content || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function loadPosts() {
  try {
    const savedPosts = JSON.parse(localStorage.getItem('localhub-posts') || '[]')
    posts.value = savedPosts.map(post => ({
      ...post,
      bookmarked: Boolean(post.bookmarked),
      nickname: (post.nickname || '').trim() || '익명',
      likes: Number(post.likes) || 0,
      liked: Boolean(post.liked),
      views: Number(post.views) || 0,
      category: categories.includes(post.category) ? post.category : categories[0]
    }))
  } catch (error) {
    console.error('게시글을 불러오지 못했습니다.', error)
    posts.value = []
  }
}

function savePosts() {
  try {
    localStorage.setItem('localhub-posts', JSON.stringify(posts.value))
  } catch (error) {
    console.error('게시글을 저장하지 못했습니다.', error)
    alert('게시글을 저장하지 못했습니다. 이미지나 파일 용량을 확인해 주세요.')
  }
}

function onEditorInput() {
  syncEditorContent()
  if (getPlainText(form.value.content)) errors.value.content = ''
}

function setEditorContent(content = '') {
  if (!editorRef.value) return
  editorRef.value.innerHTML = content
}

function syncEditorContent() {
  if (!editorRef.value) return
  form.value.content = editorRef.value.innerHTML
}

function focusEditor(moveCursorToEnd = false) {
  if (!editorRef.value) return
  editorRef.value.focus()
  if (!moveCursorToEnd) return

  const selection = window.getSelection()
  if (!selection) return
  const range = document.createRange()
  range.selectNodeContents(editorRef.value)
  range.collapse(false)
  selection.removeAllRanges()
  selection.addRange(range)
}

async function applyEditorCommand(command, value = null) {
  await nextTick()
  focusEditor()
  document.execCommand(command, false, value === null ? undefined : value)
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
  if (!range) return
  const selection = window.getSelection()
  if (!selection) return
  selection.removeAllRanges()
  selection.addRange(range)
}

function openLinkModal() {
  const selection = window.getSelection()
  if (selection && selection.rangeCount > 0 && editorRef.value?.contains(selection.anchorNode)) {
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
  if (savedRange.value) restoreSelection(savedRange.value)
  else focusEditor(true)

  const selection = window.getSelection()
  const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null
  const selectedText = range ? range.toString() : ''
  const text = linkText.value.trim() || selectedText || url

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
    document.execCommand('insertHTML', false, linkElement.outerHTML)
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
  if (!file) return
  const reader = new FileReader()
  reader.onload = async () => {
    const imageHtml = `<img src="${reader.result}" alt="${file.name}" style="display:block; max-width:100%; margin:8px 0; border-radius:6px;">`
    await insertEditorHtml(imageHtml)
  }
  reader.onerror = () => alert('이미지를 불러오지 못했습니다.')
  reader.readAsDataURL(file)
  event.target.value = ''
}

function handleFileUpload(event) {
  const file = event.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = async () => {
    const attachmentHtml = `<a href="${reader.result}" download="${file.name}" style="display:inline-block; margin:6px 0; padding:8px 10px; border-radius:6px; background-color:#eef6ff; color:#4571ec; text-decoration:none;">📎 ${file.name}</a>`
    await insertEditorHtml(attachmentHtml)
  }
  reader.onerror = () => alert('파일을 불러오지 못했습니다.')
  reader.readAsDataURL(file)
  event.target.value = ''
}

function resetForm() {
  form.value = { title: '', content: '', password: '', nickname: '', category: categories[0] }
  errors.value = { title: '', content: '', password: '' }
  editingId.value = null
  fontSizeValue.value = '3'
  textColorValue.value = '#111827'
  closeDeleteModal()
  cancelLinkModal()
  nextTick(() => setEditorContent(''))
}

function openPostDetail(post) {
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
  if (!value) return ''
  const d = new Date(value)
  const pad = n => String(n).padStart(2, '0')

  const yy = String(d.getFullYear()).slice(-2)       // '26'
  const mm = pad(d.getMonth() + 1)                   // '07'
  const dd = pad(d.getDate())                        // '15'
  const hh = pad(d.getHours())                       // '13'
  const min = pad(d.getMinutes())                    // '44'

  return `${yy}.${mm}.${dd} ${hh}:${min}`
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
    nextTick(() => { const el = document.getElementById('post-title'); el?.focus() })
    return
  }
  if (!plainContent) {
    errors.value.content = '내용을 입력해 주세요.'
    nextTick(() => editorRef.value?.focus())
    return
  }
  if (!password) {
    errors.value.password = '수정·삭제용 비밀번호를 입력해 주세요.'
    nextTick(() => passwordInputRef.value?.focus())
    return
  }

  if (editingId.value !== null) {
    const targetPost = posts.value.find(post => post.id === editingId.value)
    if (!targetPost) { alert('수정할 게시글을 찾을 수 없습니다.'); openListView(); return }
    if (targetPost.password !== password) { alert('비밀번호가 맞지 않습니다.'); return }
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
    category: categories.includes(post.category) ? post.category : categories[0]
  }
  currentView.value = 'write'
  closeDeleteModal()
  nextTick(() => setEditorContent(post.content || ''))
}

function openDeleteModal(post) {
  deleteTargetId.value = post.id
  deletePassword.value = ''
  deleteError.value = ''
}

function confirmDelete() {
  if (deleteTargetId.value === null) { deleteError.value = '삭제할 게시글을 찾을 수 없습니다.'; return }
  if (!deletePassword.value) { deleteError.value = '비밀번호를 입력해 주세요.'; return }

  const postIndex = posts.value.findIndex(post => post.id === deleteTargetId.value)
  if (postIndex === -1) { deleteError.value = '게시글을 찾을 수 없습니다.'; return }

  const post = posts.value[postIndex]
  if (post.password !== deletePassword.value) { deletePassword.value = ''; deleteError.value = '비밀번호가 일치하지 않습니다.'; return }

  const deletedPostId = post.id
  posts.value.splice(postIndex, 1)
  savePosts()
  closeDeleteModal()
  if (selectedPostId.value === deletedPostId) closePostDetail()
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
    <h3>서울Log ㅡ 우리 동네의 기록</h3>

    <!-- 게시글 목록 화면 -->
    <div v-if="currentView === 'list'">
      <div class="search-bar">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="검색어 입력"
          @keyup.enter="openSearchResults"
        >

        <select id="search-scope" class="custom-select search-scope-inline" v-model="searchScope">
          <option value="title">제목</option>
          <option value="nickname">닉네임</option>
          <option value="content">내용</option>
          <option value="all">제목 + 내용</option>
        </select>

        <button
          type="button"
          class="btn-search"
          @click="openSearchResults"
        >
          검색
        </button>
      </div>

      <div class="list-controls">
        <div class="category-filter">
          <label for="category-filter">카테고리</label>
          <select id="category-filter" class="custom-select" v-model="selectedCategoryFilter">
            <option value="all">전체</option>
            <option v-for="category in categories" :key="category" :value="category">{{ category }}</option>
          </select>
        </div>

        <div class="sort-controls">
          <label for="sort-mode">정렬</label>
          <select id="sort-mode" class="custom-select" v-model="sortMode">
            <option value="latest">최신순</option>
            <option value="likes">추천순</option>
            <option value="views">조회수순</option>
            <option value="oldest">오래된순</option>
          </select>
        </div>

        <label class="bookmark-filter">
          <input v-model="showBookmarksOnly" type="checkbox">
          북마크만 보기
        </label>
        <button type="button" class="btn-write" @click="openWriteForm"> ✏️ 글 작성</button>
      </div>

      <div v-if="displayedPosts.length" class="post-table-wrapper">
        <div class="post-table-header">
          <div class="col col-category">카테고리</div>
          <div class="col col-title">제목</div>
          <div class="col col-author">닉네임</div>
          <div class="col col-date">작성일</div>
          <div class="col col-views">조회수</div>
          <div class="col col-likes">추천수</div>
        </div>

        <div
          v-for="post in displayedPosts"
          :key="post.id"
          class="post-table-row"
          @click="openPostDetail(post)"
          role="button"
          tabindex="0"
          @keyup.enter="openPostDetail(post)"
        >
          <div class="col col-category">
            <span class="category-pill">{{ post.category }}</span>
          </div>

          <div class="col col-title">
            <button type="button" class="post-title-btn" @click.stop="openPostDetail(post)">{{ post.title }}</button>
          </div>

          <div class="col col-author">{{ post.nickname || '익명' }}</div>

          <div class="col col-date">{{ formatDate(post.createdAt) }}</div>

          <div class="col col-views">{{ post.views || 0 }}</div>

          <div class="col col-likes" aria-hidden="true">
            <span class="likes-display">👍 {{ post.likes || 0 }}</span>
          </div>
        </div>
      </div>
      

      <p v-else class="empty-message">표시할 게시글이 없습니다.</p>
    </div>

    <!-- 게시글 상세 화면 -->
    <div v-else-if="currentView === 'detail'" class="detail-view">
      <button type="button" class="btn-list" @click="closePostDetail">목록 보기</button>

      <div v-if="selectedPost" class="detail-post">
        <header class="detail-header">
          <h4 class="detail-title">{{ selectedPost.title }}</h4>

          <div class="detail-meta">
            <span class="nickname">{{ selectedPost.nickname || '익명' }}</span>
            <span class="category">{{ selectedPost.category }}</span>
            <small>{{ formatDate(selectedPost.createdAt) }} · 조회 {{ selectedPost.views || 0 }}</small>
          </div>
        </header>

        <div class="divider"></div>

        <div class="detail-content" v-html="selectedPost.content"></div>

        <div class="divider"></div>

        <!-- 본문 아래로 추천 버튼 이동 -->
        <div class="detail-like-row">
          <button type="button" class="detail-like-btn" :disabled="selectedPost.liked" @click="likePost(selectedPost)">
            👍 추천 {{ selectedPost.likes || 0 }}
          </button>
        </div>

        <div class="divider"></div>

        <!-- 수정/삭제 버튼은 오른쪽 하단에 위치 -->
        <div class="detail-stats-actions">
          <div class="detail-actions">
            <button type="button" @click="startEdit(selectedPost)" class="btn-small edit">수정</button>
            <button type="button" @click="openDeleteModal(selectedPost)" class="btn-small delete">삭제</button>

            <div v-if="deleteTargetId === selectedPost.id" class="delete-password-form">
              <p>게시글 비밀번호를 입력해 주세요.</p>
              <p v-if="deleteError" class="error-text">{{ deleteError }}</p>
              <input v-model="deletePassword" type="password" placeholder="비밀번호" @keyup.enter="confirmDelete">
              <div class="actions">
                <button type="button" @click="confirmDelete">삭제</button>
                <button type="button" @click="closeDeleteModal">취소</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <p v-else class="empty-message">게시글을 찾을 수 없습니다.</p>
    </div>

    <!-- 검색 결과 화면 -->
    <div v-else-if="currentView === 'search'" class="search-view">
      <button type="button" class="btn-list" @click="openSearchInput">목록 보기</button>

      <div class="search-result-header">
        <h4>검색 결과</h4>
        <p>검색어: {{ searchQuery }}</p>
      </div>

      <div v-if="searchedPosts.length">
        <div v-for="post in searchedPosts" :key="post.id" class="post">
          <div class="post-header">
            <div>
              <button type="button" class="post-title-btn" @click="openPostDetail(post)">{{ post.title }}</button>

              <div class="post-meta">
                <span class="nickname">{{ post.nickname || '익명' }}</span>
                <span class="category">{{ post.category }}</span>
                <small>{{ formatDate(post.createdAt) }} · 조회 {{ post.views || 0 }} · 추천 {{ post.likes || 0 }}</small>
              </div>
            </div>

            <button type="button" class="bookmark-btn" :aria-label="post.bookmarked ? '북마크 해제' : '북마크 추가'" @click="toggleBookmark(post)">{{ post.bookmarked ? '★' : '☆' }}</button>
          </div>

          <div class="content-body search-content-preview" v-html="post.content"></div>

          <div class="actions">
            <button type="button" @click="openPostDetail(post)">자세히 보기</button>
            <button type="button" @click="startEdit(post)">수정</button>
            <button type="button" @click="openDeleteModal(post)">삭제</button>
          </div>

          <div v-if="deleteTargetId === post.id" class="delete-password-form">
            <p>게시글 비밀번호를 입력해 주세요.</p>

            <p v-if="deleteError" class="error-text">{{ deleteError }}</p>

            <input v-model="deletePassword" type="password" placeholder="비밀번호" @keyup.enter="confirmDelete">

            <div class="actions">
              <button type="button" @click="confirmDelete">삭제</button>
              <button type="button" @click="closeDeleteModal">취소</button>
            </div>
          </div>
        </div>
      </div>

      <p v-else class="empty-message">검색 결과가 없습니다.</p>
    </div>

    <!-- 글 작성 및 수정 화면 -->
    <div v-else class="write-view">
      <button type="button" class="btn-list" @click="openListView">목록 보기</button>

      <form class="form" @submit.prevent="submitPost">
        <div class="form-group">
          <label for="post-title">제목</label>
          <input id="post-title" v-model="form.title" type="text" placeholder="제목을 입력하세요" @input="errors.title = ''" />
          <p v-if="errors.title" class="field-error">{{ errors.title }}</p>
        </div>

        <div class="form-group">
          <label for="post-nickname">닉네임</label>
          <input id="post-nickname" v-model="form.nickname" type="text" placeholder="닉네임을 입력하지 않으면 익명으로 표시됩니다">
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
            <button type="button" title="굵게" @click="applyEditorCommand('bold')"><strong>B</strong></button>
            <button type="button" title="기울임" @click="applyEditorCommand('italic')"><em>I</em></button>
            <button type="button" title="밑줄" @click="applyEditorCommand('underline')"><u>U</u></button>
            <button type="button" title="취소선" @click="applyEditorCommand('strikeThrough')"><s>S</s></button>

            <select v-model="fontSizeValue" title="글자 크기" @change="applyEditorCommand('fontSize', fontSizeValue)">
              <option value="1">아주 작게</option>
              <option value="2">작게</option>
              <option value="3">보통</option>
              <option value="4">조금 크게</option>
              <option value="5">크게</option>
              <option value="6">아주 크게</option>
              <option value="7">가장 크게</option>
            </select>

            <input v-model="textColorValue" type="color" class="color-picker" title="글자 색상" @input="applyTextColor(textColorValue)">

            <button type="button" title="왼쪽 정렬" @click="applyEditorCommand('justifyLeft')">≡</button>
            <button type="button" title="가운데 정렬" @click="applyEditorCommand('justifyCenter')">≡</button>
            <button type="button" title="오른쪽 정렬" @click="applyEditorCommand('justifyRight')">≡</button>

            <button type="button" title="글머리 기호" @click="applyEditorCommand('insertUnorderedList')">• 글머리 기호</button>
            <button type="button" title="번호 목록" @click="applyEditorCommand('insertOrderedList')">1. 목록 번호</button>

            <button type="button" title="링크 삽입" @mousedown.prevent="openLinkModal">🔗 링크</button>
            <button type="button" title="이미지 삽입" @mousedown.prevent="triggerImageUpload">🖼️ 이미지</button>
            <button type="button" title="파일 첨부" @mousedown.prevent="triggerFileUpload">📁 파일</button>

            <button type="button" title="서식 제거" @click="applyEditorCommand('removeFormat')">서식 제거</button>

            <input ref="imageInputRef" type="file" accept="image/*" class="hidden-file-input" @change="handleImageUpload">
            <input ref="fileInputRef" type="file" class="hidden-file-input" @change="handleFileUpload">
          </div>

          <div ref="editorRef" contenteditable="true" :class="['editor-area', { 'input-error': errors.content }]" data-placeholder="게시글 내용을 입력하세요" @input="onEditorInput" @blur="syncEditorContent"></div>
          <p v-if="errors.content" class="field-error">{{ errors.content }}</p>
        </div>

        <div class="form-group">
          <label for="post-password">수정·삭제용 비밀번호</label>
          <input id="post-password" ref="passwordInputRef" v-model="form.password" type="password" placeholder="..." @input="errors.password = ''" />
          <p v-if="errors.password" class="field-error">{{ errors.password }}</p>
        </div>

        <div class="actions form-actions">
          <button type="submit">{{ editingId !== null ? '수정하기' : '작성하기' }}</button>
          <button type="button" @click="openListView">취소</button>
        </div>
      </form>
    </div>

    <!-- 링크 삽입 모달 -->
    <div v-if="showLinkModal" class="link-modal" @mousedown.self="cancelLinkModal">
      <div class="link-dialog" role="dialog" aria-modal="true" aria-labelledby="link-modal-title" @mousedown.stop>
        <h4 id="link-modal-title">링크 삽입</h4>
        <label for="link-url">링크 주소</label>
        <input id="link-url" v-model="linkUrl" type="url" placeholder="https://example.com">
        <label for="link-text">표시할 글자</label>
        <input id="link-text" v-model="linkText" type="text" placeholder="입력하지 않으면 링크 주소가 표시됩니다" @keyup.enter="insertLinkFromModal">
        <div class="actions">
          <button type="button" @click="insertLinkFromModal">삽입</button>
          <button type="button" @click="cancelLinkModal">취소</button>
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
.card h3 { margin: 0 0 20px; color: #333333; }

button, input, select { font-family: inherit; }
button { cursor: pointer; }

input[type='text'], input[type='password'], input[type='url'], .search-bar input {
  width: 100%; box-sizing: border-box; padding: 10px; border: 1px solid #cccccc; border-radius: 4px; font-size: 14px;
}

input:focus, select:focus {
  outline: none; border-color: #2196f3; box-shadow: 0 0 5px rgba(33,150,243,0.3);
}

.btn-write, .btn-list, .btn-search {
  padding: 8px 16px; border: none; border-radius: 4px; color: #fff; font-weight: 500; white-space: nowrap; transition: background-color .2s, transform .2s;
}
.btn-write { background-color: #4caf50; } .btn-write:hover { background-color: #45a049; }
.btn-list { margin-bottom: 15px; background-color: #8c8e8f; } .btn-list:hover { background-color: #0b7dda; }
.btn-search { background-color: #ff9800; } .btn-search:hover { background-color: #f57c00; }

/* 페이지 하단 중앙에 고정된 "목록 보기" 버튼 */
.btn-list {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: 20px;
  z-index: 1000;
  padding: 10px 18px;
  border-radius: 999px;
  box-shadow: 0 6px 18px rgba(0,0,0,0.12);
}

/* 모바일에서 간격을 줄이거나 숨기려면 조정 */
@media (max-width: 600px) {
  .btn-list { bottom: 14px; padding: 8px 14px; }
}

.search-bar {display: flex; gap: 8px; align-items: center; margin-bottom: 10px;}
.search-bar input { flex:1; }

.search-scope { display:flex; align-items:center; gap:8px; margin:8px 0 12px; }
.search-scope label { color:#555; font-size:14px; }
.search-scope-inline { width: 100px; min-width: 120px;}

.list-controls { display:flex; flex-wrap:wrap; gap:12px; margin:8px 0 12px; align-items: center;}
/* 오른쪽으로 밀기 */
.list-controls .bookmark-filter { margin-left: auto;}
.list-controls .bookmark-filter { margin-left: 8px; /* 또는 0 — 간격 원하면 조정 */ }
.list-controls .btn-write { margin-left: auto; flex: 0 0 auto; padding: 8px 16px; }
.sort-controls, .category-filter { display:flex; align-items:center; gap:8px; }
.sort-controls label, .category-filter label { color:#555; font-size:14px; }

.custom-select {
  appearance: none; -webkit-appearance:none; -moz-appearance:none;
  background-color:#fff; border:1px solid #d1d5db; padding:8px 28px 8px 12px; border-radius:8px; font-size:14px; color:#111827;
  background-image: linear-gradient(45deg, transparent 50%, #6b7280 50%), linear-gradient(135deg, #6b7280 50%, transparent 50%), linear-gradient(to right, #f3f4f6, #f3f4f6);
  background-position: calc(100% - 18px) calc(1em + 2px), calc(100% - 12px) calc(1em + 2px), 0 0;
  background-size: 8px 8px, 8px 8px, 100% 100%; background-repeat: no-repeat; cursor:pointer;
}
.custom-select:focus { outline:none; border-color:#3b82f6; box-shadow:0 0 0 3px rgba(59,130,246,0.12); }

.bookmark-filter { display:flex; align-items:center; width:fit-content; margin:10px 0; cursor:pointer; }
.bookmark-filter input { margin-right:8px; }

/* New table-like list styles */
.post-table-wrapper { border:1px solid #eee; border-radius:8px; overflow:hidden; margin-top:12px; }
.post-table-header, .post-table-row {
  display:grid;
  grid-template-columns: 120px 1fr 120px 160px 80px 90px;
  align-items:center;
  gap:12px;
  padding:10px 14px;
}
.post-table-header { background:#fafafa; border-bottom:1px solid #eee; font-weight:700; color:#444; font-size:14px; }
.post-table-row { background:#fff; border-bottom:1px solid #f3f3f3; cursor:pointer; }
.post-table-row:hover { background:#fbfbff; }

.post-table-row .col { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.post-table-row .col-title { font-weight:600; color:#222; }

.category-pill { display:inline-block; padding:4px 8px; border-radius:999px; background:#eef6ff; color:#2563eb; font-size:13px; font-weight:600; }
.post-title-btn { padding:0; border:none; background:none; font:inherit; color:inherit; text-align:left; }
.like-small { padding:6px 8px; border-radius:6px; border:1px solid #e6e7ea; background:#fff; cursor:pointer; }
.like-small:disabled { opacity:0.6; cursor:default; }

/* Fallback older list styles (kept for search view rows) */
.post { margin:15px 0; padding:15px; border:1px solid #eee; border-radius:6px; background:#f9f9f9; }
.post-header { position:relative; display:flex; align-items:center; justify-content:space-between; min-height:40px; padding-right:100px; }

.post-title-btn { padding:0; border:none; background:none; color:#363636; font-size:16px; font-weight:600; text-align:left; }
.post-title-btn:hover { text-decoration:underline; }
.post-meta { display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin-top:5px; }
.nickname { color:#5a5a5a; font-size:13px; font-weight:600; }
.post-meta small { color:#999; font-size:12px; }

/* detail / editor styles kept from original (unchanged except minor spacing) */
.detail-view, .search-view, .write-view { margin-top:10px; }
.detail-post {
  position: relative;
  padding: 18px;
  border: 1px solid #eee;
  border-radius: 6px;
  background: #fafafa;
}
.detail-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.detail-title { margin: 0; font-size: 20px; color: #222; }
.detail-meta { color: #666; font-size: 13px; display:flex; gap:8px; align-items:center; }
.divider { height: 1px; background: #ececec; margin: 14px 0; }

/* 내용 영역 */
.detail-content { color: #444; line-height: 1.7; margin-bottom: 8px; }

/* 통계 + 액션 영역(하단) - 오른쪽 끝에 버튼 배치 */
.detail-stats-actions { display: flex; justify-content: space-between; align-items: center; gap: 12px; position: relative; }
.detail-stats { display:flex; align-items:center; gap:12px; }

/* 작은 버튼 스타일(상세 하단 버튼) */
.btn-small { padding: 8px 12px; border-radius:6px; border:1px solid #ddd; background:#fff; cursor:pointer; }
.btn-small:hover { background:#f5f5f5; }
.btn-danger { border-color:#f44336; background:#fef0ef; color:#b91c1c; }
.btn-danger:hover { background:#fdecea; }

/* 기존 큰 like 버튼 스타일(필요시 조정) */
.detail-like-btn { padding:8px 12px; border-radius:8px; border:1px solid #dbdcdd8a; background:#fff; font-weight:700; cursor:pointer; }

.detail-title-area { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
.detail-title-area h4 { margin:0; color:#333; font-size:21px; }
.detail-title-area .category {font-size: 12px; color: #666; font-weight: 600; margin-left: 8px;}
.detail-actions-inline { display:inline-flex; gap:10px; align-items:center; }
.detail-share, .detail-bookmark { display:inline-flex; align-items:center; gap:6px; padding:6px 10px; border:1px solid transparent; border-radius:6px; background:transparent; font-size:15px; cursor:pointer; color:#111827; }
.detail-share { color:#3b82f6; border-color:rgba(59,130,246,0.08); background:rgba(59,130,246,0.03); }
.detail-bookmark { color:#f4b400; border-color:rgba(244,180,0,0.08); background:rgba(244,180,0,0.03); }
.detail-like-wrapper { margin-top:18px; display:flex; justify-content:center; }
.detail-like-btn { display:inline-flex; align-items:center; gap:8px; padding:10px 16px; border-radius:8px; border:1px solid #dbdcdd8a; background:#ffffff96; color:#111827; font-weight:700; font-size:15px; cursor:pointer; transition:transform .12s, box-shadow .12s; }
.detail-like-btn:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 6px 20px rgba(0,0,0,0.08); }
.detail-like-btn:disabled { opacity:0.6; cursor:default; transform:none; box-shadow:none; }
.detail-stats-actions { display:flex; justify-content:space-between; align-items:center; gap:12px; }
.detail-stats { display:flex; align-items:center; justify-content:center; flex:1; }
/* 본문(.detail-content) 바로 다음 나오는 구분선만 숨김 */
.detail-content + .divider { display: none; }
/* 수정/삭제 버튼 스타일(색상 조정) */
.detail-actions { display:flex; gap:8px; align-items:center; justify-content:flex-end; }

/* 본문 바로 아래 추천 버튼 중앙 배치 */
.detail-like-row {
  display: flex;
  justify-content: center;
  margin: 10px 0;
}

.detail-like-row .detail-like-btn {
  padding: 10px 16px;
  border-radius: 8px;
  border: 1px solid #dbdcdd8a;
  background: #fff;
  font-weight:700;
  cursor: pointer;
}
.detail-like-row .detail-like-btn:disabled { opacity:0.6; cursor:default; }
.detail-post { position: relative; }

.detail-actions {
  position: static;
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: flex-end;
  width: 100%;
  margin-top: 8px;
}

.detail-actions .btn-small {
  padding:8px 12px;
  border-radius:6px;
  border:1px solid #cfd8dc;
  background:#ffffff;
  color:#1f2937; /* 수정 버튼 기본 텍스트 색 */
  box-shadow: none;
}

.detail-actions .btn-small:hover { background:#f3f4f6; }

/* 수정 버튼 (primary 스타일) */
.detail-actions .btn-small.edit {
  background: #219bff; /* 파란 배경 */
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.9);
}
.detail-actions .btn-small.edit:hover { background:#1e4fb8; }

/* 삭제 버튼 (danger 스타일) */
.detail-actions .btn-small.delete {
  background: #ec3030;
  color: #ffffff;
  border-color: #ffffff;
}
.detail-actions .btn-small.delete:hover { background:#fdecea; }



.sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }
.content-body { margin-top:18px; color:#444; line-height:1.7; overflow-wrap:anywhere; }
.content-body :deep(img) { display:block; max-width:100%; height:auto; margin:8px 0; border-radius:6px; }
.content-body :deep(a) { color:#4571ec; overflow-wrap:anywhere; }

.search-content-preview { max-height:180px; overflow:hidden; }

.actions { display:flex; gap:8px; margin-top:12px; }
.actions button { flex:1; padding:9px 12px; border:none; border-radius:4px; background:#eeeeee; color:#333; font-size:14px; transition:background-color .2s; }
.actions button:hover { background:#ddd; }

.delete-password-form { margin-top:12px; padding:12px; border:1px solid #ffc107; border-radius:4px; background:#fff3cd; }
.delete-password-form p { margin:0 0 10px; color:#856404; font-weight:500; }
.delete-password-form .error-text { color:#b91c1c; font-size:13px; }
.delete-password-form input { margin-bottom:4px; }
.delete-password-form .actions button:first-child { background:#ffc107; }
.delete-password-form .actions button:first-child:hover { background:#ffb300; }

.search-result-header { margin-bottom:12px; }
.search-result-header h4 { margin:0 0 4px; }
.search-result-header p { margin:0; color:#666; }

.form { display:flex; flex-direction:column; gap:16px; }
.form-group { display:flex; flex-direction:column; gap:7px; }
.form-group label, .editor-label { color:#444; font-size:14px; font-weight:600; }

.editor-toolbar { position:relative; z-index:20; display:flex; flex-wrap:wrap; gap:7px; padding:8px; border:1px solid #ddd; border-radius:6px 6px 0 0; background:#f8f9fa; }
.editor-toolbar button, .editor-toolbar select, .editor-toolbar input[type='color'] { min-height:34px; padding:6px 10px; border:1px solid #ccc; border-radius:4px; background:#fff; font-size:14px; }
.editor-toolbar button:hover { background:#eee; }

.color-picker { width:42px; height:34px; padding:2px !important; }

.editor-area { position:relative; z-index:10; min-height:200px; max-height:420px; padding:12px; overflow-y:auto; border:1px solid #ccc; border-top:none; border-radius:0 0 6px 6px; background:#fff; line-height:1.7; overflow-wrap:anywhere; }
.editor-area:focus { outline:none; border-color:#2196f3; box-shadow:0 2px 5px rgba(33,150,243,0.2); }
.editor-area:empty::before { color:#999; content:attr(data-placeholder); pointer-events:none; }
.editor-area :deep(img) { display:block; max-width:100%; height:auto; margin:8px 0; border-radius:6px; }

.hidden-file-input { display:none; }

.form-actions { margin-top:2px; }
.form-actions button { padding:12px; font-weight:600; }
.form-actions button:first-child { background:#4caf50; color:#fff; }
.form-actions button:first-child:hover { background:#45a049; }
.form-actions button:last-child { background:#f44336; color:#fff; }
.form-actions button:last-child:hover { background:#da190b; }

.link-modal { position:fixed; z-index:1000; inset:0; display:flex; align-items:center; justify-content:center; padding:12px; background:rgba(0,0,0,0.4); }
.link-dialog { width:360px; max-width:100%; padding:18px; border-radius:8px; background:#fff; box-shadow:0 6px 20px rgba(0,0,0,0.25); }
.link-dialog h4 { margin:0 0 15px; color:#333; font-size:18px; }
.link-dialog label { display:block; margin-top:10px; color:#555; font-size:13px; font-weight:600; }
.link-dialog input { margin-top:5px; }

.empty-message { margin:18px 0; padding:20px; border-radius:6px; background:#f7f7f7; color:#777; text-align:center; }

.input-error { border-color:#f44336 !important; box-shadow:0 0 0 3px rgba(244,67,54,0.08); }
.field-error { margin:4px 0 0; color:#b91c1c; font-size:15px; font-weight:700; }

/* 목록 글씨 크기 조정 */
.post-table-row .col { font-size: 13px; }            /* 전체 컬럼 기본 */
.post-table-row .col-title { font-size: 14px; }      /* 제목 (약간 크게 유지) */
.post-table-row .col-author,
.post-table-row .col-date { font-size: 12px; color: #666; } /* 작성자·작성일 작게, 옅은 색 */

.post-table-row .col-views,
.post-table-row .col-likes { font-size: 12px; color: #666; }

/* 카드형(검색 결과) 스타일도 함께 축소 */
.post .post-title-btn { font-size: 15px; } /* 기존 카드형 제목 */
.post .nickname,
.post .post-meta small { font-size: 12px; color: #666; }

/* 테이블 목록 제목 크기 강제 조정 */
.post-table-row .post-title-btn {
  font-size: 14px;
  line-height: 1.25;
  font-weight: 600;
}

.likes-display {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #666;
  pointer-events: none;
}

/* responsive */
@media (max-width: 820px) {
  .post-table-header { display: none; }
  .post-table-row { grid-template-columns: 1fr; padding:12px; gap:8px; }
  .post-table-row .col { white-space:normal; display:flex; justify-content:space-between; align-items:center; }
  .post-table-row .col-title { font-size:16px; }
  .post-table-row .col-author, .post-table-row .col-date, .post-table-row .col-views, .post-table-row .col-likes, .post-table-row .col-category { color:#666; font-size:13px; }
}

@media (max-width: 600px) {
  .detail-stats-actions { flex-direction: column; align-items: stretch; gap:8px; }
  .detail-actions { display:flex; gap:8px; justify-content:flex-end; }
}

@media (max-width: 600px) {
  .card { padding:14px; }
  .search-bar { flex-direction: column; align-items: stretch;}
  .btn-search { width:100%; }
  .search-scope { align-items:stretch; flex-direction:column; }
  .search-scope-inline { width: 100%;}
  .list-controls, .sort-controls, .category-filter { align-items:stretch; flex-direction:column; }
  .sort-controls select, .category-filter select { width:100%; }
  .editor-toolbar button, .editor-toolbar select { flex-grow:1; }
  .actions { flex-direction:column; }
  .detail-title-area { align-items:flex-start; }
}
/* 모바일: 카드 흐름으로 되돌림 */
@media (max-width: 600px) {
  .detail-actions {
    justify-content: flex-end;
  }
}

</style>