import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Box, Typography, Sheet, Button, Input, CircularProgress, Chip } from '@mui/joy';
import { GameLoop } from './gameLoop';
import { Camera } from './camera';
import { InputManager } from './inputs';
import { Player } from './player';
import { generateTileMap, drawTileMap } from './tilemap';
import { checkOverlap, checkMapCollision } from './collision';
import { TileType } from './types';
import type { NPC, TileMap } from './types';

const TILE_SIZE = 48;
const MAP_COLS = 25;
const MAP_ROWS = 42;
const GEN1_FRONT = (id: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-i/red-blue/${id}.png`;
const GEN1_BACK = (id: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-i/red-blue/back/${id}.png`;

const INITIAL_NPCS: NPC[] = [
  {
    id: 'db-agent', name: 'Prof. Oak (DB Agent)', type: 'pokemon',
    worldX: 8.5 * TILE_SIZE, worldY: 17.5 * TILE_SIZE,
    width: TILE_SIZE * 1.5, height: TILE_SIZE * 1.5,
    spriteUrl: 'https://img.pokemondb.net/sprites/black-white/anim/normal/snorlax.gif',
    responsibility: 'D1 & R2 Agent', dialogue: ['Welcome, trainer!', 'I am the Cloudflare DB Agent.', 'I can query D1 tables and inspect R2 buckets.', 'What would you like to know?'],
    isSolid: true, animationType: 'breathing',
    metadata: { endpoint: 'database-chat', type: 'db-agent' },
  },
  {
    id: 'knowledge-agent', name: 'Knowledge Agent', type: 'pokemon',
    worldX: 12.5 * TILE_SIZE, worldY: 17.5 * TILE_SIZE,
    width: TILE_SIZE * 1.5, height: TILE_SIZE * 1.5,
    spriteUrl: 'https://img.pokemondb.net/sprites/black-white/anim/normal/mewtwo.gif',
    responsibility: 'Portfolio Advisor', dialogue: ['Greetings, young investor!', 'I hold the secrets of the Oaktree portfolio.', 'Ask me about your holdings, history, or investment frameworks.'],
    isSolid: true, animationType: 'breathing',
    metadata: { endpoint: 'chat', type: 'chat-agent' },
  },
  {
    id: 'llm-summarizer', name: 'Stock Summarizer', type: 'pokemon',
    worldX: 3.5 * TILE_SIZE, worldY: 17 * TILE_SIZE,
    width: TILE_SIZE, height: TILE_SIZE,
    spriteUrl: 'https://img.pokemondb.net/sprites/black-white/anim/normal/bulbasaur.gif',
    responsibility: 'Summarizes News', dialogue: ['Model: @cf/google/gemma-4-26b-a4b-it', 'I synthesize stock news into Howard Marks memos.', 'Output: Thai JSON with summary, sentiment, key_takeaways.'],
    isSolid: true, animationType: 'breathing',
    metadata: { type: 'llm-task', endpoint: '/api/summarize-all', triggerLabel: 'Run Synthesis', schedule: 'Every 6h' },
  },
  {
    id: 'llm-email', name: 'Newsletter Digest', type: 'pokemon',
    worldX: 3.5 * TILE_SIZE, worldY: 19 * TILE_SIZE,
    width: TILE_SIZE, height: TILE_SIZE,
    spriteUrl: 'https://img.pokemondb.net/sprites/black-white/anim/normal/charmander.gif',
    responsibility: 'Groups Emails', dialogue: ['Model: @cf/google/gemma-4-26b-a4b-it', 'I group emails into macro themes.', 'Output: Thai Howard Marks paragraphs + 3-5 takeaways.'],
    isSolid: true, animationType: 'waddle',
    metadata: { type: 'llm-task', endpoint: '/api/test-email-digest', triggerLabel: 'Run Digest', schedule: 'Hourly' },
  },
  {
    id: 'llm-facebook', name: 'Facebook Assistant', type: 'pokemon',
    worldX: 3.5 * TILE_SIZE, worldY: 21 * TILE_SIZE,
    width: TILE_SIZE, height: TILE_SIZE,
    spriteUrl: 'https://img.pokemondb.net/sprites/black-white/anim/normal/squirtle.gif',
    responsibility: 'Formats FB Posts', dialogue: ['Model: @cf/google/gemma-3-12b-it', 'I format daily reports as engaging FB posts.', 'Rule: No hashtags mentioning investor names!'],
    isSolid: true, animationType: 'bounce',
    metadata: { type: 'llm-task', endpoint: '/api/test-facebook-post', triggerLabel: 'Format Post', method: 'POST', schedule: 'Every 6h' },
  },
  {
    id: 'job-market-stats', name: 'fetchMarketStats', type: 'pokemon',
    worldX: 12 * TILE_SIZE, worldY: 7 * TILE_SIZE,
    width: TILE_SIZE, height: TILE_SIZE,
    spriteUrl: 'https://img.pokemondb.net/sprites/black-white/anim/normal/dragonite.gif',
    responsibility: 'Pulls Watchlist Prices', dialogue: ['Cron: 0 * * * * (Every hour)', 'Job: Pull watchlist prices from Finnhub.', 'Updates price & valuation tables in D1.'],
    isSolid: true, animationType: 'bounce',
    metadata: { type: 'scheduled-job', endpoint: '/api/test-market-stats', triggerLabel: 'Fetch Stats', schedule: 'Hourly' },
  },
  {
    id: 'job-crawler', name: 'runCrawler', type: 'pokemon',
    worldX: 14 * TILE_SIZE, worldY: 8 * TILE_SIZE,
    width: TILE_SIZE, height: TILE_SIZE,
    spriteUrl: 'https://img.pokemondb.net/sprites/black-white/anim/normal/scyther.gif',
    responsibility: 'Crawls Google/Yahoo', dialogue: ['Cron: Every 6 hours', 'Job: Crawl Google News & Yahoo Finance.', 'Falls back to Puppeteer if RSS fails.'],
    isSolid: true, animationType: 'waddle',
    metadata: { type: 'scheduled-job', endpoint: '/api/crawl', triggerLabel: 'Start Crawl', schedule: 'Every 6h' },
  },
  {
    id: 'job-summarizer', name: 'generateDailySummaries', type: 'pokemon',
    worldX: 13 * TILE_SIZE, worldY: 10 * TILE_SIZE,
    width: TILE_SIZE, height: TILE_SIZE,
    spriteUrl: 'https://img.pokemondb.net/sprites/black-white/anim/normal/alakazam.gif',
    responsibility: 'Gemma Daily Summaries', dialogue: ['Cron: Every 6 hours', 'Job: LLM synthesis of news for each symbol.', 'Gemma-4 26B model. Output in Thai.'],
    isSolid: true, animationType: 'breathing',
    metadata: { type: 'scheduled-job', endpoint: '/api/summarize-all', triggerLabel: 'Summarize', schedule: 'Every 6h' },
  },
  {
    id: 'job-emails', name: 'syncEmails', type: 'pokemon',
    worldX: 5 * TILE_SIZE, worldY: 17 * TILE_SIZE,
    width: TILE_SIZE, height: TILE_SIZE,
    spriteUrl: 'https://img.pokemondb.net/sprites/black-white/anim/normal/farfetchd.gif',
    responsibility: 'Syncs Gmail Newsletters', dialogue: ['Cron: 0 * * * * (Every hour)', 'Job: Poll Gmail via Google OAuth.', 'Ingests unread financial newsletters.'],
    isSolid: true, animationType: 'waddle',
    metadata: { type: 'scheduled-job', endpoint: '/api/sync-emails', triggerLabel: 'Sync Emails', schedule: 'Hourly' },
  },
  {
    id: 'job-market-events', name: 'fetchMarketEvents', type: 'pokemon',
    worldX: 7 * TILE_SIZE, worldY: 18 * TILE_SIZE,
    width: TILE_SIZE, height: TILE_SIZE,
    spriteUrl: 'https://img.pokemondb.net/sprites/black-white/anim/normal/chansey.gif',
    responsibility: 'Watchlist Events', dialogue: ['Cron: Every 6 hours', 'Job: Fetch dividends, splits, earnings calendar.', 'Source: Finnhub API for watchlist symbols.'],
    isSolid: true, animationType: 'bounce',
    metadata: { type: 'scheduled-job', endpoint: '/api/crawl-events', triggerLabel: 'Fetch Events', schedule: 'Every 6h' },
  },
  {
    id: 'job-email-report', name: 'sendDailyEmailReport', type: 'pokemon',
    worldX: 6 * TILE_SIZE, worldY: 20 * TILE_SIZE,
    width: TILE_SIZE, height: TILE_SIZE,
    spriteUrl: 'https://img.pokemondb.net/sprites/black-white/anim/normal/pidgeot.gif',
    responsibility: 'Sends Email Reports', dialogue: ['Cron: Every 6 hours', 'Job: Format reports as HTML email.', 'Sent via Cloudflare Email binding.'],
    isSolid: true, animationType: 'bounce',
    metadata: { type: 'scheduled-job', endpoint: '/api/email-test', triggerLabel: 'Send Email', schedule: 'Every 6h' },
  },
  {
    id: 'job-alerts', name: 'checkAlertRules', type: 'pokemon',
    worldX: 16 * TILE_SIZE, worldY: 24 * TILE_SIZE,
    width: TILE_SIZE, height: TILE_SIZE,
    spriteUrl: 'https://img.pokemondb.net/sprites/black-white/anim/normal/growlithe.gif',
    responsibility: 'Evaluates Alert Rules', dialogue: ['Cron: 0 * * * * (Every hour)', 'Job: Evaluate price alert rules.', 'Stores triggered notifications in D1.'],
    isSolid: true, animationType: 'breathing',
    metadata: { type: 'scheduled-job', endpoint: null, triggerLabel: 'Check Alerts', schedule: 'Hourly' },
  },
  {
    id: 'job-purge', name: 'purgeOldData', type: 'pokemon',
    worldX: 18 * TILE_SIZE, worldY: 25 * TILE_SIZE,
    width: TILE_SIZE, height: TILE_SIZE,
    spriteUrl: 'https://img.pokemondb.net/sprites/black-white/anim/normal/muk.gif',
    responsibility: 'Purges Old Data', dialogue: ['Cron: Every 6 hours', 'Job: Delete reports & news older than 3 days.', 'Deletes events > 30 days. Keeps D1 lean.'],
    isSolid: true, animationType: 'squish',
    metadata: { type: 'scheduled-job', endpoint: null, triggerLabel: 'Purge Data', schedule: 'Every 6h' },
  },
  {
    id: 'job-email-digest', name: 'generateEmailDigests', type: 'pokemon',
    worldX: 5 * TILE_SIZE, worldY: 31 * TILE_SIZE,
    width: TILE_SIZE, height: TILE_SIZE,
    spriteUrl: 'https://img.pokemondb.net/sprites/black-white/anim/normal/psyduck.gif',
    responsibility: 'Gemma Email Summaries', dialogue: ['Cron: 0 * * * * (Every hour)', 'Job: Synthesize emails into theme-based digests.', 'Gemma-4 26B model. Capped at batch size 2.'],
    isSolid: true, animationType: 'waddle',
    metadata: { type: 'scheduled-job', endpoint: '/api/test-email-digest', triggerLabel: 'Run Digest', schedule: 'Hourly' },
  },
  {
    id: 'job-facebook', name: 'syncFacebookPosts', type: 'pokemon',
    worldX: 7 * TILE_SIZE, worldY: 32 * TILE_SIZE,
    width: TILE_SIZE, height: TILE_SIZE,
    spriteUrl: 'https://img.pokemondb.net/sprites/black-white/anim/normal/jigglypuff.gif',
    responsibility: 'Post Daily FB Report', dialogue: ['Cron: 0 * * * * (Every hour)', 'Job: Format daily reports into FB posts.', 'Gemma-3 12B model. Capped at 1 post.'],
    isSolid: true, animationType: 'bounce',
    metadata: { type: 'scheduled-job', endpoint: '/api/test-facebook-post', triggerLabel: 'Format Post', method: 'POST', schedule: 'Hourly' },
  },
];

function initializeNPCs(map: TileMap): NPC[] {
  const walkableTiles: { r: number; c: number }[] = [];
  const startRow = 22;
  const endRow = 32;
  const startCol = 3;
  const endCol = 22;
  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      // Exclude Pokemon Center interior (rows 15-24, cols 1-15)
      if (r >= 15 && r <= 24 && c >= 1 && c <= 15) {
        continue;
      }
      if (map[r][c] === TileType.GRASS) {
        walkableTiles.push({ r, c });
      }
    }
  }

  // Shuffle walkableTiles
  const shuffled = [...walkableTiles].sort(() => Math.random() - 0.5);

  return INITIAL_NPCS.map((npc, index) => {
    if (npc.id === 'db-agent' || npc.id === 'knowledge-agent' || npc.id.startsWith('llm-')) {
      return {
        ...npc,
        isWalking: false,
        walkTimer: 0
      };
    }
    const tile = shuffled[index % shuffled.length];
    return {
      ...npc,
      worldX: tile.c * TILE_SIZE,
      worldY: tile.r * TILE_SIZE,
      isWalking: false,
      walkTimer: Math.random() * 3 + 1
    };
  });
}

