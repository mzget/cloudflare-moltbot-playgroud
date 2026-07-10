import React from 'react';
import { Box, Typography, Tooltip } from '@mui/joy';
import { HEROES, dotaColors } from '../styles/dotaTheme';

interface MinimapProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function Minimap({ activeTab, setActiveTab }: MinimapProps) {
  // Position each hero dot on the "map"
  const heroPositions = [
    { x: 30, y: 25 },  // Analyst - top left area
    { x: 70, y: 20 },  // Scout - top right
    { x: 20, y: 55 },  // Guardian - mid left
    { x: 50, y: 50 },  // Oracle - center
    { x: 75, y: 60 },  // Merchant - mid right
    { x: 50, y: 85 },  // Sage - bottom center
  ];

  const classColorMap: Record<string, string> = {
    strength: dotaColors.strength,
    agility: dotaColors.agility,
    intelligence: dotaColors.intelligence,
  };

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '2px',
        // Terrain background
        background: `
          radial-gradient(circle at 30% 40%, rgba(16, 80, 40, 0.15) 0%, transparent 50%),
          radial-gradient(circle at 70% 60%, rgba(16, 80, 40, 0.1) 0%, transparent 50%),
          linear-gradient(180deg, #0a1210 0%, #0d1a14 50%, #0a1210 100%)
        `,
        border: `1px solid ${dotaColors.borderGold}`,
        boxShadow: `inset 0 0 20px rgba(0,0,0,0.5)`,
      }}
    >
      {/* Grid lines */}
      {[25, 50, 75].map((pos) => (
        <React.Fragment key={pos}>
          <Box
            sx={{
              position: 'absolute',
              left: `${pos}%`,
              top: 0,
              bottom: 0,
              width: '1px',
              bgcolor: 'rgba(139, 115, 85, 0.08)',
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              top: `${pos}%`,
              left: 0,
              right: 0,
              height: '1px',
              bgcolor: 'rgba(139, 115, 85, 0.08)',
            }}
          />
        </React.Fragment>
      ))}

      {/* "MINIMAP" label */}
      <Typography
        sx={{
          position: 'absolute',
          top: 4,
          left: 6,
          fontSize: '7px',
          fontWeight: 700,
          color: dotaColors.textDim,
          fontFamily: 'Cinzel, serif',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}
      >
        MAP
      </Typography>

      {/* Hero dots */}
      {HEROES.map((hero, i) => {
        const isActive = activeTab === hero.id;
        const pos = heroPositions[i];

        return (
          <Tooltip key={hero.id} title={hero.name} placement="top" arrow>
            <Box
              onClick={() => setActiveTab(hero.id)}
              sx={{
                position: 'absolute',
                left: `${pos.x}%`,
                top: `${pos.y}%`,
                transform: 'translate(-50%, -50%)',
                cursor: 'pointer',
                zIndex: isActive ? 10 : 1,
              }}
            >
              {/* Pulse ring for active hero */}
              {isActive && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    border: `1px solid ${classColorMap[hero.heroClass]}`,
                    opacity: 0.4,
                    animation: 'minimap-pulse 2s ease-in-out infinite',
                    '@keyframes minimap-pulse': {
                      '0%, 100%': { transform: 'translate(-50%, -50%) scale(1)', opacity: 0.4 },
                      '50%': { transform: 'translate(-50%, -50%) scale(1.5)', opacity: 0 },
                    },
                  }}
                />
              )}
              {/* Hero dot */}
              <Box
                sx={{
                  width: isActive ? 10 : 7,
                  height: isActive ? 10 : 7,
                  borderRadius: '50%',
                  bgcolor: classColorMap[hero.heroClass],
                  boxShadow: isActive
                    ? `0 0 8px ${classColorMap[hero.heroClass]}, 0 0 16px ${classColorMap[hero.heroClass]}40`
                    : `0 0 3px ${classColorMap[hero.heroClass]}80`,
                  border: isActive ? '1px solid rgba(255,255,255,0.3)' : 'none',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'scale(1.4)',
                    boxShadow: `0 0 12px ${classColorMap[hero.heroClass]}`,
                  },
                }}
              />
            </Box>
          </Tooltip>
        );
      })}
    </Box>
  );
}
