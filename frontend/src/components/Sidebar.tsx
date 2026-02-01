import React from 'react';
import Watchlist from './Watchlist';
import SourceManager from './SourceManager';

export default function Sidebar() {
    return (
        <aside className="space-y-8 lg:col-span-1">
            <Watchlist />
            <SourceManager />
        </aside>
    );
}