const INITIAL_MAP = generateTileMap(MAP_ROWS, MAP_COLS);
const INITIALIZED_NPCS = initializeNPCs(INITIAL_MAP);

class ChiptuneAudio {
  private ctx: AudioContext | null = null;
  public muted = false;
  private getCtx() { if (!this.ctx) this.ctx = new AudioContext(); return this.ctx; }
  private beep(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.07) {
    if (this.muted) return;
    try {
      const ctx = this.getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = type; osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.start(); osc.stop(ctx.currentTime + dur);
    } catch {}
  }
  step()    { this.beep(200, 0.04); }
  select()  { this.beep(440, 0.06); setTimeout(() => this.beep(660, 0.06), 80); }
  confirm() { [523, 659, 784].forEach((f, i) => setTimeout(() => this.beep(f, 0.1), i * 80)); }
  battle()  { [110, 138, 165, 220].forEach((f, i) => setTimeout(() => this.beep(f, 0.15, 'sawtooth', 0.09), i * 60)); }
  error()   { this.beep(150, 0.2, 'sawtooth'); }
  trigger() { [784, 988, 1046].forEach((f, i) => setTimeout(() => this.beep(f, 0.12), i * 90)); }
}
const sfx = new ChiptuneAudio();

interface GameCanvasProps {
  isEnabled: boolean;
  mcpWorkerUrl: string;
  apiBaseUrl: string;
  authToken: string | null;
}

