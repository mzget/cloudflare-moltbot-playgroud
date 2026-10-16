import React, { useState } from 'react';
import {
  Box,
  Typography,
  Tabs,
  TabList,
  Tab,
  TabPanel,
} from '@mui/joy';
import {
  Globe,
  Mail,
  BookOpen,
} from 'lucide-react';
import { useSettingsStore, type DensityMode } from '../../../store/settingsStore';
import WebCrawlerTab from './WebCrawlerTab';
import GmailNewslettersTab from './GmailNewslettersTab';
import FacebookQueueTab, { FacebookIcon } from './FacebookQueueTab';
import FundamentalIntelligenceTab from './FundamentalIntelligenceTab';

export { FacebookIcon };

export default function SourceManager({ initialTab = 0 }: { initialTab?: number } = {}) {
  const [index, setIndex] = useState(initialTab);

  let storeDensity: DensityMode = 'cozy';
  try {
    storeDensity = useSettingsStore((state) => state.density);
  } catch {
    storeDensity = 'cozy';
  }
  const density = storeDensity || 'cozy';

  return (
    <Box sx={{ p: 2 }}>
      <Typography level="h2" sx={{ fontWeight: 800, mb: 1 }}>Command Center</Typography>
      <Typography sx={{ color: 'text.secondary', mb: 3 }}>
        Manage crawlers, web search definitions, and email newsletter configurations.
      </Typography>

      <Tabs value={index} onChange={(_e, val) => setIndex(val as number)}>
        <TabList
          variant="soft"
          sx={{
            p: 0.5,
            gap: 1,
            borderRadius: '12px',
            bgcolor: 'background.level1',
            '--Tab-colorscheme': 'primary',
            '--Tab-indicatorRadius': '8px',
            mb: 3,
          }}
        >
          <Tab disableIndicator sx={{ px: 3, borderRadius: '8px' }}>
            <Globe size={16} style={{ marginRight: 8 }} />
            Web & RSS Crawler
          </Tab>
          <Tab disableIndicator sx={{ px: 3, borderRadius: '8px' }}>
            <Mail size={16} style={{ marginRight: 8 }} />
            Gmail Newsletters
          </Tab>
          <Tab disableIndicator sx={{ px: 3, borderRadius: '8px' }}>
            <FacebookIcon size={16} style={{ marginRight: 8 }} />
            Facebook Page
          </Tab>
          <Tab disableIndicator sx={{ px: 3, borderRadius: '8px' }}>
            <BookOpen size={16} style={{ marginRight: 8 }} />
            Fundamental Intelligence
          </Tab>
        </TabList>

        <TabPanel value={0} sx={{ p: 0 }}>
          <WebCrawlerTab density={density} />
        </TabPanel>

        <TabPanel value={1} sx={{ p: 0 }}>
          <GmailNewslettersTab density={density} />
        </TabPanel>

        <TabPanel value={2} sx={{ p: 0 }}>
          <FacebookQueueTab density={density} active={index === 2} />
        </TabPanel>

        <TabPanel value={3} sx={{ p: 0 }}>
          <FundamentalIntelligenceTab density={density} />
        </TabPanel>
      </Tabs>
    </Box>
  );
}
