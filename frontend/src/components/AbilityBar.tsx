import React, { useRef, useCallback } from 'react';
import { Box, Typography, Tooltip } from '@mui/joy';
import { HEROES, dotaColors } from '../styles/dotaTheme';
import gsap from 'gsap';
import * as LucideIcons from 'lucide-react';

interface AbilityBarProps {
  activeTab: string;
  onAbilityUse?: (abilityIndex: number) => void;
}

const getIcon = (name: string, size = 24) => {
  const Icon = (LucideIcons as any)[name];
  return Icon ? <Icon size={size} /> : null;
};

export default function AbilityBar({ activeTab, onAbilityUse }: AbilityBarProps) {
  const hero = HEROES.find(h => h.id === activeTab) || HEROES[0];
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);

  const handleClick = useCallback((index: number, el: HTMLDivElement | null) => {
    if (el) {
      gsap.fromTo(
        el,
        { scale: 0.9 },
        { scale: 1, duration: 0.2, ease: 'back.out(2)' }
      );
    }
    onAbilityUse?.(index);
  }, [onAbilityUse]);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        height: '100%',
        py: 1,
      }}
    >
      {hero.abilities.map((ability, i) => (
        <Tooltip
          key={ability.key}
          title={
            <Box>
              <Typography level="title-sm" sx={{ color: dotaColors.textGold, fontFamily: 'Cinzel, serif' }}>
                [{ability.key}] {ability.name}
              </Typography>
              <Typography level="body-xs" sx={{ color: dotaColors.textMuted, mt: 0.5 }}>
                {ability.description}
              </Typography>
              {ability.cooldown && (
                <Typography level="body-xs" sx={{ color: dotaColors.mp, mt: 0.25 }}>
                  Cooldown: {ability.cooldown}s
                </Typography>
              )}
            </Box>
          }
          placement="top"
          arrow
        >
          <Box
            ref={(el: HTMLDivElement | null) => { slotRefs.current[i] = el; }}
            onClick={() => handleClick(i, slotRefs.current[i])}
            sx={{
              width: 64,
              height: 64,
              borderRadius: '4px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              position: 'relative',
              bgcolor: 'rgba(10, 14, 20, 0.9)',
              border: `1px solid ${dotaColors.borderDark}`,
              color: dotaColors.textLight,
              transition: 'border-color 0.2s, box-shadow 0.2s',
              '&:hover': {
                borderColor: dotaColors.borderGoldBright,
                boxShadow: `0 0 8px ${dotaColors.goldGlow}`,
                color: dotaColors.textGold,
              },
              '&:active': {
                bgcolor: 'rgba(139, 115, 85, 0.15)',
              },
            }}
          >
            {/* Icon */}
            <Box sx={{ mb: 0.5 }}>
              {getIcon(ability.icon, 22)}
            </Box>

            {/* Key label */}
            <Typography
              sx={{
                position: 'absolute',
                bottom: 2,
                right: 4,
                fontSize: '10px',
                fontWeight: 700,
                color: dotaColors.textDim,
                fontFamily: 'Cinzel, serif',
                lineHeight: 1,
              }}
            >
              {ability.key}
            </Typography>

            {/* Ability name */}
            <Typography
              sx={{
                fontSize: '8px',
                fontWeight: 600,
                color: dotaColors.textMuted,
                textAlign: 'center',
                lineHeight: 1.1,
                px: 0.25,
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {ability.name}
            </Typography>
          </Box>
        </Tooltip>
      ))}
    </Box>
  );
}
