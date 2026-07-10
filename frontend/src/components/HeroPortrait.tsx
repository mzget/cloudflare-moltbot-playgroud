import React, { useEffect, useRef } from 'react';
import { Box, Typography } from '@mui/joy';
import { HEROES, dotaColors } from '../styles/dotaTheme';
import gsap from 'gsap';

interface HeroPortraitProps {
  activeTab: string;
}

export default function HeroPortrait({ activeTab }: HeroPortraitProps) {
  const portraitRef = useRef<HTMLDivElement>(null);
  const hero = HEROES.find(h => h.id === activeTab) || HEROES[0];

  const classColorMap: Record<string, string> = {
    strength: dotaColors.strength,
    agility: dotaColors.agility,
    intelligence: dotaColors.intelligence,
  };

  useEffect(() => {
    if (portraitRef.current) {
      gsap.fromTo(
        portraitRef.current,
        { opacity: 0, scale: 0.9 },
        { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(1.4)' }
      );
    }
  }, [activeTab]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.5,
        py: 0.5,
        height: '100%',
        justifyContent: 'center',
      }}
    >
      {/* Portrait Frame */}
      <Box
        ref={portraitRef}
        sx={{
          width: 100,
          height: 110,
          borderRadius: '4px',
          overflow: 'hidden',
          border: `3px solid ${dotaColors.borderGold}`,
          boxShadow: `
            0 0 0 1px ${dotaColors.borderDark},
            0 0 15px ${dotaColors.goldGlow},
            inset 0 0 5px rgba(255, 215, 0, 0.1)
          `,
          position: 'relative',
        }}
      >
        <Box
          component="img"
          src={hero.portrait}
          alt={hero.name}
          sx={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'top center',
            display: 'block',
          }}
        />
        {/* Level badge */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
            px: 0.5,
            py: 0.25,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography
            sx={{
              fontSize: '9px',
              fontWeight: 700,
              color: dotaColors.textGold,
              fontFamily: 'Cinzel, serif',
              textShadow: '0 0 4px rgba(255,215,0,0.5)',
            }}
          >
            LVL 1
          </Typography>
        </Box>
      </Box>

      {/* HP Bar */}
      <Box sx={{ width: '100%', px: 0.5 }}>
        <Box
          sx={{
            height: 6,
            bgcolor: dotaColors.hpBg,
            borderRadius: '1px',
            overflow: 'hidden',
            border: `1px solid rgba(56, 142, 60, 0.3)`,
          }}
        >
          <Box
            sx={{
              width: '82%',
              height: '100%',
              background: `linear-gradient(90deg, ${dotaColors.hp}, #66BB6A)`,
              boxShadow: `0 0 4px rgba(76, 175, 80, 0.4)`,
              borderRadius: '1px',
            }}
          />
        </Box>
      </Box>

      {/* MP Bar */}
      <Box sx={{ width: '100%', px: 0.5 }}>
        <Box
          sx={{
            height: 5,
            bgcolor: dotaColors.mpBg,
            borderRadius: '1px',
            overflow: 'hidden',
            border: `1px solid rgba(25, 118, 210, 0.3)`,
          }}
        >
          <Box
            sx={{
              width: '65%',
              height: '100%',
              background: `linear-gradient(90deg, ${dotaColors.mp}, #42A5F5)`,
              boxShadow: `0 0 4px rgba(33, 150, 243, 0.4)`,
              borderRadius: '1px',
            }}
          />
        </Box>
      </Box>

      {/* Hero Name */}
      <Typography
        sx={{
          fontSize: '10px',
          fontWeight: 700,
          color: dotaColors.textGold,
          fontFamily: 'Cinzel, serif',
          textAlign: 'center',
          lineHeight: 1.2,
          textShadow: '0 0 6px rgba(255,215,0,0.3)',
        }}
      >
        {hero.name}
      </Typography>
      <Typography
        sx={{
          fontSize: '8px',
          fontWeight: 600,
          color: classColorMap[hero.heroClass],
          textAlign: 'center',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
      >
        {hero.heroClass}
      </Typography>
    </Box>
  );
}
