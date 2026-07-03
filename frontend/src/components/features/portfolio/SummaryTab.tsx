import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Sheet, Chip, Divider, Stack, IconButton, Table,
  Button, Input, Modal, ModalDialog, DialogTitle, DialogContent, ModalClose,
  FormControl, FormLabel, Grid, TabList, Tab, Tabs, LinearProgress
} from '@mui/joy';
import {
  TrendingUp, Eye, EyeOff, Edit, Plus, Trash2, Save, Settings,
  Coins, Landmark, Percent, RefreshCw, BarChart2, ChevronDown, ChevronUp
} from 'lucide-react';
import { glassStyle } from '../../../styles/glass';
import { formatCurrency, formatPct } from './YahooPortfolio';
import type { PortfolioSummary } from './YahooPortfolio';
import PortfolioChart from './PortfolioChart';
import AssetAllocationChart from './AssetAllocationChart';
import FastInlineInput from '../../common/FastInlineInput';
import { useSettingsStore } from '../../../store/settingsStore';
import { API_BASE_URL } from '../../../config';



interface SummaryTabProps {
  summary: PortfolioSummary;
  holdingsCount: number;
  openPositionsCount: number;
  holdings: any[];
}

export default function SummaryTab({ summary: initialSummary, holdingsCount, openPositionsCount, holdings }: SummaryTabProps) {
  const showMoneyValues = useSettingsStore(state => state.showMoneyValues);
  const setShowMoneyValues = useSettingsStore(state => state.setShowMoneyValues);
  const usdThbRate = useSettingsStore(state => state.usdThbRate);

  // Summary state (dynamically fetched with rate)
  const [summary, setSummary] = useState<PortfolioSummary>(initialSummary);

  const stocksSummary = summary.stocks || {
    total_market_value: 0,
    total_cost: 0,
    day_change_amt: 0,
    day_change_pct: 0,
    unrealized_gain_amt: 0,
    unrealized_gain_pct: 0,
    realized_gain_amt: 0,
    total_dividends: 0
  };

  // Custom data states
  const [yearlyHistory, setYearlyHistory] = useState<any[]>([]);
  const [taxSavings, setTaxSavings] = useState<any[]>([]);
  const [funds, setFunds] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [allocations, setAllocations] = useState<any[]>([]);
  const [fundsForm, setFundsForm] = useState<Record<number, string>>({});
  const [categoriesForm, setCategoriesForm] = useState<Record<number, string>>({});
  const [brokers, setBrokers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const displayedBrokers = React.useMemo(() => {
    return brokers.filter(b => b.broker_name !== 'Cash');
  }, [brokers]);

  const activeStocksCount = React.useMemo(() => {
    return holdings.filter(h => h.status === 'Open' && (h.shares || 0) > 0).length;
  }, [holdings]);

  const activeFundsCount = React.useMemo(() => {
    return funds.filter(fund => {
      if (fund.broker_name === 'Cash') return false;
      const totalAlloc = allocations
        .filter(a => a.fund_id === fund.id)
        .reduce((sum, a) => sum + (a.amount || 0), 0);
      return totalAlloc > 0;
    }).length;
  }, [funds, allocations]);

  const activeCashCount = React.useMemo(() => {
    const hasCashAllocation = funds.some(fund => {
      if (fund.broker_name !== 'Cash') return false;
      const totalAlloc = allocations
        .filter(a => a.fund_id === fund.id)
        .reduce((sum, a) => sum + (a.amount || 0), 0);
      return totalAlloc > 0;
    });

    const hasCashBroker = brokers.some(b => b.broker_name === 'Cash' && (b.balance || 0) > 0);

    return (hasCashAllocation || hasCashBroker) ? 1 : 0;
  }, [funds, allocations, brokers]);

  const brokerTotals = React.useMemo(() => {
    if (displayedBrokers.length === 0) return null;
    const cost = displayedBrokers.reduce((sum, b) => sum + (b.cost || 0), 0);
    const balance = displayedBrokers.reduce((sum, b) => sum + (b.balance || 0), 0);
    const gain_amt = balance - cost;
    const gain_pct = cost > 0 ? (gain_amt / cost) * 100 : 0;
    return { cost, balance, gain_amt, gain_pct };
  }, [displayedBrokers]);

  // Expanded years state for yearly history table
  const [expandedYears, setExpandedYears] = useState<Record<number, boolean>>({});

  const toggleYearExpanded = (year: number) => {
    setExpandedYears(prev => ({
      ...prev,
      [year]: !prev[year]
    }));
  };

  // Edit states

  const [editingYear, setEditingYear] = useState<any>(null);
  const [yearlyModalOpen, setYearlyModalOpen] = useState(false);
  const [editingTax, setEditingTax] = useState<any>(null);
  const [taxModalOpen, setTaxModalOpen] = useState(false);
  const [isEditingAlloc, setIsEditingAlloc] = useState(false);
  const [allocForm, setAllocForm] = useState<Record<string, string>>({});

  // Broker overrides state
  const [isEditingBrokers, setIsEditingBrokers] = useState(false);
  const [brokerOverrideForm, setBrokerOverrideForm] = useState<Record<string, { cost: string; balance: string }>>({});
  const [submittingBroker, setSubmittingBroker] = useState<string | null>(null);

  // Fetch Summary and Custom Data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [summaryRes, historyRes, taxRes, fundsRes, catsRes, allocsRes, brokersRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/portfolio/summary?rate=${usdThbRate}`),
        fetch(`${API_BASE_URL}/api/portfolio/history/yearly`),
        fetch(`${API_BASE_URL}/api/portfolio/tax-savings`),
        fetch(`${API_BASE_URL}/api/portfolio/funds`),
        fetch(`${API_BASE_URL}/api/portfolio/categories`),
        fetch(`${API_BASE_URL}/api/portfolio/fund-allocations`),
        fetch(`${API_BASE_URL}/api/portfolio/brokers?rate=${usdThbRate}`),
      ]);

      if (summaryRes.ok) setSummary(await summaryRes.json());
      if (historyRes.ok) setYearlyHistory(await historyRes.json());
      if (taxRes.ok) setTaxSavings(await taxRes.json());
      if (fundsRes.ok) setFunds(await fundsRes.json());
      if (catsRes.ok) setCategories(await catsRes.json());
      if (allocsRes.ok) setAllocations(await allocsRes.json());
      if (brokersRes.ok) {
        const brokerData = await brokersRes.json();
        setBrokers(brokerData);
        // Initialize override form
        const formInit: Record<string, { cost: string; balance: string }> = {};
        brokerData.forEach((b: any) => {
          formInit[b.broker_name] = {
            cost: b.cost_override !== null ? b.cost_override.toString() : '',
            balance: b.balance_override !== null ? b.balance_override.toString() : ''
          };
        });
        setBrokerOverrideForm(formInit);
      }
    } catch (e) {
      console.error('Failed to fetch summary custom data:', e);
    } finally {
      setLoading(false);
    }
  }, [usdThbRate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);


  const handleSaveYearly = async () => {
    if (!editingYear || !editingYear.year) return;
    try {
      const cap = parseFloat(editingYear.capital) || 0;
      const bal = parseFloat(editingYear.balance) || 0;
      const gainPct = cap > 0 ? (bal - cap) / cap : 0;

      const res = await fetch(`${API_BASE_URL}/api/portfolio/history/yearly`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editingYear,
          total_gain_pct: gainPct
        })
      });
      if (res.ok) {
        setYearlyModalOpen(false);
        fetchData();
      }
    } catch (e) { console.error(e); }
  };

  const handleDeleteYearly = async (year: number) => {
    if (!confirm(`Are you sure you want to delete performance history for ${year}?`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/portfolio/history/yearly/${year}`, {
        method: 'DELETE'
      });
      if (res.ok) fetchData();
    } catch (e) { console.error(e); }
  };

  // Tax Savings operations
  const handleSaveTax = async () => {
    if (!editingTax || !editingTax.year) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/portfolio/tax-savings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingTax)
      });
      if (res.ok) {
        setTaxModalOpen(false);
        fetchData();
      }
    } catch (e) { console.error(e); }
  };

  const handleDeleteTax = async (year: number) => {
    if (!confirm(`Are you sure you want to delete tax savings for ${year}?`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/portfolio/tax-savings/${year}`, {
        method: 'DELETE'
      });
      if (res.ok) fetchData();
    } catch (e) { console.error(e); }
  };

  // Allocations Edit open
  const handleStartEditingAlloc = () => {
    const formInit: Record<string, string> = {};
    categories.forEach(c => {
      funds.forEach(f => {
        const found = allocations.find(a => a.category_id === c.id && a.fund_id === f.id);
        formInit[`${c.id}-${f.id}`] = found ? found.amount.toString() : '';
      });
    });
    setAllocForm(formInit);

    const fundsInit: Record<number, string> = {};
    funds.forEach(f => {
      fundsInit[f.id] = f.name;
    });
    setFundsForm(fundsInit);

    const catsInit: Record<number, string> = {};
    categories.forEach(c => {
      catsInit[c.id] = c.name;
    });
    setCategoriesForm(catsInit);

    setIsEditingAlloc(true);
  };

  const handleSaveAllocations = async () => {
    const payload = Object.entries(allocForm).map(([key, val]) => {
      const [catId, fundId] = key.split('-').map(Number);
      return {
        category_id: catId,
        fund_id: fundId,
        amount: parseFloat(val) || 0
      };
    });

    try {
      const res = await fetch(`${API_BASE_URL}/api/portfolio/fund-allocations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      // Save fund name edits
      const fundPromises = Object.entries(fundsForm).map(async ([idStr, newName]) => {
        const id = Number(idStr);
        const originalFund = funds.find(f => f.id === id);
        if (originalFund && originalFund.name !== newName) {
          await fetch(`${API_BASE_URL}/api/portfolio/funds`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id,
              name: newName,
              broker_name: originalFund.broker_name
            })
          });
        }
      });

      // Save category name edits
      const catPromises = Object.entries(categoriesForm).map(async ([idStr, newName]) => {
        const id = Number(idStr);
        const originalCat = categories.find(c => c.id === id);
        if (originalCat && originalCat.name !== newName) {
          await fetch(`${API_BASE_URL}/api/portfolio/categories`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id,
              name: newName,
              target_weight: originalCat.target_weight
            })
          });
        }
      });

      await Promise.all([...fundPromises, ...catPromises]);

      if (res.ok) {
        setIsEditingAlloc(false);
        fetchData();
      }
    } catch (e) { console.error(e); }
  };

  // Broker Overrides operations
  const handleStartEditingBrokers = () => {
    const formInit: Record<string, { cost: string; balance: string }> = {};
    brokers.forEach((b: any) => {
      formInit[b.broker_name] = {
        cost: b.cost_override !== null ? b.cost_override.toString() : '',
        balance: b.balance_override !== null ? b.balance_override.toString() : ''
      };
    });
    setBrokerOverrideForm(formInit);
    setIsEditingBrokers(true);
  };

  const handleCancelEditingBrokers = () => {
    const formInit: Record<string, { cost: string; balance: string }> = {};
    brokers.forEach((b: any) => {
      formInit[b.broker_name] = {
        cost: b.cost_override !== null ? b.cost_override.toString() : '',
        balance: b.balance_override !== null ? b.balance_override.toString() : ''
      };
    });
    setBrokerOverrideForm(formInit);
    setIsEditingBrokers(false);
  };

  const handleSaveBrokerOverrides = async () => {
    setSubmittingBroker('all');
    try {
      const promises = displayedBrokers.map(broker => {
        const cost = brokerOverrideForm[broker.broker_name]?.cost;
        const balance = brokerOverrideForm[broker.broker_name]?.balance;
        return fetch(`${API_BASE_URL}/api/portfolio/brokers/override`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            broker_name: broker.broker_name,
            cost_override: cost === '' ? null : parseFloat(cost),
            balance_override: balance === '' ? null : parseFloat(balance)
          })
        });
      });
      await Promise.all(promises);
      setIsEditingBrokers(false);
      fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setSubmittingBroker(null);
    }
  };

  // Matrix sums calculation
  const getFundTotal = (fundId: number) => {
    if (isEditingAlloc) {
      return categories.reduce((sum, cat) => {
        const val = parseFloat(allocForm[`${cat.id}-${fundId}`]) || 0;
        return sum + val;
      }, 0);
    }
    return allocations
      .filter(a => a.fund_id === fundId)
      .reduce((sum, a) => sum + a.amount, 0);
  };

  const getCategoryTotal = (catId: number) => {
    if (isEditingAlloc) {
      return funds.reduce((sum, fund) => {
        const val = parseFloat(allocForm[`${catId}-${fund.id}`]) || 0;
        return sum + val;
      }, 0);
    }
    return allocations
      .filter(a => a.category_id === catId)
      .reduce((sum, a) => sum + a.amount, 0);
  };

  const getGrandTotal = () => {
    if (isEditingAlloc) {
      return Object.values(allocForm).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
    }
    return allocations.reduce((sum, a) => sum + a.amount, 0);
  };

  // Latest tax savings progress details (Year 2025/2026)
  const currentTaxYearData = taxSavings.length > 0 ? taxSavings[taxSavings.length - 1] : null;
  const currentRmf = currentTaxYearData?.rmf || 0;
  const currentSsf = currentTaxYearData?.ssf || 0;
  const combinedTaxSavingTotal = currentRmf + currentSsf + (currentTaxYearData?.ltf || 0);

    // Memoized charts to avoid re-renders on keystroke in Edit Mode

    const memoizedAssetAllocationChart = React.useMemo(() => (

      <AssetAllocationChart

        brokers={brokers}

        categories={categories}

        allocations={allocations}

        summary={summary}

        rate={usdThbRate}

        holdings={holdings}

      />

    ), [brokers, categories, allocations, summary, usdThbRate, holdings]);

  

    const memoizedPortfolioChart = React.useMemo(() => (

      <PortfolioChart />

    ), []);

  

    return (
    <Box className="tab-pane-active" sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>

      {/* Top Metrics Cards (THB) */}
      <Grid container spacing={2}>
        {/* Stocks Only Card */}
        <Grid xs={12} md={4}>
          <Sheet sx={{ ...glassStyle, p: 3, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 3 }}>
              <Box sx={{ width: '100%' }}>
                <Typography level="body-xs" sx={{ opacity: 0.6, fontWeight: 700, mb: 0.5, display: 'flex', alignItems: 'center' }}>
                  <Box component="span" sx={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', bgcolor: 'info.solidBg', mr: 0.75 }} />
                  STOCKS ONLY (USD)
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <Typography level="h1" sx={{ fontWeight: 800, fontSize: '2.2rem', whiteSpace: 'nowrap', letterSpacing: '-0.02em', background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    {showMoneyValues ? formatCurrency(stocksSummary.total_market_value, false, '$') : '••••••••'}
                  </Typography>
                  <IconButton
                    size="sm"
                    variant="plain"
                    color="neutral"
                    onClick={() => setShowMoneyValues(!showMoneyValues)}
                    sx={{ borderRadius: '50%' }}
                  >
                    {showMoneyValues ? <EyeOff size={16} /> : <Eye size={16} />}
                  </IconButton>
                </Box>
                <Stack spacing={0.75}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1.5 }}>
                    <Typography level="body-sm" sx={{ opacity: 0.7, whiteSpace: 'nowrap' }}>Total Cost</Typography>
                    <Typography level="body-sm" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {showMoneyValues ? formatCurrency(stocksSummary.total_cost, false, '$') : '••••••••'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1.5 }}>
                    <Typography level="body-sm" sx={{ opacity: 0.7, whiteSpace: 'nowrap' }}>Unrealized Gain</Typography>
                    <Typography level="body-sm" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }} className={stocksSummary.unrealized_gain_amt >= 0 ? 'yf-positive' : 'yf-negative'}>
                      {showMoneyValues ? formatCurrency(stocksSummary.unrealized_gain_amt, true, '$') : '••••••••'} ({formatPct(stocksSummary.unrealized_gain_pct)})
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1.5 }}>
                    <Typography level="body-sm" sx={{ opacity: 0.7, whiteSpace: 'nowrap' }}>Day Change</Typography>
                    <Typography level="body-sm" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }} className={stocksSummary.day_change_amt >= 0 ? 'yf-positive' : 'yf-negative'}>
                      {showMoneyValues ? formatCurrency(stocksSummary.day_change_amt, true, '$') : '••••••••'} ({formatPct(stocksSummary.day_change_pct)})
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1.5 }}>
                    <Typography level="body-sm" sx={{ opacity: 0.7, whiteSpace: 'nowrap' }}>Realized Gain</Typography>
                    <Typography level="body-sm" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }} className={stocksSummary.realized_gain_amt >= 0 ? 'yf-positive' : 'yf-negative'}>
                      {showMoneyValues ? formatCurrency(stocksSummary.realized_gain_amt, true, '$') : '••••••••'}
                    </Typography>
                  </Box>
                </Stack>
                <Divider sx={{ my: 1.5, opacity: 0.15 }} />
                <Typography level="body-xs" sx={{ opacity: 0.5, fontWeight: 500 }}>
                  {holdingsCount} stocks · {openPositionsCount} positions active
                </Typography>
              </Box>
            </Box>
          </Sheet>
        </Grid>

        {/* Pie chart to see percent of all assets */}
        <Grid xs={12} md={4}>
          <Sheet sx={{ ...glassStyle, p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ mb: 2 }}>
              <Typography level="title-md" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Landmark size={18} color="#10b981" /> Asset Allocation
              </Typography>
              <Typography level="body-xs" sx={{ opacity: 0.6, mt: 0.5, fontWeight: 500 }}>
                {activeStocksCount} stocks • {activeFundsCount} funds • {activeCashCount} cash
              </Typography>
            </Box>
            <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              {memoizedAssetAllocationChart}
            </Box>
          </Sheet>
        </Grid>

        {/* Daily TWR Performance vs S&P 500 (holdings stock) */}
        <Grid xs={12} md={4}>
          <Sheet sx={{ ...glassStyle, p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography level="title-md" sx={{ fontWeight: 800, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <BarChart2 size={18} color="#10b981" /> Daily TWR Performance vs S&P 500 (holdings stock)
            </Typography>
            <Box sx={{ minHeight: 260, height: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              {memoizedPortfolioChart}
            </Box>
          </Sheet>
        </Grid>
      </Grid>

      {/* Portfolio Performance & Asset Allocation Grid */}
      <Grid container spacing={2}>

        {/* Broker Balances Table */}
        <Grid xs={12} md={8}>
          <Sheet sx={{ ...glassStyle, p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
              <Box>
                <Typography level="title-lg" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Coins size={20} color="#10b981" /> Broker & Platform (THB)
                </Typography>
                <Typography level="body-xs" sx={{ opacity: 0.6, mt: 0.5 }}>
                  Consolidated balances by platform.
                </Typography>
              </Box>
              {isEditingBrokers ? (
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="solid"
                    color="success"
                    startDecorator={<Save size={16} />}
                    loading={submittingBroker === 'all'}
                    onClick={handleSaveBrokerOverrides}
                    sx={{ borderRadius: '12px', fontWeight: 700 }}
                  >
                    Save
                  </Button>
                  <Button
                    variant="outlined"
                    color="neutral"
                    onClick={handleCancelEditingBrokers}
                    sx={{ borderRadius: '12px', fontWeight: 700 }}
                  >
                    Cancel
                  </Button>
                </Stack>
              ) : (
                <Button
                  variant="soft"
                  color="primary"
                  startDecorator={<Edit size={16} />}
                  onClick={handleStartEditingBrokers}
                  sx={{ borderRadius: '12px', fontWeight: 700 }}
                >
                  Edit Overrides
                </Button>
              )}
            </Box>
            <Box sx={{ overflowX: 'auto' }}>
              <Table aria-label="broker balances table" sx={{ '& th': { fontWeight: 700 } }}>
                <thead>
                  <tr>
                    <th>Broker/Account</th>
                    <th style={{ textAlign: 'right' }}>Cost</th>
                    <th style={{ textAlign: 'right' }}>Value</th>
                    <th style={{ textAlign: 'right' }}>Gain</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedBrokers.map(broker => (
                    <tr key={broker.broker_name}>
                      <td style={{ fontWeight: 700 }}>{broker.broker_name}</td>
                      {/* Cost: edit input when editing, override when set, else calculated */}
                      <td style={{ textAlign: 'right' }}>
                        {isEditingBrokers ? (
                          <FastInlineInput
                            size="sm"
                            placeholder="Manual Cost"
                            value={brokerOverrideForm[broker.broker_name]?.cost || ''}
                            onChange={val => setBrokerOverrideForm(prev => ({
                              ...prev,
                              [broker.broker_name]: { ...prev[broker.broker_name], cost: val }
                            }))}
                            slotProps={{ input: { style: { textAlign: 'right' } } }}
                            sx={{ borderRadius: '8px' }}
                          />
                        ) : showMoneyValues ? formatCurrency(broker.cost_override ?? broker.cost, false, '฿') : '••••••••'}
                      </td>
                      {/* Value: edit input when editing, override when set, else calculated */}
                      <td style={{ textAlign: 'right' }}>
                        {isEditingBrokers ? (
                          <FastInlineInput
                            size="sm"
                            placeholder="Manual Value"
                            value={brokerOverrideForm[broker.broker_name]?.balance || ''}
                            onChange={val => setBrokerOverrideForm(prev => ({
                              ...prev,
                              [broker.broker_name]: { ...prev[broker.broker_name], balance: val }
                            }))}
                            slotProps={{ input: { style: { textAlign: 'right' } } }}
                            sx={{ borderRadius: '8px' }}
                          />
                        ) : showMoneyValues ? formatCurrency(broker.balance_override ?? broker.balance, false, '฿') : '••••••••'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }} className={broker.gain_amt >= 0 ? 'yf-positive' : 'yf-negative'}>
                        {showMoneyValues ? formatCurrency(broker.gain_amt, true, '฿') : '••••••••'} ({broker.gain_pct.toFixed(2)}%)
                      </td>
                    </tr>
                  ))}
                </tbody>
                {brokerTotals && (
                  <tfoot style={{ borderTop: '2px solid var(--yf-border)', backgroundColor: 'var(--yf-header-bg)', fontWeight: 'bold' }}>
                    <tr>
                      <td style={{ fontWeight: 700, textAlign: 'left' }}>Total</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>
                        {showMoneyValues ? formatCurrency(brokerTotals.cost, false, '฿') : '••••••••'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>
                        {showMoneyValues ? formatCurrency(brokerTotals.balance, false, '฿') : '••••••••'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }} className={brokerTotals.gain_amt >= 0 ? 'yf-positive' : 'yf-negative'}>
                        {showMoneyValues ? formatCurrency(brokerTotals.gain_amt, true, '฿') : '••••••••'} ({brokerTotals.gain_pct.toFixed(2)}%)
                      </td>

                    </tr>
                  </tfoot>
                )}
              </Table>
            </Box>
          </Sheet>
        </Grid>

        {/* All Assets Card */}
        <Grid xs={12} md={4}>
          <Sheet sx={{ ...glassStyle, p: 3, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 3 }}>
              <Box sx={{ width: '100%' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
                  <Typography level="body-xs" sx={{ opacity: 0.6, fontWeight: 700, display: 'flex', alignItems: 'center' }}>
                    <Box component="span" sx={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.solidBg', mr: 0.75 }} />
                    ALL ASSETS (THB)
                  </Typography>
                  <Chip
                    variant="soft"
                    color="success"
                    size="sm"
                    startDecorator={<TrendingUp size={14} />}
                    sx={{ borderRadius: '8px', fontWeight: 600 }}
                  >
                    Bullish
                  </Chip>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <Typography level="h1" sx={{ fontWeight: 800, fontSize: '2.2rem', letterSpacing: '-0.02em', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', whiteSpace: 'nowrap' }}>
                    {showMoneyValues ? formatCurrency(summary.total_market_value, false, '฿') : '••••••••'}
                  </Typography>
                  <IconButton
                    size="sm"
                    variant="plain"
                    color="neutral"
                    onClick={() => setShowMoneyValues(!showMoneyValues)}
                    sx={{ borderRadius: '50%' }}
                  >
                    {showMoneyValues ? <EyeOff size={16} /> : <Eye size={16} />}
                  </IconButton>
                </Box>
                <Stack spacing={0.75}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1.5 }}>
                    <Typography level="body-sm" sx={{ opacity: 0.7, whiteSpace: 'nowrap' }}>Total Cost</Typography>
                    <Typography level="body-sm" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {showMoneyValues ? formatCurrency(summary.total_cost, false, '฿') : '••••••••'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1.5 }}>
                    <Typography level="body-sm" sx={{ opacity: 0.7, whiteSpace: 'nowrap' }}>Unrealized Gain</Typography>
                    <Typography level="body-sm" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }} className={summary.unrealized_gain_amt >= 0 ? 'yf-positive' : 'yf-negative'}>
                      {showMoneyValues ? formatCurrency(summary.unrealized_gain_amt, true, '฿') : '••••••••'} ({formatPct(summary.unrealized_gain_pct)})
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1.5 }}>
                    <Typography level="body-sm" sx={{ opacity: 0.7, whiteSpace: 'nowrap' }}>Realized Gain</Typography>
                    <Typography level="body-sm" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }} className={summary.realized_gain_amt >= 0 ? 'yf-positive' : 'yf-negative'}>
                      {showMoneyValues ? formatCurrency(summary.realized_gain_amt, true, '฿') : '••••••••'}
                    </Typography>
                  </Box>
                </Stack>
                <Divider sx={{ my: 1.5, opacity: 0.15 }} />
                <Typography level="body-xs" sx={{ opacity: 0.5, fontWeight: 500 }}>
                  Stocks, mutual funds & cash overrides
                </Typography>
              </Box>
            </Box>
          </Sheet>
        </Grid>

      </Grid>

      {/* Fund Allocations Grid (Matrix) */}
      <Sheet sx={{ ...glassStyle, p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography level="title-lg" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Landmark size={20} color="#10b981" /> Fund Allocation Matrix (THB)
            </Typography>
            <Typography level="body-xs" sx={{ opacity: 0.6, mt: 0.5 }}>
              Asset allocation breakdown by category and mutual funds.
            </Typography>
          </Box>
          {isEditingAlloc ? (
            <Stack direction="row" spacing={1}>
              <Button
                variant="solid"
                color="success"
                startDecorator={<Save size={16} />}
                onClick={handleSaveAllocations}
                sx={{ borderRadius: '12px', fontWeight: 700 }}
              >
                Save
              </Button>
              <Button
                variant="outlined"
                color="neutral"
                onClick={() => setIsEditingAlloc(false)}
                sx={{ borderRadius: '12px', fontWeight: 700 }}
              >
                Cancel
              </Button>
            </Stack>
          ) : (
            <Button
              variant="soft"
              color="primary"
              startDecorator={<Edit size={16} />}
              onClick={handleStartEditingAlloc}
              sx={{ borderRadius: '12px', fontWeight: 700 }}
            >
              Edit Allocations
            </Button>
          )}
        </Box>
        <Box sx={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid', borderColor: 'divider' }}>
          <Table aria-label="allocation matrix table" variant="plain" sx={{ minWidth: 800, '& th': { fontWeight: 700, bgcolor: 'background.level1' } }}>
            <thead>
              <tr>
                <th style={{ width: 120 }}>Category</th>
                {funds.map(fund => (
                  <th key={fund.id} style={{ textAlign: 'right' }}>
                    {isEditingAlloc ? (
                      <FastInlineInput
                        size="sm"
                        value={fundsForm[fund.id] ?? fund.name}
                        onChange={val => setFundsForm(prev => ({
                          ...prev,
                          [fund.id]: val
                        }))}
                        slotProps={{ input: { style: { textAlign: 'right' } } }}
                        sx={{
                          borderRadius: '8px',
                          width: '100%',
                          minWidth: '100px',
                          display: 'inline-flex',
                        }}
                      />
                    ) : (
                      fund.name
                    )}
                  </th>
                ))}
                <th style={{ textAlign: 'right', width: 120 }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {categories.map(cat => (
                <tr key={cat.id}>
                  <td style={{ fontWeight: 700 }}>
                    {isEditingAlloc ? (
                      <FastInlineInput
                        size="sm"
                        value={categoriesForm[cat.id] ?? cat.name}
                        onChange={val => setCategoriesForm(prev => ({
                          ...prev,
                          [cat.id]: val
                        }))}
                        sx={{
                          borderRadius: '8px',
                          width: '100%',
                          minWidth: '80px',
                        }}
                      />
                    ) : (
                      cat.name
                    )}
                  </td>
                  {funds.map(fund => {
                    const alloc = allocations.find(a => a.category_id === cat.id && a.fund_id === fund.id);
                    const amount = alloc ? alloc.amount : 0;
                    return (
                      <td key={fund.id} style={{ textAlign: 'right' }}>
                        {isEditingAlloc ? (
                          <FastInlineInput
                            size="sm"
                            type="number"
                            placeholder="0"
                            value={allocForm[`${cat.id}-${fund.id}`] || ''}
                            onChange={val => setAllocForm(prev => ({
                              ...prev,
                              [`${cat.id}-${fund.id}`]: val
                            }))}
                            slotProps={{ input: { style: { textAlign: 'right' } } }}
                            sx={{ borderRadius: '8px', width: '100%', minWidth: '90px' }}
                          />
                        ) : (
                          amount > 0 ? amount.toLocaleString('en-US') : '--'
                        )}
                      </td>
                    );
                  })}
                  <td style={{ textAlign: 'right', fontWeight: 700, backgroundColor: 'rgba(16, 185, 129, 0.03)' }}>
                    {getCategoryTotal(cat.id).toLocaleString('en-US')}
                  </td>
                </tr>
              ))}
              {/* Grand Total Row */}
              <tr style={{ backgroundColor: 'rgba(16, 185, 129, 0.05)', fontWeight: 800 }}>
                <td>Total</td>
                {funds.map(fund => (
                  <td key={fund.id} style={{ textAlign: 'right' }}>
                    {getFundTotal(fund.id).toLocaleString('en-US')}
                  </td>
                ))}
                <td style={{ textAlign: 'right', color: 'var(--joy-palette-primary-plainColor, #10b981)' }}>
                  {getGrandTotal().toLocaleString('en-US')}
                </td>
              </tr>
            </tbody>
          </Table>
        </Box>
      </Sheet>


      {/* Yearly History and Tax Savings Tabs Group */}
      <Grid container spacing={2}>
        {/* Yearly Performance History */}
        <Grid xs={12} md={6}>
          <Sheet sx={{ ...glassStyle, p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography level="title-md" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
                <TrendingUp size={18} color="#10b981" /> Yearly Performance History
              </Typography>
              <Button
                size="sm"
                variant="soft"
                color="primary"
                startDecorator={<Plus size={14} />}
                onClick={() => {
                  setEditingYear({ year: new Date().getFullYear(), capital: '', balance: '', total_gain_pct: '', remark: '' });
                  setYearlyModalOpen(true);
                }}
                sx={{ borderRadius: '10px', fontWeight: 700 }}
              >
                Add Year
              </Button>
            </Box>
            <Box sx={{ flexGrow: 1, overflowY: 'auto', overflowX: 'auto', maxHeight: 340 }}>
              <Table aria-label="yearly history table" sx={{ minWidth: 500 }}>
                <thead>
                  <tr>
                    <th style={{ width: 40 }}></th>
                    <th>Year</th>
                    <th style={{ textAlign: 'right' }}>Capital (฿)</th>
                    <th style={{ textAlign: 'right' }}>Balance (฿)</th>
                    <th style={{ textAlign: 'right' }}>Total Return</th>
                    <th style={{ width: 80 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {yearlyHistory.map(row => {
                    const isExpanded = !!expandedYears[row.year];
                    const calculatedReturn = row.capital > 0 ? (row.balance - row.capital) / row.capital : 0;
                    return (
                      <React.Fragment key={row.year}>
                        <tr
                          onClick={() => toggleYearExpanded(row.year)}
                          style={{ cursor: 'pointer', backgroundColor: isExpanded ? 'rgba(16, 185, 129, 0.02)' : 'transparent' }}
                        >
                          <td>
                            <IconButton
                              size="sm"
                              variant="plain"
                              color="neutral"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleYearExpanded(row.year);
                              }}
                            >
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </IconButton>
                          </td>
                          <td style={{ fontWeight: 700 }}>{row.year}</td>
                          <td style={{ textAlign: 'right' }}>{row.capital.toLocaleString('en-US')}</td>
                          <td style={{ textAlign: 'right' }}>{row.balance.toLocaleString('en-US')}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }} className={calculatedReturn >= 0 ? 'yf-positive' : 'yf-negative'}>
                            {(calculatedReturn * 100).toFixed(2)}%
                          </td>
                          <td>
                            <Stack direction="row" spacing={0.5} justifyContent="flex-end" onClick={(e) => e.stopPropagation()}>
                              <IconButton size="sm" variant="plain" color="neutral" onClick={() => {
                                setEditingYear({
                                  year: row.year,
                                  capital: row.capital.toString(),
                                  balance: row.balance.toString(),
                                  total_gain_pct: (calculatedReturn * 100).toString(),
                                  remark: row.remark
                                });
                                setYearlyModalOpen(true);
                              }}>
                                <Edit size={14} />
                              </IconButton>
                              <IconButton size="sm" variant="plain" color="danger" onClick={() => handleDeleteYearly(row.year)}>
                                <Trash2 size={14} />
                              </IconButton>
                            </Stack>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr style={{ backgroundColor: 'rgba(16, 185, 129, 0.01)' }}>
                            <td colSpan={6} style={{ padding: '12px 16px', borderBottom: '1px solid var(--joy-palette-divider)' }}>
                              <Typography level="body-xs" sx={{ fontWeight: 600, color: 'text.secondary', mb: 0.5 }}>
                                Year {row.year} Remark
                              </Typography>
                              <Typography level="body-sm" sx={{ whiteSpace: 'pre-wrap' }}>
                                {row.remark || 'No remarks recorded for this year.'}
                              </Typography>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                  {yearlyHistory.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', opacity: 0.5 }}>No yearly records found</td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </Box>
          </Sheet>
        </Grid>

        {/* Tax Savings Tracker */}
        <Grid xs={12} md={6}>
          <Sheet sx={{ ...glassStyle, p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography level="title-md" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Percent size={18} color="#10b981" /> Tax Savings Progress (30% Limits)
              </Typography>
              <Button
                size="sm"
                variant="soft"
                color="primary"
                startDecorator={<Plus size={14} />}
                onClick={() => {
                  setEditingTax({ year: new Date().getFullYear(), ltf: '', rmf: '', ssf: '' });
                  setTaxModalOpen(true);
                }}
                sx={{ borderRadius: '10px', fontWeight: 700 }}
              >
                Record Year
              </Button>
            </Box>

            {currentTaxYearData && (
              <Box sx={{ mb: 3, p: 2, borderRadius: '12px', bgcolor: 'rgba(16, 185, 129, 0.03)', border: '1px solid', borderColor: 'divider' }}>
                <Typography level="title-sm" sx={{ fontWeight: 700, mb: 1 }}>
                  Current Year ({currentTaxYearData.year}) Progress
                </Typography>
                <Stack spacing={1.5}>
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography level="body-xs" sx={{ fontWeight: 600 }}>RMF Savings (Limit: 500k)</Typography>
                      <Typography level="body-xs" sx={{ fontWeight: 700 }}>
                        ฿{currentRmf.toLocaleString('en-US')} / ฿500,000
                      </Typography>
                    </Box>
                    <LinearProgress
                      value={Math.min(100, (currentRmf / 500000) * 100)}
                      determinate
                      color={currentRmf >= 500000 ? 'success' : 'primary'}
                      variant="soft"
                      sx={{ height: 8, borderRadius: '4px' }}
                    />
                  </Box>
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography level="body-xs" sx={{ fontWeight: 600 }}>SSF Savings (Limit: 200k)</Typography>
                      <Typography level="body-xs" sx={{ fontWeight: 700 }}>
                        ฿{currentSsf.toLocaleString('en-US')} / ฿200,000
                      </Typography>
                    </Box>
                    <LinearProgress
                      value={Math.min(100, (currentSsf / 200000) * 100)}
                      determinate
                      color={currentSsf >= 200000 ? 'success' : 'primary'}
                      variant="soft"
                      sx={{ height: 8, borderRadius: '4px' }}
                    />
                  </Box>
                </Stack>
              </Box>
            )}

            <Box sx={{ flexGrow: 1, overflowY: 'auto', overflowX: 'auto', maxHeight: 240 }}>
              <Table aria-label="tax savings table" sx={{ minWidth: 500 }}>
                <thead>
                  <tr>
                    <th>Year</th>
                    <th style={{ textAlign: 'right' }}>LTF (฿)</th>
                    <th style={{ textAlign: 'right' }}>RMF (฿)</th>
                    <th style={{ textAlign: 'right' }}>SSF (฿)</th>
                    <th style={{ textAlign: 'right' }}>Total (฿)</th>
                    <th style={{ width: 80 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {taxSavings.map(row => (
                    <tr key={row.year}>
                      <td style={{ fontWeight: 700 }}>{row.year}</td>
                      <td style={{ textAlign: 'right' }}>{row.ltf.toLocaleString('en-US')}</td>
                      <td style={{ textAlign: 'right' }}>{row.rmf.toLocaleString('en-US')}</td>
                      <td style={{ textAlign: 'right' }}>{row.ssf.toLocaleString('en-US')}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>
                        {(row.ltf + row.rmf + row.ssf).toLocaleString('en-US')}
                      </td>
                      <td>
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <IconButton size="sm" variant="plain" color="neutral" onClick={() => {
                            setEditingTax({
                              year: row.year,
                              ltf: row.ltf.toString(),
                              rmf: row.rmf.toString(),
                              ssf: row.ssf.toString()
                            });
                            setTaxModalOpen(true);
                          }}>
                            <Edit size={14} />
                          </IconButton>
                          <IconButton size="sm" variant="plain" color="danger" onClick={() => handleDeleteTax(row.year)}>
                            <Trash2 size={14} />
                          </IconButton>
                        </Stack>
                      </td>
                    </tr>
                  ))}
                  {taxSavings.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', opacity: 0.5 }}>No tax savings recorded</td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </Box>
          </Sheet>
        </Grid>
      </Grid>

      {/* MODALS */}

      {/* Yearly History Modal */}
      <Modal open={yearlyModalOpen} onClose={() => setYearlyModalOpen(false)}>
        <ModalDialog sx={{ ...glassStyle, minWidth: { xs: '90%', sm: 400 }, borderRadius: '20px', p: 3 }}>
          <ModalClose />
          <DialogTitle sx={{ fontWeight: 800, fontSize: '1.3rem', mb: 1 }}>
            {editingYear?.year ? 'Edit Yearly History' : 'Add Yearly History'}
          </DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl required>
              <FormLabel>Year</FormLabel>
              <Input
                type="number"
                value={editingYear?.year || ''}
                onChange={e => setEditingYear((prev: any) => ({ ...prev, year: parseInt(e.target.value) || 0 }))}
              />
            </FormControl>
            <FormControl>
              <FormLabel>Capital Invested (฿)</FormLabel>
              <Input
                type="number"
                value={editingYear?.capital || ''}
                onChange={e => setEditingYear((prev: any) => ({ ...prev, capital: parseFloat(e.target.value) || 0 }))}
              />
            </FormControl>
            <FormControl>
              <FormLabel>Ending Balance (฿)</FormLabel>
              <Input
                type="number"
                value={editingYear?.balance || ''}
                onChange={e => setEditingYear((prev: any) => ({ ...prev, balance: parseFloat(e.target.value) || 0 }))}
              />
            </FormControl>
            <FormControl>
              <FormLabel>Return / Gain Percentage (%)</FormLabel>
              <Input
                type="text"
                disabled
                value={
                  editingYear?.capital && editingYear?.balance && parseFloat(editingYear.capital) > 0
                    ? (((parseFloat(editingYear.balance) - parseFloat(editingYear.capital)) / parseFloat(editingYear.capital)) * 100).toFixed(2) + '%'
                    : '0.00%'
                }
                sx={{ bgcolor: 'background.level1' }}
              />
              <Typography level="body-xs" sx={{ mt: 0.5, opacity: 0.6 }}>
                Auto-calculated from Capital and Ending Balance.
              </Typography>
            </FormControl>
            <FormControl>
              <FormLabel>Remark / Notes</FormLabel>
              <Input
                value={editingYear?.remark || ''}
                onChange={e => setEditingYear((prev: any) => ({ ...prev, remark: e.target.value }))}
              />
            </FormControl>
            <Button variant="solid" color="primary" onClick={handleSaveYearly} sx={{ mt: 1, borderRadius: '12px', fontWeight: 700 }}>
              Save Record
            </Button>
          </DialogContent>
        </ModalDialog>
      </Modal>

      {/* Tax Savings Modal */}
      <Modal open={taxModalOpen} onClose={() => setTaxModalOpen(false)}>
        <ModalDialog sx={{ ...glassStyle, minWidth: { xs: '90%', sm: 400 }, borderRadius: '20px', p: 3 }}>
          <ModalClose />
          <DialogTitle sx={{ fontWeight: 800, fontSize: '1.3rem', mb: 1 }}>
            {editingTax?.year ? 'Edit Tax Savings' : 'Record Tax Savings'}
          </DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl required>
              <FormLabel>Year</FormLabel>
              <Input
                type="number"
                value={editingTax?.year || ''}
                onChange={e => setEditingTax((prev: any) => ({ ...prev, year: parseInt(e.target.value) || 0 }))}
              />
            </FormControl>
            <FormControl>
              <FormLabel>LTF Amount (฿)</FormLabel>
              <Input
                type="number"
                value={editingTax?.ltf || ''}
                onChange={e => setEditingTax((prev: any) => ({ ...prev, ltf: parseFloat(e.target.value) || 0 }))}
              />
            </FormControl>
            <FormControl>
              <FormLabel>RMF Amount (฿)</FormLabel>
              <Input
                type="number"
                value={editingTax?.rmf || ''}
                onChange={e => setEditingTax((prev: any) => ({ ...prev, rmf: parseFloat(e.target.value) || 0 }))}
              />
            </FormControl>
            <FormControl>
              <FormLabel>SSF Amount (฿)</FormLabel>
              <Input
                type="number"
                value={editingTax?.ssf || ''}
                onChange={e => setEditingTax((prev: any) => ({ ...prev, ssf: parseFloat(e.target.value) || 0 }))}
              />
            </FormControl>
            <Button variant="solid" color="primary" onClick={handleSaveTax} sx={{ mt: 1, borderRadius: '12px', fontWeight: 700 }}>
              Save Record
            </Button>
          </DialogContent>
        </ModalDialog>
      </Modal>
    </Box>
  );
}
