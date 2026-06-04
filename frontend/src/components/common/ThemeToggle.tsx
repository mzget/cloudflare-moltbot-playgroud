import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
        if (savedTheme) {
            setTheme(savedTheme);
        }
    }, []);

    useEffect(() => {
        if (!mounted) return; // Prevent effect on initial render

        const root = document.documentElement;
        if (theme === 'light') {
            root.classList.remove('dark');
        } else {
            root.classList.add('dark');
        }
        localStorage.setItem('theme', theme);
    }, [theme, mounted]);

    if (!mounted) {
        return <div className="w-[140px] h-9 rounded-full bg-black/5 dark:bg-white/5 animate-pulse ml-2" />;
    }

    return (
        <div className="flex items-center p-1 bg-black/5 dark:bg-white/5 rounded-full border border-black/10 dark:border-white/10 ml-2">
            <button
                onClick={() => setTheme('light')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full transition-all duration-300 ${theme === 'light'
                        ? 'bg-white text-purple-600 shadow-sm ring-1 ring-black/5'
                        : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
                    }`}
                aria-label="Switch to light mode"
            >
                <Sun className="w-3.5 h-3.5" />
                <span className="text-xs font-bold">Light</span>
            </button>
            <button
                onClick={() => setTheme('dark')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full transition-all duration-300 ${theme === 'dark'
                        ? 'bg-gray-800 text-white shadow-sm ring-1 ring-white/10'
                        : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
                    }`}
                aria-label="Switch to dark mode"
            >
                <Moon className="w-3.5 h-3.5" />
                <span className="text-xs font-bold">Dark</span>
            </button>
        </div>
    );
}
