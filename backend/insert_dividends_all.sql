-- Manual update/insert of dividends from image captures (MSFT, GOOGL, META, MRVL, TSM)
-- Table schema: dividends(id, symbol, date, amount, per_share, note, created_at)

-- Clean existing dividends for these symbols to prevent duplicates if rerun
DELETE FROM dividends WHERE symbol IN ('MSFT', 'GOOGL', 'META', 'MRVL', 'TSM');

-- Insert MSFT dividends
INSERT INTO dividends (symbol, date, amount, per_share, note) VALUES 
('MSFT', '2026-06-11', 31.85, 0.91, 'Qty: 35'),
('MSFT', '2026-03-12', 12.74, 0.91, 'Qty: 14'),
('MSFT', '2025-12-11', 0.91, 0.91, 'Qty: 1'),
('MSFT', '2025-06-12', 9.13, 0.83, 'Qty: 11'),
('MSFT', '2025-03-13', 1.66, 0.83, 'Qty: 2'),
('MSFT', '2024-12-12', 1.66, 0.83, 'Qty: 2');

-- Insert GOOGL dividends
INSERT INTO dividends (symbol, date, amount, per_share, note) VALUES 
('GOOGL', '2025-12-15', 1.05, 0.21, 'Qty: 5'),
('GOOGL', '2025-09-15', 15.96, 0.21, 'Qty: 76'),
('GOOGL', '2025-06-16', 15.33, 0.21, 'Qty: 73'),
('GOOGL', '2025-03-17', 13.20, 0.20, 'Qty: 66'),
('GOOGL', '2024-12-16', 12.00, 0.20, 'Qty: 60'),
('GOOGL', '2024-09-16', 12.00, 0.20, 'Qty: 60'),
('GOOGL', '2024-06-17', 12.00, 0.20, 'Qty: 60');

-- Insert META dividends
INSERT INTO dividends (symbol, date, amount, per_share, note) VALUES 
('META', '2026-03-26', 5.25, 0.525, 'Qty: 10'),
('META', '2025-12-23', 5.78, 0.525, 'Qty: 11');

-- Insert MRVL dividends
INSERT INTO dividends (symbol, date, amount, per_share, note) VALUES 
('MRVL', '2026-04-30', 1.71, 0.06, 'Qty: 28.508'),
('MRVL', '2026-01-29', 0.96, 0.06, 'Qty: 16');

-- Insert TSM dividends
INSERT INTO dividends (symbol, date, amount, per_share, note) VALUES 
('TSM', '2024-10-09', 18.78, 0.626, 'Qty: 30'),
('TSM', '2024-07-11', 10.88, 0.544, 'Qty: 20'),
('TSM', '2024-04-11', 11.08, 0.554, 'Qty: 20'),
('TSM', '2024-01-11', 9.58, 0.479, 'Qty: 20'),
('TSM', '2023-10-12', 9.42, 0.471, 'Qty: 20'),
('TSM', '2023-07-13', 8.96, 0.448, 'Qty: 20'),
('TSM', '2023-04-13', 5.84, 0.449, 'Qty: 13');
