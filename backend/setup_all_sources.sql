DELETE FROM news_sources;
INSERT INTO news_sources (id, name, url_pattern, selector, type, enabled) VALUES 
(1, 'Google News RSS', 'https://news.google.com/rss/search?q={symbol}+stock&hl=en-US&gl=US&ceid=US:en', NULL, 'RSS', 1),
(2, 'Yahoo Finance RSS', 'https://feeds.finance.yahoo.com/rss/2.0/headline?s={symbol}', NULL, 'RSS', 1),
(3, 'Google News WEB', 'https://news.google.com/search?q={symbol}%20stock&hl=en-US&gl=US&ceid=US%3Aen', 'article h3 a', 'WEB', 1),
(4, 'Yahoo Finance WEB', 'https://finance.yahoo.com/quote/{symbol}/', '.titles', 'WEB', 1);
