import { createApp } from "vue";
import App from "./App.vue";
import { watchExtensionContext } from "@/bootstrap";
import "@/styles/tokens.css";
import "@/styles/base.css";

// A page opened before the extension reloaded or updated is a zombie whose listeners are all dead — watch for that and reload.
watchExtensionContext();

createApp(App).mount("#app");
