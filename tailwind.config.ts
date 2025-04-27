// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  // Specify the files Tailwind should scan for classes
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',      // If you had a pages dir
    './src/components/**/*.{js,ts,jsx,tsx,mdx}', // Your components folder
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',       // Your app router pages/layouts
  ],
  // Define your theme customizations (optional for now)
  theme: {
    extend: {
      // Add custom animations, colors, fonts, etc. here later
      // Example (from previous redesign steps):
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.5s ease-out forwards',
        'fade-in-up': 'fade-in-up 0.5s ease-out forwards',
      },
      // Example: Add custom colors for themes if using CSS variables later
      // colors: {
      //   'theme-bg-start': 'var(--background-start)',
      //   'theme-bg-end': 'var(--background-end)',
      //   'theme-text': 'var(--text-color)',
      // },
    },
  },
  // Add any Tailwind plugins here (optional for now)
  plugins: [
    // require('@tailwindcss/forms'), // Example if you needed form styling later
  ],
};
export default config;