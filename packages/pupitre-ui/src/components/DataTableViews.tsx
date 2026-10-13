import { useCallback, useState } from 'react'
import { Popover } from '@base-ui/react/popover'
import { Dialog } from '@base-ui/react/dialog'
import type { TableDescriptor, TableViewDescriptor } from '@rikology/pupitre/catalog'
import { t, useTableViews } from '@rikology/pupitre-react'
import {
  Button,
  Input,
  CheckboxControl,
  dialogPopupClasses,
  cn,
  popupClasses,
  positionerClasses,
  backdropClasses,
} from '../primitives/index.js'
import { Icon } from '../icons.js'

export function DataTableViews({
  descriptor,
  query,
  columns,
  onColumns,
}: {
  descriptor: TableDescriptor
  query: Record<string, unknown>
  columns: Record<string, boolean>
  onColumns: (columns: Record<string, boolean>) => void
}) {
  const applyColumns = useCallback(
    (saved: Record<string, boolean>) => {
      onColumns(
        Object.fromEntries(
          descriptor.columns.map((column) => [
            column.name,
            saved[column.name] ?? !column.toggleable?.hiddenByDefault,
          ])
        )
      )
    },
    [descriptor.columns, onColumns]
  )
  const views = useTableViews(descriptor, applyColumns)
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'save' | 'rename' | 'delete' | null>(null)
  const [editing, setEditing] = useState<TableViewDescriptor>()
  const [name, setName] = useState('')
  const [isPublic, setPublic] = useState(false)
  const [isDefault, setDefault] = useState(false)
  const payload = (view?: TableViewDescriptor) => ({
    name: view?.name ?? name,
    query: view?.query ?? query,
    columns: view?.columns ?? columns,
    isPublic: view?.isPublic ?? isPublic,
    isDefault: view?.isDefault ?? isDefault,
  })
  const begin = (next: 'save' | 'rename' | 'delete', view?: TableViewDescriptor) => {
    setEditing(view)
    setName(view?.name ?? '')
    setPublic(view?.isPublic ?? false)
    setDefault(view?.isDefault ?? false)
    setMode(next)
    setOpen(false)
  }
  const selected = views.active
  const canEdit = selected?.editable && (!selected.isPublic || descriptor.views?.canManagePublic)
  return (
    <>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger render={<Button variant="outline" size="sm" />}>
          <Icon name="bookmark" className="size-4" />
          {t('Views')}
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner className={positionerClasses} sideOffset={8} align="end">
            <Popover.Popup
              data-pupitre-popup=""
              className={cn(popupClasses, 'w-72 p-3')}
              aria-label={t('Views')}
            >
              {(['preset', 'public', 'mine'] as const).map((source) => (
                <div key={source} className="mb-3 grid gap-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    {source === 'preset'
                      ? t('Preset views')
                      : source === 'public'
                        ? t('Public views')
                        : t('My views')}
                  </p>
                  {views.items
                    .filter((view) => view.source === source)
                    .map((view) => (
                      <Button
                        key={view.id}
                        variant="ghost"
                        size="sm"
                        className="justify-start"
                        aria-pressed={selected?.id === view.id}
                        onClick={() => {
                          views.apply(view)
                          setOpen(false)
                        }}
                      >
                        {view.icon && <Icon name={view.icon} className="size-4" />}
                        {view.name}
                        {view.isDefault && <span className="text-xs">{t('Default')}</span>}
                        {selected?.id === view.id && (
                          <Icon name="check" className="ml-auto size-4" />
                        )}
                      </Button>
                    ))}
                </div>
              ))}
              {descriptor.views?.enabled && (
                <Button size="sm" variant="outline" onClick={() => begin('save')}>
                  {t('Save current view')}
                </Button>
              )}
              {canEdit && selected && (
                <div className="mt-3 grid gap-1 border-t border-border pt-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={views.busy}
                    onClick={() =>
                      void views.mutate('PUT', { ...payload(selected), query, columns }, selected)
                    }
                  >
                    {t('Update view')}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => begin('rename', selected)}>
                    {t('Rename view')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={views.busy}
                    onClick={() =>
                      void views.mutate(
                        'PUT',
                        { ...payload(selected), isDefault: !selected.isDefault },
                        selected
                      )
                    }
                  >
                    {selected.isDefault ? t('Unset default view') : t('Set default view')}
                  </Button>
                  {descriptor.views?.canManagePublic && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={views.busy}
                      onClick={() =>
                        void views.mutate(
                          'PUT',
                          { ...payload(selected), isPublic: !selected.isPublic },
                          selected
                        )
                      }
                    >
                      {selected.isPublic ? t('Make view private') : t('Make view public')}
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => begin('delete', selected)}>
                    {t('Delete view')}
                  </Button>
                </div>
              )}
              {views.error && (
                <p role="alert" className="mt-2 text-sm text-destructive">
                  {views.error}
                </p>
              )}
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
      <Dialog.Root
        open={mode !== null}
        onOpenChange={(next) => {
          if (!next) setMode(null)
        }}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className={backdropClasses} />
          <Dialog.Popup data-pupitre-popup="" className={cn(dialogPopupClasses('sm'), 'p-6')}>
            <Dialog.Title className="mb-2 text-lg font-semibold">
              {mode === 'delete'
                ? t('Delete view')
                : mode === 'rename'
                  ? t('Rename view')
                  : t('Save current view')}
            </Dialog.Title>
            <Dialog.Description className="mb-4 text-sm text-muted-foreground">
              {mode === 'delete'
                ? t('Delete this saved view? This cannot be undone.')
                : t('Save filters, sorting and visible columns for this table.')}
            </Dialog.Description>
            <form
              className="grid gap-4"
              onSubmit={(event) => {
                event.preventDefault()
                void (async () => {
                  const success =
                    mode === 'delete'
                      ? await views.mutate('DELETE', undefined, editing)
                      : await views.mutate(
                          editing ? 'PUT' : 'POST',
                          {
                            name,
                            query: editing?.query ?? query,
                            columns: editing?.columns ?? columns,
                            isPublic,
                            isDefault,
                          },
                          editing
                        )
                  if (success) setMode(null)
                })()
              }}
            >
              {mode !== 'delete' && (
                <>
                  <label className="grid gap-1 text-sm">
                    {t('View name')}
                    <Input
                      value={name}
                      onChange={(event) => setName(event.currentTarget.value)}
                      required
                      maxLength={120}
                      autoFocus
                    />
                  </label>
                  <label className="flex min-h-6 items-center gap-2 text-sm">
                    <CheckboxControl
                      className="size-6"
                      checked={isDefault}
                      onCheckedChange={(checked) => setDefault(checked)}
                    />
                    {t('Default view')}
                  </label>
                  {descriptor.views?.canManagePublic && (
                    <label className="flex min-h-6 items-center gap-2 text-sm">
                      <CheckboxControl
                        className="size-6"
                        checked={isPublic}
                        onCheckedChange={(checked) => setPublic(checked)}
                      />
                      {t('Public view')}
                    </label>
                  )}
                </>
              )}
              {views.error && (
                <p role="alert" className="text-sm text-destructive">
                  {views.error}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setMode(null)}>
                  {t('Cancel')}
                </Button>
                <Button
                  type="submit"
                  color={mode === 'delete' ? 'danger' : 'primary'}
                  disabled={views.busy}
                >
                  {mode === 'delete' ? t('Delete view') : t('Save view')}
                </Button>
              </div>
            </form>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
