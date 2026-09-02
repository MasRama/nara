import { createRouter, createWebHistory } from 'vue-router';
import { LoginPage } from '../features/auth/web';
import HomePage from './pages/HomePage.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomePage,
    },
    {
      path: '/login',
      name: 'login',
      component: LoginPage,
    },
  ],
});

export default router;
