import React from 'react';
import { List, ListItem, ListItemButton, ListItemContent, ListItemDecorator, Typography, Box, Chip } from '@mui/joy';
import { BarChart3, TrendingUp, Terminal, Info, Bot, LayoutDashboard, Database } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  reportsCount?: number;
  collapsed?: boolean;
}

export default function Sidebar({ activeTab, setActiveTab, reportsCount }: SidebarProps) {
  const { t } = useTranslation();
  const menuItems = [
    { id: 'dashboard', label: t('sidebar.dashboard'), icon: <LayoutDashboard size={20} /> },
    { id: 'market', label: t('sidebar.market_intelligence'), icon: <BarChart3 size={20} /> },
    { id: 'watchlist', label: t('sidebar.watchlist'), icon: <TrendingUp size={20} /> },
    { id: 'command-center', label: t('sidebar.command_center'), icon: <Terminal size={20} /> },
    { id: 'agent', label: t('sidebar.agent_chat'), icon: <Bot size={20} /> },
    { id: 'db-agent', label: t('sidebar.db_agent'), icon: <Database size={20} /> },
    { id: 'about', label: t('sidebar.about_oaktree'), icon: <Info size={20} /> },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ py: 1 }}>
        <Typography
          level="body-xs"
          sx={{
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            fontWeight: 700,
            mb: 1.5,
            px: 1.5,
            color: 'text.tertiary'
          }}
        >
          {t('sidebar.command_center')}
        </Typography>
        <List sx={{ '--ListItem-radius': '12px', gap: 0.75 }}>
          {menuItems.map((item) => {
            const isSelected = activeTab === item.id;
            return (
              <ListItem key={item.id}>
                <ListItemButton
                  selected={isSelected}
                  onClick={() => setActiveTab(item.id)}
                  sx={{
                    px: 1.75,
                    py: 1.25,
                    borderRadius: '12px',
                    color: isSelected ? 'primary.plainColor' : 'text.secondary',
                    bgcolor: isSelected ? 'var(--joy-palette-primary-softBg)' : 'transparent',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      bgcolor: isSelected ? 'var(--joy-palette-primary-softHoverBg)' : 'background.level1',
                      color: 'text.primary',
                    },
                    '&.Mui-selected': {
                      borderLeft: '3px solid var(--joy-palette-primary-solidBg)',
                    }
                  }}
                >
                  <ListItemDecorator sx={{ 
                    color: isSelected ? 'var(--joy-palette-primary-solidBg)' : 'inherit',
                    minInlineSize: '2.25rem',
                  }}>
                    {item.icon}
                  </ListItemDecorator>
                  <ListItemContent>
                    <Typography level="title-sm" sx={{ fontWeight: isSelected ? 700 : 500 }}>
                      {item.label}
                    </Typography>
                  </ListItemContent>
                  {item.id === 'market' && reportsCount !== undefined && reportsCount > 0 && (
                    <Chip variant={isSelected ? 'solid' : 'soft'} color="primary" size="sm" sx={{ ml: 1, height: 20, minWidth: 20, fontSize: '0.75rem', fontWeight: 700 }}>
                      {reportsCount}
                    </Chip>
                  )}
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </Box>
    </Box>
  );
}
