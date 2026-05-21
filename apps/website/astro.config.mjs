import { defineConfig } from 'astro/config';
import icon from 'astro-icon';
import tailwindcss from '@tailwindcss/vite';

// Static output is fine for the marketing/docs site — SEO is handled by SSG,
// and the demos are independently-built Vite apps mounted under /embeds/<slug>/.
// Tailwind v4 is wired through its Vite plugin (no separate Astro integration);
// the theme tokens live in src/styles/global.css via @theme.
export default defineConfig({
  site: 'https://arcade2d.dev',
  output: 'static',
  trailingSlash: 'ignore',
  integrations: [icon()],
  vite: {
    plugins: [tailwindcss()],
  },
});
