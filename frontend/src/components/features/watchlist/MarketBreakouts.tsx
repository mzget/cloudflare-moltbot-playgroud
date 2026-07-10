import React, { useState, useEffect, useMemo } from 'react';
import { Box, Typography, Sheet, Table, Button, Input, Grid, Stack, IconButton, CircularProgress } from '@mui/joy';
import { Plus, Check, Play, Calendar } from 'lucide-react';
import { useWatchlist } from './hooks/useWatchlist';
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
	const { watchlist, addWatchlist } = useWatchlist();
	const [breakouts, setBreakouts] = useState<BreakoutItem[]>([]);
	const [selectedDate, setSelectedDate] = useState<string>(() => {
		return new Date().toISOString().split('T')[0];
	});
	const [loading, setLoading] = useState(false);
	const [scanning, setScanning] = useState(false);

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
		} catch (e) {
			console.error('Failed to add symbol to watchlist:', e);
		}
	};

	const highsList = useMemo(() => {
		return breakouts.filter(b => b.breakout_type === '52w_high');
	}, [breakouts]);

	const lowsList = useMemo(() => {
		return breakouts.filter(b => b.breakout_type === '52w_low');
	}, [breakouts]);

	return (
		<Box>
			{/* Controls Toolbar */}
			<Sheet
				sx={{
					...glassStyle,
					p: 2,
					mb: 3,
					display: 'flex',
					flexDirection: { xs: 'column', sm: 'row' },
					gap: 2,
					alignItems: 'center',
					justifyContent: 'space-between',
					backgroundColor: 'rgba(255, 255, 255, 0.02)'
				}}
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
							<Box sx={{ overflowX: 'auto', maxHeight: '600px' }}>
								<Table
									hoverRow
									sx={{
										'--TableCell-paddingY': '12px',
										backgroundColor: 'transparent',
										'& tbody tr:hover': {
											backgroundColor: 'rgba(255,255,255,0.03)'
										}
									}}
								>
									<thead>
										<tr>
											<th>Symbol</th>
											<th style={{ width: '40%' }}>Name</th>
											<th style={{ textAlign: 'right' }}>Price</th>
											<th style={{ textAlign: 'right' }}>Change</th>
											<th style={{ textAlign: 'center', width: '60px' }}>Watch</th>
										</tr>
									</thead>
									<tbody>
										{highsList.length === 0 ? (
											<tr>
												<td colSpan={5} style={{ textAlign: 'center', fontStyle: 'italic', opacity: 0.5 }}>
													No new 52-week highs scanned for this date.
												</td>
											</tr>
										) : (
											highsList.map(item => {
												const isAdded = watchlistSymbols.has(item.symbol);
												return (
													<tr key={item.symbol}>
														<td style={{ fontWeight: 700 }}>{item.symbol}</td>
														<td style={{ opacity: 0.8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px' }}>
															{item.name}
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
														<td style={{ textAlign: 'center' }}>
															<IconButton
																size="sm"
																variant={isAdded ? 'soft' : 'solid'}
																color={isAdded ? 'neutral' : 'success'}
																onClick={() => !isAdded && handleAddToWatchlist(item)}
																disabled={isAdded}
																sx={{ borderRadius: '8px' }}
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
							<Box sx={{ overflowX: 'auto', maxHeight: '600px' }}>
								<Table
									hoverRow
									sx={{
										'--TableCell-paddingY': '12px',
										backgroundColor: 'transparent',
										'& tbody tr:hover': {
											backgroundColor: 'rgba(255,255,255,0.03)'
										}
									}}
								>
									<thead>
										<tr>
											<th>Symbol</th>
											<th style={{ width: '40%' }}>Name</th>
											<th style={{ textAlign: 'right' }}>Price</th>
											<th style={{ textAlign: 'right' }}>Change</th>
											<th style={{ textAlign: 'center', width: '60px' }}>Watch</th>
										</tr>
									</thead>
									<tbody>
										{lowsList.length === 0 ? (
											<tr>
												<td colSpan={5} style={{ textAlign: 'center', fontStyle: 'italic', opacity: 0.5 }}>
													No new 52-week lows scanned for this date.
												</td>
											</tr>
										) : (
											lowsList.map(item => {
												const isAdded = watchlistSymbols.has(item.symbol);
												return (
													<tr key={item.symbol}>
														<td style={{ fontWeight: 700 }}>{item.symbol}</td>
														<td style={{ opacity: 0.8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px' }}>
															{item.name}
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
														<td style={{ textAlign: 'center' }}>
															<IconButton
																size="sm"
																variant={isAdded ? 'soft' : 'solid'}
																color={isAdded ? 'neutral' : 'success'}
																onClick={() => !isAdded && handleAddToWatchlist(item)}
																disabled={isAdded}
																sx={{ borderRadius: '8px' }}
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
		</Box>
	);
}

