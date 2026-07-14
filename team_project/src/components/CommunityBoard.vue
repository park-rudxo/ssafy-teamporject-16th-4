<script setup>
import { onMounted, ref, computed } from 'vue'

const posts = ref([])
const form = ref({ title: '', content: '', password: '', nickname: '' })
const editingId = ref(null)
const searchQuery = ref('')
const showBookmarksOnly = ref(false)
const currentView = ref('list')
const deletePassword = ref('')
const deleteTargetId = ref(null)

const filteredPosts = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  const base = showBookmarksOnly.value
    ? posts.value.filter(post => post.bookmarked)
    : posts.value

  if (!query) return base

  return base.filter(post => {
    const title = post.title?.toLowerCase() || ''
    const content = post.content?.toLowerCase() || ''
    const nickname = (post.nickname || '익명').toLowerCase()
    return title.includes(query) || content.includes(query) || nickname.includes(query)
  })
})

onMounted(() => {
  loadPosts()
})

function loadPosts() {
  try {
    posts.value = JSON.parse(localStorage.getItem('localhub-posts') || '[]').map(post => ({
      bookmarked: false,
      nickname: '익명',
      ...post
    }))
  } catch {
    posts.value = []
  }
}

function savePosts() {
  localStorage.setItem('localhub-posts', JSON.stringify(posts.value))
}

function resetForm() {
  form.value = { title: '', content: '', password: '', nickname: '' }
  editingId.value = null
}

function openWriteForm() {
  resetForm()
  currentView.value = 'write'
}

function openListView() {
  resetForm()
  currentView.value = 'list'
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : ''
}

