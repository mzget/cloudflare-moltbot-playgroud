import React, { useState, useEffect, useMemo } from 'react';
import {
	Box,
	Typography,
	Sheet,
	Table,
	Button,
	Grid,
	Stack,
	IconButton,
	CircularProgress,
	Tooltip,
	Snackbar,
	Alert,
	Chip,
	Card,
	RadioGroup,
	Radio
} from '@mui/joy';
import {
	RefreshCw,
	TrendingUp,
	TrendingDown,
	Flame,
	AlertTriangle,
	ArrowUp,
	ArrowDown,
	ArrowUpDown,
	FileText,
	Zap,
	ShieldAlert,
	CheckCircle2
} from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import DebouncedInput from '../../common/DebouncedInput';
import { glassStyle } from '../../../styles/glass';
import { API_BASE_URL } from '../../../config';

export interface BreakoutItem {
	symbol: string;
	name: string;
	price: number;
	percentChange: number;
	yearHigh: number;
	yearLow: number;
	allTimeHigh?: number | null;
	allTimeLow?: number | null;
	breakoutType: 'ath' | '52w_high' | '52w_low' | 'atl';
}

export type BreakoutStatus =
	| 'ath'
	| '52w_high'
	| '52w_low'
	| 'atl'
	| 'near_ath'
	| 'near_52w_high'
	| 'near_52w_low'
	| 'near_atl'
	| 'normal';

export interface WatchlistProximityItem {
	symbol: string;
	name: string;
	sectorLabel?: string | null;
	sectorLabelColor?: string | null;
	price: number;
	percentChange: number;
	yearHigh: number | null;
	yearLow: number | null;
	allTimeHigh: number | null;
	allTimeLow: number | null;
	distance52wHigh: number | null;
	distanceAth: number | null;
	distance52wLow: number | null;
	distanceAtl: number | null;
	status: BreakoutStatus;
	updatedAt?: string | null;
}

export interface WatchlistBreakoutSummary {
	totalWatchlist: number;
	athCount: number;
	high52wCount: number;
	low52wCount: number;
	atlCount: number;
	nearAthCount: number;
	nearHigh52wCount: number;
	nearLow52wCount: number;
	nearAtlCount: number;
	totalBreakouts: number;
	highsRatio: number;
	lowsRatio: number;
}

type SortField = 'symbol' | 'price' | 'percentChange' | 'distance52wHigh' | 'distanceAth' | 'distance52wLow';

