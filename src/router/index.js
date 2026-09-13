import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import RoutesView from '../views/RoutesView.vue'
import EventsView from '../views/EventsView.vue'
import LoginView from '../views/LoginView.vue'
import RegisterView from '../views/RegisterView.vue'
import AccountView from '../views/AccountView.vue'
import AdminView from '../views/AdminView.vue'
import AccessDeniedView from '../views/AccessDeniedView.vue'
import { useAuth } from '../services/auth'

const { currentUser } = useAuth()

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/routes', name: 'routes', component: RoutesView },
    { path: '/events', name: 'events', component: EventsView },
    { path: '/login', name: 'login', component: LoginView },
    { path: '/register', name: 'register', component: RegisterView },
    { path: '/account', name: 'account', component: AccountView, meta: { requiresAuth: true } },
    { path: '/admin', name: 'admin', component: AdminView, meta: { requiresAuth: true, role: 'admin' } },
    { path: '/access-denied', name: 'access-denied', component: AccessDeniedView },
  ],
})

router.beforeEach((to) => {
  if (to.meta.requiresAuth && !currentUser.value) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.meta.role && currentUser.value?.role !== to.meta.role) {
    return { name: 'access-denied' }
  }
})

export default router
