/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      gridTemplateColumns: {
        'top': '1fr minmax(48rem, 1fr) 1fr'
      }
    },
  },
  plugins: [],
}
