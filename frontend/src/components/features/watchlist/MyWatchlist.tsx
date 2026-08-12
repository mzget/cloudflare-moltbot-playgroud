import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useWatchlist, type WatchlistItem } from './hooks/useWatchlist';
import { useAlertRules } from './hooks/useAlertRules';
import { WatchlistCard } from './WatchlistCard';
import AddSecurityBox from './AddSecurityBox';
import { EditSecurityModal } from './EditSecurityModal';
import { AlertsManagerModal } from './AlertsManagerModal';
import {
  Typography,
  Select,
  Option,
  Grid,
  Modal,
  ModalDialog,
  DialogTitle,
  DialogContent,
  Stack,
  Button,
  Snackbar,
  Alert,
} from '@mui/joy';
import { Trash2, Check, AlertTriangle } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { API_BASE_URL } from '../../../config';
import { glassStyle } from '../../../styles/glass';

const EMPTY_EVENTS: any[] = [];

export default function MyWatchlist() {
  const navigate = useNavigate();
  const handleViewAnalysis = useCallback((symbol: string) => {
    navigate({
      to: '/analysis',
      search: { symbol, tab: 'report' },
    });
  }, [navigate]);

  const {
    watchlist,
    marketStats,
    addWatchlist,
    updateWatchlistDetails,
    deleteWatchlist,
    toggleActive,
    togglePortfolioStatus,
    fetchWatchlist,
  } = useWatchlist();

  const {
    symbolRules,
    fetchRulesForSymbol,
    createRule,
    toggleRule,
    deleteRule,
  } = useAlertRules(fetchWatchlist);

  // Toast state
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastColor, setToastColor] = useState<'success' | 'danger'>('success');

  // Today Market Events State for UI Badging
  const [todayEventsMap, setTodayEventsMap] = useState<Record<string, any[]>>({});

  useEffect(() => {
    async function fetchTodayEvents() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/market-events/today`);
        if (res.ok) {
          const events = await res.json();
          const map: Record<string, any[]> = {};
          if (Array.isArray(events)) {
            for (const evt of events) {
              const sym = evt.symbol.toUpperCase();
              if (!map[sym]) map[sym] = [];
              map[sym].push(evt);
            }
          }
          setTodayEventsMap(map);
        }
      } catch (e) {
        console.error('Failed to fetch today market events:', e);
      }
    }
    fetchTodayEvents();
  }, []);

  // Edit Security Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WatchlistItem | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  const handleOpenEditModal = useCallback((item: WatchlistItem) => {
    setEditingItem(item);
    setIsEditModalOpen(true);
  }, []);

  const handleCloseEditModal = useCallback(() => {
    setIsEditModalOpen(false);
    setEditingItem(null);
  }, []);

  const handleSaveEdit = useCallback(
    async (
      symbol: string,
      name: string,
      type: string,
      sectorLabel: string | null,
      sectorLabelColor: string | null
    ) => {
      if (!symbol) return;
      try {
        const res = await updateWatchlistDetails(
          symbol,
          name,
          type,
          sectorLabel,
          sectorLabelColor
        );
        if (res.ok) {
          setIsEditModalOpen(false);
          setEditingItem(null);
        }
      } catch (e) {
        console.error('Failed to update watchlist item', e);
        throw e;
      }
    },
    [updateWatchlistDetails]
  );

  const [sortBy, setSortBy] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('watchlist_sort_by');
      if (saved && ['symbol', 'symbol-desc', 'name', 'in_portfolio', 'is_active'].includes(saved)) {
        return saved;
      }
    }
    return 'symbol';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('watchlist_sort_by', sortBy);
    }
  }, [sortBy]);

  const sortedWatchlist = useMemo(() => {
    return [...watchlist].sort((a, b) => {
      if (sortBy === 'symbol') {
        return a.symbol.localeCompare(b.symbol);
      }
      if (sortBy === 'symbol-desc') {
        return b.symbol.localeCompare(a.symbol);
      }
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'in_portfolio') {
        if (a.in_portfolio !== b.in_portfolio) {
          return b.in_portfolio - a.in_portfolio;
        }
        return a.symbol.localeCompare(b.symbol);
      }
      if (sortBy === 'is_active') {
        if (a.is_active !== b.is_active) {
          return b.is_active - a.is_active;
        }
        return a.symbol.localeCompare(b.symbol);
      }
      return 0;
    });
  }, [watchlist, sortBy]);

  // Alert Modal State
  const [isAlertsModalOpen, setIsAlertsModalOpen] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

  const handleOpenAlertsModal = useCallback(
    (symbol: string) => {
      setSelectedSymbol(symbol);
      fetchRulesForSymbol(symbol);
      setIsAlertsModalOpen(true);
    },
    [fetchRulesForSymbol]
  );

  const handleCloseAlertsModal = useCallback(() => {
    setIsAlertsModalOpen(false);
    setSelectedSymbol(null);
  }, []);

  const handleCreateRule = useCallback(
    async (metric: string, condition: string, targetVal: number) => {
      if (!selectedSymbol) return;
      try {
        await createRule(selectedSymbol, metric, condition, targetVal);
      } catch (e) {
        console.error('Failed to create alert rule', e);
        throw e;
      }
    },
    [selectedSymbol, createRule]
  );

  const handleToggleRule = useCallback(
    async (ruleId: number, currentStatus: number) => {
      try {
        if (selectedSymbol) {
          await toggleRule(selectedSymbol, ruleId, currentStatus);
        }
      } catch (e) {
        console.error('Failed to toggle alert rule', e);
      }
    },
    [selectedSymbol, toggleRule]
  );

  const handleDeleteRule = useCallback(
    async (ruleId: number) => {
      try {
        if (selectedSymbol) {
          await deleteRule(selectedSymbol, ruleId);
        }
      } catch (e) {
        console.error('Failed to delete alert rule', e);
      }
    },
    [selectedSymbol, deleteRule]
  );

  const currentSymbolStats = useMemo(
    () => marketStats.find((s) => s.symbol === selectedSymbol),
    [marketStats, selectedSymbol]
  );

  // Stable callbacks for AddSecurityBox
  const handleAddSuccess = useCallback(() => {
    setToastColor('success');
    setToastMessage('Symbol added successfully!');
    setToastOpen(true);
  }, []);

  const handleAddError = useCallback((errMsg: string) => {
    setToastColor('danger');
    setToastMessage(errMsg);
    setToastOpen(true);
  }, []);

  const handleDelete = useCallback(
    async (symbol: string) => {
      try {
        await deleteWatchlist(symbol);
      } catch (e) {
        console.error('Failed to delete from watchlist', e);
      }
    },
    [deleteWatchlist]
  );

  const handleToggleActive = useCallback(
    async (symbol: string, currentStatus: number) => {
      try {
        await toggleActive(symbol, currentStatus);
      } catch (e) {
        console.error('Failed to toggle watchlist status', e);
      }
    },
    [toggleActive]
  );

  const handleTogglePortfolio = useCallback(
    async (symbol: string, currentPortfolioStatus: number) => {
      try {
        await togglePortfolioStatus(symbol, currentPortfolioStatus);
      } catch (e) {
        console.error('Failed to toggle portfolio status', e);
      }
    },
    [togglePortfolioStatus]
  );

  return (
    <>
      <AddSecurityBox
        onAdd={addWatchlist}
        onSuccess={handleAddSuccess}
        onError={handleAddError}
      />

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Typography level="title-md" sx={{ opacity: 0.6 }}>
          {watchlist.length} {watchlist.length === 1 ? 'Security' : 'Securities'}
        </Typography>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ width: { xs: '100%', sm: 'auto' } }}>
          <Typography level="body-sm" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
            Sort By:
          </Typography>
          <Select
            value={sortBy}
            onChange={(_, val) => setSortBy(val || 'symbol')}
            size="sm"
            sx={{
              minWidth: 180,
              flex: { xs: 1, sm: 'none' },
              ...glassStyle,
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                borderColor: 'rgba(255, 255, 255, 0.15)',
              },
            }}
          >
            <Option value="symbol">Symbol (A-Z)</Option>
            <Option value="symbol-desc">Symbol (Z-A)</Option>
            <Option value="name">Company Name (A-Z)</Option>
            <Option value="in_portfolio">In Portfolio First</Option>
            <Option value="is_active">Active First</Option>
          </Select>
        </Stack>
      </Stack>

      <Grid container spacing={2}>
        {sortedWatchlist.map((item) => (
          <Grid key={item.symbol} xs={12} sm={12} md={4}>
            <WatchlistCard
              item={item}
              todayEvents={todayEventsMap[item.symbol.toUpperCase()] || EMPTY_EVENTS}
              onEdit={handleOpenEditModal}
              onAlertsClick={handleOpenAlertsModal}
              onViewAnalysis={handleViewAnalysis}
              onToggleActive={handleToggleActive}
              onTogglePortfolio={handleTogglePortfolio}
            />
          </Grid>
        ))}
      </Grid>

      {/* Alert Rules Manager Modal */}
      <AlertsManagerModal
        open={isAlertsModalOpen}
        symbol={selectedSymbol}
        symbolRules={symbolRules}
        currentSymbolStats={currentSymbolStats}
        onClose={handleCloseAlertsModal}
        onCreateRule={handleCreateRule}
        onToggleRule={handleToggleRule}
        onDeleteRule={handleDeleteRule}
      />

      {/* Edit Symbol Detail Modal */}
      <EditSecurityModal
        open={isEditModalOpen}
        item={editingItem}
        onClose={handleCloseEditModal}
        onSave={handleSaveEdit}
        onDeleteClick={() => setIsDeleteConfirmOpen(true)}
      />

      {/* Delete Confirm Dialog */}
      <Modal open={isDeleteConfirmOpen} onClose={() => setIsDeleteConfirmOpen(false)}>
        <ModalDialog
          variant="outlined"
          role="alertdialog"
          sx={{
            ...glassStyle,
            maxWidth: 400,
            borderRadius: '16px',
            border: '1px solid rgba(239, 68, 68, 0.25)',
          }}
        >
          <DialogTitle>
            <Trash2 size={18} style={{ color: '#ef4444' }} />
            ลบออกจาก Watchlist
          </DialogTitle>
          <DialogContent>
            <Typography level="body-sm" sx={{ opacity: 0.8 }}>
              คุณแน่ใจหรือไม่ว่าต้องการลบ{' '}
              <Typography component="span" fontWeight="bold" sx={{ color: '#ef4444' }}>
                {editingItem?.symbol}
              </Typography>{' '}
              ออกจาก Watchlist?
            </Typography>
          </DialogContent>
          <Stack direction="row" spacing={1.5} justifyContent="flex-end" sx={{ mt: 1 }}>
            <Button
              variant="plain"
              color="neutral"
              size="sm"
              onClick={() => setIsDeleteConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="solid"
              color="danger"
              size="sm"
              startDecorator={<Trash2 size={14} />}
              onClick={() => {
                if (editingItem?.symbol) {
                  handleDelete(editingItem.symbol);
                }
                setIsDeleteConfirmOpen(false);
                handleCloseEditModal();
              }}
            >
              Delete
            </Button>
          </Stack>
        </ModalDialog>
      </Modal>

      {/* Snackbar Toast Alert */}
      <Snackbar
        open={toastOpen}
        autoHideDuration={4000}
        onClose={() => setToastOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        variant="soft"
        color={toastColor}
        sx={{
          borderRadius: '12px',
          backgroundColor: 'rgba(20, 20, 20, 0.85)',
          backdropFilter: 'blur(12px)',
          border:
            '1px solid ' +
            (toastColor === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'),
          boxShadow:
            '0 8px 32px ' +
            (toastColor === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'),
          p: 0.5,
        }}
      >
        <Alert
          variant="soft"
          color={toastColor}
          startDecorator={toastColor === 'success' ? <Check size={18} /> : <AlertTriangle size={18} />}
          sx={{ width: '100%', bg: 'transparent', p: 1, color: toastColor === 'success' ? '#10b981' : '#ef4444' }}
        >
          {toastMessage}
        </Alert>
      </Snackbar>
    </>
  );
}
