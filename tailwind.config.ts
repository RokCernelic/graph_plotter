import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        forest: '#1b3d26',
        wood: '#8b6f47',
        ink: '#2c2c2c',
        muted: '#6b7280',
        canvas: '#f9fafb',
        hairline: '#e5e7eb',
      },
      fontFamily: {
        sans: ['system-ui', 'sans-serif'],
        serif: ['georgia', 'serif'],
      },
    },
  },
  plugins: [],
};

export default config;
