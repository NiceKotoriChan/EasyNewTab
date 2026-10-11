<script setup lang="ts">
import type { Component } from "vue";
import BookmarkTree from "@/components/BookmarkTree.vue";
import HistoryList from "@/components/HistoryList.vue";
import type { SidePaneId } from "@/core/panels";

const PANES: Record<SidePaneId, Component> = {
  bookmarks: BookmarkTree,
  history: HistoryList,
};

const props = defineProps<{ panel: SidePaneId }>();
</script>

<template>
  <component :is="PANES[props.panel]" />
</template>
