import type sharpFactory from 'sharp'
export type MediaConversion = { width: number; height?: number; format?: 'webp' | 'jpeg' | 'png' }
export async function convertImage(
  bytes: Uint8Array,
  conversions: Record<string, MediaConversion>,
  load: () => Promise<{ default: typeof sharpFactory }> = () => import('sharp')
) {
  let sharp: typeof sharpFactory
  try {
    const module = await load()
    sharp = module.default
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      ['ERR_MODULE_NOT_FOUND', 'MODULE_NOT_FOUND'].includes(String(error.code))
    )
      return { width: null, height: null, files: [] }
    throw error
  }
  const image = sharp(bytes, { limitInputPixels: 40_000_000 })
  const metadata = await image.metadata()
  const files = []
  for (const [name, conversion] of Object.entries(conversions)) {
    const format = conversion.format ?? 'webp'
    const contents = await image
      .clone()
      .rotate()
      .resize({
        width: conversion.width,
        height: conversion.height,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .toFormat(format)
      .toBuffer()
    files.push({ name, format, contents })
  }
  return { width: metadata.width ?? null, height: metadata.height ?? null, files }
}
