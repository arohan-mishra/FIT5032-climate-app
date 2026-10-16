import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './assets/main.css'
import { authReady } from './services/auth'

const app = createApp(App)

await authReady
app.use(router)

app.mount('#app')
