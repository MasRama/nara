import './index.css';
import { createApp } from 'vue';
import App from '../src/app/App.vue';
import router from '../src/app/router';
import { initializeLocale } from '../src/shared/i18n';

// Feature dictionaries register while the router imports their pages; the
// detected locale loads before the first render so no page flashes English.
void initializeLocale().finally(() => createApp(App).use(router).mount('#app'));
