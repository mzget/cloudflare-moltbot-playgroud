// Hero configuration
export interface HeroConfig {
  id: string;
  name: string;
  title: string;
  heroClass: 'strength' | 'agility' | 'intelligence';
  portrait: string; // path to image
  icon: string; // lucide-react icon name
  description: string;
  abilities: {
    key: string; // Q, W, E, R
    name: string;
    description: string;
    icon: string; // lucide icon name
    cooldown?: number; // seconds, optional
  }[];
}

export const HEROES: HeroConfig[] = [
  {
    id: 'dashboard',
    name: 'The Analyst',
    title: 'Master of Data',
    heroClass: 'intelligence',
    portrait: '/heroes/analyst.png',
    icon: 'LayoutDashboard',
    description: 'Wields the power of fundamental analysis to reveal hidden market truths.',
    abilities: [
      { key: 'Q', name: 'Sort Data', description: 'Sort table columns', icon: 'ArrowUpDown' },
      { key: 'W', name: 'Filter', description: 'Filter by column values', icon: 'Filter' },
      { key: 'E', name: 'Density', description: 'Change table density', icon: 'Rows3' },
      { key: 'R', name: 'Full Analysis', description: 'Run comprehensive analysis', icon: 'Zap' },
    ],
  },
  {
    id: 'market',
    name: 'The Scout',
    title: 'Eyes of the Market',
    heroClass: 'agility',
    portrait: '/heroes/scout.png',
    icon: 'BarChart3',
    description: 'Swift and vigilant, gathering intelligence from every corner of the market.',
    abilities: [
      { key: 'Q', name: 'View Reports', description: 'Read latest market reports', icon: 'FileText' },
      { key: 'W', name: 'Scan Digests', description: 'Check email digests', icon: 'Mail' },
      { key: 'E', name: 'Timeline', description: 'View market events timeline', icon: 'Clock' },
      { key: 'R', name: 'Force Crawl', description: 'Trigger news crawler', icon: 'RefreshCw', cooldown: 60 },
    ],
  },
  {
    id: 'watchlist',
    name: 'The Guardian',
    title: 'Shield of Wealth',
    heroClass: 'strength',
    portrait: '/heroes/guardian.png',
    icon: 'TrendingUp',
    description: 'Protects and manages the portfolio with unwavering vigilance.',
    abilities: [
      { key: 'Q', name: 'Add Symbol', description: 'Add new stock to watchlist', icon: 'Plus' },
      { key: 'W', name: 'Toggle Active', description: 'Enable/disable tracking', icon: 'ToggleLeft' },
      { key: 'E', name: 'Portfolio', description: 'View portfolio status', icon: 'Briefcase' },
      { key: 'R', name: 'Bulk Import', description: 'Import symbols from CSV', icon: 'Upload' },
    ],
  },
  {
    id: 'agent',
    name: 'The Oracle',
    title: 'Voice of Knowledge',
    heroClass: 'intelligence',
    portrait: '/heroes/oracle.png',
    icon: 'Bot',
    description: 'Channels the wisdom of artificial intelligence to answer any question.',
    abilities: [
      { key: 'Q', name: 'Ask', description: 'Send a question to AI', icon: 'MessageSquare' },
      { key: 'W', name: 'Context', description: 'Set conversation context', icon: 'BookOpen' },
      { key: 'E', name: 'History', description: 'View chat history', icon: 'History' },
      { key: 'R', name: 'Clear Chat', description: 'Reset conversation', icon: 'Trash2' },
    ],
  },
  {
    id: 'sources',
    name: 'The Merchant',
    title: 'Keeper of Sources',
    heroClass: 'agility',
    portrait: '/heroes/merchant.png',
    icon: 'Search',
    description: 'Trades in information, managing the network of news sources.',
    abilities: [
      { key: 'Q', name: 'Add Source', description: 'Add a new news source', icon: 'PlusCircle' },
      { key: 'W', name: 'Gmail', description: 'Connect Gmail account', icon: 'Mail' },
      { key: 'E', name: 'Subscriptions', description: 'Manage email subscriptions', icon: 'Rss' },
      { key: 'R', name: 'Sync All', description: 'Sync all sources now', icon: 'RefreshCw', cooldown: 30 },
    ],
  },
  {
    id: 'about',
    name: 'The Sage',
    title: 'Ancient Wisdom',
    heroClass: 'intelligence',
    portrait: '/heroes/sage.png',
    icon: 'Info',
    description: 'Guardian of knowledge about the Oaktree system itself.',
    abilities: [
      { key: 'Q', name: 'About', description: 'View system information', icon: 'Info' },
      { key: 'W', name: 'Settings', description: 'Open settings', icon: 'Settings' },
      { key: 'E', name: 'Theme', description: 'Toggle dark/light theme', icon: 'Sun' },
      { key: 'R', name: 'Sign Out', description: 'Logout from the system', icon: 'LogOut' },
    ],
  },
];

// DotA Color Palette
export const dotaColors = {
  // Backgrounds
  hudBg: '#0d1117',
  hudBgLight: '#161b22',
  contentBg: '#0a0e14',
  panelBg: 'rgba(13, 17, 23, 0.95)',

  // Borders & Frames
  borderGold: '#8B7355',
  borderGoldBright: '#C9A84C',
  borderDark: '#30363d',
  frameStone: '#3d3d5c',

  // Gold / XP
  gold: '#FFD700',
  goldDark: '#B8860B',
  goldGlow: 'rgba(255, 215, 0, 0.3)',
  goldMuted: '#C9A84C',

  // Hero Classes
  strength: '#EC3D06',
  agility: '#26E030',
  intelligence: '#00B4FC',

  // HP / MP Bars
  hp: '#388E3C',
  hpBg: '#1B3D1D',
  mp: '#1976D2',
  mpBg: '#0D2744',

  // Status
  active: '#10b981',
  danger: '#f43f5e',
  warning: '#f59e0b',

  // Text
  textGold: '#FFD700',
  textLight: '#e6edf3',
  textMuted: '#8b949e',
  textDim: '#484f58',
};

// DotA frame styles (sx prop compatible)
export const dotaFrameStyle = {
  background: 'linear-gradient(180deg, rgba(13,17,23,0.98) 0%, rgba(22,27,34,0.95) 100%)',
  border: '1px solid',
  borderColor: '#30363d',
  borderRadius: '4px',
  boxShadow: '0 0 0 1px rgba(139,115,85,0.3), inset 0 1px 0 rgba(255,215,0,0.05)',
};

export const dotaGoldBorderStyle = {
  border: '2px solid #8B7355',
  boxShadow: '0 0 10px rgba(255, 215, 0, 0.15), inset 0 0 5px rgba(255, 215, 0, 0.05)',
};

export const dotaStoneStyle = {
  background: `
    radial-gradient(ellipse at 20% 50%, rgba(61, 61, 92, 0.2) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 50%, rgba(61, 61, 92, 0.15) 0%, transparent 50%),
    linear-gradient(180deg, #1a1a2e 0%, #13111a 100%)`,
  border: '1px solid rgba(139, 115, 85, 0.4)',
};
