import { defineConfig } from 'astro/config';
import icon from 'astro-icon';

// Static output is fine for the marketing/docs site — SEO is handled by SSG,
// and the demos are independently-built Vite apps mounted under /embeds/<slug>/.
export default defineConfig({
  site: 'https://arcade2d.dev',
  output: 'static',
  trailingSlash: 'ignore',
  integrations: [icon()],
});
