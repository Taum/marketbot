import { FC, useState, useEffect } from "react"
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
  const [isDesktop, setIsDesktop] = useState(true);
  const url = addCdn(props.card.imageUrl, props.quality, props.width);
  const width = parseInt((props.width ?? 300) + "", 10);
  const largeUrl = addCdn(props.card.imageUrl, 95, 800); // Higher quality and larger for modal
  
  // Check if desktop on mount and resize
  useEffect(() => {
    const checkIsDesktop = () => {
      setIsDesktop(window.innerWidth >= 640); // sm breakpoint
    };
    
    checkIsDesktop();
    window.addEventListener('resize', checkIsDesktop);
    return () => window.removeEventListener('resize', checkIsDesktop);
  }, []);
  
  // Preload large image on hover for faster modal opening
  const preloadImage = () => {
    if (isDesktop) {
      const img = new Image();
      img.src = largeUrl!;
    }
  };
  
  const handleClick = () => {
    if (isDesktop) {
      setIsOpen(true);
    }
  };
  
  return (
    <>
      <button 
        type="button"
        onClick={handleClick}
        onMouseEnter={preloadImage}
        onFocus={preloadImage}
        className={cn(
          "border-0 p-0 bg-transparent",
          isDesktop ? "cursor-pointer" : "cursor-default"
        )}
        aria-label={isDesktop ? `View larger image of ${props.card.name}` : props.card.name}
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
      
      {isDesktop && (
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
      )}
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
