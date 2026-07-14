<script setup>
defineProps({
  region: Object
})
</script>

<template>
  <section class="card">
    <h2>{{ region.name }}</h2>
    <p>{{ region.description }}</p>
    <ul>
      <li v-for="item in region.highlights" :key="item">{{ item }}</li>
    </ul>
  </section>
</template>