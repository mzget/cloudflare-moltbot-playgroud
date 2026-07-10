import React from 'react';
import { Box } from '@mui/joy';
import { dotaColors, dotaStoneStyle } from '../styles/dotaTheme';
import TopResourceBar from './TopResourceBar';
import HeroSelectionBar from './HeroSelectionBar';
import HeroPortrait from './HeroPortrait';
import AbilityBar from './AbilityBar';
import InventoryGrid from './InventoryGrid';
import Minimap from './Minimap';

interface DotaHUDProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  gameMode: boolean;
  onToggleGameMode: () => void;
  reportsCount?: number;
  children: React.ReactNode;
}

export default function DotaHUD({
  activeTab,
  setActiveTab,
  gameMode,
  onToggleGameMode,
  reportsCount,
  children,
}: DotaHUDProps) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateRows: '56px 1fr auto',
        gridTemplateColumns: '1fr',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        bgcolor: dotaColors.contentBg,
      }}
    >
      {/* ═══ Row 1: Top Resource Bar ══════════════════════════════════ */}
      <TopResourceBar
        activeHero={activeTab}
        gameMode={gameMode}
        onToggleGameMode={onToggleGameMode}
      />

      {/* ═══ Row 2: Main Content (scrollable) ════════════════════════ */}
      <Box
        sx={{
          overflow: 'auto',
          p: { xs: 1.5, md: 3 },
          '&::-webkit-scrollbar': { width: '8px' },
          '&::-webkit-scrollbar-track': { bgcolor: dotaColors.hudBg },
          '&::-webkit-scrollbar-thumb': {
            bgcolor: dotaColors.borderDark,
            borderRadius: '4px',
            border: `1px solid ${dotaColors.hudBg}`,
            '&:hover': { bgcolor: dotaColors.borderGold },
          },
        }}
      >
        <Box sx={{ maxWidth: '1600px', margin: '0 auto' }}>{children}</Box>
      </Box>

      {/* ═══ Row 3: Bottom HUD Bar ═══════════════════════════════════ */}
      <Box
        sx={{
          ...dotaStoneStyle,
          height: { xs: '100px', md: '180px' },
          borderTop: `2px solid ${dotaColors.borderGold}`,
          borderBottom: 'none',
          borderLeft: 'none',
          borderRight: 'none',
          borderRadius: 0,
          gridTemplateColumns: {
            xs: '60px 1fr 60px',
            md: '180px 140px 1fr 160px 80px',
          },
          boxShadow: `0 -4px 16px rgba(0,0,0,0.5), 0 -1px 0 ${dotaColors.goldGlow}`,
          position: 'relative',
          zIndex: 1100,
          display: 'grid',
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            background:
              'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.008) 3px, rgba(255,255,255,0.008) 6px)',
            pointerEvents: 'none',
            zIndex: 0,
          },
        }}
      >
        {/* Col 1: Minimap */}
        <Box
          sx={{
            borderRight: `1px solid rgba(139, 115, 85, 0.3)`,
            position: 'relative',
            zIndex: 1,
            p: 0.5,
            display: { xs: 'none', md: 'block' },
          }}
        >
          <Minimap activeTab={activeTab} setActiveTab={setActiveTab} />
        </Box>

        {/* Col 2: Hero Portrait */}
        <Box
          sx={{
            borderRight: `1px solid rgba(139, 115, 85, 0.3)`,
            position: 'relative',
            zIndex: 1,
          }}
        >
          <HeroPortrait activeTab={activeTab} />
        </Box>

        {/* Col 3: Ability Bar */}
        <Box
          sx={{
            borderRight: `1px solid rgba(139, 115, 85, 0.3)`,
            position: 'relative',
            zIndex: 1,
          }}
        >
          <AbilityBar activeTab={activeTab} />
        </Box>

        {/* Col 4: Inventory Grid */}
        <Box
          sx={{
            borderRight: `1px solid rgba(139, 115, 85, 0.3)`,
            position: 'relative',
            zIndex: 1,
            display: { xs: 'none', md: 'block' },
          }}
        >
          <InventoryGrid />
        </Box>

        {/* Col 5: Hero Selection Bar */}
        <Box
          sx={{
            position: 'relative',
            zIndex: 1,
          }}
        >
          <HeroSelectionBar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            reportsCount={reportsCount}
          />
        </Box>
      </Box>
    </Box>
  );
}
