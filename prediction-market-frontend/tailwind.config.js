/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: 'rgb(26 26 26)',
                secondary: 'rgb(45 45 45)',
                accent: 'rgb(0 208 132)',
                danger: 'rgb(255 107 107)',
            },
            borderRadius: {
                lg: '12px',
                xl: '16px',
            },
        },
    },
    plugins: [],
}
