import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const workspaceRoot = join(__dirname, "../..")

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  turbopack: {
    root: workspaceRoot,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
