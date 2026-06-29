import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Card,
  Button,
  IconButton,
  Stack,
  Sheet,
  Tabs,
  TabList,
  Tab,
  TabPanel,
  LinearProgress,
} from '@mui/joy';
import { Volume2, VolumeX, Sparkles, Terminal, Gamepad2, BookOpen, RefreshCw } from 'lucide-react';
import { glassStyle } from '../../../styles/glass';

// Sound synthesizer using Web Audio API
const playTone = (type: 'collect' | 'hit' | 'jump', muted: boolean) => {
  if (muted) return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'collect') {
      // Coin-like retro ding sound
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08); // A5
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else if (type === 'jump') {
      // Retro pitch slide jump sound
      osc.type = 'sine';
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } else {
      // Low buzz/crash for hitting a risk
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.35);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    }
  } catch (e) {
    console.warn("Web Audio API blocked or not supported:", e);
  }
};

interface HowardMarksQuote {
  title: string;
  quote: string;
}

const MEMO_QUOTES: HowardMarksQuote[] = [
  {
    title: "การคิดขั้นที่สอง (Second-Level Thinking)",
    quote: "อย่ามองแค่ 'บริษัทนี้ดี น่าซื้อหุ้น' แต่ต้องประเมินว่าตลาดคาดหวังอะไร และราคาหุ้นได้สะท้อนความคาดหวังนั้นไปแล้วหรือยัง"
  },
  {
    title: "ความเสี่ยงที่แท้จริง (Permanent Loss of Capital)",
    quote: "ความเสี่ยงที่ใหญ่ที่สุดไม่ใช่ความผันผวน (Volatility) แต่คือโอกาสที่จะสูญเสียเงินต้นอย่างถาวร หุ้นผันผวนแต่ราคาต่ำอาจปลอดภัยกว่าหุ้นนิ่งแต่ราคาแพงลิ่ว"
  },
  {
    title: "อันตรายสูงสุดในตลาด",
    quote: "ความเสี่ยงที่น่ากลัวที่สุดเกิดขึ้นเมื่อคนในตลาดเชื่อร่วมกันว่า 'ไม่มีความเสี่ยง' เพราะนั่นคือช่วงเวลาที่วินัยจะหายไปและราคาก็จะพุ่งเกินจริง"
  },
  {
    title: "วินัยด้านราคา (Price Discipline)",
    quote: "ไม่ว่าหุ้นนั้นจะมีพื้นฐานทางธุรกิจที่ดีเลิศเพียงใดก็ตาม หากซื้อมาในราคาที่สูงเกินควร การลงทุนนั้นก็พร้อมจะล้มเหลวได้ทันที"
  },
  {
    title: "ตำแหน่งบนวัฏจักร (Cycle Assessment)",
    quote: "แม้เราจะทำนายอนาคตไม่ได้ แต่เราต้องประเมินให้ออกว่าตอนนี้พอร์ตโฟลิโอเราอยู่จุดใดในวัฏจักรตลาด กำลังมีคนโลภสุดขีด หรือมีความกลัวครอบงำ"
  },
  {
    title: "ความถ่อมตัวทางปัญญา (Intellectual Humility)",
    quote: "ยอมรับตามตรงว่าเราพยากรณ์เศรษฐกิจมหภาคหรือทิศทางตลาดไม่ได้ ให้เน้นวิเคราะห์มูลค่าของธุรกิจและบริหารความเสี่ยงที่เราควบคุมได้เป็นหลัก"
  },
  {
    title: "มุมมองสวนทาง (Contrarianism)",
    quote: "การลงทุนที่ประสบความสำเร็จต้องการการวิเคราะห์อย่างโดดเดี่ยว: ซื้อเมื่อผู้อื่นกลัวขาย และระมัดระวังเมื่อผู้อื่นโลภจนขาดสติ"
  }
];

interface Obstacle {
  id: number;
  x: number;
  emoji: string;
  speed: number;
  size: number;
}

interface InteractiveWaitingStateProps {
  activeTool?: string;
  onStop?: () => void;
}

