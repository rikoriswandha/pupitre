import type { ComponentProps } from 'react'
import { Pupitre } from '@rikology/pupitre-react'
import { registry } from '../admin/registry.js'

export default function PupitrePage(props: ComponentProps<typeof Pupitre>) {
  return <Pupitre {...props} registry={registry} />
}