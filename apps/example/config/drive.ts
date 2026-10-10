import app from '@adonisjs/core/services/app'
import { defineConfig, services } from '@adonisjs/drive'

export default defineConfig({
  default: 'uploads',
  services: {
    uploads: services.fs({
      location: app.makePath('storage/uploads'),
      visibility: 'public',
      serveFiles: true,
      routeBasePath: '/uploads',
    }),
    private: services.fs({
      location: app.makePath('storage/private'),
      visibility: 'private',
    }),
  },
})
