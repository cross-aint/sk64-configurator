import { useCallback, useEffect, useState } from 'react'
import { coverTransform, type ImageTransform } from '../keyboard/imageSampling'
import type { KeyboardLayout } from '../keyboard/layout'

export type PlacedImage = {
  name: string
  url: string
  element: HTMLImageElement
  width: number
  height: number
}

type Placement = { image: PlacedImage; transform: ImageTransform }

/** A picture being positioned over the keyboard, before its colors are taken. */
export function useImagePlacement(layout: KeyboardLayout) {
  const [placement, setPlacement] = useState<Placement | null>(null)

  // Free the picture's memory when it's replaced or closed.
  const url = placement?.image.url
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url])

  /** Loads a picture file and places it to cover the keyboard. Throws a readable error. */
  const open = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) throw new Error(`“${file.name}” isn’t a picture.`)
      const objectUrl = URL.createObjectURL(file)
      const element = new Image()
      element.src = objectUrl
      try {
        await element.decode()
      } catch {
        URL.revokeObjectURL(objectUrl)
        throw new Error(`Couldn’t open “${file.name}”. Try a PNG or JPEG.`)
      }
      const { naturalWidth: width, naturalHeight: height } = element
      if (!width || !height) {
        URL.revokeObjectURL(objectUrl)
        throw new Error(`Couldn’t read the size of “${file.name}”.`)
      }
      setPlacement({
        image: { name: file.name, url: objectUrl, element, width, height },
        transform: coverTransform(layout, width, height),
      })
    },
    [layout],
  )

  const update = useCallback((change: (t: ImageTransform) => ImageTransform) => {
    setPlacement((cur) => (cur ? { ...cur, transform: change(cur.transform) } : cur))
  }, [])

  const fit = useCallback(() => {
    setPlacement((cur) => (cur ? { ...cur, transform: coverTransform(layout, cur.image.width, cur.image.height) } : cur))
  }, [layout])

  const close = useCallback(() => setPlacement(null), [])

  return {
    image: placement?.image ?? null,
    transform: placement?.transform ?? null,
    open,
    update,
    fit,
    close,
  }
}
