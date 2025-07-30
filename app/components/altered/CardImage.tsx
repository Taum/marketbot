import { FC, useState } from "react"
import { cn } from "~/lib/utils"
import { DisplayUniqueCard } from "~/models/cards"
import { Dialog, DialogContent } from "~/components/ui/dialog"

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
  const [isOpen, setIsOpen] = useState(false);
  const url = addCdn(props.card.imageUrl, props.quality, props.width);
  const width = parseInt((props.width ?? 300) + "", 10);
  const largeUrl = addCdn(props.card.imageUrl, 95, 800); // Higher quality and larger for modal
  
  // Preload large image on hover for faster modal opening
  const preloadImage = () => {
    const img = new Image();
    img.src = largeUrl!;
  };
  
  return (
    <>
      <button 
        type="button"
        onClick={() => setIsOpen(true)}
        onMouseEnter={preloadImage}
        onFocus={preloadImage}
        className="border-0 p-0 bg-transparent cursor-pointer"
        aria-label={`View larger image of ${props.card.name}`}
      >
        <img 
          src={url}
          className={cn(!props.dontRound && "rounded-alt-card aspect-alt-card bg-card-placeholder", props.className)}
          alt={props.card.name}
          style={props.style}
          width={width}
          height={width * 1.4}
          onError={(x) => console.error("Error loading card image", props.card.ref, " : ", x)} 
        />
      </button>
      
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl w-fit p-2">
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="border-0 p-0 bg-transparent cursor-pointer"
            aria-label="Close image"
          >
            <img
              src={largeUrl}
              alt={props.card.name}
              className="rounded-alt-card max-h-[90vh] w-auto"
            />
          </button>
        </DialogContent>
      </Dialog>
    </>
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
  alt: string // Make alt required
}
export const CDNImage: FC<CDNImageProps> = ({ src, quality, width, alt, ...props }) => {
  const url = addCdn(src, quality, width);
  return <img alt={alt} {...props} src={url} />
}
