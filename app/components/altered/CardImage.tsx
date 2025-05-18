import { FC } from "react"
import { cn } from "~/lib/utils"
import { DisplayUniqueCard } from "~/models/cards"

export interface CardImageProps {
  card: DisplayUniqueCard
  className?: string
  quality?: number
  width?: string | number
  // lang?: keyof LocalizedString
  style?: React.CSSProperties
  dontRound?: Boolean
}

export const CardImage: FC<CardImageProps> = (props) => {
  // const lang = props.lang ?? 'en';
  const url = addCdn(props.card.imageUrl, props.quality, props.width);
  const width = parseInt((props.width ?? 300) + "", 10);
  return (
    <img src={url}
      className={cn(!props.dontRound && "rounded-alt-card aspect-alt-card bg-card-placeholder", props.className)}
      alt={props.card.name}
      style={props.style}
      width={width}
      height={width * 1.4}
      onError={(x) => console.error("Error loading card image", props.card.ref, " : ", x)} />
  )
}

const addCdn = (src?: string, quality?: number, width?: string | number) => {
  if (!src) {
    return undefined
  }
  if (src.startsWith('https://www.altered.gg/cdn-cgi/image/')) {
    return src
  }
  const w: number = typeof width === 'string' ? parseInt(width) : width ?? 400
  return `https://www.altered.gg/cdn-cgi/image/width=${w},format=auto,quality=${quality ?? 90}/${src}`
}

interface CDNImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  quality?: number
  width?: string | number
}
export const CDNImage: FC<CDNImageProps> = ({ src, quality, width, ...props }) => {
  const url = addCdn(src, quality, width);
  return <img {...props} src={url} />
}
