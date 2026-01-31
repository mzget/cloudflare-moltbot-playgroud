import React, { useState, useEffect } from 'react';
import { List, Plus, Trash2, Loader2 } from 'lucide-react';

interface WatchlistItem {
    symbol: string;
    is_auto_suggested?: boolean;
}

export default function Sidebar() {
    const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const [inputValue, setInputValue] = useState('');

    const fetchWatchlist = async () => {
        try {
            const res = await fetch('/api/watchlist');
            if (res.ok) {
                const data = await res.json();
                setWatchlist(data);
            }
        } catch (e) {
            console.error("Failed to fetch watchlist", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchWatchlist();
    }, []);

    const handleAddStock = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue) return;

        setAdding(true);
        try {
            const symbol = inputValue.toUpperCase();
            await fetch('/api/watchlist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbol })
            });
            setInputValue('');
            await fetchWatchlist();
        } catch (e) {
            console.error("Failed to add stock", e);
        } finally {
            setAdding(false);
        }
    };

    const removeStock = async (symbol: string) => {
        if (!confirm(`Stop tracking ${symbol}?`)) return;
        try {
            await fetch(`/api/watchlist/${symbol}`, { method: 'DELETE' });
            await fetchWatchlist();
        } catch (e) {
            console.error("Failed to remove stock", e);
        }
    };

    return (
        <aside className="glass rounded-2xl p-6 lg:col-span-1 h-fit transform transition hover:scale-[1.01] duration-300">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
                <List className="mr-2 w-5 h-5" /> Watchlist
            </h2>

            <form onSubmit={handleAddStock} className="flex gap-2 mb-6">
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="AAPL"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-purple-500 transition-colors uppercase"
                    required
                />
                <button
                    type="submit"
                    disabled={adding}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center disabled:opacity-50"
                >
                    {adding ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                </button>
            </form>

            <div className="space-y-3">
                {loading ? (
                    <div className="animate-pulse bg-gray-800 h-10 rounded-lg"></div>
                ) : (
                    watchlist.map((item) => (
                        <div key={item.symbol} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors group">
                            <div className="flex items-center">
                                <span className="font-bold text-lg text-purple-400">{item.symbol}</span>
                                {item.is_auto_suggested && (
                                    <span className="ml-2 text-xs bg-cyan-900/50 text-cyan-400 px-2 py-0.5 rounded-full border border-cyan-800">AI</span>
                                )}
                            </div>
                            <button
                                onClick={() => removeStock(item.symbol)}
                                className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </aside>
    );
}
