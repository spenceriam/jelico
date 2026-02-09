import logoUrl from '../../assets/branding/jelico-icon-ui.png'

interface JelicoLogoProps {
  size?: number
  className?: string
}

export function JelicoLogo({ size = 94, className = '' }: JelicoLogoProps) {
  return (
    <img
      src={logoUrl}
      alt="Jelico"
      width={size}
      height={size}
      draggable={false}
      className={className}
    />
  )
}
