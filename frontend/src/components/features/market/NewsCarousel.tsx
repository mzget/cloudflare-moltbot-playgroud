import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, TrendingUp } from 'lucide-react';

const MOCK_TRENDS = [
    { symbol: 'TSLA', price: '$182.45', change: '+2.4%', signal: 'BULLISH' },
    { symbol: 'NVDA', price: '$822.79', change: '+4.1%', signal: 'STRONG BUY' },
    { symbol: 'AAPL', price: '$170.12', change: '-0.8%', signal: 'NEUTRAL' },
    { symbol: 'MSFT', price: '$415.50', change: '+1.2%', signal: 'BULLISH' },
    { symbol: 'AMD', price: '$180.49', change: '+3.2%', signal: 'BUY' },
];

export default function NewsCarousel() {
    const [index, setIndex] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setIndex((prev) => (prev + 1) % MOCK_TRENDS.length);
        }, 5000);
        return () => clearInterval(timer);
    }, []);

    const next = () => setIndex((prev) => (prev + 1) % MOCK_TRENDS.length);
    const prev = () => setIndex((prev) => (prev - 1 + MOCK_TRENDS.length) % MOCK_TRENDS.length);

    return (
        <div className="glass-pink rounded-2xl p-6 relative overflow-hidden group border border-pink-500/10">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-pink-400 flex items-center uppercase tracking-widest">
                    <TrendingUp className="w-4 h-4 mr-2" /> Market Momentum
                </h3>
                <div className="flex space-x-1">
                    <button onClick={prev} className="p-1 hover:bg-pink-500/20 rounded-md transition-colors">
                        <ChevronLeft className="w-4 h-4 text-pink-400" />
                    </button>
                    <button onClick={next} className="p-1 hover:bg-pink-500/20 rounded-md transition-colors">
                        <ChevronRight className="w-4 h-4 text-pink-400" />
                    </button>
                </div>
            </div>

            <div className="relative h-20">
                {MOCK_TRENDS.map((item, i) => (
                    <div
                        key={item.symbol}
                        className={`absolute inset-0 transition-all duration-700 ease-out flex items-center justify-between ${i === index ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8 pointer-events-none'
                            }`}
                    >
                        <div>
                            <span className="text-3xl font-black text-black dark:text-white">{item.symbol}</span>
                            <div className="flex items-center space-x-2 mt-1">
                                <span className="text-gray-400 font-mono">{item.price}</span>
                                <span className={item.change.startsWith('+') ? 'text-green-400' : 'text-red-400'}>
                                    {item.change}
                                </span>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="text-[10px] font-mono text-pink-500/50 block mb-1">SENTIMENT ENGINE</span>
                            <span className="bg-pink-500/10 text-pink-400 border border-pink-500/30 px-3 py-1 rounded-full text-xs font-bold">
                                {item.signal}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Background elements */}
            <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-pink-600/10 blur-3xl rounded-full"></div>
            <div className="absolute left-1/2 bottom-0 w-2/3 h-px bg-gradient-to-r from-transparent via-pink-500/20 to-transparent"></div>
        </div>
    );
}
