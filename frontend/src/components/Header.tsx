import React from 'react';
import { Newspaper, Bell, Settings, User } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

export default function Header() {
    return (
        <header className="glass mb-8 px-6 py-4 rounded-2xl flex items-center justify-between border border-purple-500/10">
            <div className="flex items-center space-x-3">
                <div className="bg-gradient-to-br from-purple-600 to-pink-600 p-2 rounded-xl shadow-lg shadow-purple-900/40">
                    <Newspaper className="w-6 h-6 text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600 tracking-tight">
                        Moltbot Alpha
                    </h1>
                    <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-[10px] font-mono text-gray-400 uppercase tracking-widest">Neural Link Active</span>
                    </div>
                </div>
            </div>

            <div className="flex items-center space-x-2">
                <ThemeToggle />

                <nav className="hidden md:flex items-center space-x-1">
                    <button className="p-2.5 text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-500/10 rounded-xl transition-all">
                        <Bell className="w-5 h-5" />
                    </button>
                    <button className="p-2.5 text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-500/10 rounded-xl transition-all">
                        <Settings className="w-5 h-5" />
                    </button>
                    <div className="w-px h-6 bg-black/10 dark:bg-white/10 mx-2"></div>
                    <button className="flex items-center space-x-3 pl-2 pr-4 py-1.5 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border border-black/10 dark:border-white/10 rounded-xl transition-all">
                        <div className="w-7 h-7 bg-purple-900/50 rounded-lg flex items-center justify-center border border-purple-500/30">
                            <User className="w-4 h-4 text-purple-400" />
                        </div>
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-300">Operator</span>
                    </button>
                </nav>
            </div>
        </header>
    );
}
