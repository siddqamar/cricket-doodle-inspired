import { BugPalette, BugKind } from '../world/bugs';

export type SkinId = 'bugs' | 'robots' | 'aliens';

export type SkinDef = {
  id: SkinId;
  name: string;
  icon: string;
  description: string;
  palettes: Record<BugKind, BugPalette>;
  skyColors: { top: number; mid: number; bot: number };
  grassColors: { center: number; edge: number };
  ropeColor: number;
  ballColor: number;
  shellShader: 'standard' | 'iridescent' | 'metallic' | 'holographic';
  crowdColors: number[];
};

export const SKINS: Record<SkinId, SkinDef> = {
  bugs: {
    id: 'bugs',
    name: 'Pitch Bugs',
    icon: 'bug',
    description: 'Classic insect cricket.',
    palettes: {
      striker: { shell: 0x2d6a4f, belly: 0x95d5b2, limb: 0x1b4332, eye: 0xfff3b0, accent: 0xf4d35e, helmet: 0x40916c },
      partner: { shell: 0x457b9d, belly: 0xa8dadc, limb: 0x1d3557, eye: 0xe0fbfc, accent: 0xf1faee, helmet: 0x1d3557 },
      bowler: { shell: 0xe9c46a, belly: 0xffe8a3, limb: 0x6d6875, eye: 0xfff8e7, accent: 0xe76f51 },
      fielder: { shell: 0x6d6875, belly: 0xb8b0c0, limb: 0x3d3a44, eye: 0xffe5d9, accent: 0xe76f51 },
    },
    skyColors: { top: 0x1a0533, mid: 0xff6b35, bot: 0x7ec8e3 },
    grassColors: { center: 0x40916c, edge: 0x1b4332 },
    ropeColor: 0xf4d35e,
    ballColor: 0xd62828,
    shellShader: 'iridescent',
    crowdColors: [0xe76f51, 0xf4d35e, 0x52b788, 0x457b9d, 0xe9c46a, 0xff85a1],
  },
  robots: {
    id: 'robots',
    name: 'Chrome League',
    icon: 'robot',
    description: 'Metallic mechs on neon arena.',
    palettes: {
      striker: { shell: 0x4a90d9, belly: 0x8ec5fc, limb: 0x2c3e50, eye: 0x00ff88, accent: 0x00ffcc, helmet: 0x34495e },
      partner: { shell: 0x7f8c8d, belly: 0xbdc3c7, limb: 0x2c3e50, eye: 0x00ff88, accent: 0xe74c3c, helmet: 0x2c3e50 },
      bowler: { shell: 0xe74c3c, belly: 0xf1948a, limb: 0x2c3e50, eye: 0xf39c12, accent: 0xf1c40f },
      fielder: { shell: 0x95a5a6, belly: 0xd5dbdb, limb: 0x2c3e50, eye: 0x00ff88, accent: 0xe74c3c },
    },
    skyColors: { top: 0x0a0a2e, mid: 0x1a1a5e, bot: 0x0d2137 },
    grassColors: { center: 0x1a3a2a, edge: 0x0a1a15 },
    ropeColor: 0x00ffcc,
    ballColor: 0xff4444,
    shellShader: 'metallic',
    crowdColors: [0x00ffcc, 0xff4444, 0x4a90d9, 0xf1c40f, 0x9b59b6, 0x1abc9c],
  },
  aliens: {
    id: 'aliens',
    name: 'Cosmic XI',
    icon: 'alien',
    description: 'Bioluminescent aliens.',
    palettes: {
      striker: { shell: 0x6c3483, belly: 0xd2b4de, limb: 0x4a235a, eye: 0x82e0aa, accent: 0x00ff88, helmet: 0x5b2c6f },
      partner: { shell: 0x1a5276, belly: 0xa9cce3, limb: 0x154360, eye: 0xabebc6, accent: 0x48c9b0, helmet: 0x1b4f72 },
      bowler: { shell: 0xd4ac0d, belly: 0xf9e79f, limb: 0x7d6608, eye: 0x82e0aa, accent: 0xe74c3c },
      fielder: { shell: 0x1e8449, belly: 0x82e0aa, limb: 0x145a32, eye: 0xf9e79f, accent: 0xe74c3c },
    },
    skyColors: { top: 0x1a002e, mid: 0x4a0080, bot: 0x0d1b2a },
    grassColors: { center: 0x0d3320, edge: 0x061a10 },
    ropeColor: 0x00ff88,
    ballColor: 0xff00ff,
    shellShader: 'holographic',
    crowdColors: [0x00ff88, 0xff00ff, 0x00ccff, 0xffff00, 0xff6600, 0xcc00ff],
  },
};

export const DEFAULT_SKIN: SkinId = 'bugs';

export function loadSkin(): SkinId {
  const stored = localStorage.getItem('pitchbugs.skin') as SkinId;
  if (stored && SKINS[stored]) {
    return stored;
  }
  return DEFAULT_SKIN;
}

export function saveSkin(id: SkinId): void {
  localStorage.setItem('pitchbugs.skin', id);
}
