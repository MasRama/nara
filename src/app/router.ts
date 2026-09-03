import { createRouter, createWebHistory } from 'vue-router';
import { LoginPage, RegisterPage, RolesPage, useAuthSession } from '../features/auth/web';
import { ProfilePage, UsersPage } from '../features/users/web';
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
    {
      path: '/users',
      name: 'users',
      component: UsersPage,
      meta: { requiresAuth: true, requiresPermission: 'users.view' },
    },
    {
      path: '/roles',
      name: 'roles',
      component: RolesPage,
      meta: { requiresAuth: true, requiresPermission: 'roles.view' },
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
  const requiredPermission = to.meta.requiresPermission;
  if (typeof requiredPermission === 'string' && !authSession.can(requiredPermission)) {
    return { name: 'dashboard' };
  }

  if (to.meta.guestOnly && authSession.isAuthenticated.value) {
    return { name: 'dashboard' };
  }

  return true;
});

export default router;
