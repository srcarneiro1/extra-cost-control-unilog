// Fundo animado da marca (06/11/2026): ícones de logística em contorno fino, brancos e suaves,
// flutuando devagar sobre o Cinza UNILOG. Puramente decorativo (aria-hidden). Para quem ativou
// "reduzir movimento" no sistema, a animação é desligada (ver brand-backdrop.css).
const ICONS: Record<string, string> = {
  cubo: 'M12 2 3 7v10l9 5 9-5V7l-9-5Z M3 7l9 5 9-5 M12 12v10',
  caminhao: 'M2 6h11v9H2Z M13 9h4l3 3v3h-7Z M6.5 18.5a1.8 1.8 0 1 0 0-.01Z M16.5 18.5a1.8 1.8 0 1 0 0-.01Z',
  carrinho: 'M3 4h2l2.4 10.2c.1.5.5.8 1 .8h8.9c.5 0 .9-.3 1-.8L20 8H6 M9 19.5a1.3 1.3 0 1 0 0-.01Z M17 19.5a1.3 1.3 0 1 0 0-.01Z',
  prancheta: 'M7 4H5.5A1.5 1.5 0 0 0 4 5.5v14A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5v-14A1.5 1.5 0 0 0 18.5 4H17 M9 3h6v3H9Z m0 10.5 2 2 4-4',
  relogio: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z M12 7.5V12l3 2',
  moeda: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z M12 6.5v11 M14.8 9.4c0-1.3-1.2-2.2-2.8-2.2s-2.8.9-2.8 2.2 1.2 2 2.8 2.3 2.8 1 2.8 2.3-1.2 2.3-2.8 2.3-2.8-1-2.8-2.3',
  etiqueta: 'M3 12V4h8l9.5 9.5-8 8L3 12Z M7.5 7.5h.01',
}

// Posições em % da área, tamanho em px, duração/atraso da flutuação em s.
const ITEMS: Array<{ icon: keyof typeof ICONS; x: number; y: number; size: number; dur: number; delay: number; rot: number }> = [
  { icon: 'carrinho', x: 8, y: 14, size: 84, dur: 19, delay: 0, rot: -8 },
  { icon: 'cubo', x: 78, y: 10, size: 110, dur: 24, delay: -6, rot: 10 },
  { icon: 'caminhao', x: 30, y: 44, size: 92, dur: 21, delay: -3, rot: -4 },
  { icon: 'prancheta', x: 14, y: 78, size: 78, dur: 23, delay: -9, rot: 6 },
  { icon: 'relogio', x: 86, y: 58, size: 70, dur: 17, delay: -4, rot: 0 },
  { icon: 'moeda', x: 58, y: 82, size: 64, dur: 20, delay: -12, rot: 0 },
  { icon: 'etiqueta', x: 62, y: 30, size: 58, dur: 26, delay: -7, rot: 14 },
  { icon: 'cubo', x: 92, y: 88, size: 56, dur: 18, delay: -2, rot: -12 },
]

export function BrandBackdrop({ className = '' }: { className?: string }) {
  return (
    <div className={`brand-backdrop ${className}`} aria-hidden="true">
      {ITEMS.map((item, index) => (
        <svg
          key={index}
          viewBox="0 0 24 24"
          className="brand-backdrop-icon"
          style={{
            left: `${item.x}%`,
            top: `${item.y}%`,
            width: item.size,
            height: item.size,
            animationDuration: `${item.dur}s`,
            animationDelay: `${item.delay}s`,
            ['--rot' as string]: `${item.rot}deg`,
          }}
        >
          <path d={ICONS[item.icon]} />
        </svg>
      ))}
    </div>
  )
}
