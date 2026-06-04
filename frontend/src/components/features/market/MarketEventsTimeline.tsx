import * as React from 'react';
import {
  Box,
  Typography,
  Sheet,
  Card,
  CardContent,
  Chip,
  Stack,
  Select,
  Option,
  Button,
  CircularProgress,
  IconButton,
  Tooltip
} from '@mui/joy';
import {
  Calendar,
  Layers,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  Activity,
  Filter,
  RefreshCw,
  DollarSign,
  Briefcase
} from 'lucide-react';
import { API_BASE_URL } from '../../../config';
import { glassStyle } from '../../../styles/glass';

interface MarketEvent {
  id: string;
  symbol: string;
  event_type: 'news' | 'dividend' | 'split' | 'earnings';
  event_date: string;
  title: string;
  description: string;
  url?: string;
  metadata?: string; // JSON string
  created_at: number;
}

export default function MarketEventsTimeline({ inSidebar = false }: { inSidebar?: boolean }) {
  const [events, setEvents] = React.useState<MarketEvent[]>([]);
  const [symbols, setSymbols] = React.useState<string[]>([]);
  const [selectedSymbol, setSelectedSymbol] = React.useState<string>('ALL');
  const [selectedType, setSelectedType] = React.useState<string>('ALL');
  const [loading, setLoading] = React.useState(true);   // initial mount — shows full spinner
  const [fetching, setFetching] = React.useState(false); // filter change — subtle inline indicator
  const [refreshing, setRefreshing] = React.useState(false);

  const fetchWatchlistSymbols = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/watchlist`);
      if (res.ok) {
        const data = await res.json();
        const activeSymbols = data
          .filter((item: any) => item.is_active === 1)
          .map((item: any) => item.symbol);
        setSymbols(activeSymbols);
      }
    } catch (e) {
      console.error('Failed to fetch watchlist symbols', e);
    }
  };

  const fetchEvents = async (symbol: string, eventType: string, isInitial = false) => {
    if (isInitial) setLoading(true);
    else setFetching(true);
    try {
      const params = new URLSearchParams();
      if (symbol !== 'ALL') params.set('symbol', symbol);
      if (eventType !== 'ALL') params.set('event_type', eventType);
      const url = `${API_BASE_URL}/api/market-events${params.toString() ? '?' + params.toString() : ''}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      }
    } catch (e) {
      console.error('Failed to fetch market events', e);
    } finally {
      if (isInitial) setLoading(false);
      else setFetching(false);
    }
  };

  const triggerCrawl = async () => {
    setRefreshing(true);
    try {
      await fetch(`${API_BASE_URL}/api/crawl-events`);
      setTimeout(async () => {
        await fetchEvents(selectedSymbol, selectedType);
        setRefreshing(false);
      }, 3000);
    } catch (e) {
      console.error('Failed to trigger events crawl', e);
      setRefreshing(false);
    }
  };

  // Fetch watchlist symbols and initial events (latest 5 per symbol) on mount
  const isMounted = React.useRef(false);
  React.useEffect(() => {
    fetchWatchlistSymbols();
    fetchEvents('ALL', 'ALL', true); // initial — show full spinner
    isMounted.current = true;
  }, []);

  // Re-fetch from server whenever a filter changes (skip initial mount)
  React.useEffect(() => {
    if (!isMounted.current) return;
    fetchEvents(selectedSymbol, selectedType, false); // filter change — subtle indicator
  }, [selectedSymbol, selectedType]);



  const getEventStyles = (type: MarketEvent['event_type']) => {
    switch (type) {
      case 'news':
        return {
          color: 'primary' as const,
          label: 'Press Release',
          icon: <Activity size={16} />
        };
      case 'dividend':
        return {
          color: 'success' as const,
          label: 'Dividend',
          icon: <DollarSign size={16} />
        };
      case 'split':
        return {
          color: 'neutral' as const,
          label: 'Stock Split',
          icon: <Layers size={16} />
        };
      case 'earnings':
        return {
          color: 'warning' as const,
          label: 'Earnings',
          icon: <Calendar size={16} />
        };
    }
  };

  const renderMetadataDetails = (evt: MarketEvent) => {
    if (!evt.metadata) return null;
    try {
      const meta = JSON.parse(evt.metadata);
      if (evt.event_type === 'dividend') {
        return (
          <Stack direction="row" spacing={2} sx={{ mt: 1.5, flexWrap: 'wrap', gap: 1 }}>
            {meta.payDate && (
              <Typography level="body-xs" sx={{ bgcolor: 'rgba(46, 204, 113, 0.1)', px: 1, py: 0.5, borderRadius: '4px', color: 'success.dark' }}>
                Pay Date: <strong>{meta.payDate}</strong>
              </Typography>
            )}
            {meta.recordDate && (
              <Typography level="body-xs" sx={{ bgcolor: 'rgba(0, 0, 0, 0.04)', px: 1, py: 0.5, borderRadius: '4px', color: 'text.secondary' }}>
                Record Date: <strong>{meta.recordDate}</strong>
              </Typography>
            )}
            {meta.declarationDate && (
              <Typography level="body-xs" sx={{ bgcolor: 'rgba(0, 0, 0, 0.04)', px: 1, py: 0.5, borderRadius: '4px', color: 'text.secondary' }}>
                Declared: <strong>{meta.declarationDate}</strong>
              </Typography>
            )}
          </Stack>
        );
      }
      if (evt.event_type === 'split') {
        return (
          <Stack direction="row" spacing={2} sx={{ mt: 1.5, flexWrap: 'wrap', gap: 1 }}>
            <Typography level="body-xs" sx={{ bgcolor: 'rgba(0, 0, 0, 0.04)', px: 1, py: 0.5, borderRadius: '4px', color: 'text.secondary' }}>
              Split Ratio: <strong>{meta.fromFactor} : {meta.toFactor}</strong>
            </Typography>
          </Stack>
        );
      }
      if (evt.event_type === 'earnings') {
        const isMiss = meta.epsActual !== null && meta.epsEstimate !== null && meta.epsActual < meta.epsEstimate;
        const isBeat = meta.epsActual !== null && meta.epsEstimate !== null && meta.epsActual >= meta.epsEstimate;
        return (
          <Stack spacing={1.5} sx={{ mt: 1.5, p: 1.5, bgcolor: 'rgba(0, 0, 0, 0.02)', borderRadius: '8px' }}>
            <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', gap: 1 }}>
              {meta.epsEstimate !== null && (
                <Typography level="body-xs">
                  EPS Est: <strong>{meta.epsEstimate}</strong>
                </Typography>
              )}
              {meta.epsActual !== null && (
                <Typography level="body-xs" color={isBeat ? 'success' : isMiss ? 'danger' : 'neutral'}>
                  EPS Act: <strong>{meta.epsActual}</strong>
                  {isBeat && ' (Beat)'}
                  {isMiss && ' (Miss)'}
                </Typography>
              )}
            </Stack>
            {(meta.revenueActual !== null || meta.revenueEstimate !== null) && (
              <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', gap: 1 }}>
                {meta.revenueEstimate !== null && (
                  <Typography level="body-xs">
                    Rev Est: <strong>${(meta.revenueEstimate / 1e9).toFixed(2)}B</strong>
                  </Typography>
                )}
                {meta.revenueActual !== null && (
                  <Typography level="body-xs">
                    Rev Act: <strong>${(meta.revenueActual / 1e9).toFixed(2)}B</strong>
                  </Typography>
                )}
              </Stack>
            )}
            {meta.hour && (
              <Typography level="body-xs" sx={{ textTransform: 'uppercase', fontSize: '0.65rem', color: 'text.tertiary' }}>
                Release Time: {meta.hour}
              </Typography>
            )}
          </Stack>
        );
      }
    } catch (e) {
      // JSON parse error
    }
    return null;
  };

  return (
    <Card sx={{ ...glassStyle, p: inSidebar ? 2 : 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Stack direction="row" spacing={inSidebar ? 1 : 1.5} alignItems="center">
          <Briefcase size={inSidebar ? 18 : 20} className="text-emerald-500" />
          <Typography level={inSidebar ? "title-md" : "title-lg"} sx={{ fontWeight: 700 }}>
            {inSidebar ? "Market Events" : "Watchlist Market Events"}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          {fetching && (
            <CircularProgress size="sm" color="neutral" sx={{ '--CircularProgress-size': '18px' }} />
          )}
          <Tooltip title="Fetch latest events from Finnhub">
            <IconButton
              variant="soft"
              color="success"
              onClick={triggerCrawl}
              disabled={refreshing || loading || fetching}
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {/* Filter Row */}
      <Stack direction={inSidebar ? 'column' : { xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 3 }}>
        <Select
          placeholder="Filter by Symbol"
          value={selectedSymbol}
          onChange={(_, val) => setSelectedSymbol(val || 'ALL')}
          startDecorator={<Filter size={14} />}
          sx={{ minWidth: inSidebar ? '100%' : 160, flex: 1 }}
        >
          <Option value="ALL">All Watchlist</Option>
          {symbols.map((sym) => (
            <Option key={sym} value={sym}>{sym}</Option>
          ))}
        </Select>

        <Select
          placeholder="Filter by Event Type"
          value={selectedType}
          onChange={(_, val) => setSelectedType(val || 'ALL')}
          startDecorator={<Filter size={14} />}
          sx={{ minWidth: inSidebar ? '100%' : 180, flex: 1 }}
        >
          <Option value="ALL">All Events</Option>
          <Option value="news">Press Releases</Option>
          <Option value="earnings">Earnings Releases</Option>
          <Option value="dividend">Dividends</Option>
          <Option value="split">Stock Splits</Option>
        </Select>
      </Stack>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress color="success" size="md" />
        </Box>
      ) : events.length === 0 ? (
        <Typography level="body-md" sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
          No market events found.
        </Typography>
      ) : (
        <Stack
          spacing={2}
          sx={{
            maxHeight: inSidebar ? 'calc(100vh - 250px)' : 480,
            overflowY: 'auto',
            pr: 1,
            opacity: fetching ? 0.5 : 1,
            transition: 'opacity 0.2s ease',
            pointerEvents: fetching ? 'none' : 'auto',
          }}
        >
          {events.map((evt) => {
            const styles = getEventStyles(evt.event_type);
            const dateObj = new Date(evt.event_date);
            const formattedDate = isNaN(dateObj.getTime())
              ? evt.event_date
              : dateObj.toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                });

            return (
              <Box
                key={evt.id}
                sx={{
                  p: 2,
                  borderRadius: '12px',
                  bgcolor: 'background.level1',
                  border: '1px solid',
                  borderColor: 'divider',
                  boxShadow: 'sm',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: 'md',
                    bgcolor: 'background.level2'
                  }
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography level="title-sm" sx={{ fontWeight: 800 }}>{evt.symbol}</Typography>
                    <Chip
                      variant="soft"
                      color={styles.color}
                      size="sm"
                      startDecorator={styles.icon}
                    >
                      {styles.label}
                    </Chip>
                  </Stack>
                  <Typography level="body-xs" sx={{ color: 'text.tertiary' }}>
                    {formattedDate}
                  </Typography>
                </Stack>

                <Typography level="title-md" sx={{ fontWeight: 700, mb: 0.5 }}>{evt.title}</Typography>
                
                {evt.description && (
                  <Typography level="body-sm" sx={{ color: 'text.secondary', lineHeight: 1.5 }}>
                    {evt.description}
                  </Typography>
                )}

                {renderMetadataDetails(evt)}

                {evt.url && (
                  <Button
                    component="a"
                    href={evt.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="plain"
                    color="primary"
                    size="sm"
                    endDecorator={<ArrowUpRight size={14} />}
                    sx={{ mt: 1, p: 0, minHeight: 'auto', '&:hover': { bgcolor: 'transparent', textDecoration: 'underline' } }}
                  >
                    View Source
                  </Button>
                )}
              </Box>
            );
          })}
        </Stack>
      )}
    </Card>
  );
}
