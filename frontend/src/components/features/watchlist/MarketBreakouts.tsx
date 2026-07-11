import React, { useState, useEffect, useMemo } from 'react';
import { Box, Typography, Sheet, Table, Button, Input, Grid, Stack, IconButton, CircularProgress, Tooltip, Snackbar, Alert } from '@mui/joy';
import { Plus, Check, Play, Calendar, ArrowUp, ArrowDown, ArrowUpDown, Search, FileText } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { useWatchlist } from './hooks/useWatchlist';
import DebouncedInput from '../../common/DebouncedInput';
import { glassStyle } from '../../../styles/glass';
import { API_BASE_URL } from '../../../config';

interface BreakoutItem {
	symbol: string;
	name: string;
	price: number;
	percent_change: number;
	year_high: number;
	year_low: number;
	breakout_type: '52w_high' | '52w_low';
	scan_date: string;
}

export default function MarketBreakouts() {
	const navigate = useNavigate();
	const { watchlist, addWatchlist } = useWatchlist();
	const [breakouts, setBreakouts] = useState<BreakoutItem[]>([]);
	const [selectedDate, setSelectedDate] = useState<string>(() => {
		return new Date().toISOString().split('T')[0];
	});
	const [loading, setLoading] = useState(false);
	const [scanning, setScanning] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');

	// Toast notification state
	const [toastOpen, setToastOpen] = useState(false);
	const [toastMessage, setToastMessage] = useState('');

	// Sort states
	const [highsSort, setHighsSort] = useState<{ field: 'symbol' | 'price' | 'percent_change'; order: 'asc' | 'desc' }>({
		field: 'percent_change',
		order: 'desc'
	});
	const [lowsSort, setLowsSort] = useState<{ field: 'symbol' | 'price' | 'percent_change'; order: 'asc' | 'desc' }>({
		field: 'percent_change',
		order: 'desc'
	});

	const watchlistSymbols = useMemo(() => {
		return new Set(watchlist.map(item => item.symbol.toUpperCase()));
	}, [watchlist]);

	const fetchBreakouts = async (dateStr: string) => {
		setLoading(true);
		try {
			const res = await fetch(`${API_BASE_URL}/api/market-breakouts?date=${dateStr}`);
			if (res.ok) {
				const data = await res.json() as BreakoutItem[];
				setBreakouts(data);
			}
		} catch (error) {
			console.error('Failed to fetch market breakouts:', error);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchBreakouts(selectedDate);
	}, [selectedDate]);

	const handleRunScan = async () => {
		setScanning(true);
		try {
			const res = await fetch(`${API_BASE_URL}/api/scan-market`, { method: 'POST' });
			if (res.ok) {
				const todayStr = new Date().toISOString().split('T')[0];
				setSelectedDate(todayStr);
				await fetchBreakouts(todayStr);
			}
		} catch (error) {
			console.error('Failed to trigger market scan:', error);
		} finally {
			setScanning(false);
		}
	};

	const handleAddToWatchlist = async (item: BreakoutItem) => {
		try {
			await addWatchlist(item.symbol, item.name || item.symbol, 'stock');
			setToastMessage(`${item.symbol} added to watchlist successfully!`);
			setToastOpen(true);
		} catch (e) {
			console.error('Failed to add symbol to watchlist:', e);
		}
	};

	const handleViewAnalysis = (symbol: string) => {
		navigate({
			to: '/analysis',
			search: { symbol, tab: 'report' },
		});
	};

	const handleSortHighs = (field: 'symbol' | 'price' | 'percent_change') => {
		setHighsSort(prev => ({
			field,
			order: prev.field === field && prev.order === 'desc' ? 'asc' : 'desc'
		}));
	};

	const handleSortLows = (field: 'symbol' | 'price' | 'percent_change') => {
		setLowsSort(prev => ({
			field,
			order: prev.field === field && prev.order === 'desc' ? 'asc' : 'desc'
		}));
	};

	// Market Breadth Gauge variables
	const rawHighsList = useMemo(() => breakouts.filter(b => b.breakout_type === '52w_high'), [breakouts]);
	const rawLowsList = useMemo(() => breakouts.filter(b => b.breakout_type === '52w_low'), [breakouts]);
	const totalBreakouts = rawHighsList.length + rawLowsList.length;
	const highsPercentage = totalBreakouts > 0 ? (rawHighsList.length / totalBreakouts) * 100 : 50;
	const lowsPercentage = totalBreakouts > 0 ? (rawLowsList.length / totalBreakouts) * 100 : 50;

	// Highs sorting and filtering
	const highsList = useMemo(() => {
		let list = [...rawHighsList];
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			list = list.filter(item => item.symbol.toLowerCase().includes(q) || (item.name && item.name.toLowerCase().includes(q)));
		}
		list.sort((a, b) => {
			if (highsSort.field === 'symbol') {
				const aVal = a.symbol;
				const bVal = b.symbol;
				return highsSort.order === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
			} else {
				const aVal = a[highsSort.field] as number;
				const bVal = b[highsSort.field] as number;
				return highsSort.order === 'asc' ? aVal - bVal : bVal - aVal;
			}
		});
		return list;
	}, [rawHighsList, searchQuery, highsSort]);

	// Lows sorting and filtering
	const lowsList = useMemo(() => {
		let list = [...rawLowsList];
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			list = list.filter(item => item.symbol.toLowerCase().includes(q) || (item.name && item.name.toLowerCase().includes(q)));
		}
		list.sort((a, b) => {
			if (lowsSort.field === 'symbol') {
				const aVal = a.symbol;
				const bVal = b.symbol;
				return lowsSort.order === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
			} else {
				const aVal = a[lowsSort.field] as number;
				const bVal = b[lowsSort.field] as number;
				return lowsSort.order === 'asc' ? aVal - bVal : bVal - aVal;
			}
		});
		return list;
	}, [rawLowsList, searchQuery, lowsSort]);

	const renderHeaderSortLabel = (
		label: string, 
		field: 'symbol' | 'price' | 'percent_change', 
		currentSort: { field: string; order: 'asc' | 'desc' }, 
		onSort: (field: 'symbol' | 'price' | 'percent_change') => void,
		align: 'left' | 'right' | 'center' = 'left'
	) => {
		const isSorted = currentSort.field === field;
		return (
			<th 
				onClick={() => onSort(field)}
				style={{ 
					cursor: 'pointer', 
					userSelect: 'none', 
					textAlign: align,
					padding: '8px 12px'
				}}
			>
				<Stack 
					direction="row" 
					spacing={0.5} 
					alignItems="center" 
					justifyContent={align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start'}
					sx={{ 
						'&:hover': { color: 'var(--joy-palette-text-primary)' },
						color: isSorted ? 'var(--joy-palette-text-primary)' : 'var(--joy-palette-text-tertiary)',
						transition: 'color 0.2s ease-in-out'
					}}
				>
					<span>{label}</span>
					{isSorted ? (
						currentSort.order === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
					) : (
						<ArrowUpDown size={12} style={{ opacity: 0.4 }} />
					)}
				</Stack>
			</th>
		);
	};

	return (
		<Box>
			{/* Controls Toolbar */}
			<Sheet
				sx={{
					...glassStyle,
					p: 2,
					mb: 3,
					display: 'flex',
					flexDirection: { xs: 'column', md: 'row' },
					gap: 2,
					alignItems: 'center',
					justifyContent: 'space-between',
					backgroundColor: 'rgba(255, 255, 255, 0.02)'
				}}
			>
				<Stack 
					direction={{ xs: 'column', sm: 'row' }} 
					spacing={2.5} 
					alignItems="center" 
					sx={{ width: { xs: '100%', md: 'auto' } }}
				>
					<Stack direction="row" spacing={1.5} alignItems="center" sx={{ width: { xs: '100%', sm: 'auto' } }}>
						<Calendar size={18} opacity={0.6} />
						<Typography level="title-sm" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>Scan Date:</Typography>
						<Input
							type="date"
							value={selectedDate}
							onChange={e => setSelectedDate(e.target.value)}
							size="sm"
							sx={{
								minWidth: 150,
								...glassStyle,
								backgroundColor: 'rgba(255, 255, 255, 0.05)',
								borderColor: 'rgba(255, 255, 255, 0.1)'
							}}
						/>
					</Stack>

					<DebouncedInput
						placeholder="Search symbols or names..."
						value={searchQuery}
						onChange={setSearchQuery}
						size="sm"
						startDecorator={<Search size={16} opacity={0.6} />}
						sx={{
							minWidth: { xs: '100%', sm: 240 },
							...glassStyle,
							backgroundColor: 'rgba(255, 255, 255, 0.05)',
							borderColor: 'rgba(255, 255, 255, 0.1)',
							'&:hover': {
								borderColor: 'rgba(255, 255, 255, 0.2)'
							}
						}}
					/>
				</Stack>

				<Button
					variant="solid"
					color="primary"
					onClick={handleRunScan}
					loading={scanning}
					startDecorator={<Play size={16} />}
					size="sm"
					sx={{
						borderRadius: '12px',
						fontWeight: 600,
						width: { xs: '100%', md: 'auto' },
						transition: 'all 0.3s ease-out',
						boxShadow: '0 4px 12px rgba(16, 185, 129, 0.1)',
						'&:hover': {
							transform: 'translateY(-1px)',
							boxShadow: '0 6px 16px rgba(16, 185, 129, 0.2)'
						}
					}}
				>
					Run Market Scan
				</Button>
			</Sheet>

			{/* Market Breadth Gauge */}
			{!loading && breakouts.length > 0 && (
				<Sheet
					sx={{
						...glassStyle,
						p: 2.5,
						mb: 3,
						backgroundColor: 'rgba(255, 255, 255, 0.01)',
						display: 'flex',
						flexDirection: 'column',
						gap: 1.5
					}}
				>
					<Stack direction="row" justifyContent="space-between" alignItems="center">
						<Typography level="title-sm" sx={{ fontWeight: 700 }}>
							Market Breadth Ratio (52-Week Breakouts)
						</Typography>
						<Typography level="body-xs" sx={{ fontWeight: 700, color: highsPercentage >= 65 ? 'success.solidBg' : highsPercentage <= 35 ? 'danger.solidBg' : 'neutral.solidBg' }}>
							{highsPercentage >= 65 ? '🔥 Strongly Bullish' : highsPercentage <= 35 ? '❄️ Strongly Bearish' : '⚖️ Balanced Market'} ({highsPercentage.toFixed(1)}% Highs)
						</Typography>
					</Stack>
					<Box sx={{ position: 'relative', height: '10px', width: '100%', borderRadius: '5px', overflow: 'hidden', display: 'flex', backgroundColor: 'rgba(255,255,255,0.05)' }}>
						<Box sx={{ width: `${highsPercentage}%`, backgroundColor: '#10b981', transition: 'width 0.5s ease-out' }} />
						<Box sx={{ width: `${lowsPercentage}%`, backgroundColor: '#f43f5e', transition: 'width 0.5s ease-out' }} />
					</Box>
					<Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ opacity: 0.8 }}>
						<Typography level="body-xs" sx={{ color: '#10b981', fontWeight: 600 }}>
							New 52-Week Highs: {rawHighsList.length} ({highsPercentage.toFixed(0)}%)
						</Typography>
						<Typography level="body-xs" sx={{ color: '#f43f5e', fontWeight: 600 }}>
							New 52-Week Lows: {rawLowsList.length} ({lowsPercentage.toFixed(0)}%)
						</Typography>
					</Stack>
				</Sheet>
			)}

			{loading ? (
				<Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
					<CircularProgress variant="soft" />
				</Box>
			) : (
				<Grid container spacing={3}>
					{/* New 52-Week Highs */}
					<Grid xs={12} md={6}>
						<Sheet
							sx={{
								...glassStyle,
								p: 3,
								height: '100%',
								backgroundColor: 'rgba(255, 255, 255, 0.01)'
							}}
						>
							<Typography
								level="h4"
								sx={{
									mb: 2,
									fontWeight: 800,
									color: 'success.solidBg',
									display: 'flex',
									justifyContent: 'space-between',
									alignItems: 'center'
								}}
							>
								<span>New 52-Week Highs</span>
								<Typography level="body-xs" sx={{ opacity: 0.6 }}>
									{highsList.length} Symbols
								</Typography>
							</Typography>
							<Box 
								sx={{ 
									overflowX: 'auto', 
									maxHeight: '600px',
									'&::-webkit-scrollbar': {
										width: '6px',
										height: '6px',
									},
									'&::-webkit-scrollbar-track': {
										background: 'rgba(255, 255, 255, 0.02)',
										borderRadius: '8px',
									},
									'&::-webkit-scrollbar-thumb': {
										background: 'rgba(255, 255, 255, 0.12)',
										borderRadius: '8px',
										'&:hover': {
											background: 'rgba(255, 255, 255, 0.25)',
										},
									},
								}}
							>
								<Table
									hoverRow
									sx={{
										'--TableCell-paddingY': '12px',
										backgroundColor: 'transparent',
										'& tbody tr': {
											transition: 'background-color 0.2s ease-out'
										},
										'& tbody tr:hover': {
											backgroundColor: 'rgba(255,255,255,0.03)',
											cursor: 'pointer'
										}
									}}
								>
									<thead>
										<tr>
											{renderHeaderSortLabel('Symbol', 'symbol', highsSort, handleSortHighs)}
											<th style={{ width: '40%', padding: '8px 12px' }}>Name</th>
											{renderHeaderSortLabel('Price', 'price', highsSort, handleSortHighs, 'right')}
											{renderHeaderSortLabel('Change', 'percent_change', highsSort, handleSortHighs, 'right')}
											<th style={{ textAlign: 'center', width: '60px', padding: '8px 12px' }}>Watch</th>
										</tr>
									</thead>
									<tbody>
										{highsList.length === 0 ? (
											<tr>
												<td colSpan={5} style={{ textAlign: 'center', fontStyle: 'italic', opacity: 0.5 }}>
													No new 52-week highs scanned.
												</td>
											</tr>
										) : (
											highsList.map(item => {
												const isAdded = watchlistSymbols.has(item.symbol);
												return (
													<tr key={item.symbol} onClick={() => handleViewAnalysis(item.symbol)}>
														<td style={{ fontWeight: 700 }}>
															<Stack direction="row" spacing={1} alignItems="center">
																<span>{item.symbol}</span>
																<Tooltip title="View Analysis" variant="soft" size="sm">
																	<IconButton 
																		size="sm" 
																		variant="plain" 
																		color="neutral"
																		onClick={(e) => {
																			e.stopPropagation();
																			handleViewAnalysis(item.symbol);
																		}}
																		sx={{ opacity: 0.5, '&:hover': { opacity: 1 } }}
																	>
																		<FileText size={12} />
																	</IconButton>
																</Tooltip>
															</Stack>
														</td>
														<td style={{ opacity: 0.8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px' }}>
															{item.name || '-'}
														</td>
														<td style={{ textAlign: 'right', fontWeight: 600 }}>
															${item.price.toFixed(2)}
														</td>
														<td
															style={{
																textAlign: 'right',
																fontWeight: 600,
																color: item.percent_change >= 0 ? '#10b981' : '#f43f5e'
															}}
														>
															{item.percent_change >= 0 ? '+' : ''}
															{item.percent_change.toFixed(2)}%
														</td>
														<td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
															<IconButton
																size="sm"
																variant={isAdded ? 'soft' : 'solid'}
																color={isAdded ? 'neutral' : 'success'}
																onClick={() => !isAdded && handleAddToWatchlist(item)}
																disabled={isAdded}
																sx={{ 
																	borderRadius: '8px',
																	transition: 'all 0.2s ease-out',
																	'&:hover': {
																		transform: isAdded ? 'none' : 'scale(1.1)'
																	}
																}}
															>
																{isAdded ? <Check size={16} /> : <Plus size={16} />}
															</IconButton>
														</td>
													</tr>
												);
											})
										)}
									</tbody>
								</Table>
							</Box>
						</Sheet>
					</Grid>

					{/* New 52-Week Lows */}
					<Grid xs={12} md={6}>
						<Sheet
							sx={{
								...glassStyle,
								p: 3,
								height: '100%',
								backgroundColor: 'rgba(255, 255, 255, 0.01)'
							}}
						>
							<Typography
								level="h4"
								sx={{
									mb: 2,
									fontWeight: 800,
									color: 'danger.solidBg',
									display: 'flex',
									justifyContent: 'space-between',
									alignItems: 'center'
								}}
							>
								<span>New 52-Week Lows</span>
								<Typography level="body-xs" sx={{ opacity: 0.6 }}>
									{lowsList.length} Symbols
								</Typography>
							</Typography>
							<Box 
								sx={{ 
									overflowX: 'auto', 
									maxHeight: '600px',
									'&::-webkit-scrollbar': {
										width: '6px',
										height: '6px',
									},
									'&::-webkit-scrollbar-track': {
										background: 'rgba(255, 255, 255, 0.02)',
										borderRadius: '8px',
									},
									'&::-webkit-scrollbar-thumb': {
										background: 'rgba(255, 255, 255, 0.12)',
										borderRadius: '8px',
										'&:hover': {
											background: 'rgba(255, 255, 255, 0.25)',
										},
									},
								}}
							>
								<Table
									hoverRow
									sx={{
										'--TableCell-paddingY': '12px',
										backgroundColor: 'transparent',
										'& tbody tr': {
											transition: 'background-color 0.2s ease-out'
										},
										'& tbody tr:hover': {
											backgroundColor: 'rgba(255,255,255,0.03)',
											cursor: 'pointer'
										}
									}}
								>
									<thead>
										<tr>
											{renderHeaderSortLabel('Symbol', 'symbol', lowsSort, handleSortLows)}
											<th style={{ width: '40%', padding: '8px 12px' }}>Name</th>
											{renderHeaderSortLabel('Price', 'price', lowsSort, handleSortLows, 'right')}
											{renderHeaderSortLabel('Change', 'percent_change', lowsSort, handleSortLows, 'right')}
											<th style={{ textAlign: 'center', width: '60px', padding: '8px 12px' }}>Watch</th>
										</tr>
									</thead>
									<tbody>
										{lowsList.length === 0 ? (
											<tr>
												<td colSpan={5} style={{ textAlign: 'center', fontStyle: 'italic', opacity: 0.5 }}>
													No new 52-week lows scanned.
												</td>
											</tr>
										) : (
											lowsList.map(item => {
												const isAdded = watchlistSymbols.has(item.symbol);
												return (
													<tr key={item.symbol} onClick={() => handleViewAnalysis(item.symbol)}>
														<td style={{ fontWeight: 700 }}>
															<Stack direction="row" spacing={1} alignItems="center">
																<span>{item.symbol}</span>
																<Tooltip title="View Analysis" variant="soft" size="sm">
																	<IconButton 
																		size="sm" 
																		variant="plain" 
																		color="neutral"
																		onClick={(e) => {
																			e.stopPropagation();
																			handleViewAnalysis(item.symbol);
																		}}
																		sx={{ opacity: 0.5, '&:hover': { opacity: 1 } }}
																	>
																		<FileText size={12} />
																	</IconButton>
																</Tooltip>
															</Stack>
														</td>
														<td style={{ opacity: 0.8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px' }}>
															{item.name || '-'}
														</td>
														<td style={{ textAlign: 'right', fontWeight: 600 }}>
															${item.price.toFixed(2)}
														</td>
														<td
															style={{
																textAlign: 'right',
																fontWeight: 600,
																color: item.percent_change >= 0 ? '#10b981' : '#f43f5e'
															}}
														>
															{item.percent_change >= 0 ? '+' : ''}
															{item.percent_change.toFixed(2)}%
														</td>
														<td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
															<IconButton
																size="sm"
																variant={isAdded ? 'soft' : 'solid'}
																color={isAdded ? 'neutral' : 'success'}
																onClick={() => !isAdded && handleAddToWatchlist(item)}
																disabled={isAdded}
																sx={{ 
																	borderRadius: '8px',
																	transition: 'all 0.2s ease-out',
																	'&:hover': {
																		transform: isAdded ? 'none' : 'scale(1.1)'
																	}
																}}
															>
																{isAdded ? <Check size={16} /> : <Plus size={16} />}
															</IconButton>
														</td>
													</tr>
												);
											})
										)}
									</tbody>
								</Table>
							</Box>
						</Sheet>
					</Grid>
				</Grid>
			)}

			{/* Snackbar Toast Alert */}
			<Snackbar
				open={toastOpen}
				autoHideDuration={3000}
				onClose={() => setToastOpen(false)}
				anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
				variant="soft"
				color="success"
				sx={{ 
					...glassStyle, 
					borderRadius: '12px', 
					backgroundColor: 'rgba(20, 20, 20, 0.85)',
					backdropFilter: 'blur(12px)',
					border: '1px solid rgba(16, 185, 129, 0.3)',
					boxShadow: '0 8px 32px rgba(16, 185, 129, 0.15)'
				}}
			>
				<Alert
					variant="soft"
					color="success"
					startDecorator={<Check size={18} />}
					sx={{ width: '100%', bg: 'transparent', p: 0, color: '#10b981' }}
				>
					{toastMessage}
				</Alert>
			</Snackbar>
		</Box>
	);
}
