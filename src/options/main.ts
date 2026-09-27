import { createApp } from "vue";
import OptionsApp from "./OptionsApp.vue";
import { watchExtensionContext } from "@/bootstrap";
import "@/styles/tokens.css";
import "@/styles/base.css";

// This page is where settings are written, so it is the one that has to be
// sure its writes still land: a zombie options tab saves nothing at all.
watchExtensionContext();

createApp(OptionsApp).mount("#app");
