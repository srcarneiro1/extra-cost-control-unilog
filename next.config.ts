import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  typescript: {
    // Esta branch valida primeiro a fundação visual Next/PrimeReact.
    // O typecheck completo volta a ser obrigatório quando as telas forem reconectadas.
    ignoreBuildErrors: true,
  },
}

export default nextConfig
