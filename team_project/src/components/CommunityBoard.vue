<script setup>
import { onMounted, ref } from 'vue'

const posts = ref([])
const form = ref({ title: '', content: '', password: '' })
const editingId = ref(null)

onMounted(() => {
  loadPosts()
})

function loadPosts() {
  try {
    posts.value = JSON.parse(localStorage.getItem('localhub-posts') || '[]')
  } catch {
    posts.value = []
  }
}

function savePosts() {
  localStorage.setItem('localhub-posts', JSON.stringify(posts.value))
}

function resetForm() {
  form.value = { title: '', content: '', password: '' }
  editingId.value = null
}

function submitPost() {
  if (!form.value.title || !form.value.content || !form.value.password) return

  const payload = {
    id: editingId.value || Date.now(),
    title: form.value.title.trim(),
    content: form.value.content.trim(),
    password: form.value.password,
    createdAt: new Date().toISOString()
  }

  if (editingId.value) {
    posts.value = posts.value.map(post => post.id === editingId.value ? payload : post)
  } else {
    posts.value.unshift(payload)
  }

  savePosts()
  resetForm()
}

function startEdit(post) {
  editingId.value = post.id
  form.value = { title: post.title, content: post.content, password: '' }
}

function deletePost(post) {
  const input = prompt('삭제 비밀번호를 입력하세요')
  if (input === post.password) {
    posts.value = posts.value.filter(p => p.id !== post.id)
    savePosts()
  } else {
    alert('비밀번호가 일치하지 않습니다.')
  }
}
</script>

<template>
  <section class="card">
    <h3>익명 커뮤니티</h3>

    <form class="form" @submit.prevent="submitPost">
      <input v-model="form.title" placeholder="제목" />
      <textarea v-model="form.content" placeholder="내용"></textarea>
      <input v-model="form.password" type="password" placeholder="수정/삭제용 비밀번호" />
      <button type="submit">{{ editingId ? '수정하기' : '작성하기' }}</button>
    </form>

    <div v-for="post in posts" :key="post.id" class="post">
      <div class="post-header">
        <strong>{{ post.title }}</strong>
        <small>{{ new Date(post.createdAt).toLocaleString() }}</small>
      </div>
      <p>{{ post.content }}</p>
      <div class="actions">
        <button @click="startEdit(post)">수정</button>
        <button @click="deletePost(post)">삭제</button>
      </div>
    </div>
  </section>
</template>