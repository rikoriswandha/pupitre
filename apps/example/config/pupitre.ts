import { join } from 'node:path'
import app from '@adonisjs/core/services/app'
import { mkdir, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { defineConfig } from '@rikology/pupitre'
import { transmitRealtime } from '@rikology/pupitre-transmit'
import { auditAdapter } from '@rikology/pupitre/drivers/audit'
import { jobsAdapter } from '@rikology/pupitre/drivers/queue'

export default defineConfig({
  cache: { dev: false },
  jobs: jobsAdapter(),
  timezone: 'UTC',
  i18n: {
    fallbackLocale: 'en',
    messages: {
      id: {
        'Settings': 'Pengaturan',
        'General': 'Umum',
        'Site name': 'Nama situs',
        'Maintenance mode': 'Mode pemeliharaan',
        'Default theme': 'Tema bawaan',
        'Light': 'Terang',
        'Dark': 'Gelap',
        'System': 'Sistem',
        'Editor configuration': 'Konfigurasi editor',
        'Clear cache': 'Bersihkan cache',
        'Clear cached settings?': 'Bersihkan cache pengaturan?',
        'Settings cache invalidated': 'Cache pengaturan dibersihkan',
        'Workspace settings': 'Pengaturan ruang kerja',
        'Workspace name': 'Nama ruang kerja',
        'Accept submissions': 'Terima kiriman',
        'Comment': 'Komentar',
        'Comments': 'Komentar',
        'Title': 'Judul',
        'Body': 'Isi',
        'Post': 'Kiriman',
        'Rating': 'Penilaian',
        'No rating': 'Tanpa penilaian',
        '{count} of {max} stars': '{count} dari {max} bintang',
        'Rate comment': 'Nilai komentar',
        'Save rating': 'Simpan penilaian',
        'Rating saved': 'Penilaian tersimpan',
        'Use arrow keys to choose a rating, or clear it with No rating.':
          'Gunakan tombol panah untuk memilih penilaian, atau pilih Tanpa penilaian untuk mengosongkannya.',
        'Rating criteria': 'Kriteria penilaian',
        'Criterion': 'Kriteria',
        'Criterion rating': 'Nilai kriteria',
        'Add criterion': 'Tambah kriteria',
      },
    },
  },
  storage: { disk: 'uploads' },
  auth: { model: () => import('#models/user') },
  realtime: transmitRealtime(),
  audit: auditAdapter(),
  mail: async () => ({
    async send(message) {
      const directory = process.env.PUPITRE_MAIL_DIR ?? app.makePath('tmp/mails')
      await mkdir(directory, { recursive: true })
      await writeFile(join(directory, `${randomUUID()}.json`), JSON.stringify(message, null, 2))
    },
  }),
  notifications: async () => {
    const { notificationsAdapter } = await import('@rikology/pupitre/drivers/notifications')
    return notificationsAdapter()
  },
})
