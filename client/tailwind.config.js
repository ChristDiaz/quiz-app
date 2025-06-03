/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        'brand-primary': '#2980b9',
        'brand-primary-light': '#e0f2fe',
        // ... other theme colors
      },
    },
  },
  plugins: [],
};
