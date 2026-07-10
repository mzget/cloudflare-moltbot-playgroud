import React, { useEffect, useRef } from 'react';
import { Box, Typography, Tooltip, Badge } from '@mui/joy';
import { HEROES, dotaColors } from '../styles/dotaTheme';
import gsap from 'gsap';

interface HeroSelectionBarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  reportsCount?: number;
}

export default function HeroSelectionBar({ activeTab, setActiveTab, reportsCount }: HeroSelectionBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const heroRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (containerRef.current) {
      gsap.fromTo(
        heroRefs.current.filter(Boolean),
        { opacity: 0, x: 20, scale: 0.8 },
        {
          opacity: 1,
          x: 0,
          scale: 1,
          duration: 0.4,
          stagger: 0.08,
          ease: 'back.out(1.7)',
        }
      );
    }
  }, []);

  const handleHeroHover = (el: HTMLDivElement | null, enter: boolean) => {
    if (!el) return;
    gsap.to(el, {
      scale: enter ? 1.12 : 1,
      filter: enter ? 'brightness(1.3)' : '',
      duration: 0.2,
      ease: 'power2.out',
    });
  };

  const classColorMap = {
    strength: dotaColors.strength,
    agility: dotaColors.agility,
    intelligence: dotaColors.intelligence,
  };

  return (
    <Box
      ref={containerRef}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '6px',
        py: 1,
        height: '100%',
        justifyContent: 'center',
      }}
    >
      {HEROES.map((hero, i) => {
        const isActive = activeTab === hero.id;
        const showBadge = hero.id === 'market' && reportsCount !== undefined && reportsCount > 0;

        return (
          <Tooltip
            key={hero.id}
            title={
              <Box>
                <Typography level="title-sm" sx={{ color: dotaColors.textGold, fontFamily: 'Cinzel, serif' }}>
                  {hero.name}
                </Typography>
                <Typography level="body-xs" sx={{ color: classColorMap[hero.heroClass] }}>
                  {hero.title} • {hero.heroClass.charAt(0).toUpperCase() + hero.heroClass.slice(1)}
                </Typography>
              </Box>
            }
            placement="left"
            arrow
          >
            <Box
              ref={(el: HTMLDivElement | null) => { heroRefs.current[i] = el; }}
              onClick={() => setActiveTab(hero.id)}
              onMouseEnter={() => handleHeroHover(heroRefs.current[i], true)}
              onMouseLeave={() => handleHeroHover(heroRefs.current[i], false)}
              sx={{
                position: 'relative',
                width: 52,
                height: 52,
                borderRadius: '4px',
                overflow: 'hidden',
                cursor: 'pointer',
                border: isActive ? `2px solid ${dotaColors.gold}` : `1px solid ${dotaColors.borderDark}`,
                boxShadow: isActive
                  ? `0 0 12px ${dotaColors.goldGlow}, 0 0 4px ${dotaColors.goldGlow}`
                  : 'none',
                filter: isActive ? 'brightness(1)' : 'brightness(0.55)',
                transition: 'border 0.2s, box-shadow 0.2s',
                '&::after': isActive ? {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  border: `1px solid ${dotaColors.borderGoldBright}`,
                  borderRadius: '3px',
                  pointerEvents: 'none',
                } : {},
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
              {/* Class color indicator dot */}
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 2,
                  right: 2,
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  bgcolor: classColorMap[hero.heroClass],
                  boxShadow: `0 0 4px ${classColorMap[hero.heroClass]}`,
                }}
              />
              {/* Report badge */}
              {showBadge && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 1,
                    right: 1,
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    bgcolor: dotaColors.danger,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '8px',
                    fontWeight: 700,
                    color: '#fff',
                    boxShadow: `0 0 4px ${dotaColors.danger}`,
                  }}
                >
                  {reportsCount! > 9 ? '9+' : reportsCount}
                </Box>
              )}
            </Box>
          </Tooltip>
        );
      })}
    </Box>
  );
}
