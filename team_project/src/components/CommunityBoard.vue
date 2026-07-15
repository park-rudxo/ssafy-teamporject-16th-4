<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'

const posts = ref([])

const form = ref({
  title: '',
  content: '',
  password: '',
  nickname: ''
})

const editingId = ref(null)

const searchQuery = ref('')
const searchScope = ref('all')
const showBookmarksOnly = ref(false)

const currentView = ref('list')
const selectedPostId = ref(null)

const deleteTargetId = ref(null)
const deletePassword = ref('')
const deleteError = ref('')

const editorRef = ref(null)
const imageInputRef = ref(null)
const fileInputRef = ref(null)

const fontSizeValue = ref('3')
const textColorValue = ref('#111827')

const showLinkModal = ref(false)
const linkUrl = ref('')
const linkText = ref('')
const savedRange = ref(null)

onMounted(() => {
  loadPosts()
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

  return (
    title.includes(query) ||
    content.includes(query) ||
    nickname.includes(query)
  )
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
      bookmarked: false,
      nickname: '익명',
      ...post
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
    nickname: ''
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
    alert('제목을 입력해 주세요.')
    return
  }

  if (!plainContent) {
    alert('내용을 입력해 주세요.')
    return
  }

  if (!password) {
    alert('수정·삭제용 비밀번호를 입력해 주세요.')
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
    targetPost.updatedAt = new Date().toISOString()
  } else {
    posts.value.unshift({
      id: Date.now(),
      title,
      content: content.trim(),
      password,
      nickname,
      createdAt: new Date().toISOString(),
      bookmarked: false
    })
  }

  savePosts()
  openListView()
}

function startEdit(post) {
  editingId.value = post.id

  form.value = {
    title: post.title,
    content: post.content || '',
    password: '',
    nickname: post.nickname || ''
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
          <option value="all">제목 + 내용 + 닉네임</option>
        </select>
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
        v-if="filteredPosts.length"
        class="post-list"
      >
        <div
          v-for="post in filteredPosts"
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

                <small>
                  {{ formatDate(post.createdAt) }}
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

              <small>
                {{ formatDate(selectedPost.createdAt) }}
              </small>
            </div>
          </div>

          <button
            type="button"
            class="detail-bookmark-btn"
            :aria-label="
              selectedPost.bookmarked
                ? '북마크 해제'
                : '북마크 추가'
            "
            @click="toggleBookmark(selectedPost)"
          >
            {{ selectedPost.bookmarked ? '★' : '☆' }}
          </button>
        </div>

        <div
          class="content-body"
          v-html="selectedPost.content"
        ></div>

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

                <small>
                  {{ formatDate(post.createdAt) }}
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

          <input
            id="post-title"
            v-model="form.title"
            type="text"
            placeholder="제목을 입력하세요"
          >
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

          <div
            ref="editorRef"
            contenteditable="true"
            class="editor-area"
            data-placeholder="게시글 내용을 입력하세요"
            @input="syncEditorContent"
            @blur="syncEditorContent"
          ></div>
        </div>

        <div class="form-group">
          <label for="post-password">
            수정·삭제용 비밀번호
          </label>

          <input
            id="post-password"
            v-model="form.password"
            type="password"
            placeholder="게시글 수정과 삭제에 사용할 비밀번호"
          >
        </div>

        <div class="actions form-actions">
          <button type="submit">
            {{ editingId ? '수정하기' : '작성하기' }}
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
  align-items: flex-start;
  justify-content: space-between;
  min-height: 30px;
  padding-right: 40px;
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

.bookmark-btn {
  position: absolute;
  top: 0;
  right: 0;
  padding: 0;
  border: none;
  background: transparent;
  color: #f4b400;
  font-size: 22px;
  transition: transform 0.2s ease;
}

.bookmark-btn:hover {
  transform: scale(1.15);
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

.detail-bookmark-btn {
  padding: 0;
  border: none;
  background: transparent;
  color: #f4b400;
  font-size: 25px;
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