import { Infolist } from '../../../src/components/Infolist.js'
import { TextEntry } from '../../../src/components/TextEntry.js'

/** A record with mostly blank optional fields, like an order that has not shipped yet. */
export function SparseRecordStory({ empties = 4 }: { empties?: number }) {
  return (
    <Infolist>
      <TextEntry props={{ label: 'Order', value: '6336' }} />
      <TextEntry props={{ label: 'Status', value: 'Completed' }} />
      {Array.from({ length: empties }, (_, index) => (
        <TextEntry key={index} props={{ label: `Optional ${index + 1}`, value: null }} />
      ))}
    </Infolist>
  )
}
