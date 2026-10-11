import { createApp } from "vue";
import OptionsApp from "./OptionsApp.vue";
import { watchExtensionContext } from "@/bootstrap";
import "@/styles/tokens.css";
import "@/styles/base.css";

watchExtensionContext();

createApp(OptionsApp).mount("#app");
