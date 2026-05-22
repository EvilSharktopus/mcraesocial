// src/components/ThemeToggle.jsx
import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle({ className = '' }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
      className={`
        relative w-12 h-6 rounded-full border transition-colors duration-300 flex-shrink-0
        border-pg-border2 bg-pg-surface2
        hover:border-pg-primary
        ${className}
      `}
    >
      {/* Track icons */}
      <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] select-none">
        ☀️
      </span>
      <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] select-none">
        🌙
      </span>
      {/* Thumb */}
      <span
        className="absolute top-0.5 w-5 h-5 rounded-full shadow-sm transition-all duration-300"
        style={{
          left: isDark ? 'calc(100% - 1.375rem)' : '0.125rem',
          backgroundColor: 'var(--pg-primary)',
        }}
      />
    </button>
  );
}