export default function MarketBreakouts() {
	const navigate = useNavigate();
	const [summary, setSummary] = useState<WatchlistBreakoutSummary>({
		totalWatchlist: 0,
		athCount: 0,
		high52wCount: 0,
		low52wCount: 0,
		atlCount: 0,
		nearAthCount: 0,
		nearHigh52wCount: 0,
		nearLow52wCount: 0,
		nearAtlCount: 0,
		totalBreakouts: 0,
		highsRatio: 50,
		lowsRatio: 50
	});
	const [todayBreakouts, setTodayBreakouts] = useState<BreakoutItem[]>([]);
	const [matrix, setMatrix] = useState<WatchlistProximityItem[]>([]);
	const [loading, setLoading] = useState(false);
	const [scanning, setScanning] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');

	// Matrix filter: 'all' | 'breaking' | 'near'
	const [statusFilter, setStatusFilter] = useState<'all' | 'breaking' | 'near'>('all');

	// Active breakouts filter tab
	const [breakoutTab, setBreakoutTab] = useState<'all' | 'ath' | '52w_high' | '52w_low' | 'atl'>('all');

	// Toast state
	const [toastOpen, setToastOpen] = useState(false);
	const [toastMessage, setToastMessage] = useState('');

	// Table Sorting
	const [sortState, setSortState] = useState<{ field: SortField; order: 'asc' | 'desc' }>({
		field: 'percentChange',
		order: 'desc'
	});

	const fetchBreakoutsData = async () => {
		setLoading(true);
		try {
			const res = await fetch(`${API_BASE_URL}/api/watchlist-breakouts`);
			if (res.ok) {
				const data = await res.json() as {
					summary: WatchlistBreakoutSummary;
					todayBreakouts: BreakoutItem[];
					matrix: WatchlistProximityItem[];
				};
				if (data.summary) setSummary(data.summary);
				if (Array.isArray(data.todayBreakouts)) setTodayBreakouts(data.todayBreakouts);
				if (Array.isArray(data.matrix)) setMatrix(data.matrix);
			}
		} catch (error) {
			console.error('Failed to fetch watchlist breakouts data:', error);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchBreakoutsData();
	}, []);

	const handleRunScan = async () => {
		setScanning(true);
		try {
			const res = await fetch(`${API_BASE_URL}/api/scan-watchlist`, { method: 'POST' });
			if (res.ok) {
				const data = await res.json() as any;
				if (data.summary) setSummary(data.summary);
				if (Array.isArray(data.todayBreakouts)) setTodayBreakouts(data.todayBreakouts);
				if (Array.isArray(data.matrix)) setMatrix(data.matrix);

				setToastMessage(`Scan complete! Found ${data.count ?? data.todayBreakouts?.length ?? 0} active breakouts today.`);
				setToastOpen(true);
			} else {
				throw new Error(res.statusText);
			}
		} catch (error) {
			console.error('Failed to trigger watchlist scan:', error);
			setToastMessage('Failed to scan watchlist. Please try again.');
			setToastOpen(true);
		} finally {
			setScanning(false);
		}
	};

	const handleViewAnalysis = (symbol: string) => {
		navigate({
			to: '/analysis',
			search: { symbol, tab: 'report' },
		});
	};

	const handleSort = (field: SortField) => {
		setSortState(prev => ({
			field,
			order: prev.field === field && prev.order === 'desc' ? 'asc' : 'desc'
		}));
	};

	// Filtered Active Breakouts List
	const filteredBreakouts = useMemo(() => {
		if (breakoutTab === 'all') return todayBreakouts;
		return todayBreakouts.filter(b => b.breakoutType === breakoutTab);
	}, [todayBreakouts, breakoutTab]);

	// Filtered & Sorted Proximity Matrix
	const filteredMatrix = useMemo(() => {
		let list = [...matrix];

		// Status category filter
		if (statusFilter === 'breaking') {
			list = list.filter(m => ['ath', '52w_high', '52w_low', 'atl'].includes(m.status));
		} else if (statusFilter === 'near') {
			list = list.filter(m => ['near_ath', 'near_52w_high', 'near_52w_low', 'near_atl'].includes(m.status));
		}

		// Search Query filter
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			list = list.filter(m =>
				m.symbol.toLowerCase().includes(q) ||
				(m.name && m.name.toLowerCase().includes(q)) ||
				(m.sectorLabel && m.sectorLabel.toLowerCase().includes(q))
			);
		}

		// Sorting
		list.sort((a, b) => {
			const orderMult = sortState.order === 'asc' ? 1 : -1;
			if (sortState.field === 'symbol') {
				return orderMult * a.symbol.localeCompare(b.symbol);
			}
			const aVal = a[sortState.field];
			const bVal = b[sortState.field];
			if (aVal === null || aVal === undefined) return 1;
			if (bVal === null || bVal === undefined) return -1;
			return orderMult * ((aVal as number) - (bVal as number));
		});

		return list;
	}, [matrix, statusFilter, searchQuery, sortState]);

	// Render Status Badge
	const renderStatusBadge = (status: BreakoutStatus) => {
		switch (status) {
			case 'ath':
				return (
					<Chip color="success" variant="solid" size="sm" startDecorator={<Flame size={14} />}>
						ATH
					</Chip>
				);
			case '52w_high':
				return (
					<Chip color="primary" variant="solid" size="sm" startDecorator={<TrendingUp size={14} />}>
						52W High
					</Chip>
				);
			case 'near_ath':
				return (
					<Chip color="warning" variant="soft" size="sm" startDecorator={<Zap size={14} />}>
						Near ATH
					</Chip>
				);
			case 'near_52w_high':
				return (
					<Chip color="primary" variant="soft" size="sm">
						Near 52W High
					</Chip>
				);
			case '52w_low':
				return (
					<Chip color="warning" variant="solid" size="sm" startDecorator={<TrendingDown size={14} />}>
						52W Low
					</Chip>
				);
			case 'atl':
				return (
					<Chip color="danger" variant="solid" size="sm" startDecorator={<AlertTriangle size={14} />}>
						ATL
					</Chip>
				);
			case 'near_52w_low':
				return (
					<Chip color="neutral" variant="soft" size="sm">
						Near 52W Low
					</Chip>
				);
			case 'near_atl':
				return (
					<Chip color="danger" variant="soft" size="sm" startDecorator={<ShieldAlert size={14} />}>
						Near ATL
					</Chip>
				);
			default:
				return (
					<Typography level="body-xs" sx={{ color: 'text.tertiary' }}>
						—
					</Typography>
				);
		}
	};

	const renderSortHeader = (label: string, field: SortField, align: 'left' | 'right' = 'left') => {
		const isSorted = sortState.field === field;
		return (
			<Box
				onClick={() => handleSort(field)}
				sx={{
					display: 'flex',
					alignItems: 'center',
					justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
					gap: 0.5,
					cursor: 'pointer',
					userSelect: 'none',
					'&:hover': { color: 'primary.plainColor' }
				}}
			>
				<Typography level="title-sm" sx={{ color: isSorted ? 'primary.plainColor' : 'inherit' }}>
					{label}
				</Typography>
				{isSorted ? (
					sortState.order === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
				) : (
					<ArrowUpDown size={14} style={{ opacity: 0.3 }} />
				)}
			</Box>
		);
	};

	const totalImminent = summary.nearAthCount + summary.nearHigh52wCount + summary.nearLow52wCount + summary.nearAtlCount;

	return (
		<Box sx={{ width: '100%', pb: 6 }}>
			{/* Top Bar / Header */}
			<Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
				<Box>
					<Typography level="h2" sx={{ fontWeight: 'bold' }}>
						Watchlist Breakouts
					</Typography>
					<Typography level="body-sm" sx={{ color: 'text.secondary', mt: 0.5 }}>
						Live boundary milestone monitoring (ATH, ATL, 52W High/Low) and proximity matrix for your {summary.totalWatchlist} active watchlist stocks.
					</Typography>
				</Box>

				<Stack direction="row" spacing={1.5} alignItems="center">
					<Button
						variant="solid"
						color="primary"
						startDecorator={<RefreshCw size={16} className={scanning ? 'animate-spin' : ''} />}
						loading={scanning}
						onClick={handleRunScan}
						sx={{ px: 2.5 }}
					>
						Scan Watchlist
					</Button>
				</Stack>
			</Box>

			{/* Metric Overview Cards */}
			<Grid container spacing={2} sx={{ mb: 3 }}>
				{/* 1. All-Time High */}
				<Grid xs={12} sm={6} md={3}>
					<Sheet sx={{ ...glassStyle, p: 2.5, borderRadius: 'md', display: 'flex', alignItems: 'center', gap: 2 }}>
						<Box
							sx={{
								width: 48,
								height: 48,
								borderRadius: '50%',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								bgcolor: 'success.softBg',
								color: 'success.solidBg'
							}}
						>
							<Flame size={24} />
						</Box>
						<Box>
							<Typography level="body-xs" sx={{ textTransform: 'uppercase', fontWeight: 600, color: 'text.tertiary' }}>
								All-Time High
							</Typography>
							<Typography level="h3" sx={{ fontWeight: 'bold', color: 'success.plainColor' }}>
								{summary.athCount}
							</Typography>
							<Typography level="body-xs" sx={{ color: 'text.secondary' }}>
								{summary.nearAthCount > 0 ? `${summary.nearAthCount} nearing ATH (3%)` : '0 nearing ATH'}
							</Typography>
						</Box>
					</Sheet>
				</Grid>

				{/* 2. 52-Week High */}
				<Grid xs={12} sm={6} md={3}>
					<Sheet sx={{ ...glassStyle, p: 2.5, borderRadius: 'md', display: 'flex', alignItems: 'center', gap: 2 }}>
						<Box
							sx={{
								width: 48,
								height: 48,
								borderRadius: '50%',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								bgcolor: 'primary.softBg',
								color: 'primary.solidBg'
							}}
						>
							<TrendingUp size={24} />
						</Box>
						<Box>
							<Typography level="body-xs" sx={{ textTransform: 'uppercase', fontWeight: 600, color: 'text.tertiary' }}>
								52-Week High
							</Typography>
							<Typography level="h3" sx={{ fontWeight: 'bold', color: 'primary.plainColor' }}>
								{summary.high52wCount}
							</Typography>
							<Typography level="body-xs" sx={{ color: 'text.secondary' }}>
								{summary.nearHigh52wCount > 0 ? `${summary.nearHigh52wCount} nearing high (3%)` : '0 nearing high'}
							</Typography>
						</Box>
					</Sheet>
				</Grid>

				{/* 3. 52-Week Low */}
				<Grid xs={12} sm={6} md={3}>
					<Sheet sx={{ ...glassStyle, p: 2.5, borderRadius: 'md', display: 'flex', alignItems: 'center', gap: 2 }}>
						<Box
							sx={{
								width: 48,
								height: 48,
								borderRadius: '50%',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								bgcolor: 'warning.softBg',
								color: 'warning.solidBg'
							}}
						>
							<TrendingDown size={24} />
						</Box>
						<Box>
							<Typography level="body-xs" sx={{ textTransform: 'uppercase', fontWeight: 600, color: 'text.tertiary' }}>
								52-Week Low
							</Typography>
							<Typography level="h3" sx={{ fontWeight: 'bold', color: 'warning.plainColor' }}>
								{summary.low52wCount}
							</Typography>
							<Typography level="body-xs" sx={{ color: 'text.secondary' }}>
								{summary.nearLow52wCount > 0 ? `${summary.nearLow52wCount} nearing low (3%)` : '0 nearing low'}
							</Typography>
						</Box>
					</Sheet>
				</Grid>

				{/* 4. All-Time Low */}
				<Grid xs={12} sm={6} md={3}>
					<Sheet sx={{ ...glassStyle, p: 2.5, borderRadius: 'md', display: 'flex', alignItems: 'center', gap: 2 }}>
						<Box
							sx={{
								width: 48,
								height: 48,
								borderRadius: '50%',
								display: 'flex',
								alignItems: 'center',
								justifyContent: 'center',
								bgcolor: 'danger.softBg',
								color: 'danger.solidBg'
							}}
						>
							<AlertTriangle size={24} />
						</Box>
						<Box>
							<Typography level="body-xs" sx={{ textTransform: 'uppercase', fontWeight: 600, color: 'text.tertiary' }}>
								All-Time Low
							</Typography>
							<Typography level="h3" sx={{ fontWeight: 'bold', color: 'danger.plainColor' }}>
								{summary.atlCount}
							</Typography>
							<Typography level="body-xs" sx={{ color: 'text.secondary' }}>
								{summary.nearAtlCount > 0 ? `${summary.nearAtlCount} nearing ATL (3%)` : '0 nearing ATL'}
							</Typography>
						</Box>
					</Sheet>
				</Grid>
			</Grid>

			{/* Market Breadth Ratio Gauge */}
			{summary.totalBreakouts > 0 && (
				<Sheet sx={{ ...glassStyle, p: 2.5, mb: 3, borderRadius: 'md' }}>
					<Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
						<Typography level="title-md" sx={{ fontWeight: 'bold' }}>
							Watchlist Breakout Breadth
						</Typography>
						<Chip
							variant="soft"
							color={summary.highsRatio >= 65 ? 'success' : summary.highsRatio <= 35 ? 'danger' : 'neutral'}
							size="sm"
						>
							{summary.highsRatio >= 65
								? '🔥 Strongly Bullish'
								: summary.highsRatio <= 35
								? '❄️ Strongly Bearish'
								: '⚖️ Balanced Sentiment'}
						</Chip>
					</Box>

					{/* Custom Progress Ratio Bar */}
					<Box
						sx={{
							height: 12,
							width: '100%',
							borderRadius: 'sm',
							display: 'flex',
							overflow: 'hidden',
							bgcolor: 'background.level2'
						}}
					>
						<Box
							sx={{
								width: `${summary.highsRatio}%`,
								bgcolor: 'success.solidBg',
								transition: 'width 0.4s ease-out'
							}}
						/>
						<Box
							sx={{
								width: `${summary.lowsRatio}%`,
								bgcolor: 'danger.solidBg',
								transition: 'width 0.4s ease-out'
							}}
						/>
					</Box>

					<Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
						<Typography level="body-xs" sx={{ color: 'success.plainColor', fontWeight: 600 }}>
							Highs / ATH: {summary.athCount + summary.high52wCount} ({summary.highsRatio.toFixed(1)}%)
						</Typography>
						<Typography level="body-xs" sx={{ color: 'danger.plainColor', fontWeight: 600 }}>
							Lows / ATL: {summary.atlCount + summary.low52wCount} ({summary.lowsRatio.toFixed(1)}%)
						</Typography>
					</Box>
				</Sheet>
			)}

			{/* SECTION 1: Today's Active Breakouts */}
			<Sheet sx={{ ...glassStyle, p: 3, mb: 4, borderRadius: 'md' }}>
				<Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1.5 }}>
					<Box>
						<Typography level="title-lg" sx={{ fontWeight: 'bold' }}>
							Today's Active Breakouts ({todayBreakouts.length})
						</Typography>
						<Typography level="body-xs" sx={{ color: 'text.secondary' }}>
							Watchlisted stocks with confirmed price breaches registered today.
						</Typography>
					</Box>

					{/* Filter Chips */}
					{todayBreakouts.length > 0 && (
						<Stack direction="row" spacing={1}>
							<Chip
								variant={breakoutTab === 'all' ? 'solid' : 'outlined'}
								color="neutral"
								size="sm"
								onClick={() => setBreakoutTab('all')}
								sx={{ cursor: 'pointer' }}
							>
								All ({todayBreakouts.length})
							</Chip>
							{summary.athCount > 0 && (
								<Chip
									variant={breakoutTab === 'ath' ? 'solid' : 'outlined'}
									color="success"
									size="sm"
									onClick={() => setBreakoutTab('ath')}
									sx={{ cursor: 'pointer' }}
								>
									ATH ({summary.athCount})
								</Chip>
							)}
							{summary.high52wCount > 0 && (
								<Chip
									variant={breakoutTab === '52w_high' ? 'solid' : 'outlined'}
									color="primary"
									size="sm"
									onClick={() => setBreakoutTab('52w_high')}
									sx={{ cursor: 'pointer' }}
								>
									52W High ({summary.high52wCount})
								</Chip>
							)}
							{summary.low52wCount > 0 && (
								<Chip
									variant={breakoutTab === '52w_low' ? 'solid' : 'outlined'}
									color="warning"
									size="sm"
									onClick={() => setBreakoutTab('52w_low')}
									sx={{ cursor: 'pointer' }}
								>
									52W Low ({summary.low52wCount})
								</Chip>
							)}
							{summary.atlCount > 0 && (
								<Chip
									variant={breakoutTab === 'atl' ? 'solid' : 'outlined'}
									color="danger"
									size="sm"
									onClick={() => setBreakoutTab('atl')}
									sx={{ cursor: 'pointer' }}
								>
									ATL ({summary.atlCount})
								</Chip>
							)}
						</Stack>
					)}
				</Box>

				{loading && todayBreakouts.length === 0 ? (
					<Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
						<CircularProgress />
					</Box>
				) : filteredBreakouts.length === 0 ? (
					<Box
						sx={{
							p: 4,
							textAlign: 'center',
							borderRadius: 'sm',
							border: '1px dashed',
							borderColor: 'divider'
						}}
					>
						<CheckCircle2 size={36} style={{ opacity: 0.5, margin: '0 auto 12px' }} />
						<Typography level="title-md">No Active Breakouts Triggered Today</Typography>
						<Typography level="body-sm" sx={{ color: 'text.secondary', mt: 0.5, maxWidth: 500, mx: 'auto' }}>
							All watchlist stocks are trading within their established historical boundaries today. See the Proximity Matrix below to monitor stocks nearing breakout thresholds.
						</Typography>
					</Box>
				) : (
					<Sheet variant="outlined" sx={{ borderRadius: 'sm', overflowX: 'auto' }}>
						<Table
							hoverRow
							stripe="odd"
							borderAxis="xBetween"
							sx={{
								'& th': { fontWeight: 'bold', fontSize: '0.85rem' },
								'& td': { fontSize: '0.875rem' }
							}}
						>
							<thead>
								<tr>
									<th>Symbol & Name</th>
									<th style={{ textAlign: 'right' }}>Price</th>
									<th style={{ textAlign: 'right' }}>Change %</th>
									<th style={{ textAlign: 'center' }}>Event Type</th>
									<th style={{ textAlign: 'right' }}>Breached Record</th>
									<th style={{ textAlign: 'center' }}>Action</th>
								</tr>
							</thead>
							<tbody>
								{filteredBreakouts.map(b => (
									<tr key={`${b.symbol}-${b.breakoutType}`}>
										<td>
											<Box>
												<Typography level="title-sm" sx={{ fontWeight: 'bold' }}>
													{b.symbol}
												</Typography>
												<Typography level="body-xs" sx={{ color: 'text.tertiary' }}>
													{b.name}
												</Typography>
											</Box>
										</td>
										<td style={{ textAlign: 'right' }}>
											<Typography level="body-sm" sx={{ fontWeight: 600 }}>
												${b.price.toFixed(2)}
											</Typography>
										</td>
										<td style={{ textAlign: 'right' }}>
											<Typography
												level="body-sm"
												sx={{
													fontWeight: 600,
													color: b.percentChange >= 0 ? 'success.plainColor' : 'danger.plainColor'
												}}
											>
												{b.percentChange >= 0 ? '+' : ''}
												{b.percentChange.toFixed(2)}%
											</Typography>
										</td>
										<td style={{ textAlign: 'center' }}>
											{renderStatusBadge(b.breakoutType)}
										</td>
										<td style={{ textAlign: 'right' }}>
											<Typography level="body-xs" sx={{ color: 'text.secondary' }}>
												{b.breakoutType === 'ath'
													? `Prev ATH: $${(b.allTimeHigh ?? b.price).toFixed(2)}`
													: b.breakoutType === '52w_high'
													? `52W High: $${b.yearHigh.toFixed(2)}`
													: b.breakoutType === 'atl'
													? `Prev ATL: $${(b.allTimeLow ?? b.price).toFixed(2)}`
													: `52W Low: $${b.yearLow.toFixed(2)}`}
											</Typography>
										</td>
										<td style={{ textAlign: 'center' }}>
											<Tooltip title="View Detailed Analysis" size="sm">
												<IconButton
													size="sm"
													variant="plain"
													color="neutral"
													onClick={() => handleViewAnalysis(b.symbol)}
												>
													<FileText size={16} />
												</IconButton>
											</Tooltip>
										</td>
									</tr>
								))}
							</tbody>
						</Table>
					</Sheet>
				)}
			</Sheet>

			{/* SECTION 2: Watchlist Proximity Matrix */}
			<Sheet sx={{ ...glassStyle, p: 3, borderRadius: 'md' }}>
				<Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5, flexWrap: 'wrap', gap: 2 }}>
					<Box>
						<Typography level="title-lg" sx={{ fontWeight: 'bold' }}>
							Watchlist Proximity Matrix
						</Typography>
						<Typography level="body-xs" sx={{ color: 'text.secondary' }}>
							Tracking all {matrix.length} active watchlist items with real-time distance to 52-week and All-Time records.
						</Typography>
					</Box>

					{/* Controls: Search & Category Filters */}
					<Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" sx={{ gap: 1 }}>
						<DebouncedInput
							placeholder="Search symbol or sector..."
							value={searchQuery}
							onChange={setSearchQuery}
							size="sm"
							sx={{ width: 220 }}
						/>

						<Stack direction="row" spacing={0.5}>
							<Chip
								variant={statusFilter === 'all' ? 'solid' : 'outlined'}
								color="neutral"
								size="sm"
								onClick={() => setStatusFilter('all')}
								sx={{ cursor: 'pointer' }}
							>
								All ({matrix.length})
							</Chip>
							<Chip
								variant={statusFilter === 'breaking' ? 'solid' : 'outlined'}
								color="primary"
								size="sm"
								onClick={() => setStatusFilter('breaking')}
								sx={{ cursor: 'pointer' }}
							>
								Breaking ({summary.totalBreakouts})
							</Chip>
							<Chip
								variant={statusFilter === 'near' ? 'solid' : 'outlined'}
								color="warning"
								size="sm"
								onClick={() => setStatusFilter('near')}
								sx={{ cursor: 'pointer' }}
							>
								Near Breakout ({totalImminent})
							</Chip>
						</Stack>
					</Stack>
				</Box>

				{/* Proximity Matrix Table */}
				<Sheet variant="outlined" sx={{ borderRadius: 'sm', overflowX: 'auto' }}>
					<Table
						hoverRow
						stripe="odd"
						borderAxis="xBetween"
						sx={{
							'& th': { fontWeight: 'bold', fontSize: '0.85rem' },
							'& td': { fontSize: '0.875rem' }
						}}
					>
						<thead>
							<tr>
								<th>{renderSortHeader('Symbol & Sector', 'symbol')}</th>
								<th style={{ textAlign: 'right' }}>{renderSortHeader('Price', 'price', 'right')}</th>
								<th style={{ textAlign: 'right' }}>{renderSortHeader('Change %', 'percentChange', 'right')}</th>
								<th style={{ textAlign: 'center' }}>Breakout Status</th>
								<th style={{ textAlign: 'right' }}>{renderSortHeader('% From 52W High', 'distance52wHigh', 'right')}</th>
								<th style={{ textAlign: 'right' }}>{renderSortHeader('% From ATH', 'distanceAth', 'right')}</th>
								<th style={{ textAlign: 'right' }}>{renderSortHeader('% From 52W Low', 'distance52wLow', 'right')}</th>
								<th style={{ textAlign: 'center' }}>Action</th>
							</tr>
						</thead>
						<tbody>
							{filteredMatrix.length === 0 ? (
								<tr>
									<td colSpan={8} style={{ textAlign: 'center', padding: '24px' }}>
										<Typography level="body-sm" sx={{ color: 'text.secondary' }}>
											No stocks found matching the criteria.
										</Typography>
									</td>
								</tr>
							) : (
								filteredMatrix.map(m => {
									const isNearHigh = m.status === 'near_ath' || m.status === 'near_52w_high';
									const isNearLow = m.status === 'near_atl' || m.status === 'near_52w_low';

									return (
										<tr key={m.symbol}>
											<td>
												<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
													<Box>
														<Typography level="title-sm" sx={{ fontWeight: 'bold' }}>
															{m.symbol}
														</Typography>
														<Typography level="body-xs" sx={{ color: 'text.tertiary' }}>
															{m.name}
														</Typography>
													</Box>
													{m.sectorLabel && (
														<Chip
															size="sm"
															variant="soft"
															sx={{
																fontSize: '0.7rem',
																height: 20,
																color: m.sectorLabelColor || 'inherit'
															}}
														>
															{m.sectorLabel}
														</Chip>
													)}
												</Box>
											</td>
											<td style={{ textAlign: 'right' }}>
												<Typography level="body-sm" sx={{ fontWeight: 600 }}>
													${m.price > 0 ? m.price.toFixed(2) : '—'}
												</Typography>
											</td>
											<td style={{ textAlign: 'right' }}>
												<Typography
													level="body-sm"
													sx={{
														fontWeight: 600,
														color: m.percentChange >= 0 ? 'success.plainColor' : 'danger.plainColor'
													}}
												>
													{m.percentChange >= 0 ? '+' : ''}
													{m.percentChange.toFixed(2)}%
												</Typography>
											</td>
											<td style={{ textAlign: 'center' }}>
												{renderStatusBadge(m.status)}
											</td>
											<td style={{ textAlign: 'right' }}>
												{m.distance52wHigh !== null ? (
													<Typography
														level="body-sm"
														sx={{
															fontWeight: isNearHigh ? 700 : 500,
															color: isNearHigh
																? 'warning.plainColor'
																: m.distance52wHigh >= 0
																? 'success.plainColor'
																: 'text.primary'
														}}
													>
														{m.distance52wHigh >= 0 ? '+' : ''}
														{m.distance52wHigh.toFixed(2)}%
													</Typography>
												) : (
													<Typography level="body-xs" sx={{ color: 'text.tertiary' }}>—</Typography>
												)}
											</td>
											<td style={{ textAlign: 'right' }}>
												{m.distanceAth !== null ? (
													<Typography
														level="body-sm"
														sx={{
															fontWeight: m.status === 'near_ath' ? 700 : 500,
															color: m.status === 'near_ath'
																? 'warning.plainColor'
																: m.distanceAth >= 0
																? 'success.plainColor'
																: 'text.primary'
														}}
													>
														{m.distanceAth >= 0 ? '+' : ''}
														{m.distanceAth.toFixed(2)}%
													</Typography>
												) : (
													<Typography level="body-xs" sx={{ color: 'text.tertiary' }}>—</Typography>
												)}
											</td>
											<td style={{ textAlign: 'right' }}>
												{m.distance52wLow !== null ? (
													<Typography
														level="body-sm"
														sx={{
															fontWeight: isNearLow ? 700 : 500,
															color: isNearLow
																? 'warning.plainColor'
																: m.distance52wLow <= 0
																? 'danger.plainColor'
																: 'text.primary'
														}}
													>
														{m.distance52wLow >= 0 ? '+' : ''}
														{m.distance52wLow.toFixed(2)}%
													</Typography>
												) : (
													<Typography level="body-xs" sx={{ color: 'text.tertiary' }}>—</Typography>
												)}
											</td>
											<td style={{ textAlign: 'center' }}>
												<Tooltip title="View Detailed Analysis" size="sm">
													<IconButton
														size="sm"
														variant="plain"
														color="neutral"
														onClick={() => handleViewAnalysis(m.symbol)}
													>
														<FileText size={16} />
													</IconButton>
												</Tooltip>
											</td>
										</tr>
									);
								})
							)}
						</tbody>
					</Table>
				</Sheet>
			</Sheet>

			{/* Snackbar feedback */}
			<Snackbar
				autoHideDuration={4000}
				open={toastOpen}
				onClose={() => setToastOpen(false)}
				color="primary"
				variant="solid"
				anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
			>
				{toastMessage}
			</Snackbar>
		</Box>
	);
}