type GameMode = 'MAP' | 'DIALOGUE' | 'BATTLE';

interface DialogueState {
  npc: NPC;
  lineIndex: number;
  displayedText: string;
  isTyping: boolean;
  showInput: boolean;
  inputValue: string;
  streamText: string;
  isStreaming: boolean;
}

interface BattleState {
  npc: NPC;
  playerHp: number;
  enemyHp: number;
  maxHp: number;
  phase: 'MENU' | 'RESULT';
  log: string[];
  isExecuting: boolean;
}

export default function GameCanvas({ isEnabled, mcpWorkerUrl, apiBaseUrl, authToken }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const gameLoopRef = useRef<GameLoop | null>(null);
  const cameraRef = useRef<Camera | null>(null);
  const inputRef = useRef<InputManager | null>(null);
  const playerRef = useRef<Player | null>(null);
  const npcsRef = useRef<NPC[]>(INITIALIZED_NPCS.map(npc => ({ ...npc })));
  const mapRef = useRef(generateTileMap(MAP_ROWS, MAP_COLS));
  const timeRef = useRef(0);
  const aJustPressedRef = useRef(false);
  const mousePosRef = useRef({ x: -9999, y: -9999 });
  const hoverHudRef = useRef<HTMLDivElement>(null);
  const mapBgImageRef = useRef<HTMLImageElement | null>(null);
  const pokemonCenterImageRef = useRef<HTMLImageElement | null>(null);

  // Click-to-walk state refs
  const walkTargetRef = useRef<{ x: number; y: number } | null>(null);
  const walkTargetNpcRef = useRef<NPC | null>(null);
  const walkTargetTimeRef = useRef<number>(0);
  const stuckFramesRef = useRef<number>(0);

  useEffect(() => {
    const img = new Image();
    img.src = encodeURI("/game_assets/Game Boy Advance - Pokemon FireRed _ LeafGreen - Maps (Caves, Forests, Oceans, Etc.) - Route 01.png");
    img.onload = () => {
      mapBgImageRef.current = img;
    };

    const pcImg = new Image();
    pcImg.src = encodeURI("/game_assets/pokemon-center-1F.png");
    pcImg.onload = () => {
      pokemonCenterImageRef.current = pcImg;
    };
  }, []);

  const [mode, setMode] = useState<GameMode>('MAP');
  const [dialogue, setDialogue] = useState<DialogueState | null>(null);
  const [battle, setBattle] = useState<BattleState | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 600 });
  const modeRef = useRef<GameMode>('MAP');

  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { sfx.muted = isMuted; }, [isMuted]);

  // Resize observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      const w = Math.floor(width); const h = Math.floor(height);
      setCanvasSize(prev => {
        if (prev.w === w && prev.h === h) return prev;
        return { w, h };
      });
      if (canvasRef.current) {
        if (canvasRef.current.width !== w) canvasRef.current.width = w;
        if (canvasRef.current.height !== h) canvasRef.current.height = h;
      }
      cameraRef.current?.resize(w, h);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const interactWithNPC = useCallback((npc: NPC) => {
    sfx.confirm();
    const { type } = npc.metadata || {};
    if (type === 'scheduled-job' || type === 'llm-task') {
      setBattle({ npc, playerHp: 100, enemyHp: 100, maxHp: 100, phase: 'MENU', log: [`A wild ${npc.name} appeared!`], isExecuting: false });
      setMode('BATTLE');
      sfx.battle();
    } else {
      setDialogue({ npc, lineIndex: 0, displayedText: '', isTyping: true, showInput: false, inputValue: '', streamText: '', isStreaming: false });
      setMode('DIALOGUE');
    }
  }, []);

  const checkInteraction = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    const { worldX, worldY, width, height } = player.state;
    const box = { x: worldX + width * 0.1, y: worldY + height * 0.1, width: width * 0.8, height: height * 1.4 };
    for (const npc of npcsRef.current) {
      if (checkOverlap(box, { x: npc.worldX - 12, y: npc.worldY - 12, width: npc.width + 24, height: npc.height + 24 })) {
        interactWithNPC(npc);
        return;
      }
    }
  }, [interactWithNPC]);

  const update = useCallback((dt: number) => {
    timeRef.current += dt;
    const input = inputRef.current;
    const player = playerRef.current;
    if (!input || !player || modeRef.current !== 'MAP') return;
    let { dx, dy } = input.getMovementVector();
    
    if (dx !== 0 || dy !== 0) {
      walkTargetRef.current = null;
      walkTargetNpcRef.current = null;
    } else if (walkTargetRef.current) {
      const currentX = player.state.worldX + player.state.width / 2;
      const currentY = player.state.worldY + player.state.height * 0.8;
      
      const targetX = walkTargetRef.current.x;
      const targetY = walkTargetRef.current.y;
      
      const diffX = targetX - currentX;
      const diffY = targetY - currentY;
      const distance = Math.sqrt(diffX * diffX + diffY * diffY);
      
      if (distance < 6) {
        walkTargetRef.current = null;
        walkTargetNpcRef.current = null;
      } else {
        dx = diffX / distance;
        dy = diffY / distance;
      }
    }

    if ((dx !== 0 || dy !== 0) && !player.state.isMoving) sfx.step();

    const lastWorldX = player.state.worldX;
    const lastWorldY = player.state.worldY;

    player.move(dx, dy, dt, mapRef.current, npcsRef.current, TILE_SIZE);

    if (walkTargetRef.current) {
      // Check if player is adjacent to/overlapping clicked NPC's interaction range
      if (walkTargetNpcRef.current) {
        const npc = walkTargetNpcRef.current;
        const { worldX, worldY, width, height } = player.state;
        const box = { x: worldX + width * 0.1, y: worldY + height * 0.1, width: width * 0.8, height: height * 1.4 };
        if (checkOverlap(box, { x: npc.worldX - 12, y: npc.worldY - 12, width: npc.width + 24, height: npc.height + 24 })) {
          interactWithNPC(npc);
          walkTargetRef.current = null;
          walkTargetNpcRef.current = null;
        }
      }

      // Stuck detection
      const movedX = Math.abs(player.state.worldX - lastWorldX);
      const movedY = Math.abs(player.state.worldY - lastWorldY);
      if (movedX < 0.1 && movedY < 0.1) {
        stuckFramesRef.current += 1;
        if (stuckFramesRef.current > 15) {
          walkTargetRef.current = null;
          walkTargetNpcRef.current = null;
          stuckFramesRef.current = 0;
        }
      } else {
        stuckFramesRef.current = 0;
      }
    }

    // Update NPCs random walk
    npcsRef.current.forEach(npc => {
      // Exclude agents inside the Pokemon Center from walking
      if (npc.id === 'db-agent' || npc.id === 'knowledge-agent' || npc.id.startsWith('llm-')) {
        return;
      }

      if (npc.walkTimer === undefined) {
        npc.walkTimer = Math.random() * 3 + 1;
        npc.isWalking = false;
      }

      if (npc.isWalking) {
        // Destination collision checks every frame while walking
        const targetBox = {
          x: npc.walkTargetX!,
          y: npc.walkTargetY!,
          width: npc.width,
          height: npc.height
        };

        const pBox = {
          x: player.state.worldX,
          y: player.state.worldY,
          width: player.state.width,
          height: player.state.height
        };

        let collides = false;
        // Check collision with player
        if (npc.isSolid && checkOverlap(targetBox, pBox)) {
          collides = true;
        }

        // Check collision with other solid NPCs
        if (!collides) {
          for (const other of npcsRef.current) {
            if (other.id !== npc.id && other.isSolid) {
              const otherBox = {
                x: other.isWalking ? other.walkTargetX! : other.worldX,
                y: other.isWalking ? other.walkTargetY! : other.worldY,
                width: other.width,
                height: other.height
              };
              if (checkOverlap(targetBox, otherBox)) {
                collides = true;
                break;
              }
            }
          }
        }

        if (collides) {
          // Cancel walking, snap back to closest tile coordinate
          npc.isWalking = false;
          npc.worldX = Math.round(npc.worldX / TILE_SIZE) * TILE_SIZE;
          npc.worldY = Math.round(npc.worldY / TILE_SIZE) * TILE_SIZE;
          npc.walkTimer = Math.random() * 2 + 1; // wait a bit
        } else {
          // Slide smoothly towards target
          const dxNpc = npc.walkTargetX! - npc.worldX;
          const dyNpc = npc.walkTargetY! - npc.worldY;
          const dist = Math.sqrt(dxNpc * dxNpc + dyNpc * dyNpc);
          const speed = 40; // walking speed (px/sec)
          const moveStep = speed * dt;

          if (dist <= moveStep) {
            npc.worldX = npc.walkTargetX!;
            npc.worldY = npc.walkTargetY!;
            npc.isWalking = false;
            npc.walkTimer = Math.random() * 4 + 2;
          } else {
            npc.worldX += (dxNpc / dist) * moveStep;
            npc.worldY += (dyNpc / dist) * moveStep;
          }
        }
      } else {
        npc.walkTimer -= dt;
        if (npc.walkTimer <= 0) {
          const directions = [
            { dx: 0, dy: -1 },
            { dx: 0, dy: 1 },
            { dx: -1, dy: 0 },
            { dx: 1, dy: 0 }
          ];
          const shuffledDirs = [...directions].sort(() => Math.random() - 0.5);

          let foundPath = false;
          for (const dir of shuffledDirs) {
            const currentGridX = Math.round(npc.worldX / TILE_SIZE);
            const currentGridY = Math.round(npc.worldY / TILE_SIZE);
            const nextGridX = currentGridX + dir.dx;
            const nextGridY = currentGridY + dir.dy;

            // Must stay in the walkable zone: rows 22 to 32, columns 3 to 22, excluding Pokemon Center (rows 15-24, cols 1-15)
            const isInsidePC = nextGridY >= 15 && nextGridY <= 24 && nextGridX >= 1 && nextGridX <= 15;
            if (nextGridY >= 22 && nextGridY <= 32 && nextGridX >= 3 && nextGridX <= 22 && !isInsidePC) {
              const targetBox = {
                x: nextGridX * TILE_SIZE,
                y: nextGridY * TILE_SIZE,
                width: npc.width,
                height: npc.height
              };

              // Check map collision (fences, walls, trees)
              const collidesMap = checkMapCollision(targetBox, mapRef.current, TILE_SIZE);

              if (!collidesMap) {
                // Collision with player
                let collidesPlayer = false;
                const pBox = {
                  x: player.state.worldX,
                  y: player.state.worldY,
                  width: player.state.width,
                  height: player.state.height
                };
                if (checkOverlap(targetBox, pBox)) {
                  collidesPlayer = true;
                }

                // Collision with other NPCs
                let collidesNPC = false;
                for (const other of npcsRef.current) {
                  if (other.id !== npc.id) {
                    const otherBox = {
                      x: other.isWalking ? other.walkTargetX! : other.worldX,
                      y: other.isWalking ? other.walkTargetY! : other.worldY,
                      width: other.width,
                      height: other.height
                    };
                    if (checkOverlap(targetBox, otherBox)) {
                      collidesNPC = true;
                      break;
                    }
                  }
                }

                if (!collidesPlayer && !collidesNPC) {
                  npc.walkTargetX = nextGridX * TILE_SIZE;
                  npc.walkTargetY = nextGridY * TILE_SIZE;
                  npc.isWalking = true;
                  foundPath = true;
                  break;
                }
              }
            }
          }

          if (!foundPath) {
            npc.walkTimer = Math.random() * 2 + 1;
          }
        }
      }
    });
    cameraRef.current?.update(player.state.worldX + player.state.width / 2, player.state.worldY + player.state.height / 2);
    if (input.inputs.a && !aJustPressedRef.current) { aJustPressedRef.current = true; checkInteraction(); }
    if (!input.inputs.a) aJustPressedRef.current = false;
  }, [checkInteraction]);

  const hoverIdRef = useRef<string | null>(undefined as any);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const cam = cameraRef.current;
    const player = playerRef.current;
    if (!ctx || !cam || !player || !canvas) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const t = timeRef.current;
    drawTileMap(ctx, mapRef.current, cam.pos.x, cam.pos.y, w, h, TILE_SIZE, t, mapBgImageRef.current, pokemonCenterImageRef.current);

    // Draw click target indicators
    if (walkTargetRef.current) {
      const elapsed = timeRef.current - walkTargetTimeRef.current;
      const targetCanvasX = walkTargetRef.current.x - cam.pos.x;
      const targetCanvasY = walkTargetRef.current.y - cam.pos.y;
      
      ctx.save();
      // Glowing outer ring
      const baseRadius = 8;
      const pulse = Math.sin(timeRef.current * 10) * 3;
      const radius = baseRadius + pulse;
      
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(targetCanvasX, targetCanvasY, radius, 0, Math.PI * 2);
      ctx.stroke();

      // Core dot
      ctx.fillStyle = 'rgba(16, 185, 129, 0.9)';
      ctx.beginPath();
      ctx.arc(targetCanvasX, targetCanvasY, 2, 0, Math.PI * 2);
      ctx.fill();
      
      // Initial click expand ripple
      if (elapsed < 0.4) {
        const rippleRadius = (elapsed / 0.4) * 24;
        const opacity = 1 - (elapsed / 0.4);
        ctx.strokeStyle = `rgba(16, 185, 129, ${opacity})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(targetCanvasX, targetCanvasY, rippleRadius, 0, Math.PI * 2);
        ctx.stroke();
      }
      
      ctx.restore();
    }

    // Zone labels
    ctx.save();
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillText('Workers AI Lab', 8 * TILE_SIZE - cam.pos.x, 14 * TILE_SIZE - cam.pos.y);
    ctx.fillText('Workflow Safari Zone', 24 * TILE_SIZE - cam.pos.x, 6 * TILE_SIZE - cam.pos.y);
    ctx.restore();

    // Draw character shadows on the canvas for depth
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    
    // Player shadow
    const psx = player.state.worldX - cam.pos.x;
    const psy = player.state.worldY - cam.pos.y;
    ctx.beginPath();
    ctx.ellipse(psx + TILE_SIZE / 2, psy + TILE_SIZE * 0.9, TILE_SIZE * 0.35, TILE_SIZE * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();

    // NPC shadows
    for (const npc of npcsRef.current) {
      const nsx = npc.worldX - cam.pos.x;
      const nsy = npc.worldY - cam.pos.y;
      ctx.beginPath();
      ctx.ellipse(nsx + npc.width / 2, nsy + npc.height * 0.9, npc.width * 0.35, npc.height * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Direct DOM Updates for Sprite Overlays
    const container = containerRef.current;
    if (container) {
      // 1. Update Player element
      const playerEl = container.querySelector('[data-player]') as HTMLElement;
      if (playerEl) {
        playerEl.style.transform = `translate3d(${psx}px, ${psy}px, 0)`;
        const bgX = -(player.state.frameIndex * 48);
        const bgY = -(player.state.direction * 48);
        playerEl.style.backgroundPosition = `${bgX}px ${bgY}px`;
      }

      // 2. Update NPC elements
      for (const npc of npcsRef.current) {
        const npcEl = container.querySelector(`[data-npc-id="${npc.id}"]`) as HTMLElement;
        if (npcEl) {
          const nsx = npc.worldX - cam.pos.x;
          const nsy = npc.worldY - cam.pos.y;
          npcEl.style.transform = `translate3d(${nsx}px, ${nsy}px, 0)`;
        }
      }

      // 3. Update Coordinates element
      const coordsEl = document.getElementById('player-coords');
      if (coordsEl) {
        const gridX = Math.round(player.state.worldX / TILE_SIZE);
        const gridY = Math.round(player.state.worldY / TILE_SIZE);
        coordsEl.textContent = `X: ${gridX}, Y: ${gridY}`;
      }
    }

    // Hover check
    let newHover: { npc: NPC; sx: number; sy: number } | null = null;
    if (modeRef.current === 'MAP') {
      const { x: mx, y: my } = mousePosRef.current;
      for (const npc of npcsRef.current) {
        const sx = npc.worldX - cam.pos.x;
        const sy = npc.worldY - cam.pos.y;
        if (mx >= sx && mx <= sx + npc.width && my >= sy && my <= sy + npc.height) {
          if (npc.metadata?.type === 'scheduled-job' || npc.metadata?.type === 'llm-task') {
            newHover = { npc, sx, sy };
            break;
          }
        }
      }
    }

    // Hide Hover HUD overlay in other modes
    if (modeRef.current !== 'MAP') {
      newHover = null;
    }

    // Direct DOM update for Hover HUD tooltip (prevents React update depth crash)
    const hoverHud = hoverHudRef.current;
    if (hoverHud) {
      if (newHover) {
        hoverHud.style.display = 'block';
        const hx = Math.min(newHover.sx, w - 200);
        const hy = Math.max(newHover.sy - 78, 4);
        hoverHud.style.transform = `translate3d(${hx}px, ${hy}px, 0)`;
        
        const nameEl = hoverHud.querySelector('.hud-name');
        if (nameEl) nameEl.textContent = newHover.npc.name;
        
        const metaEl = hoverHud.querySelector('.hud-meta');
        if (metaEl) {
          metaEl.textContent = newHover.npc.metadata?.schedule 
            ? `Cron: ${newHover.npc.metadata.schedule}` 
            : (newHover.npc.metadata?.type || '');
        }
      } else {
        hoverHud.style.display = 'none';
      }
    }
  }, []);

  // Initialize game
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const w = container.offsetWidth; const h = container.offsetHeight;
    canvas.width = w; canvas.height = h;
    setCanvasSize({ w, h });
    const startX = 10 * TILE_SIZE; const startY = 22 * TILE_SIZE;
    playerRef.current = new Player(startX, startY);
    cameraRef.current = new Camera(MAP_COLS * TILE_SIZE, MAP_ROWS * TILE_SIZE, w, h);
    cameraRef.current.update(startX, startY);
    inputRef.current = new InputManager();
    gameLoopRef.current = new GameLoop(update, render);
    gameLoopRef.current.start();
    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mousePosRef.current = { x: (e.clientX - rect.left) * (canvas.width / rect.width), y: (e.clientY - rect.top) * (canvas.height / rect.height) };
    };
    const onCanvasClick = (e: MouseEvent) => {
      if (modeRef.current !== 'MAP') return;
      const rect = canvas.getBoundingClientRect();
      const clickX = (e.clientX - rect.left) * (canvas.width / rect.width);
      const clickY = (e.clientY - rect.top) * (canvas.height / rect.height);
      const cam = cameraRef.current;
      if (!cam) return;
      
      const targetX = clickX + cam.pos.x;
      const targetY = Math.max(12 * TILE_SIZE, Math.min(41 * TILE_SIZE, clickY + cam.pos.y));
      
      // Check if we clicked on an NPC
      let clickedNPC: NPC | null = null;
      for (const npc of npcsRef.current) {
        if (
          targetX >= npc.worldX &&
          targetX <= npc.worldX + npc.width &&
          targetY >= npc.worldY &&
          targetY <= npc.worldY + npc.height
        ) {
          clickedNPC = npc;
          break;
        }
      }
      
      walkTargetRef.current = { x: targetX, y: targetY };
      walkTargetNpcRef.current = clickedNPC;
      walkTargetTimeRef.current = timeRef.current;
      stuckFramesRef.current = 0;
      sfx.select();
    };

    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('click', onCanvasClick);
    return () => {
      gameLoopRef.current?.stop();
      inputRef.current?.cleanup();
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('click', onCanvasClick);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Typewriter
  useEffect(() => {
    if (!dialogue?.isTyping) return;
    const line = dialogue.npc.dialogue[dialogue.lineIndex] ?? '';
    if (dialogue.displayedText.length >= line.length) { setDialogue(d => d ? { ...d, isTyping: false } : null); return; }
    const t = setTimeout(() => { sfx.step(); setDialogue(d => d ? { ...d, displayedText: line.slice(0, d.displayedText.length + 1) } : null); }, 30);
    return () => clearTimeout(t);
  }, [dialogue?.displayedText, dialogue?.isTyping, dialogue?.lineIndex]);

  const advanceDialogue = useCallback(() => {
    if (!dialogue) return;
    if (dialogue.isTyping) {
      const line = dialogue.npc.dialogue[dialogue.lineIndex] ?? '';
      setDialogue(d => d ? { ...d, displayedText: line, isTyping: false } : null);
      return;
    }
    const next = dialogue.lineIndex + 1;
    if (next < dialogue.npc.dialogue.length) {
      setDialogue(d => d ? { ...d, lineIndex: next, displayedText: '', isTyping: true } : null);
    } else {
      setDialogue(d => d ? { ...d, showInput: true, isTyping: false } : null);
    }
  }, [dialogue]);

  const sendChatMessage = useCallback(async () => {
    if (!dialogue?.inputValue.trim()) return;
    const msg = dialogue.inputValue;
    const endpoint = dialogue.npc.metadata?.endpoint;
    setDialogue(d => d ? { ...d, inputValue: '', isStreaming: true, displayedText: '...' } : null);
    sfx.select();
    try {
      const res = await fetch(`${mcpWorkerUrl}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', parts: [{ type: 'text', text: msg }] }] }),
      });
      const reader = res.body?.getReader();
      const dec = new TextDecoder();
      let full = '';
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          dec.decode(value, { stream: true }).split('\n').forEach(l => {
            if (l.startsWith('0:')) { try { full += JSON.parse(l.slice(2)); } catch {} }
          });
          setDialogue(d => d ? { ...d, displayedText: full } : null);
        }
      }
      setDialogue(d => d ? { ...d, isStreaming: false, displayedText: full, showInput: true } : null);
    } catch {
      setDialogue(d => d ? { ...d, isStreaming: false, displayedText: 'Connection error. Try again.', showInput: true } : null);
      sfx.error();
    }
  }, [dialogue, mcpWorkerUrl]);

  const triggerJob = useCallback(async () => {
    if (!battle) return;
    const { endpoint, method } = battle.npc.metadata || {};
    if (!endpoint) {
      setBattle(b => b ? { ...b, log: [...b.log, 'No endpoint configured for this job.'], phase: 'RESULT' } : null);
      return;
    }
    setBattle(b => b ? { ...b, isExecuting: true, log: [...b.log, `Triggering ${battle.npc.name}...`] } : null);
    sfx.trigger();
    try {
      const res = await fetch(`${apiBaseUrl}${endpoint}`, {
        method: method || 'GET',
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      });
      const text = await res.text();
      setBattle(b => b ? { ...b, isExecuting: false, enemyHp: 0, phase: 'RESULT', log: [...b.log, `OK ${res.status}: ${text.slice(0, 250)}`] } : null);
      sfx.confirm();
    } catch (e: any) {
      setBattle(b => b ? { ...b, isExecuting: false, phase: 'RESULT', log: [...b.log, `Error: ${e.message}`] } : null);
      sfx.error();
    }
  }, [battle, apiBaseUrl, authToken]);

  const exitMode = () => { setMode('MAP'); setDialogue(null); setBattle(null); sfx.select(); };
  const vd = (k: 'up'|'down'|'left'|'right'|'a'|'b') => {
    if (['up', 'down', 'left', 'right'].includes(k)) {
      walkTargetRef.current = null;
      walkTargetNpcRef.current = null;
    }
    inputRef.current?.setVirtualInput(k, true);
  };
  const vu = (k: 'up'|'down'|'left'|'right'|'a'|'b') => inputRef.current?.setVirtualInput(k, false);

  const btnSx = (bg: string, shadowColor: string = 'rgba(0,0,0,0.35)') => ({
    width: 44, height: 44, borderRadius: '0px', background: bg,
    border: '4px solid #111118', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff',
    boxShadow: `
      inset 2px 2px 0px rgba(255,255,255,0.45),
      inset -2px -2px 0px rgba(0,0,0,0.35),
      0 4px 0px ${shadowColor}
    `,
    userSelect: 'none' as const,
    transition: 'all 0.05s steps(2)',
    '&:hover': {
      filter: 'brightness(1.1)',
    },
    '&:active': {
      transform: 'translateY(3px)',
      boxShadow: `
        inset 2px 2px 0px rgba(255,255,255,0.45),
        inset -2px -2px 0px rgba(0,0,0,0.35),
        0 1px 0px ${shadowColor}
      `,
    },
  });

  const VolumeIcon = () => (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor" style={{ shapeRendering: 'crispEdges' }}>
      <path d="M2 5h3v6H2z M5 4h1v8H5z M6 3h1v10H6z M7 2h2v12H7z" />
      <path d="M11 5h1v6h-1z M13 3h1v10h-1z" />
    </svg>
  );

  const MuteIcon = () => (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor" style={{ shapeRendering: 'crispEdges' }}>
      <path d="M2 5h3v6H2z M5 4h1v8H5z M6 3h1v10H6z M7 2h2v12H7z" />
      <path d="M11 5h1v1h-1z M15 5h-1v1h1z M12 6h1v1h-1z M14 6h-1v1h1z M13 7h1v2h-1z M12 9h1v1h-1z M14 9h-1v1h1z M11 10h1v1h-1z M15 10h-1v1h1z" />
    </svg>
  );

  const BackIcon = () => (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor" style={{ shapeRendering: 'crispEdges' }}>
      <path d="M7 3h1v10H7z M6 4h1v8H6z M5 5h1v6H5z M4 6h1v4H4z M3 7h1v2H3z" />
      <path d="M8 6h6v4H8z" />
    </svg>
  );

  const HpBar = ({ hp, max, color }: { hp: number; max: number; color: string }) => (
    <Box sx={{ width: '100%', height: 8, bgcolor: 'rgba(0,0,0,0.5)', borderRadius: 4, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.12)' }}>
      <Box sx={{ width: `${Math.max(0, (hp / max) * 100)}%`, height: '100%', bgcolor: color, transition: 'width 0.5s ease', borderRadius: 4 }} />
    </Box>
  );

  const pixelFont = { fontFamily: "'Press Start 2P', monospace" };

  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative', bgcolor: '#060a14', ...pixelFont }}>
      {/* Header bar */}
      <Box sx={{ px: 2, py: 0.75, display: 'flex', alignItems: 'center', gap: 1.5, borderBottom: '2px solid rgba(16,185,129,0.2)', bgcolor: 'rgba(0,0,0,0.5)', flexShrink: 0 }}>
        <Typography sx={{ ...pixelFont, fontSize: '10px', color: '#10b981', letterSpacing: '0.1em' }}>OAKTREE WORLD v1.0</Typography>
        <Box sx={{ flex: 1 }} />
        <Typography id="player-coords" sx={{ ...pixelFont, fontSize: '9px', color: '#eab308', mr: 1, letterSpacing: '0.05em' }}>X: 12, Y: 36</Typography>
        <Chip size="sm" variant="soft" color={isEnabled ? 'success' : 'danger'} sx={{ ...pixelFont, fontSize: '8px' }}>
          {isEnabled ? 'D1 ONLINE' : 'OFFLINE'}
        </Chip>
        <Box component="button" onClick={() => setIsMuted(m => !m)} sx={btnSx(isMuted ? '#ef4444' : '#10b981', isMuted ? '#b91c1c' : '#047857')}>
          {isMuted ? <MuteIcon /> : <VolumeIcon />}
        </Box>
        {mode !== 'MAP' && <Box component="button" onClick={exitMode} sx={btnSx('#475569', '#1e293b')}><BackIcon /></Box>}
      </Box>

      {/* Canvas wrapper */}
      <Box ref={containerRef} sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%', imageRendering: 'pixelated' }} />

        {/* Scanlines */}
        <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.07) 3px, rgba(0,0,0,0.07) 4px)', zIndex: 1 }} />

        {/* Sprite Overlay Layer */}
        {(mode === 'MAP' || mode === 'DIALOGUE') && (
          <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2 }}>
            {/* Player Sprite */}
            <Box
              data-player
              sx={{
                position: 'absolute',
                width: TILE_SIZE,
                height: TILE_SIZE,
                top: 0,
                left: 0,
                transform: 'translate3d(-9999px, -9999px, 0)',
                backgroundImage: 'url(/game_assets/player_sprite.png)',
                backgroundSize: `${TILE_SIZE * 4}px ${TILE_SIZE * 4}px`,
                backgroundRepeat: 'no-repeat',
                imageRendering: 'pixelated',
              }}
            />

            {/* NPC Sprites */}
                        {/* NPC Sprites & HUD */}
            {INITIALIZED_NPCS.map(npc => (
              <Box
                key={npc.id}
                data-npc-id={npc.id}
                sx={{
                  position: 'absolute',
                  width: npc.width,
                  height: npc.height,
                  top: 0,
                  left: 0,
                  transform: 'translate3d(-9999px, -9999px, 0)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {/* HUD bubble floating above the NPC sprite */}
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: '105%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 10,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                  }}
                >
                  <Box
                    sx={{
                      bgcolor: 'rgba(6, 10, 20, 0.85)',
                      border: '1.5px solid #10b981',
                      borderRadius: '3px',
                      px: 1,
                      py: 0.5,
                      boxShadow: '0 4px 10px rgba(0, 0, 0, 0.4)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 0.25,
                      backdropFilter: 'blur(3px)',
                    }}
                  >
                    <Typography
                      sx={{
                        fontFamily: "'Press Start 2P', monospace",
                        fontSize: '6.5px',
                        color: '#10b981',
                        lineHeight: 1.2,
                      }}
                    >
                      {npc.responsibility || npc.name}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      width: 0,
                      height: 0,
                      borderLeft: '4px solid transparent',
                      borderRight: '4px solid transparent',
                      borderTop: '4px solid #10b981',
                      mt: '-1px',
                    }}
                  />
                </Box>

                <img
                  src={npc.spriteUrl}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    imageRendering: 'pixelated',
                  }}
                  alt={npc.name}
                />
              </Box>
            ))}
          </Box>
        )}

        {/* Hover HUD */}
        <Box
          ref={hoverHudRef}
          sx={{
            position: 'absolute',
            zIndex: 10,
            pointerEvents: 'none',
            display: 'none',
            bgcolor: 'rgba(6,10,20,0.95)',
            border: '2px solid #10b981',
            borderRadius: '3px',
            px: 1.5,
            py: 1,
            minWidth: 175,
            transform: 'translate3d(0, 0, 0)',
          }}
        >
          <Typography className="hud-name" sx={{ ...pixelFont, fontSize: '8px', color: '#10b981', mb: 0.5 }}></Typography>
          <Typography className="hud-meta" sx={{ ...pixelFont, fontSize: '7px', color: 'rgba(255,255,255,0.65)' }}></Typography>
          <Typography sx={{ ...pixelFont, fontSize: '6px', color: 'rgba(255,255,255,0.4)', mt: 0.4 }}>[SPACE] to interact</Typography>
        </Box>

        {/* Legend */}
        {mode === 'MAP' && (
          <Box sx={{ position: 'absolute', top: 6, right: 6, zIndex: 10, display: { xs: 'none', md: 'flex' }, flexDirection: 'column', gap: 0.4 }}>
            {[
              { c: '#10b981', l: 'DB / Knowledge Agent' },
              { c: '#818cf8', l: 'Workers AI Lab' },
              { c: '#f59e0b', l: 'Scheduled Jobs' },
            ].map(({ c, l }) => (
              <Box key={l} sx={{ display: 'flex', alignItems: 'center', gap: 0.7, bgcolor: 'rgba(0,0,0,0.7)', px: 1, py: 0.4, borderRadius: '2px' }}>
                <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: c, flexShrink: 0 }} />
                <Typography sx={{ ...pixelFont, fontSize: '7px', color: 'rgba(255,255,255,0.65)' }}>{l}</Typography>
              </Box>
            ))}
            <Box sx={{ bgcolor: 'rgba(0,0,0,0.7)', px: 1, py: 0.4, borderRadius: '2px' }}>
              <Typography sx={{ ...pixelFont, fontSize: '6px', color: 'rgba(255,255,255,0.4)' }}>WASD/Arrows + Space</Typography>
            </Box>
          </Box>
        )}

        {/* DIALOGUE OVERLAY */}
        {mode === 'DIALOGUE' && dialogue && (
          <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20, bgcolor: 'rgba(6,10,20,0.97)', borderTop: '3px solid #10b981', p: 2 }}>
            <Box sx={{ display: 'inline-block', bgcolor: '#10b981', px: 1.5, py: 0.4, mb: 1, borderRadius: '2px' }}>
              <Typography sx={{ ...pixelFont, fontSize: '8px', color: '#000', fontWeight: 700 }}>{dialogue.npc.name}</Typography>
            </Box>
            <Box sx={{ border: '2px solid rgba(255,255,255,0.15)', p: 1.5, borderRadius: '3px', minHeight: 56, mb: 1.5, bgcolor: 'rgba(0,0,0,0.35)' }}>
              <Typography sx={{ ...pixelFont, fontSize: '9px', lineHeight: 2, color: '#e2e8f0', whiteSpace: 'pre-wrap' }}>
                {dialogue.displayedText}{dialogue.isTyping && <span style={{ opacity: 0.6 }}>�</span>}
              </Typography>
            </Box>
            {dialogue.showInput && (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Input size="sm" fullWidth value={dialogue.inputValue}
                  onChange={e => setDialogue(d => d ? { ...d, inputValue: e.target.value } : null)}
                  onKeyDown={e => e.key === 'Enter' && sendChatMessage()}
                  disabled={dialogue.isStreaming}
                  placeholder="Ask a question..."
                  sx={{ ...pixelFont, fontSize: '9px', bgcolor: 'rgba(0,0,0,0.5)', border: '1px solid rgba(16,185,129,0.4)' }}
                />
                <Button size="sm" color="success" onClick={sendChatMessage} disabled={dialogue.isStreaming} sx={{ ...pixelFont, fontSize: '8px' }}>
                  {dialogue.isStreaming ? <CircularProgress size="sm" /> : 'SEND'}
                </Button>
              </Box>
            )}
            {!dialogue.showInput && !dialogue.isTyping && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography sx={{ ...pixelFont, fontSize: '8px', color: 'rgba(255,255,255,0.35)' }}>{dialogue.lineIndex + 1}/{dialogue.npc.dialogue.length}</Typography>
                <Box component="button" onClick={advanceDialogue} sx={btnSx('rgba(16,185,129,0.5)')}>?</Box>
              </Box>
            )}
          </Box>
        )}

        {/* BATTLE OVERLAY */}
        {mode === 'BATTLE' && battle && (
          <Box sx={{ position: 'absolute', inset: 0, zIndex: 20, bgcolor: 'rgba(6,10,20,0.98)', display: 'flex', flexDirection: 'column' }}>
            {/* Arena */}
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'stretch', justifyContent: 'space-between', gap: 2, px: 3, pt: 3, pb: 1, minHeight: 0 }}>
              {/* Left Side: Enemy / NPC Sprite and HP */}
              <Box sx={{ width: '38%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRight: '1px solid rgba(255,255,255,0.08)', pr: 2 }}>
                {battle.npc.spriteUrl ? (
                  <Box component="img" src={battle.npc.spriteUrl} sx={{ width: 96, height: 96, imageRendering: 'pixelated', objectFit: 'contain' }}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <Box sx={{ width: 96, height: 96, borderRadius: '50%', bgcolor: 'rgba(16,185,129,0.2)', border: '2px solid #10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px' }}>?</Box>
                )}
                <Typography sx={{ ...pixelFont, fontSize: '9px', color: '#10b981', mt: 2, mb: 1, textAlign: 'center' }}>{battle.npc.name}</Typography>
                <Box sx={{ width: '100%', maxWidth: 160 }}><HpBar hp={battle.enemyHp} max={battle.maxHp} color={battle.enemyHp > 50 ? '#10b981' : battle.enemyHp > 20 ? '#f59e0b' : '#ef4444'} /></Box>
                <Typography sx={{ ...pixelFont, fontSize: '7px', color: 'rgba(255,255,255,0.4)', mt: 1 }}>{battle.enemyHp}/{battle.maxHp} HP</Typography>
              </Box>

              {/* Right Side: Retro Task Details Box */}
              <Box sx={{ 
                width: '60%', 
                bgcolor: '#0b0f19', 
                border: '6px double #e2e8f0', 
                p: 2, 
                display: 'flex', 
                flexDirection: 'column',
                minHeight: 0,
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
              }}>
                <Typography sx={{ ...pixelFont, fontSize: '9px', color: '#fbbf24', borderBottom: '2px solid rgba(255,255,255,0.1)', pb: 1, mb: 1.5, letterSpacing: '0.05em' }}>
                  TASK SPECIFICATION
                </Typography>
                
                {/* Meta details */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 1.5, fontSize: '7px', color: '#e2e8f0', borderBottom: '1px dashed rgba(255,255,255,0.1)', pb: 1.5 }}>
                  <Box sx={{ display: 'flex' }}><Typography component="span" sx={{ ...pixelFont, fontSize: '7px', color: '#10b981', width: 110 }}>TASK TYPE:</Typography> <Typography component="span" sx={{ ...pixelFont, fontSize: '7px' }}>{(battle.npc.metadata?.type || 'N/A').toUpperCase()}</Typography></Box>
                  <Box sx={{ display: 'flex' }}><Typography component="span" sx={{ ...pixelFont, fontSize: '7px', color: '#10b981', width: 110 }}>MISSION:</Typography> <Typography component="span" sx={{ ...pixelFont, fontSize: '7px' }}>{battle.npc.responsibility || 'N/A'}</Typography></Box>
                  <Box sx={{ display: 'flex' }}><Typography component="span" sx={{ ...pixelFont, fontSize: '7px', color: '#10b981', width: 110 }}>SCHEDULE:</Typography> <Typography component="span" sx={{ ...pixelFont, fontSize: '7px', color: '#eab308' }}>{battle.npc.metadata?.schedule || 'MANUAL ONLY'}</Typography></Box>
                  {battle.npc.metadata?.endpoint && (
                    <Box sx={{ display: 'flex' }}>
                      <Typography component="span" sx={{ ...pixelFont, fontSize: '7px', color: '#10b981', width: 110 }}>ENDPOINT:</Typography>
                      <Typography component="span" sx={{ ...pixelFont, fontSize: '7px', color: '#38bdf8', wordBreak: 'break-all' }}>
                        {battle.npc.metadata?.method || 'GET'} {battle.npc.metadata?.endpoint}
                      </Typography>
                    </Box>
                  )}
                </Box>

                {/* Instructions / Dialogue lines */}
                <Typography sx={{ ...pixelFont, fontSize: '7px', color: '#10b981', mb: 1 }}>REQUIREMENTS / SPECS:</Typography>
                <Box sx={{ 
                  flex: 1, 
                  overflowY: 'auto', 
                  pr: 0.5,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                  '&::-webkit-scrollbar': { width: 6 },
                  '&::-webkit-scrollbar-track': { background: 'rgba(0,0,0,0.3)' },
                  '&::-webkit-scrollbar-thumb': { background: '#10b981', borderRadius: 0 },
                }}>
                  {battle.npc.dialogue.map((line, idx) => (
                    <Box key={idx} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                      <Typography sx={{ ...pixelFont, fontSize: '7px', color: '#fbbf24', mt: 0.3 }}>&raquo;</Typography>
                      <Typography sx={{ ...pixelFont, fontSize: '7.5px', color: '#f8fafc', lineHeight: 1.5 }}>{line}</Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            </Box>
            {/* Log */}
            <Box sx={{ height: 100, overflowY: 'auto', px: 2, py: 1, bgcolor: 'rgba(0,0,0,0.5)', borderTop: '1px solid rgba(255,255,255,0.07)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              {battle.log.map((line, i) => (
                <Typography key={i} sx={{ ...pixelFont, fontSize: '7px', lineHeight: 2.2, color: line.startsWith('OK') ? '#10b981' : line.startsWith('Error') ? '#ef4444' : line.startsWith('Triggering') ? '#fbbf24' : 'rgba(255,255,255,0.7)' }}>
                  {line}
                </Typography>
              ))}
            </Box>
            {/* Menu */}
            <Box sx={{ p: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
              {battle.phase === 'MENU' && (
                <>
                  {battle.npc.metadata?.endpoint && (
                    <Box component="button" onClick={triggerJob} disabled={battle.isExecuting} sx={btnSx('rgba(16,185,129,0.55)')}>
                      <Typography sx={{ ...pixelFont, fontSize: '7px', color: '#fff' }}>FIGHT</Typography>
                    </Box>
                  )}
                  <Box component="button" onClick={exitMode} sx={btnSx('rgba(239,68,68,0.45)')}>
                    <Typography sx={{ ...pixelFont, fontSize: '7px', color: '#fff' }}>RUN</Typography>
                  </Box>
                </>
              )}
              {battle.phase === 'RESULT' && (
                <>
                  <Box component="button" onClick={() => setBattle(b => b ? { ...b, phase: 'MENU', enemyHp: 100 } : null)} sx={btnSx('rgba(99,102,241,0.55)')}>
                    <Typography sx={{ ...pixelFont, fontSize: '7px', color: '#fff' }}>AGAIN</Typography>
                  </Box>
                  <Box component="button" onClick={exitMode} sx={btnSx('rgba(239,68,68,0.45)')}>
                    <Typography sx={{ ...pixelFont, fontSize: '7px', color: '#fff' }}>DONE</Typography>
                  </Box>
                </>
              )}
              {battle.isExecuting && <CircularProgress size="sm" color="success" />}
            </Box>
          </Box>
        )}

        {/* Mobile D-Pad */}
        <Box sx={{ display: { xs: 'flex', lg: 'none' }, position: 'absolute', bottom: 12, left: 12, right: 12, justifyContent: 'space-between', zIndex: 15, pointerEvents: 'none' }}>
          <Box sx={{ position: 'relative', width: 132, height: 132, pointerEvents: 'auto' }}>
            {([['up','W',{top:0,left:44}],['down','S',{bottom:0,left:44}],['left','A',{top:44,left:0}],['right','D',{top:44,right:0}]] as [string,string,object][]).map(([dir,icon,pos]) => (
              <Box key={dir} component="button"
                onPointerDown={() => vd(dir as any)} onPointerUp={() => vu(dir as any)} onPointerLeave={() => vu(dir as any)}
                sx={{ ...btnSx('#475569', '#1e293b'), position: 'absolute', fontSize: '14px', ...pos }}>{icon}</Box>
            ))}
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-end', pointerEvents: 'auto' }}>
            <Box component="button" onPointerDown={() => vd('b')} onPointerUp={() => vu('b')} onPointerLeave={() => vu('b')} sx={btnSx('#ef4444', '#b91c1c')}>B</Box>
            <Box component="button" onPointerDown={() => vd('a')} onPointerUp={() => vu('a')} onPointerLeave={() => vu('a')} sx={btnSx('#10b981', '#047857')}>A</Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

