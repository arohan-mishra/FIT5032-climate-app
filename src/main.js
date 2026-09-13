import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './assets/main.css'
import { ensureDemoAccounts } from './services/auth'

const app = createApp(App)

await ensureDemoAccounts()
app.use(router)

app.mount('#app')
