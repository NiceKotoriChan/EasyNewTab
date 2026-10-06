<script setup lang="ts">
// The one place a side panel's id becomes a component. It renders no element of its own, so the
// class, the width and the `data-panel` a shell passes land on the pane's own root — which is what
// the shell's flex rules measure.
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
  <component :is="PANES[props.panel]" :data-panel="props.panel" />
</template>
