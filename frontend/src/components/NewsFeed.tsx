import React, { useState, useEffect } from 'react';
import { Newspaper, ExternalLink } from 'lucide-react';

interface NewsItem {
    id: number;
    symbol: string;
    title: string;
    summary: string;
    sentiment: string;
    url: string;
    created_at: number;
}

const NewsFeed: React.FC = () => {
    const [news, setNews] = useState<NewsItem[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchNews = async () => {
        try {
            const res = await fetch('/api/news');
            const data = await res.json();
            setNews(data);
        } catch (e) {
            console.error("Failed to fetch news", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNews();
        // Refresh news every minute
        const interval = setInterval(fetchNews, 60000);
        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return (
            <div className="grid gap-4">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse glass h-48 rounded-2xl"></div>
                ))}
            </div>
        );
    }

    if (news.length === 0) {
        return (
            <div className="text-center text-gray-500 py-20 glass rounded-2xl">
                <Newspaper className="mx-auto w-12 h-12 mb-4 opacity-20" />
                <p>No news found yet. Wait for the crawler to run.</p>
            </div>
        );
    }

    return (
        <div className="grid gap-4">
            {news.map((item) => {
                const sentimentColor = item.sentiment?.toLowerCase().includes('positive') ? 'text-green-400' :
                    item.sentiment?.toLowerCase().includes('negative') ? 'text-red-400' : 'text-gray-400';

                return (
                    <div key={item.id} className="glass p-6 rounded-2xl hover:bg-gray-800/80 transition-colors group">
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center space-x-2">
                                <span className="bg-purple-900/40 text-purple-300 text-xs px-2 py-1 rounded-md font-bold border border-purple-800/50">
                                    {item.symbol}
                                </span>
                                <span className="text-xs text-gray-500">
                                    {new Date(item.created_at * 1000).toLocaleDateString()}
                                </span>
                            </div>
                            <span className={`text-[10px] uppercase font-bold tracking-widest px-2 py-1 rounded-full border ${sentimentColor.replace('text', 'border')}/30 bg-gray-900/50 ${sentimentColor}`}>
                                {item.sentiment || 'NEUTRAL'}
                            </span>
                        </div>

                        <h3 className="text-lg font-bold mb-2 leading-tight group-hover:text-purple-400 transition-colors">
                            {item.title}
                        </h3>

                        <p className="text-gray-400 text-sm mb-6 line-clamp-2">
                            {item.summary}
                        </p>

                        <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-sm text-purple-400 hover:text-purple-300 transition-colors font-medium"
                        >
                            Read Source <ExternalLink className="ml-1.5 w-3.5 h-3.5" />
                        </a>
                    </div>
                );
            })}
        </div>
    );
};

export default NewsFeed;
