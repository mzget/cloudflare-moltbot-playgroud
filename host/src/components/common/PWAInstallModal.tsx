import * as React from 'react';
import {
  Modal,
  ModalDialog,
  ModalClose,
  Typography,
  Box,
  Stack,
  Sheet,
  Button,
} from '@mui/joy';
import {
  Share,
  PlusSquare,
  Smartphone,
  Zap,
  MoreVertical,
  Download,
  Sparkles,
} from 'lucide-react';
import OaktreeIcon from './OaktreeIcon';
import { checkIsIOS } from '../../hooks/usePWAInstall';
import { glassStyle } from '../../styles/glass';

export interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInstall?: () => void | Promise<any>;
  isIOS?: boolean;
}

export default function PWAInstallModal({
  isOpen,
  onClose,
  onInstall,
  isIOS: isIOSProp,
}: PWAInstallModalProps) {
  const isIOSDevice = typeof isIOSProp === 'boolean'
    ? isIOSProp
    : (typeof navigator !== 'undefined' ? checkIsIOS(navigator) : false);

  const handleInstallClick = async () => {
    if (onInstall) {
      await onInstall();
    }
    onClose();
  };

  return (
    <Modal open={isOpen} onClose={onClose} disablePortal={typeof window === 'undefined' ? true : undefined}>
      <ModalDialog
        aria-labelledby="pwa-modal-title"
        sx={{
          ...glassStyle,
          maxWidth: 440,
          width: '92vw',
          p: { xs: 2.5, sm: 3 },
          borderRadius: '24px',
          boxShadow: '0 24px 48px -12px rgba(0, 0, 0, 0.7)',
        }}
      >
        <ModalClose variant="plain" sx={{ top: 16, right: 16, borderRadius: '50%' }} />

        {/* App Icon & Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2.5, pr: 4 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: '16px',
              bgcolor: 'primary.softBg',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              border: '1px solid',
              borderColor: 'primary.outlinedBorder',
              color: 'primary.plainColor',
            }}
          >
            <OaktreeIcon size={30} color="var(--joy-palette-primary-500, #10b981)" />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              id="pwa-modal-title"
              level="title-md"
              sx={{ fontWeight: 800, color: 'text.primary', display: 'flex', alignItems: 'center', gap: 1 }}
            >
              ติดตั้ง Oaktree App
              <Sparkles size={16} color="#eab308" />
            </Typography>
            <Typography level="body-xs" sx={{ color: 'text.secondary', mt: 0.25 }}>
              เพิ่มลงหน้าจอหลักเพื่อเข้าถึงข้อมูลการลงทุนได้ทันที
            </Typography>
          </Box>
        </Box>

        {/* Benefits Badges */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, mb: 2.5 }}>
          <Sheet
            variant="soft"
            color="neutral"
            sx={{
              p: 1.25,
              borderRadius: '12px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 0.5,
            }}
          >
            <Zap size={16} color="var(--joy-palette-warning-solidBg, #f59e0b)" />
            <Typography level="body-xs" sx={{ fontWeight: 600, fontSize: '0.72rem' }}>
              เปิดไว 1 คลิก
            </Typography>
          </Sheet>
          <Sheet
            variant="soft"
            color="neutral"
            sx={{
              p: 1.25,
              borderRadius: '12px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 0.5,
            }}
          >
            <Smartphone size={16} color="var(--joy-palette-primary-solidBg, #10b981)" />
            <Typography level="body-xs" sx={{ fontWeight: 600, fontSize: '0.72rem' }}>
              เต็มจอไร้บาร์
            </Typography>
          </Sheet>
          <Sheet
            variant="soft"
            color="neutral"
            sx={{
              p: 1.25,
              borderRadius: '12px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 0.5,
            }}
          >
            <Sparkles size={16} color="var(--joy-palette-success-solidBg, #059669)" />
            <Typography level="body-xs" sx={{ fontWeight: 600, fontSize: '0.72rem' }}>
              ออฟไลน์แคช
            </Typography>
          </Sheet>
        </Box>

        {/* Step-by-Step Instructions */}
        <Sheet
          variant="outlined"
          sx={{
            p: 2,
            borderRadius: '16px',
            bgcolor: 'background.level1',
            borderColor: 'divider',
            mb: 2.5,
          }}
        >
          {isIOSDevice ? (
            <Stack spacing={1.5}>
              <Typography level="body-xs" sx={{ fontWeight: 700, color: 'primary.plainColor', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                วิธีติดตั้งบน iOS Safari:
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                <Box
                  sx={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    bgcolor: 'primary.softBg',
                    color: 'primary.plainColor',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  1
                </Box>
                <Typography level="body-sm" sx={{ color: 'text.primary', pt: 0.25 }}>
                  แตะปุ่ม <Box component="span" sx={{ fontWeight: 700, px: 0.75, py: 0.25, borderRadius: '6px', bgcolor: 'background.level2', display: 'inline-flex', alignItems: 'center', gap: 0.5 }}><Share size={13} /> แชร์ (Share)</Box> ที่แถบด้านล่างของ Safari
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                <Box
                  sx={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    bgcolor: 'primary.softBg',
                    color: 'primary.plainColor',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  2
                </Box>
                <Typography level="body-sm" sx={{ color: 'text.primary', pt: 0.25 }}>
                  เลื่อนลงมาแล้วเลือก <Box component="span" sx={{ fontWeight: 700, px: 0.75, py: 0.25, borderRadius: '6px', bgcolor: 'background.level2', display: 'inline-flex', alignItems: 'center', gap: 0.5 }}><PlusSquare size={13} /> เพิ่มไปยังหน้าจอโฮม</Box>
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                <Box
                  sx={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    bgcolor: 'primary.softBg',
                    color: 'primary.plainColor',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  3
                </Box>
                <Typography level="body-sm" sx={{ color: 'text.primary', pt: 0.25 }}>
                  แตะ <Box component="span" sx={{ fontWeight: 700, color: 'success.plainColor' }}>"เพิ่ม" (Add)</Box> ที่มุมบนขวา เป็นอันเสร็จสิ้น
                </Typography>
              </Box>
            </Stack>
          ) : (
            <Stack spacing={1.5}>
              <Typography level="body-xs" sx={{ fontWeight: 700, color: 'primary.plainColor', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                วิธีติดตั้งบน Android / Chrome / Edge:
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                <Box
                  sx={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    bgcolor: 'primary.softBg',
                    color: 'primary.plainColor',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  1
                </Box>
                <Typography level="body-sm" sx={{ color: 'text.primary', pt: 0.25 }}>
                  กดปุ่ม <Box component="span" sx={{ fontWeight: 700, color: 'primary.plainColor' }}>"ติดตั้งแอป"</Box> ด้านล่าง หรือแตะที่ไอคอนติดตั้งบนแถบ URL
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                <Box
                  sx={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    bgcolor: 'primary.softBg',
                    color: 'primary.plainColor',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  2
                </Box>
                <Typography level="body-sm" sx={{ color: 'text.primary', pt: 0.25 }}>
                  หากเมนูไม่ขึ้น ให้แตะ <Box component="span" sx={{ fontWeight: 700, px: 0.75, py: 0.25, borderRadius: '6px', bgcolor: 'background.level2', display: 'inline-flex', alignItems: 'center', gap: 0.5 }}><MoreVertical size={13} /> จุดสามจุด</Box> แล้วเลือก "ติดตั้งแอป" (Install App)
                </Typography>
              </Box>
            </Stack>
          )}
        </Sheet>

        {/* Action Buttons */}
        {isIOSDevice ? (
          <Button
            variant="solid"
            color="primary"
            onClick={onClose}
            sx={{ borderRadius: '14px', py: 1.2, fontWeight: 700 }}
          >
            เข้าใจแล้ว
          </Button>
        ) : (
          <Stack spacing={1}>
            <Button
              id="pwa-modal-install-btn"
              variant="solid"
              color="primary"
              startDecorator={<Download size={18} />}
              onClick={handleInstallClick}
              sx={{ borderRadius: '14px', py: 1.2, fontWeight: 700 }}
            >
              ติดตั้งแอปทันที
            </Button>
            <Button
              variant="plain"
              color="neutral"
              onClick={onClose}
              sx={{ borderRadius: '14px', fontSize: '0.85rem' }}
            >
              ไว้คราวหลัง
            </Button>
          </Stack>
        )}
      </ModalDialog>
    </Modal>
  );
}
