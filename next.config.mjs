/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // TypeScript and ESLint errors are no longer suppressed — the build is the
  // gate. Posters are plain <img> pointing at TMDB, so no image config here.
};

export default nextConfig;
