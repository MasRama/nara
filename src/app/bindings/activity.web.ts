import type { RouteRecordRaw } from 'vue-router';
import { ActivityPage } from '../../features/activity/web';

// Application-owned route placement for Activity.
export default [
  {
    path: '/activity',
    name: 'activity',
    component: ActivityPage,
    meta: { requiresAuth: true, requiresPermission: 'activity.view', nav: { label: 'Activity' } },
  },
] satisfies RouteRecordRaw[];
