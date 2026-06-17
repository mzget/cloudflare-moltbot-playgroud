import React from 'react';
import { List, ListItem, ListItemButton, ListItemContent, ListItemDecorator, Typography, Box, Chip, Tooltip } from '@mui/joy';
import { BarChart3, TrendingUp, Terminal, Info, Bot, LayoutDashboard, Database } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  reportsCount?: number;
  collapsed?: boolean;
}

export default function Sidebar({ activeTab, setActiveTab, reportsCount, collapsed }: SidebarProps) {
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
    <Box>
      <Box sx={{ py: 2 }}>
        <Typography
          level="body-xs"
          sx={{
            opacity: collapsed ? 0 : 0.5,
            height: collapsed ? 0 : 'auto',
            overflow: 'hidden',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            fontWeight: 700,
            mb: collapsed ? 0 : 2,
            px: 2,
            transition: 'all 0.3s ease'
          }}
        >
          {t('sidebar.command_center')}
        </Typography>
        <List sx={{ '--ListItem-radius': '12px', gap: 1 }}>
          {menuItems.map((item) => (
            <ListItem key={item.id}>
              <Tooltip 
                title={item.label} 
                placement="right" 
                variant="solid"
                arrow
                disabled={!collapsed}
                sx={{ 
                  borderRadius: '8px', 
                  fontWeight: 600,
                  boxShadow: 'md',
                }}
              >
                <ListItemButton
                  selected={activeTab === item.id}
                  onClick={() => setActiveTab(item.id)}
                  sx={{
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    px: collapsed ? 1 : 2,
                    color: activeTab === item.id ? 'primary.plainColor' : 'text.secondary',
                    bgcolor: activeTab === item.id ? 'var(--joy-palette-primary-softBg)' : 'transparent',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      bgcolor: 'background.level1',
                      color: 'text.primary',
                    },
                    '&.Mui-selected': {
                      borderRight: collapsed ? 'none' : '3px solid var(--joy-palette-primary-solidBg)',
                      borderLeft: collapsed ? '3px solid var(--joy-palette-primary-solidBg)' : 'none',
                      '&:hover': {
                        bgcolor: 'var(--joy-palette-primary-softHoverBg)',
                      }
                    }
                  }}
                >
                  <ListItemDecorator sx={{ 
                    color: activeTab === item.id ? 'var(--joy-palette-primary-solidBg)' : 'inherit',
                    minInlineSize: collapsed ? 0 : '2.5rem',
                  }}>
                    {item.icon}
                  </ListItemDecorator>
                  <ListItemContent sx={{ 
                    opacity: collapsed ? 0 : 1, 
                    width: collapsed ? 0 : 'auto',
                    transition: 'opacity 0.2s ease' 
                  }}>
                    <Typography level="title-sm" sx={{ whiteSpace: 'nowrap' }}>{item.label}</Typography>
                  </ListItemContent>
                  {!collapsed && item.id === 'market' && reportsCount !== undefined && (
                    <Chip variant="soft" size="sm" sx={{ ml: 1 }}>
                      {reportsCount}
                    </Chip>
                  )}
                </ListItemButton>
              </Tooltip>
            </ListItem>
          ))}
        </List>
      </Box>
    </Box>
  );
}
