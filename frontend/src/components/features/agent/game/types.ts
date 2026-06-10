export interface Coordinate {
  x: number;
  y: number;
}

export interface Inputs {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  a: boolean;
  b: boolean;
}

export interface GameConfig {
  tileSize: number;
  playerSpeed: number;
  playerWidth: number;
  playerHeight: number;
}

export enum TileType {
  GRASS = 0,
  PATH = 1,
  WATER = 2,
  FENCE = 3,
  WALL = 4,
  TREE = 5,
}

export interface TileConfig {
  id: TileType;
  name: string;
  color: string;
  isSolid: boolean;
}

export type TileMap = number[][];

export interface NPC {
  id: string;
  name: string;
  type: 'd1_table' | 'r2_bucket' | 'r2_object' | 'pokemon';
  worldX: number;
  worldY: number;
  width: number;
  height: number;
  spriteUrl?: string;
  dialogue: string[];
  isSolid: boolean;
  animationType: 'breathing' | 'waddle' | 'bounce' | 'squish';
  metadata?: any;
  walkTargetX?: number;
  walkTargetY?: number;
  isWalking?: boolean;
  walkTimer?: number;
  responsibility?: string;
}

export interface CameraState {
  x: number;
  y: number;
}

export interface PlayerState {
  worldX: number;
  worldY: number;
  width: number;
  height: number;
  speed: number;
  direction: number; // 0: DOWN, 1: LEFT, 2: RIGHT, 3: UP
  frameIndex: number;
  animTime: number;
  isMoving: boolean;
}

export interface GameState {
  player: PlayerState;
  npcs: NPC[];
  map: TileMap;
  camera: CameraState;
  dialog: {
    open: boolean;
    title: string;
    text: string;
    npcId?: string;
    options?: { label: string; action: string }[];
  } | null;
}