import { useCallback, useEffect, useState } from 'react'
import Cropper from 'react-easy-crop'
import { Dialog } from '@base-ui/react/dialog'
import {
  Button,
  backdropClasses,
  dialogPopupClasses,
  segmentedListClasses,
  segmentedItemClasses,
} from '../primitives/index.js'
import { Icon } from '../icons.js'

type Crop = { x: number; y: number }
type Area = { x: number; y: number; width: number; height: number }
type Props = {
  file: File
  ratios?: (string | null)[]
  onCancel: () => void
  onComplete: (file: File) => void
}

function loadImage(url: string): Promise<HTMLImageElement> {
  const { promise, resolve, reject } = Promise.withResolvers<HTMLImageElement>()
  const element = new Image()
  element.onload = () => resolve(element)
  element.onerror = reject
  element.src = url
  return promise
}

async function cropImage(
  file: File,
  area: Area,
  rotation: number,
  flipped: boolean
): Promise<File> {
  const sourceUrl = URL.createObjectURL(file)
  try {
    const source = await loadImage(sourceUrl)
    const radians = (rotation * Math.PI) / 180
    const rotatedWidth =
      Math.abs(source.width * Math.cos(radians)) + Math.abs(source.height * Math.sin(radians))
    const rotatedHeight =
      Math.abs(source.width * Math.sin(radians)) + Math.abs(source.height * Math.cos(radians))
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas is unavailable')
    canvas.width = Math.ceil(rotatedWidth)
    canvas.height = Math.ceil(rotatedHeight)
    context.translate(canvas.width / 2, canvas.height / 2)
    context.rotate(radians)
    context.scale(flipped ? -1 : 1, 1)
    context.drawImage(source, -source.width / 2, -source.height / 2)

    const output = document.createElement('canvas')
    output.width = area.width
    output.height = area.height
    const outputContext = output.getContext('2d')
    if (!outputContext) throw new Error('Canvas is unavailable')
    outputContext.drawImage(
      canvas,
      area.x,
      area.y,
      area.width,
      area.height,
      0,
      0,
      area.width,
      area.height
    )
    const { promise, resolve, reject } = Promise.withResolvers<Blob>()
    output.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Could not crop image'))
    }, file.type || 'image/jpeg')
    const blob = await promise
    return new File([blob], file.name, { type: blob.type, lastModified: Date.now() })
  } finally {
    URL.revokeObjectURL(sourceUrl)
  }
}

function ratioValue(ratio: string | null, originalAspect: number): number {
  if (ratio === null) return originalAspect
  const [width, height] = ratio.split(':').map(Number)
  return width && height ? width / height : originalAspect
}

export function ImageCropper({ file, ratios, onCancel, onComplete }: Props) {
  const [imageUrl] = useState(() => URL.createObjectURL(file))
  const [crop, setCrop] = useState<Crop>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [area, setArea] = useState<Area>()
  const [originalAspect, setOriginalAspect] = useState(1)
  const [selectedRatio, setSelectedRatio] = useState<string | null>(() => ratios?.[0] ?? null)
  const aspect = ratioValue(selectedRatio, originalAspect)

  useEffect(() => () => URL.revokeObjectURL(imageUrl), [imageUrl])

  const onCropComplete = useCallback((_area: Area, pixels: Area) => setArea(pixels), [])

  async function save() {
    if (!area) return
    onComplete(await cropImage(file, area, rotation, flipped))
  }

  const aspectRatios = ratios?.length ? ratios : [null]

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onCancel()
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className={backdropClasses} />
        <Dialog.Popup data-pupitre-popup="" className={dialogPopupClasses('2xl')}>
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <Dialog.Title className="text-[0.9375rem] font-semibold">Edit image</Dialog.Title>
            <Button
              type="button"
              variant="ghost"
              square
              size="sm"
              aria-label="Close image editor"
              onClick={onCancel}
            >
              <Icon name="x" />
            </Button>
          </div>
          <div className="space-y-5 overflow-y-auto p-5">
            <div className="relative h-80 w-full overflow-hidden rounded-lg bg-muted">
              <Cropper
                image={imageUrl}
                crop={crop}
                zoom={zoom}
                rotation={rotation}
                aspect={aspect}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                onMediaLoaded={(media) =>
                  setOriginalAspect(media.naturalWidth / media.naturalHeight)
                }
              />
            </div>
            <div className="relative flex flex-wrap items-center gap-3">
              <label className="flex flex-1 items-center gap-3 text-sm font-medium">
                Zoom
                <input
                  aria-label="Zoom"
                  type="range"
                  min={1}
                  max={3}
                  step={0.1}
                  value={zoom}
                  onChange={(event) => setZoom(Number(event.currentTarget.value))}
                  className="min-w-20 flex-1 accent-primary focus-visible:outline-2 focus-visible:outline-ring"
                />
              </label>
              <Button
                type="button"
                size="sm"
                onClick={() => setRotation((value) => (value + 90) % 360)}
              >
                <Icon name="rotate-ccw" /> Rotate
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => setFlipped((value) => !value)}
                aria-pressed={flipped}
              >
                Flip
              </Button>
            </div>
            <div className="grid gap-2">
              <p className="text-sm font-medium">Aspect ratio</p>
              <div role="group" aria-label="Aspect ratio" className={segmentedListClasses}>
                {aspectRatios.map((ratio, index) => (
                  <button
                    type="button"
                    key={`${ratio}-${index}`}
                    className={segmentedItemClasses}
                    aria-pressed={selectedRatio === ratio}
                    onClick={() => setSelectedRatio(ratio)}
                  >
                    {ratio ?? 'Original'}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-border bg-muted/30 px-5 py-4">
            <Button type="button" color="gray" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="button" color="primary" disabled={!area} onClick={() => void save()}>
              Apply crop
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default ImageCropper
