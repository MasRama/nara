import { createRouter, createWebHistory } from 'vue-router';
import { LoginPage, RegisterPage, useAuthSession } from '../features/auth/web';
import { ProfilePage } from '../features/users/web';
import DashboardPage from './pages/DashboardPage.vue';
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
      meta: { guestOnly: true },
    },
    {
      path: '/register',
      name: 'register',
      component: RegisterPage,
      meta: { guestOnly: true },
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: DashboardPage,
      meta: { requiresAuth: true },
    },
    {
      path: '/profile',
      name: 'profile',
      component: ProfilePage,
      meta: { requiresAuth: true },
    },
  ],
});

const authSession = useAuthSession();

router.beforeEach(async (to) => {
  await authSession.load();

  if (to.meta.requiresAuth && !authSession.isAuthenticated.value) {
    return {
      name: 'login',
      query: { redirect: to.fullPath },
    };
  }

  if (to.meta.guestOnly && authSession.isAuthenticated.value) {
    return { name: 'dashboard' };
  }

  return true;
});

export default router;
