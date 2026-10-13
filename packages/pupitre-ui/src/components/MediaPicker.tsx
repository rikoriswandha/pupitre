import { lazy, Suspense } from 'react'
import { t } from '@rikology/pupitre-react'
import type { MediaPickerProps } from './MediaPickerContent.js'
const Content = lazy(() => import('./MediaPickerContent.js'))
export function MediaPicker(props: MediaPickerProps) {
  return (
    <Suspense fallback={<span role="status">{t('Loading media')}</span>}>
      <Content {...props} />
    </Suspense>
  )
}
