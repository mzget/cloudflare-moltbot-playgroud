import * as React from 'react';
import { Box, Grid, Sheet, Typography, Divider } from '@mui/joy';
import { useSearch, useNavigate } from '@tanstack/react-router';
import gsap from 'gsap';
import Header from './Header';
import Sidebar from './Sidebar';
import SourceManager from './SourceManager';
import Watchlist from './Watchlist';
import KnowledgeChat from './KnowledgeChat';
import MarketIntelligenceTable from './MarketIntelligenceTable';
import IntelligenceFeed from './IntelligenceFeed';
import { glassStyle } from '../styles/glass';
import { API_BASE_URL } from '../config';

export default function DashboardLayout() {
  const { tab: activeTab } = useSearch({ from: '/' });
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(true);

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
      const res = await fetch(`${API_BASE_URL}/api/reports`);
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
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: '1600px', margin: '0 auto', minHeight: '100vh' }}>
      <Header 
        onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)} 
        sidebarCollapsed={sidebarCollapsed} 
      />

      <Box sx={{ display: 'flex', gap: 4 }}>
        {/* Sidebar Container */}
        <Box 
          sx={{ 
            width: sidebarCollapsed ? '80px' : { md: '280px', lg: '320px' },
            transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            flexShrink: 0,
            display: { xs: 'none', md: 'block' }
          }}
        >
          <Sheet sx={{ 
            ...glassStyle, 
            p: 2, 
            position: 'sticky', 
            top: 24, 
            height: 'fit-content',
            overflow: 'hidden'
          }}>
            <Sidebar 
              activeTab={activeTab} 
              setActiveTab={setActiveTab} 
              reportsCount={reports.length} 
              collapsed={sidebarCollapsed}
            />
          </Sheet>
        </Box>

        {/* Main Content Container */}
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          {activeTab === 'dashboard' && <MarketIntelligenceTable />}
          {activeTab === 'market' && <IntelligenceFeed reports={reports} loading={loading} />}

          {activeTab === 'watchlist' && <Watchlist />}
          {activeTab === 'agent' && <KnowledgeChat />}
          {activeTab === 'sources' && <SourceManager />}
          {activeTab === 'about' && (
            <Sheet sx={{ ...glassStyle, p: 4 }}>
              <Typography level="h2" sx={{ mb: 2 }}>About Oaktree Agent</Typography>
              <Typography sx={{ mb: 2, lineHeight: 1.8 }}>
                Inspired by the investment philosophy of Howard Marks (Oaktree Capital), this agent goes beyond raw data.
                It synthesizes news into cohesive narratives, focusing on market cycles, risk assessment, and long-term value.
              </Typography>
              <Divider sx={{ my: 3, opacity: 0.1 }} />
              <Typography level="body-sm" sx={{ opacity: 0.5 }}>
                Powered by Cloudflare Workers, AI (Llama 3), and Browser Rendering.
              </Typography>
            </Sheet>
          )}
        </Box>
      </Box>
    </Box>
  );
}
