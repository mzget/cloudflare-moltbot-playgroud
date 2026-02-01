import React, { useState, useEffect } from 'react';
import { Globe, Plus, Trash2, Loader2, Settings2, Check, X } from 'lucide-react';

interface NewsSource {
    id: string;
    name: string;
    url_pattern: string;
    selector: string;
    enabled: boolean;
}

export default function SourceManager() {
    const [sources, setSources] = useState<NewsSource[]>([]);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const [showForm, setShowForm] = useState(false);

    const [newSource, setNewSource] = useState({
        id: '',
        name: '',
        url_pattern: '',
        selector: ''
    });

    const fetchSources = async () => {
        try {
            const res = await fetch('/api/sources');
            if (res.ok) {
                const data = await res.json() as NewsSource[];
                setSources(data);
            }
        } catch (e) {
            console.error("Failed to fetch sources", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSources();
    }, []);

    const handleAddSource = async (e: React.FormEvent) => {
        e.preventDefault();
        setAdding(true);
        try {
            await fetch('/api/sources', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newSource)
            });
            setNewSource({ id: '', name: '', url_pattern: '', selector: '' });
            setShowForm(false);
            await fetchSources();
        } catch (e) {
            console.error("Failed to add source", e);
        } finally {
            setAdding(false);
        }
    };

    const removeSource = async (id: string) => {
        if (!confirm(`Delete source ${id}?`)) return;
        try {
            await fetch(`/api/sources?id=${id}`, { method: 'DELETE' });
            await fetchSources();
        } catch (e) {
            console.error("Failed to remove source", e);
        }
    };

    return (
        <section className="glass rounded-2xl p-6 transform transition hover:scale-[1.01] duration-300">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold flex items-center">
                    <Settings2 className="mr-2 w-5 h-5 text-pink-400" /> Intelligence Sources
                </h2>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors"
                >
                    {showForm ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5 text-purple-400" />}
                </button>
            </div>

            {showForm && (
                <form onSubmit={handleAddSource} className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 p-4 bg-black/5 dark:bg-white/5 rounded-xl border border-black/10 dark:border-white/10">
                    <div className="space-y-2">
                        <label className="text-xs font-mono text-gray-500 uppercase">Internal ID</label>
                        <input
                            type="text"
                            value={newSource.id}
                            onChange={(e) => setNewSource({ ...newSource, id: e.target.value })}
                            placeholder="seeking-alpha"
                            className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-3 py-1.5 focus:outline-none focus:border-purple-500 transition-colors text-black dark:text-white"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-mono text-gray-500 uppercase">Display Name</label>
                        <input
                            type="text"
                            value={newSource.name}
                            onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
                            placeholder="Seeking Alpha"
                            className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-3 py-1.5 focus:outline-none focus:border-purple-500 transition-colors text-black dark:text-white"
                            required
                        />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                        <label className="text-xs font-mono text-gray-500 uppercase">URL Pattern (use {'{symbol}'})</label>
                        <input
                            type="text"
                            value={newSource.url_pattern}
                            onChange={(e) => setNewSource({ ...newSource, url_pattern: e.target.value })}
                            placeholder="https://seekingalpha.com/symbol/{symbol}/news"
                            className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-3 py-1.5 focus:outline-none focus:border-purple-500 transition-colors text-black dark:text-white"
                            required
                        />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                        <label className="text-xs font-mono text-gray-500 uppercase">CSS Selector (links)</label>
                        <input
                            type="text"
                            value={newSource.selector}
                            onChange={(e) => setNewSource({ ...newSource, selector: e.target.value })}
                            placeholder="[data-test-id='post-list-item'] a"
                            className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-3 py-1.5 focus:outline-none focus:border-purple-500 transition-colors text-black dark:text-white"
                            required
                        />
                    </div>
                    <div className="md:col-span-2 flex justify-end">
                        <button
                            type="submit"
                            disabled={adding}
                            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-6 py-2 rounded-lg transition-all flex items-center shadow-lg shadow-purple-900/20"
                        >
                            {adding ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Check className="w-5 h-5 mr-2" />}
                            Initialize Source
                        </button>
                    </div>
                </form>
            )}

            <div className="space-y-3">
                {loading ? (
                    <div className="animate-pulse space-y-3">
                        <div className="bg-black/10 dark:bg-white/10 h-16 rounded-xl"></div>
                        <div className="bg-black/10 dark:bg-white/10 h-16 rounded-xl"></div>
                    </div>
                ) : (
                    sources.map((source) => (
                        <div key={source.id} className="flex items-center justify-between p-4 bg-black/5 dark:bg-white/5 rounded-xl border border-black/10 dark:border-white/10 group hover:border-pink-500/30 transition-all">
                            <div className="flex items-center space-x-4">
                                <div className="p-2 bg-black/5 dark:bg-white/5 rounded-lg border border-black/10 dark:border-white/10">
                                    <Globe className={`w-5 h-5 ${source.enabled ? 'text-green-400' : 'text-gray-600'}`} />
                                </div>
                                <div>
                                    <h3 className="font-medium text-black dark:text-gray-200">{source.name}</h3>
                                    <p className="text-xs font-mono text-gray-500 truncate max-w-[200px]">{source.url_pattern}</p>
                                </div>
                            </div>
                            <div className="flex items-center space-x-2">
                                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${source.enabled ? 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20' : 'bg-black/5 dark:bg-white/5 text-gray-500 border border-black/10 dark:border-white/10'}`}>
                                    {source.enabled ? 'ACTIVE' : 'DISABLED'}
                                </span>
                                {source.id !== 'yahoo' && (
                                    <button
                                        onClick={() => removeSource(source.id)}
                                        className="p-2 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </section>
    );
}
