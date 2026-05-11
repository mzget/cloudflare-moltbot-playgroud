import React from 'react';
import { List, ListItem, ListItemButton, ListItemContent, ListItemDecorator, Typography, Box, Chip } from '@mui/joy';
import { BarChart3, TrendingUp, Search, Info, Bot, LayoutDashboard } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  reportsCount?: number;
}

export default function Sidebar({ activeTab, setActiveTab, reportsCount }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { id: 'market', label: 'Market Intelligence', icon: <BarChart3 size={20} /> },
    { id: 'agent', label: 'Agent Chat', icon: <Bot size={20} /> },
    { id: 'watchlist', label: 'Watchlist', icon: <TrendingUp size={20} /> },
    { id: 'sources', label: 'News Sources', icon: <Search size={20} /> },
    { id: 'about', label: 'About Oaktree', icon: <Info size={20} /> },
  ];

  return (
    <Box>
      <Box sx={{ py: 2 }}>
        <Typography
          level="body-xs"
          sx={{
            opacity: 0.5,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            fontWeight: 700,
            mb: 2,
            px: 2
          }}
        >
          Command Center
        </Typography>
        <List sx={{ '--ListItem-radius': '12px', gap: 1 }}>
          {menuItems.map((item) => (
            <ListItem key={item.id}>
              <ListItemButton
                selected={activeTab === item.id}
                onClick={() => setActiveTab(item.id)}
                sx={{
                  color: activeTab === item.id ? 'primary.plainColor' : 'text.secondary',
                  bgcolor: activeTab === item.id ? 'rgba(46, 204, 113, 0.1)' : 'transparent',
                  '&:hover': {
                    bgcolor: 'rgba(0,0,0,0.04)',
                    color: 'text.primary',
                  },
                  '&.Mui-selected': {
                    borderRight: '3px solid #2ecc71',
                    '&:hover': {
                      bgcolor: 'rgba(46, 204, 113, 0.2)',
                    }
                  }
                }}
              >
                <ListItemDecorator sx={{ color: activeTab === item.id ? '#2ecc71' : 'inherit' }}>
                  {item.icon}
                </ListItemDecorator>
                <ListItemContent>
                  <Typography level="title-sm">{item.label}</Typography>
                  {item.id === 'market' && reportsCount !== undefined && (
                    <Chip variant="soft" size="sm" sx={{ ml: 1 }}>
                      {reportsCount}
                    </Chip>
                  )}
                </ListItemContent>
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Box>
    </Box>
  );
}
