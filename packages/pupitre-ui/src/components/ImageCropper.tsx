import { useCallback, useEffect, useState } from 'react'
import Cropper from 'react-easy-crop'
import { Modal } from './Modal.js'

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
    <Modal open onClose={onCancel} heading="Edit image" width="2xl">
      <div className="max-h-[calc(100vh-2rem)] w-[min(100%,42rem)] overflow-y-auto rounded-xl border border-border bg-background p-4 text-foreground shadow-xl">
        <div
          className="relative h-80 w-full bg-black"
          style={{ position: 'relative', height: '20rem', width: '100%', backgroundColor: '#000' }}
        >
          <Cropper
            image={imageUrl}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            onMediaLoaded={(media) => setOriginalAspect(media.naturalWidth / media.naturalHeight)}
          />
        </div>
        <div
          className="relative z-10 flex flex-wrap items-center gap-2"
          style={{ position: 'relative', zIndex: 1000 }}
        >
          <label>
            Zoom{' '}
            <input
              aria-label="Zoom"
              type="range"
              min={1}
              max={3}
              step={0.1}
              value={zoom}
              onChange={(event) => setZoom(Number(event.currentTarget.value))}
            />
          </label>
          <button type="button" onClick={() => setRotation((value) => (value + 90) % 360)}>
            Rotate
          </button>
          <button
            type="button"
            onClick={() => setFlipped((value) => !value)}
            aria-pressed={flipped}
          >
            Flip
          </button>
          <label>
            Aspect{' '}
            <select
              aria-label="Aspect ratio"
              value={selectedRatio ?? ''}
              onChange={(event) => setSelectedRatio(event.currentTarget.value || null)}
            >
              {aspectRatios.map((ratio, index) => (
                <option key={`${ratio}-${index}`} value={ratio ?? ''}>
                  {ratio ?? 'Original'}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="ml-auto" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" onClick={() => void save()}>
            Apply crop
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default ImageCropper