export default function InteractiveWaitingState({ activeTool, onStop }: InteractiveWaitingStateProps) {
  const [index, setIndex] = useState(0);
  const [quoteIndex, setQuoteIndex] = useState(() => Math.floor(Math.random() * MEMO_QUOTES.length));
  
  // Game state
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    if (typeof window !== 'undefined') {
      return parseInt(localStorage.getItem('oaktree_game_highscore') || '0', 10);
    }
    return 0;
  });
  const [isMuted, setIsMuted] = useState(true);
  const [gameState, setGameState] = useState<'idle' | 'running' | 'gameover'>('idle');

  // Simulated Console Log steps
  const [logs, setLogs] = useState<string[]>([
    "🤖 Spawning portfolio advisor agent...",
    "🔍 Analyzing user request and intent...",
  ]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({
    score: 0,
    gameState: 'idle' as 'idle' | 'running' | 'gameover',
    dinoY: 0,
    dinoVelocityY: 0,
    obstacles: [] as Obstacle[],
    obstacleId: 0,
    muted: true,
    frameCount: 0,
  });

  // Keep stateRef in sync with actual values for the animation loop
  stateRef.current.score = score;
  stateRef.current.muted = isMuted;
  stateRef.current.gameState = gameState;

  // Next quote click
  const nextQuote = () => {
    setQuoteIndex(prev => (prev + 1) % MEMO_QUOTES.length);
  };

  // Add logs dynamically as time ticks
  useEffect(() => {
    const logTimeline = [
      { delay: 1500, log: "📡 Connecting to D1 database cluster..." },
      { delay: 3200, log: "📊 Querying user holdings & historical quotes..." },
      { delay: 5000, log: "🧠 Applying second-level thinking analysis framework..." },
      { delay: 7000, log: "📝 Drafting financial memo in Howard Marks style..." },
      { delay: 9000, log: "✨ Synthesizing final advice output..." },
    ];

    const timers = logTimeline.map(item => {
      return setTimeout(() => {
        setLogs(prev => [...prev, item.log]);
      }, item.delay);
    });

    return () => timers.forEach(clearTimeout);
  }, []);

  // When activeTool changes, append a real log!
  useEffect(() => {
    if (activeTool) {
      setLogs(prev => [
        ...prev,
        `⚡ Executing Tool: ${activeTool}...`,
      ]);
    }
  }, [activeTool]);

  // Update High Score when score changes
  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('oaktree_game_highscore', score.toString());
    }
  }, [score, highScore]);

  // Mini-Game Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let lastSpawnFrame = 0;

    // Ground & Dino dimensions
    const groundY = canvas.height - 24;
    const dinoX = 50;
    const dinoSize = 24;
    const gravity = 0.55;
    const jumpForce = -9.2;

    const resizeCanvas = () => {
      if (canvas && containerRef.current) {
        canvas.width = containerRef.current.clientWidth;
        canvas.height = 160;
        // Adjust Dino ground position on resize
        if (stateRef.current.gameState === 'idle') {
          stateRef.current.dinoY = groundY - dinoSize;
        }
      }
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Background clouds
    const clouds = [
      { x: 100, y: 30, speed: 0.2 },
      { x: 280, y: 50, speed: 0.15 },
      { x: 420, y: 25, speed: 0.25 }
    ];

    const startGame = () => {
      stateRef.current.score = 0;
      setScore(0);
      stateRef.current.gameState = 'running';
      setGameState('running');
      stateRef.current.dinoY = groundY - dinoSize;
      stateRef.current.dinoVelocityY = 0;
      stateRef.current.obstacles = [];
      stateRef.current.frameCount = 0;
      lastSpawnFrame = 0;
    };

    const triggerJump = () => {
      const gState = stateRef.current.gameState;
      if (gState === 'idle' || gState === 'gameover') {
        startGame();
      } else if (gState === 'running') {
        // Only jump if dino is on the ground
        if (stateRef.current.dinoY >= groundY - dinoSize) {
          stateRef.current.dinoVelocityY = jumpForce;
          playTone('jump', stateRef.current.muted);
        }
      }
    };

    const handleCanvasClick = (e: MouseEvent) => {
      e.preventDefault();
      triggerJump();
    };

    const handleCanvasTouch = (e: TouchEvent) => {
      e.preventDefault();
      triggerJump();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') {
        e.preventDefault();
        triggerJump();
      }
    };

    canvas.addEventListener('click', handleCanvasClick);
    canvas.addEventListener('touchstart', handleCanvasTouch, { passive: false });
    window.addEventListener('keydown', handleKeyDown);

    // Main animation loop
    const update = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 1. Draw a beautiful subtle cyber/grid background
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      for (let i = 0; i < canvas.width; i += 24) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
      }
      for (let j = 0; j < canvas.height; j += 24) {
        ctx.beginPath();
        ctx.moveTo(0, j);
        ctx.lineTo(canvas.width, j);
        ctx.stroke();
      }

      // 2. Draw background clouds (translucent)
      ctx.globalAlpha = 0.35;
      clouds.forEach(cloud => {
        if (stateRef.current.gameState === 'running') {
          cloud.x -= cloud.speed;
          if (cloud.x < -40) {
            cloud.x = canvas.width + 40;
            cloud.y = Math.random() * 45 + 15;
          }
        }
        ctx.font = '18px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('☁️', cloud.x, cloud.y);
      });
      ctx.globalAlpha = 1.0;

      // 3. Game state running calculations
      if (stateRef.current.gameState === 'running') {
        stateRef.current.frameCount++;
        
        // Accumulate score
        if (stateRef.current.frameCount % 6 === 0) {
          stateRef.current.score += 1;
          setScore(stateRef.current.score);
        }

        // Apply physics to Dino
        stateRef.current.dinoVelocityY += gravity;
        stateRef.current.dinoY += stateRef.current.dinoVelocityY;

        // Ground collision
        if (stateRef.current.dinoY >= groundY - dinoSize) {
          stateRef.current.dinoY = groundY - dinoSize;
          stateRef.current.dinoVelocityY = 0;
        }

        // Dynamic difficulty speed calculations
        const gameSpeed = 4.2 + Math.min(5.8, stateRef.current.score * 0.012);

        // Spawn obstacles
        const minSpawnInterval = Math.max(60, 120 - Math.floor(gameSpeed * 6));
        const spawnRandomDelay = Math.random() * 50;
        if (stateRef.current.frameCount - lastSpawnFrame > minSpawnInterval + spawnRandomDelay) {
          lastSpawnFrame = stateRef.current.frameCount;
          const obstacleEmojis = ['🌵', '🪨', '🧱', '⚠️'];
          const emoji = obstacleEmojis[Math.floor(Math.random() * obstacleEmojis.length)];
          stateRef.current.obstacles.push({
            id: stateRef.current.obstacleId++,
            x: canvas.width + 20,
            emoji,
            speed: gameSpeed,
            size: 20
          });
        }

        // Update obstacles and collision checks
        stateRef.current.obstacles.forEach((obstacle) => {
          obstacle.x -= obstacle.speed;

          // Draw obstacle
          ctx.font = '22px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillText(obstacle.emoji, obstacle.x, groundY - obstacle.size + 2);

          // Collision check boxes (using tight margins since emojis have inner whitespace)
          const dinoLeft = dinoX - 6;
          const dinoRight = dinoX + 6;
          const dinoTop = stateRef.current.dinoY + 2;
          const dinoBottom = stateRef.current.dinoY + dinoSize - 2;

          const obstacleLeft = obstacle.x - 6;
          const obstacleRight = obstacle.x + 6;
          const obstacleTop = groundY - obstacle.size + 4;
          const obstacleBottom = groundY;

          const isColliding =
            dinoRight > obstacleLeft &&
            dinoLeft < obstacleRight &&
            dinoBottom > obstacleTop &&
            dinoTop < obstacleBottom;

          if (isColliding) {
            stateRef.current.gameState = 'gameover';
            setGameState('gameover');
            playTone('hit', stateRef.current.muted);
          }
        });

        // Filter out offscreen obstacles
        stateRef.current.obstacles = stateRef.current.obstacles.filter(o => o.x > -30);
      }

      // 4. Draw ground line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      ctx.lineTo(canvas.width, groundY);
      ctx.stroke();

      // 5. Draw Dino
      let dinoEmoji = '🦖';
      if (stateRef.current.gameState === 'gameover') {
        dinoEmoji = '💀';
      } else if (stateRef.current.gameState === 'running') {
        const isJumping = stateRef.current.dinoY < groundY - dinoSize - 1;
        if (!isJumping && Math.floor(stateRef.current.frameCount / 8) % 2 === 0) {
          dinoEmoji = '🦕';
        }
      }

      ctx.font = '24px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(dinoEmoji, dinoX, stateRef.current.dinoY);

      // 6. Draw HUD overlays
      if (stateRef.current.gameState === 'idle') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.font = 'bold 15px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🦖 Dino Run', canvas.width / 2, canvas.height / 2 - 20);

        ctx.font = '12px sans-serif';
        ctx.fillStyle = '#10b981';
        ctx.fillText('กด Spacebar หรือ แตะหน้าจอ เพื่อกระโดดเริ่มเล่น', canvas.width / 2, canvas.height / 2 + 15);
      } else if (stateRef.current.gameState === 'gameover') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.font = 'bold 16px sans-serif';
        ctx.fillStyle = '#ef4444';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('💥 GAME OVER 💥', canvas.width / 2, canvas.height / 2 - 25);

        ctx.font = 'bold 13px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`Score: ${stateRef.current.score}`, canvas.width / 2, canvas.height / 2);

        ctx.font = '11px sans-serif';
        ctx.fillStyle = '#10b981';
        ctx.fillText('กด Spacebar หรือ แตะหน้าจอ เพื่อเล่นใหม่', canvas.width / 2, canvas.height / 2 + 25);
      }

      animationId = requestAnimationFrame(update);
    };

    animationId = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resizeCanvas);
      canvas.removeEventListener('click', handleCanvasClick);
      canvas.removeEventListener('touchstart', handleCanvasTouch);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <Card
      className="waiting-state-card"
      sx={{
        ...glassStyle,
        p: 2,
        mb: 2,
        maxWidth: '550px',
        bgcolor: 'rgba(255, 255, 255, 0.08)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        backdropFilter: 'blur(16px)',
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.12)',
        alignSelf: 'flex-start',
        width: '100%',
        borderRadius: 'lg',
        overflow: 'hidden',
      }}
    >
      <Tabs
        aria-label="Agent Waiting Tabs"
        value={index}
        onChange={(event, newValue) => setIndex(newValue as number)}
        sx={{
          bgcolor: 'transparent',
          '--Tabs-gap': '0px',
        }}
      >
        <TabList
          variant="plain"
          size="sm"
          sx={{
            p: 0.5,
            gap: 1,
            borderRadius: 'md',
            bgcolor: 'rgba(0,0,0,0.06)',
          }}
        >
          <Tab
            variant={index === 0 ? 'solid' : 'plain'}
            color={index === 0 ? 'success' : 'neutral'}
            sx={{ borderRadius: 'md', gap: 1, flex: 1, transition: 'all 0.2s' }}
          >
            <Gamepad2 size={16} />
            <Typography level="body-xs" sx={{ fontWeight: 'bold' }}>Dino Run</Typography>
          </Tab>
          <Tab
            variant={index === 1 ? 'solid' : 'plain'}
            color={index === 1 ? 'success' : 'neutral'}
            sx={{ borderRadius: 'md', gap: 1, flex: 1, transition: 'all 0.2s' }}
          >
            <BookOpen size={16} />
            <Typography level="body-xs" sx={{ fontWeight: 'bold' }}>Wisdom Memo</Typography>
          </Tab>
          <Tab
            variant={index === 2 ? 'solid' : 'plain'}
            color={index === 2 ? 'success' : 'neutral'}
            sx={{ borderRadius: 'md', gap: 1, flex: 1, transition: 'all 0.2s' }}
          >
            <Terminal size={16} />
            <Typography level="body-xs" sx={{ fontWeight: 'bold' }}>Live Logs</Typography>
          </Tab>
        </TabList>

        {/* Tab 1: Game Panel */}
        <TabPanel value={0} sx={{ p: 0, pt: 2 }}>
          <Box ref={containerRef} sx={{ position: 'relative', width: '100%' }}>
            {/* HUD */}
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                  Score: <strong style={{ color: '#10b981' }}>{score}</strong>
                </Typography>
                <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                  High Score: <strong>{highScore}</strong>
                </Typography>
              </Stack>
              <IconButton
                size="sm"
                variant="plain"
                color="neutral"
                onClick={() => setIsMuted(prev => !prev)}
                sx={{ opacity: 0.7, '&:hover': { opacity: 1 } }}
              >
                {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </IconButton>
            </Stack>

            <canvas
              ref={canvasRef}
              style={{
                display: 'block',
                background: 'rgba(0,0,0,0.12)',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.05)',
                cursor: 'pointer',
                width: '100%',
                touchAction: 'none'
              }}
            />
            
            <Typography level="body-xs" sx={{ mt: 1, textAlign: 'center', opacity: 0.6 }}>
              ⌨️ กด Spacebar / ArrowUp หรือ แตะหน้าจอเพื่อกระโดดหลบสิ่งกีดขวาง 🌵
            </Typography>
          </Box>
        </TabPanel>

        {/* Tab 2: Wisdom Quote Panel */}
        <TabPanel value={1} sx={{ p: 0, pt: 2 }}>
          <Sheet
            variant="soft"
            color="success"
            sx={{
              p: 2,
              borderRadius: 'md',
              minHeight: '120px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              bgcolor: 'rgba(16, 185, 129, 0.06)',
              border: '1px solid rgba(16, 185, 129, 0.1)',
            }}
          >
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <Sparkles size={14} style={{ color: '#10b981' }} />
                <Typography level="body-xs" color="success" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>
                  {MEMO_QUOTES[quoteIndex].title}
                </Typography>
              </Stack>
              <Typography level="body-sm" sx={{ fontStyle: 'italic', lineHeight: 1.5 }}>
                "{MEMO_QUOTES[quoteIndex].quote}"
              </Typography>
            </Box>

            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 2 }}>
              <Typography level="body-xs" color="neutral" sx={{ opacity: 0.6 }}>
                — Howard Marks (Oaktree Memo)
              </Typography>
              <Button
                size="sm"
                variant="plain"
                color="success"
                onClick={nextQuote}
                endDecorator={<RefreshCw size={12} />}
                sx={{ p: 0.5 }}
              >
                คำคมถัดไป
              </Button>
            </Stack>
          </Sheet>
        </TabPanel>

        {/* Tab 3: Live Logs Panel */}
        <TabPanel value={2} sx={{ p: 0, pt: 2 }}>
          <Sheet
            variant="solid"
            color="neutral"
            sx={{
              p: 1.5,
              borderRadius: 'md',
              bgcolor: '#1e1e1e',
              border: '1px solid rgba(255,255,255,0.08)',
              fontFamily: 'monospace',
              fontSize: '11px',
              color: '#4ade80',
              maxHeight: '140px',
              minHeight: '120px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 0.5,
            }}
          >
            {logs.map((log, index) => (
              <Box key={index} sx={{ display: 'flex', gap: 1 }}>
                <span style={{ color: '#888', flexShrink: 0 }}>&gt;</span>
                <span style={{ wordBreak: 'break-all' }}>{log}</span>
              </Box>
            ))}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, opacity: 0.8 }}>
              <span style={{ color: '#888' }}>&gt;</span>
              <span style={{ color: '#fbbf24', animation: 'pulse 1.5s infinite' }}>
                Waiting for final streaming tokens...
              </span>
            </Box>
          </Sheet>
        </TabPanel>
      </Tabs>

      {/* Footer loading indicator */}
      <Box sx={{ mt: 2, pt: 1, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.5}>
          <Typography level="body-xs" sx={{ opacity: 0.6, flex: 1, minWidth: 0 }} noWrap>
            {activeTool ? `Running: ${activeTool}` : "Oaktree Agent is processing..."}
          </Typography>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ flexShrink: 0 }}>
            <LinearProgress
              color="success"
              size="sm"
              sx={{
                width: '60px',
                '--LinearProgress-radius': '4px',
              }}
            />
            {onStop && (
              <Button
                size="sm"
                variant="outlined"
                color="neutral"
                onClick={onStop}
                sx={{
                  py: 0.25,
                  px: 1,
                  minHeight: '24px',
                  height: '24px',
                  fontSize: '11px',
                  borderRadius: 'md',
                  transition: 'all 0.2s ease-out',
                  '&:hover': {
                    bgcolor: 'background.level1',
                  }
                }}
              >
                Stop
              </Button>
            )}
          </Stack>
        </Stack>
      </Box>
    </Card>
  );
}