function submitPost() {
  if (!form.value.title || !form.value.content || !form.value.password) return

  const nickname = (form.value.nickname || '').trim() || '익명'

  if (editingId.value) {
    const target = posts.value.find(post => post.id === editingId.value)
    if (!target || target.password !== form.value.password) {
      alert('비밀번호가 맞지 않습니다.')
      return
    }

    target.title = form.value.title.trim()
    target.content = form.value.content.trim()
    target.nickname = nickname
  } else {
    posts.value.unshift({
      id: Date.now(),
      title: form.value.title.trim(),
      content: form.value.content.trim(),
      password: form.value.password,
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
    content: post.content,
    password: '',
    nickname: post.nickname || ''
  }
  currentView.value = 'write'
}

function openDeleteModal(post) {
  deleteTargetId.value = post.id
  deletePassword.value = ''
}

function confirmDelete() {
  if (!deleteTargetId.value) {
    alert('삭제할 게시글을 찾을 수 없습니다.')
    closeDeleteModal()
    return
  }

  if (!deletePassword.value) {
    alert('비밀번호를 입력하세요.')
    return
  }

  const postIndex = posts.value.findIndex(p => p.id === deleteTargetId.value)

  if (postIndex === -1) {
    alert('게시글을 찾을 수 없습니다.')
    closeDeleteModal()
    return
  }

  const post = posts.value[postIndex]

  if (post.password !== deletePassword.value) {
    alert('비밀번호가 일치하지 않습니다.')
    deletePassword.value = ''
    return
  }

  posts.value.splice(postIndex, 1)
  savePosts()
  alert('게시글이 삭제되었습니다.')
  closeDeleteModal()
}

function closeDeleteModal() {
  deletePassword.value = ''
  deleteTargetId.value = null
}

function toggleBookmark(post) {
  post.bookmarked = !post.bookmarked
  savePosts()
}
</script>

<template>
  <section class="card">
    <h3>익명 커뮤니티</h3>

    <div v-if="currentView === 'list'">
      <input v-model="searchQuery" placeholder="검색어 입력" />
      <label>
        <input type="checkbox" v-model="showBookmarksOnly" />
        북마크만 보기
      </label>
      <button type="button" @click="openWriteForm" class="btn-write">글 작성</button>

      <div v-for="post in filteredPosts" :key="post.id" class="post">
        <div class="post-header">
          <div>
            <strong>{{ post.title }}</strong>
            <div class="post-meta">
              <span class="nickname">{{ post.nickname || '익명' }}</span>
              <small>{{ formatDate(post.createdAt) }}</small>
            </div>
          </div>

          <button
            type="button"
            class="bookmark-btn"
            @click="toggleBookmark(post)"
            :aria-label="post.bookmarked ? '북마크 해제' : '북마크 추가'"
          >
            {{ post.bookmarked ? '★' : '☆' }}
          </button>
        </div>

        <p>{{ post.content }}</p>

        <div class="actions">
          <button type="button" @click="startEdit(post)">수정</button>
          <button type="button" @click="openDeleteModal(post)">삭제</button>
        </div>

        <div v-if="deleteTargetId === post.id" class="delete-password-form">
          <p>비밀번호를 입력하세요:</p>
          <input v-model="deletePassword" type="password" placeholder="비밀번호" />
          <div class="actions">
            <button type="button" @click="confirmDelete">삭제</button>
            <button type="button" @click="closeDeleteModal">취소</button>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="write-view">
      <button type="button" @click="openListView" class="btn-list">목록 보기</button>

      <form class="form" @submit.prevent="submitPost">
        <div class="form-group">
          <input v-model="form.title" placeholder="제목" />
        </div>
        <div class="form-group">
          <input v-model="form.nickname" placeholder="닉네임 (선택)" />
        </div>
        <textarea v-model="form.content" placeholder="내용"></textarea>
        <input v-model="form.password" type="password" placeholder="수정/삭제용 비밀번호" />

        <div class="actions">
          <button type="submit">{{ editingId ? '수정하기' : '작성하기' }}</button>
          <button type="button" @click="openListView">취소</button>
        </div>
      </form>
    </div>
  </section>
</template>

<style scoped>
.btn-write,
.btn-list {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  color: white;
  transition: background-color 0.3s ease;
}

.btn-write {
  background-color: #4CAF50;
}

.btn-write:hover {
  background-color: #45a049;
}

.btn-list {
  background-color: #2196F3;
}

.btn-list:hover {
  background-color: #0b7dda;
}

.card {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 20px;
  margin: 10px 0;
  background-color: #fff;
}

.card h3 {
  margin: 0 0 20px 0;
  color: #333;
}

input[type="text"],
input[type="password"],
textarea {
  width: 100%;
  padding: 10px;
  margin: 8px 0;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-family: inherit;
  font-size: 14px;
  box-sizing: border-box;
}

textarea {
  resize: vertical;
  min-height: 100px;
}

input[type="text"]:focus,
input[type="password"]:focus,
textarea:focus {
  outline: none;
  border-color: #2196F3;
  box-shadow: 0 0 5px rgba(33, 150, 243, 0.3);
}

label {
  display: flex;
  align-items: center;
  margin: 10px 0;
  cursor: pointer;
}

label input[type="checkbox"] {
  margin-right: 8px;
  cursor: pointer;
}

.post {
  border: 1px solid #eee;
  border-radius: 6px;
  padding: 15px;
  margin: 15px 0;
  background-color: #f9f9f9;
}

.post-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  position: relative;
  padding-right: 40px;
}

.post-header strong {
  font-size: 16px;
  color: #333;
}

.post-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.nickname {
  font-size: 13px;
  color: #000000;
  font-weight: 600;
}

.post-header small {
  color: #999;
  font-size: 12px;
}

.post p {
  margin: 10px 0;
  color: #555;
  line-height: 1.5;
}

.actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.actions button {
  flex: 1;
  padding: 8px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  background-color: #f0f0f0;
  color: #333;
  font-size: 14px;
  transition: background-color 0.2s ease;
}

.actions button:hover {
  background-color: #e0e0e0;
}

.bookmark-btn {
  position: absolute;
  top: 0;
  right: 0;
  border: none;
  background: transparent;
  font-size: 22px;
  cursor: pointer;
  color: #f4b400;
  padding: 0;
}

.bookmark-btn:hover {
  transform: scale(1.1);
}

.delete-password-form {
  background-color: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 4px;
  padding: 12px;
  margin-top: 10px;
}

.delete-password-form p {
  margin: 0 0 10px 0;
  color: #856404;
  font-weight: 500;
}

.delete-password-form input {
  margin-bottom: 10px;
}

.delete-password-form .actions button {
  background-color: #ffc107;
  color: #333;
}

.delete-password-form .actions button:hover {
  background-color: #ffb300;
}

.write-view {
  margin-top: 20px;
}

.write-view > button {
  margin-bottom: 15px;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form .actions {
  margin-top: 15px;
}

.form .actions button {
  flex: 1;
  padding: 12px;
  background-color: #f0f0f0;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: background-color 0.2s ease;
}

.form .actions button:first-child {
  background-color: #4CAF50;
  color: white;
}

.form .actions button:first-child:hover {
  background-color: #45a049;
}

.form .actions button:last-child {
  background-color: #f44336;
  color: white;
}

.form .actions button:last-child:hover {
  background-color: #da190b;
}
</style>