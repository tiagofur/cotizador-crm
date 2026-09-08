/* Imagen de mueble con placeholder */
import { Armchair } from 'lucide-react';
import { cn } from '@/lib/utils';

export function FurnitureImage({
  url,
  alt,
  className,
  iconClassName,
}: {
  url?: string | null;
  alt: string;
  className?: string;
  iconClassName?: string;
}) {
  if (url) {
    return (
      <img src={url} alt={alt} loading="lazy" className={cn('object-cover', className)} />
    );
  }
  return (
    <div role="img" aria-label={alt} className={cn('flex items-center justify-center bg-stone-100', className)}>
      <Armchair aria-hidden className={cn('h-10 w-10 text-stone-300', iconClassName)} />
    </div>
  );
}
