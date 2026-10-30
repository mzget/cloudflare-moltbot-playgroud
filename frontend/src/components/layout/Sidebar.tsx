import React from 'react';
import { List, ListItem, ListItemButton, ListItemContent, ListItemDecorator, Typography, Box, Chip, Button, Divider } from '@mui/joy';
import { 
  BarChart3, TrendingUp, Terminal, Info, Bot, LayoutDashboard, Database,
  Receipt, PiggyBank, Wallet, Plus, Sparkles, Upload 
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearch, useNavigate } from '@tanstack/react-router';
import { dispatchFinanceAction } from '../../store/financeBridgeStore';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  reportsCount?: number;
  collapsed?: boolean;
}

export default function Sidebar({ activeTab, setActiveTab, reportsCount }: SidebarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as any;
  const currentFinanceTab = (search?.tab as string) || 'dashboard';
  const currentWalletId = (search?.wallet as string) || 'all';

  const isSimplicity = activeTab === 'finance' || (typeof window !== 'undefined' && window.location.pathname.startsWith('/finance'));

  const menuItems = [
    { id: 'dashboard', label: t('sidebar.dashboard'), icon: <LayoutDashboard size={20} /> },
    { id: 'market', label: t('sidebar.market_intelligence'), icon: <BarChart3 size={20} /> },
    { id: 'watchlist', label: t('sidebar.watchlist'), icon: <TrendingUp size={20} /> },
    { id: 'command-center', label: t('sidebar.command_center'), icon: <Terminal size={20} /> },
    { id: 'agent', label: t('sidebar.agent_chat'), icon: <Bot size={20} /> },
    { id: 'db-agent', label: t('sidebar.db_agent'), icon: <Database size={20} /> },
    { id: 'about', label: t('sidebar.about_oaktree'), icon: <Info size={20} /> },
  ];

  const simplicityTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { id: 'transactions', label: 'Transactions', icon: <Receipt size={20} /> },
    { id: 'budgets', label: 'Budgets', icon: <PiggyBank size={20} /> },
    { id: 'wallets', label: 'Wallets', icon: <Wallet size={20} /> },
  ];

  const handleAction = (action: 'add-tx' | 'ai-scan' | 'csv-import') => {
    dispatchFinanceAction(action);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Mobile Drawer Segmented Pill Switcher */}
      <Box sx={{ mb: 2 }}>
        <Box
          role="tablist"
          aria-label="Application Switcher"
          sx={{
            display: 'flex',
            alignItems: 'center',
            p: '3px',
            borderRadius: '24px',
            bgcolor: 'background.level1',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Button
            size="sm"
            variant="plain"
            fullWidth
            role="tab"
            aria-selected={!isSimplicity}
            data-testid="sidebar-switcher-oaktree"
            onClick={() => {
              if (!isSimplicity) return;
              setActiveTab('dashboard');
              navigate({ to: '/dashboard', search: {} });
            }}
            sx={{
              borderRadius: '20px',
              py: 0.5,
              fontWeight: !isSimplicity ? 700 : 500,
              color: !isSimplicity ? '#10b981' : 'text.secondary',
              bgcolor: !isSimplicity ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
            }}
          >
            🌳 Oaktree
          </Button>
          <Button
            size="sm"
            variant="plain"
            fullWidth
            role="tab"
            aria-selected={isSimplicity}
            data-testid="sidebar-switcher-simplicity"
            onClick={() => {
              if (isSimplicity) return;
              setActiveTab('finance');
              navigate({
                to: '/finance',
                search: { tab: 'dashboard', wallet: 'all' },
              });
            }}
            sx={{
              borderRadius: '20px',
              py: 0.5,
              fontWeight: isSimplicity ? 700 : 500,
              color: isSimplicity ? '#10b981' : 'text.secondary',
              bgcolor: isSimplicity ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
            }}
          >
            💳 Simplicity
          </Button>
        </Box>
      </Box>

      {/* Navigation Links */}
      <Box sx={{ py: 1, flex: 1, overflowY: 'auto' }}>
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
          {isSimplicity ? 'Simplicity Finance' : t('sidebar.command_center')}
        </Typography>

        {isSimplicity ? (
          <>
            <List sx={{ '--ListItem-radius': '12px', gap: 0.75 }}>
              {simplicityTabs.map((item) => {
                const isSelected = currentFinanceTab === item.id;
                return (
                  <ListItem key={item.id}>
                    <ListItemButton
                      selected={isSelected}
                      onClick={() => {
                        navigate({
                          to: '/finance',
                          search: { tab: item.id as any, wallet: currentWalletId },
                        });
                        setActiveTab('finance');
                      }}
                      sx={{
                        px: 1.75,
                        py: 1.25,
                        borderRadius: '12px',
                        color: isSelected ? 'primary.plainColor' : 'text.secondary',
                        bgcolor: isSelected ? 'var(--joy-palette-primary-softBg)' : 'transparent',
                        '&.Mui-selected': {
                          borderLeft: '3px solid var(--joy-palette-primary-solidBg)',
                        }
                      }}
                    >
                      <ListItemDecorator sx={{ color: isSelected ? '#10b981' : 'inherit', minInlineSize: '2.25rem' }}>
                        {item.icon}
                      </ListItemDecorator>
                      <ListItemContent>
                        <Typography level="title-sm" sx={{ fontWeight: isSelected ? 700 : 500 }}>
                          {item.label}
                        </Typography>
                      </ListItemContent>
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>

            {/* Quick Actions in Mobile Drawer */}
            <Divider sx={{ my: 2 }} />
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
              Quick Actions
            </Typography>
            <List sx={{ '--ListItem-radius': '12px', gap: 0.75 }}>
              <ListItem>
                <ListItemButton
                  onClick={() => handleAction('add-tx')}
                  sx={{ px: 1.75, py: 1.25, borderRadius: '12px', bgcolor: 'rgba(16, 185, 129, 0.1)' }}
                >
                  <ListItemDecorator sx={{ color: '#10b981', minInlineSize: '2.25rem' }}>
                    <Plus size={20} />
                  </ListItemDecorator>
                  <ListItemContent>
                    <Typography level="title-sm" sx={{ fontWeight: 700, color: '#10b981' }}>
                      + Add Transaction
                    </Typography>
                  </ListItemContent>
                </ListItemButton>
              </ListItem>
              <ListItem>
                <ListItemButton
                  onClick={() => handleAction('ai-scan')}
                  sx={{ px: 1.75, py: 1.25, borderRadius: '12px' }}
                >
                  <ListItemDecorator sx={{ color: '#a855f7', minInlineSize: '2.25rem' }}>
                    <Sparkles size={20} />
                  </ListItemDecorator>
                  <ListItemContent>
                    <Typography level="title-sm" sx={{ fontWeight: 600 }}>
                      AI Scanner
                    </Typography>
                  </ListItemContent>
                </ListItemButton>
              </ListItem>
              <ListItem>
                <ListItemButton
                  onClick={() => handleAction('csv-import')}
                  sx={{ px: 1.75, py: 1.25, borderRadius: '12px' }}
                >
                  <ListItemDecorator sx={{ color: 'text.secondary', minInlineSize: '2.25rem' }}>
                    <Upload size={20} />
                  </ListItemDecorator>
                  <ListItemContent>
                    <Typography level="title-sm" sx={{ fontWeight: 600 }}>
                      CSV Import
                    </Typography>
                  </ListItemContent>
                </ListItemButton>
              </ListItem>
            </List>
          </>
        ) : (
          <List sx={{ '--ListItem-radius': '12px', gap: 0.75 }}>
            {menuItems.map((item) => {
              const isSelected = activeTab === item.id;
              return (
                <ListItem key={item.id}>
                  <ListItemButton
                    component="a"
                    href={`/${item.id}`}
                    selected={isSelected}
                    onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
                      if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && e.button === 0) {
                        e.preventDefault();
                        setActiveTab(item.id);
                      }
                    }}
                    sx={{
                      px: 1.75,
                      py: 1.25,
                      borderRadius: '12px',
                      textDecoration: 'none',
                      color: isSelected ? 'primary.plainColor' : 'text.secondary',
                      bgcolor: isSelected ? 'var(--joy-palette-primary-softBg)' : 'transparent',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        bgcolor: isSelected ? 'var(--joy-palette-primary-softHoverBg)' : 'background.level1',
                        color: 'text.primary',
                        textDecoration: 'none',
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
        )}
      </Box>
    </Box>
  );
}
