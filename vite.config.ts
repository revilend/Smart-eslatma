import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Freebuff preview: HMR o'chirilgan bo'lishi shart
    hmr: false,
    // Preview proksi orqidan kelayotgan haqiqiy host nomini qabul qilamiz,
    // aks holda Vite "Blocked request" xatosini beradi.
    allowedHosts: true,
  },
})
