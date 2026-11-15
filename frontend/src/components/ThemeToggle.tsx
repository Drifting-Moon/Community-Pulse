import React from 'react';
import { useTheme } from '../theme';
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      className={`inline-flex items-center rounded-lg border p-0.5 text-[12px] font-medium transition-colors ${
        theme === 'dark'
          ? 'bg-[#141416] border-[#26262A] text-[#8B8B94]'
          : 'bg-gray-100 border-gray-200 text-gray-600'
      } ${className}`}
    >
      <button
        type="button"
        onClick={() => setTheme('light')}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] transition-all cursor-pointer ${
          theme === 'light'
            ? 'bg-white text-gray-900 shadow-xs font-semibold'
            : 'hover:text-gray-900'
        }`}
        title="White theme (Light mode)"
      >
        <SunIcon className="w-3.5 h-3.5" />
        <span>White</span>
      </button>

      <button
        type="button"
        onClick={() => setTheme('dark')}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] transition-all cursor-pointer ${
          theme === 'dark'
            ? 'bg-[#26262A] text-white shadow-xs font-semibold'
            : 'hover:text-gray-900'
        }`}
        title="Black theme (Dark mode)"
      >
        <MoonIcon className="w-3.5 h-3.5" />
        <span>Black</span>
      </button>
    </div>
  );
}
