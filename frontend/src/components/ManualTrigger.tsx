import React, { useState } from 'react';
import { Play, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export default function ManualTrigger() {
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [result, setResult] = useState<{ addedCount?: number, message?: string } | null>(null);

    const handleTriggerCrawl = async () => {
        setStatus('loading');
        setResult(null);

        try {
            // Note: In local dev, backend is usually at :8787
            // We use a relative URL if we were using an Astro proxy, 
            // but here we'll try to hit the backend directly since we added CORS.
            const response = await fetch('http://localhost:8787/crawl', {
                method: 'POST',
            });

            if (response.ok) {
                const data = await response.json() as { addedCount?: number, message?: string };
                setResult(data);
                setStatus('success');
                // Refresh the page or poll for news after a short delay
                setTimeout(() => window.location.reload(), 3000);
            } else {
                setStatus('error');
            }
        } catch (e) {
            console.error("Manual crawl failed", e);
            setStatus('error');
        }
    };

    return (
        <div className="glass rounded-2xl p-4 flex items-center justify-between mb-8 border border-purple-500/20">
            <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${status === 'loading' ? 'bg-purple-900/40' : 'bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10'}`}>
                    {status === 'loading' ? (
                        <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
                    ) : (
                        <Play className="w-5 h-5 text-purple-400" />
                    )}
                </div>
                <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-200">System Control</h3>
                    <p className="text-xs text-gray-500">Manual news crawl trigger</p>
                </div>
            </div>

            <div className="flex items-center space-x-4">
                {status === 'success' && (
                    <div className="flex items-center text-green-400 text-xs font-medium animate-in fade-in slide-in-from-right-2">
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        {result?.addedCount !== undefined ? `Added ${result.addedCount} items` : 'Crawl Complete'}
                    </div>
                )}

                {status === 'error' && (
                    <div className="flex items-center text-red-400 text-xs font-medium animate-in fade-in slide-in-from-right-2">
                        <AlertCircle className="w-4 h-4 mr-1" />
                        Crawl Failed
                    </div>
                )}

                <button
                    onClick={handleTriggerCrawl}
                    disabled={status === 'loading'}
                    className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-lg transition-all shadow-lg shadow-purple-900/20 flex items-center"
                >
                    {status === 'loading' ? 'CRAWLING...' : 'RUN CRAWLER'}
                </button>
            </div>
        </div>
    );
}
