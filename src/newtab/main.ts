import { createApp } from "vue";
import App from "./App.vue";
import { watchExtensionContext } from "@/bootstrap";
import "@/styles/tokens.css";
import "@/styles/base.css";
import "@/styles/shell.css";

watchExtensionContext();

createApp(App).mount("#app");
