import { defineTheme } from '@rikology/pupitre'

export default defineTheme({
  font: {
    family: 'Inter, ui-sans-serif, system-ui',
    url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  },
  density: 'compact',
  sidebar: 'expanded',
  sidebarCollapsibleOnDesktop: true,
  contentWidth: '7xl',
  darkMode: 'system',
  // L=0.50 keeps primary text ≥4.5:1 on the tinted active-nav and muted badge backgrounds.
  primary: 'oklch(0.5 0.18 255)',
  radius: '0.5rem',
})
