import * as React from 'react';
import { 
  Box, 
  Typography, 
  Sheet, 
  Grid, 
  Card, 
  CardContent, 
  Chip, 
  Divider,
  Stack,
  CssVarsProvider,
  extendTheme,
  CssBaseline
} from '@mui/joy';
import { TrendingUp, TrendingDown, Minus, Quote } from 'lucide-react';
import {
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
  useSearch,
  useNavigate,
} from '@tanstack/react-router';
import { z } from 'zod';
import Header from './Header';
import Sidebar from './Sidebar';
import SourceManager from './SourceManager';
import Watchlist from './Watchlist';
import KnowledgeChat from './KnowledgeChat';

// 1. Define the Search Schema (Validation)
const dashboardSearchSchema = z.object({
  tab: z.enum(['dashboard', 'agent', 'watchlist', 'sources', 'about']).catch('dashboard'),
});

// Define DashboardContent first so it can be used in the route definition
function DashboardContent() {
  const { tab: activeTab } = useSearch({ from: '/' });
  const navigate = useNavigate();

  const setActiveTab = (tab: string) => {
    navigate({
      to: '/',
      search: { tab: tab as any },
    });
  };

  const [reports, setReports] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  const fetchReports = async () => {
    try {
      const res = await fetch('http://localhost:8787/api/reports');
      if (res.ok) {
        const data = await res.json();
        setReports(data);
      }
    } catch (e) {
      console.error("Failed to fetch reports", e);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchReports();
    const interval = setInterval(fetchReports, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: '1440px', margin: '0 auto', minHeight: '100vh' }}>
        <Header />
        
        <Grid container spacing={4}>
          {/* Sidebar */}
          <Grid xs={12} md={3} lg={2.5}>
            <Sheet sx={{ ...glassStyle, p: 2, position: 'sticky', top: 24 }}>
              <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
            </Sheet>
          </Grid>

          {/* Main Content */}
          <Grid xs={12} md={9} lg={9.5}>
            {activeTab === 'dashboard' && (
              <Box>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
                  <Box>
                    <Typography level="h2" sx={{ color: 'white', fontWeight: 700 }}>Market Intelligence</Typography>
                    <Typography level="body-md" sx={{ color: 'rgba(255,255,255,0.5)' }}>Howard Marks style daily narrative and analysis.</Typography>
                  </Box>
                  <Sheet sx={{ ...glassStyle, px: 3, py: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography level="body-sm" sx={{ color: 'white' }}>Portfolio Sentiment</Typography>
                    <Chip variant="soft" color="success" size="sm" startDecorator={<TrendingUp size={14} />}>Bullish</Chip>
                  </Sheet>
                </Stack>

                {loading ? (
                  <Typography sx={{ color: 'white' }}>Analyzing markets...</Typography>
                ) : reports.length === 0 ? (
                  <Sheet sx={{ ...glassStyle, p: 6, textAlign: 'center' }}>
                    <Typography level="h4" sx={{ color: 'white', mb: 1 }}>No Intelligence Found</Typography>
                    <Typography sx={{ color: 'rgba(255,255,255,0.4)' }}>Add stocks to your watchlist and trigger a crawl to begin.</Typography>
                  </Sheet>
                ) : (
                  <Stack spacing={4}>
                    {reports.map((report) => (
                      <DailyReportCard key={report.id} report={report} />
                    ))}
                  </Stack>
                )}
              </Box>
            )}

            {activeTab === 'watchlist' && <Watchlist />}
            {activeTab === 'agent' && <KnowledgeChat />}
            {activeTab === 'sources' && <SourceManager />}
            {activeTab === 'about' && (
              <Sheet sx={{ ...glassStyle, p: 4 }}>
                <Typography level="h2" sx={{ color: 'white', mb: 2 }}>About Oaktree Agent</Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.8)', mb: 2, lineHeight: 1.8 }}>
                  Inspired by the investment philosophy of Howard Marks (Oaktree Capital), this agent goes beyond raw data. 
                  It synthesizes news into cohesive narratives, focusing on market cycles, risk assessment, and long-term value.
                </Typography>
                <Divider sx={{ my: 3, opacity: 0.1 }} />
                <Typography level="body-sm" sx={{ color: 'rgba(255,255,255,0.4)' }}>
                  Powered by Cloudflare Workers, AI (Llama 3), and Browser Rendering.
                </Typography>
              </Sheet>
            )}
          </Grid>
        </Grid>
      </Box>
  );
}

// 2. Define the Route Tree
const rootRoute = createRootRoute();

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: dashboardSearchSchema,
  component: DashboardContent,
});

const routeTree = rootRoute.addChildren([indexRoute]);

const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
});

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const theme = extendTheme({
  colorSchemes: {
    dark: {
      palette: {
        background: {
          body: 'transparent',
        },
      },
    },
  },
  fontFamily: {
    body: 'Inter, var(--joy-fontFamily-fallback)',
    display: 'Outfit, var(--joy-fontFamily-fallback)',
  },
});

const glassStyle = {
  background: 'rgba(255, 255, 255, 0.05)',
  backdropFilter: 'blur(12px)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '24px',
};

export default function Dashboard() {
  return (
    <CssVarsProvider theme={theme} defaultMode="dark">
      <CssBaseline />
      <RouterProvider router={router} />
    </CssVarsProvider>
  );
}

function DailyReportCard({ report }: { report: any }) {
  const takeaways = JSON.parse(report.key_takeaways || '[]');
  
  return (
    <Card sx={{ ...glassStyle, p: 1 }}>
      <CardContent sx={{ p: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 3 }}>
          <Box>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
              <Typography level="h3" sx={{ color: 'white', fontWeight: 800 }}>{report.symbol}</Typography>
              <Chip 
                variant="soft" 
                color={report.sentiment_score > 0.3 ? 'success' : report.sentiment_score < -0.3 ? 'danger' : 'warning'}
                size="md"
                startDecorator={report.sentiment_score > 0.3 ? <TrendingUp size={16} /> : report.sentiment_score < -0.3 ? <TrendingDown size={16} /> : <Minus size={16} />}
              >
                {report.sentiment_score > 0.3 ? 'Bullish Sentiment' : report.sentiment_score < -0.3 ? 'Bearish Sentiment' : 'Neutral Stance'}
              </Chip>
            </Stack>
            <Typography level="body-xs" sx={{ color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Reported on {new Date(report.report_date).toLocaleDateString()}
            </Typography>
          </Box>
          <Quote size={40} color="rgba(46, 204, 113, 0.1)" />
        </Stack>

        <Typography level="body-lg" sx={{ color: 'rgba(255,255,255,0.9)', fontStyle: 'italic', mb: 4, lineHeight: 1.7, borderLeft: '4px solid #2ecc71', pl: 3 }}>
          {report.summary}
        </Typography>

        <Box sx={{ bgcolor: 'rgba(255,255,255,0.03)', borderRadius: '16px', p: 3 }}>
          <Typography level="title-md" sx={{ color: 'white', mb: 2, fontWeight: 700 }}>Core Takeaways</Typography>
          <Stack spacing={1.5}>
            {takeaways.map((point: string, i: number) => (
              <Stack key={i} direction="row" spacing={2} alignItems="flex-start">
                <Box sx={{ width: 6, height: 6, bgcolor: '#2ecc71', borderRadius: '50%', mt: 1, boxShadow: '0 0 6px #2ecc71' }} />
                <Typography level="body-md" sx={{ color: 'rgba(255,255,255,0.7)' }}>{point}</Typography>
              </Stack>
            ))}
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
}
