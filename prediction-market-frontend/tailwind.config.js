/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Primary Green (pump.fun signature)
                'pump-green': '#00FF41',
                'pump-lime': '#39FF14',
                'pump-green-md': '#00CC33',
                'pump-green-dark': '#008C1A',
                'pump-green-darker': '#004D0D',

                // Neutral Colors
                'pump-white': '#FFFFFF',
                'pump-off-white': '#F5F5F5',
                'pump-gray-light': '#A0AEC0',
                'pump-gray': '#718096',
                'pump-gray-dark': '#2D3748',
                'pump-gray-darker': '#1A202C',
                'pump-black': '#0F1419',

                // Semantic Colors
                'pump-red': '#FF6B6B',
                'pump-yellow': '#FFD700',
                'pump-cyan': '#00D9FF',
            },
            fontFamily: {
                'mono': ['Space Mono', 'monospace'],
                'sans': ['Inter', 'sans-serif'],
            },
            spacing: {
                'xs': '4px',
                'sm': '8px',
                'md': '12px',
                'lg': '16px',
                'xl': '24px',
                '2xl': '32px',
                '3xl': '40px',
            },
            borderRadius: {
                'sm': '4px',
                'md': '8px',
                'lg': '12px',
            },
            boxShadow: {
                'glow': '0 0 20px rgba(0, 255, 65, 0.3)',
                'glow-lg': '0 0 40px rgba(0, 255, 65, 0.5)',
                'glow-red': '0 0 20px rgba(255, 107, 107, 0.3)',
            },
            animation: {
                'spin-glow': 'spin-glow 1s linear infinite',
                'pulse-glow': 'pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            },
            keyframes: {
                'spin-glow': {
                    'from': { transform: 'rotate(0deg)' },
                    'to': { transform: 'rotate(360deg)' },
                },
                'pulse-glow': {
                    '0%, 100%': { opacity: '1' },
                    '50%': { opacity: '0.5' },
                },
            },
        },
    },
    plugins: [],
}
