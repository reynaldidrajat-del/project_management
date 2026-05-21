/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#2563EB',
        'primary-dark': '#1E3A8A',
        'primary-light': '#DBEAFE',
        workspace: '#F8FAFC',
        border: '#E2E8F0',
        'text-dark': '#0F172A',
        'text-muted': '#64748B',
        success: '#16A34A',
        warning: '#F59E0B',
        danger: '#DC2626',
      },
      boxShadow: {
        soft: '0 16px 40px rgba(15, 23, 42, 0.08)',
      },
    },
  },
  plugins: [],
};
