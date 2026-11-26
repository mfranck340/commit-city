// Visual styles. "classic" is the detailed city; the rest are minimalist takes.
// Each style can override theme colours per light/dark and switch decorations off.

const MINIMAL_DECOR = { windows: false, trees: false, lamps: false, zebra: false, sky: false, crane: false, lanes: false, chips: true };

export const STYLES = {
  classic: { kind: 'classic', windows: true, trees: true, lamps: true, zebra: true, sky: true, crane: true, lanes: true, chips: true },

  // Calm monochrome city: same shapes as classic (houses, blocks, towers, skyscrapers,
  // trees), flat greys, and only your best days get the accent colour.
  minimal: {
    kind: 'classic',
    windows: true,
    trees: true,
    lamps: false,
    zebra: false,
    sky: false,
    crane: true,
    lanes: true,
    chips: true,
    shadowCar: false,
    mono: true,
    light: {
      skyTop: '#f7f8fa', skyBottom: '#f7f8fa', slabTop: '#e4e7ec', slabLeft: '#d6dae1', slabRight: '#c9ced7', slabGrass: '#d6dae1',
      road: '#e4e7ec', roadLine: '#ffffff', curbTop: '#f9fafb', curbSide: '#dfe3e9', grass: '#eceff3', grassDark: '#e8ebf0', pond: '#dde3ea', roofGarden: '#d3dbd4',
      trees: ['#c3cbc4', '#b6c0b8', '#cfd6d0'], trunk: '#b0b6bf',
      houses: ['#ffffff', '#f2f4f7'], roofs: ['#c5ccd6', '#b8c0cc'], blocks: ['#e6e9ee', '#dde1e7'], towers: ['#cfd5de', '#c6cdd7'], glass: ['ACCENT_SOFT'],
      window: '#ffffff', windowLit: ['#ffffff'], windowRate: 1, craneColor: '#F5A524',
      text: '#1f2328', subtext: '#656d76', chipBg: '#ffffff', chipBorder: '#e1e5eb',
      car: '#ffffff', carSide: '#d5dae2', carGlass: '#8d98ab', puck: '#8d98ab', beam: 0,
    },
    dark: {
      skyTop: '#0d1117', skyBottom: '#0d1117', slabTop: '#161b22', slabLeft: '#11151b', slabRight: '#0b0e13', slabGrass: '#11151b',
      road: '#161b22', roadLine: '#30363d', curbTop: '#1f242c', curbSide: '#1a1f26', grass: '#1b2027', grassDark: '#1a1e25', pond: '#232a33', roofGarden: '#2c3a33',
      trees: ['#2c3a33', '#33433a', '#28352f'], trunk: '#3a4048',
      houses: ['#3a414b', '#343a43'], roofs: ['#4b535e', '#555e6a'], blocks: ['#30363e', '#2b3138'], towers: ['#3d444e', '#363d46'], glass: ['ACCENT_SOFT'],
      window: '#1c2128', windowLit: ['#e6edf3', '#c9d1d9'], windowRate: 0.35, craneColor: '#F5A524',
      text: '#e6edf3', subtext: '#8d96a0', chipBg: '#161b22', chipBorder: '#30363d',
      car: '#8b949e', carSide: '#5b636e', carGlass: '#161b22', puck: '#c9d1d9', beam: 0.18,
    },
  },

  // Technical drawing: outlines only.
  blueprint: {
    kind: 'line',
    ...MINIMAL_DECOR,
    margin: 0.14,
    light: { skyTop: '#f3f7fc', skyBottom: '#f3f7fc', slabTop: '#f3f7fc', slabLeft: '#e3ecf7', slabRight: '#d6e3f2', slabGrass: '#e3ecf7', road: '#f3f7fc', curbTop: '#eaf1fa', curbSide: '#dce7f4', ink: '#2f6db5', fill: '#f3f7fc', park: 'OUTLINE', text: '#173a63', subtext: '#4a6c94', chipBg: '#f3f7fc', chipBorder: '#b9cfe9', car: '#ffffff', carSide: '#cfe0f3', carGlass: '#2f6db5' },
    dark: { skyTop: '#0b2545', skyBottom: '#0b2545', slabTop: '#0b2545', slabLeft: '#0f2d52', slabRight: '#0a2140', slabGrass: '#0f2d52', road: '#0b2545', curbTop: '#0e2b4f', curbSide: '#0c2646', ink: '#8fc1ff', fill: '#0b2545', park: 'OUTLINE', text: '#dcebff', subtext: '#8fb3dd', chipBg: '#0b2545', chipBorder: '#2a5288', car: '#dcebff', carSide: '#8fb3dd', carGlass: '#0b2545', beam: 0 },
  },

  // Dark volumes whose rooftops glow with intensity.
  neon: {
    kind: 'glow',
    ...MINIMAL_DECOR,
    margin: 0.16,
    light: { skyTop: '#fbfbfd', skyBottom: '#fbfbfd', slabTop: '#eceef3', slabLeft: '#dde0e7', slabRight: '#d0d4dc', slabGrass: '#dde0e7', road: '#eceef3', curbTop: '#f6f7fa', curbSide: '#e3e6ec', face: '#f6f7fa', park: '#eceef3', text: '#1b1d29', subtext: '#666b80', chipBg: '#ffffff', chipBorder: '#e3e6ec', car: '#ffffff', carSide: '#d6d9e2', carGlass: '#1b1d29' },
    dark: { skyTop: '#07080f', skyBottom: '#0d0f1c', slabTop: '#10121f', slabLeft: '#0c0d17', slabRight: '#08090f', slabGrass: '#0c0d17', road: '#10121f', curbTop: '#161929', curbSide: '#121421', face: '#161929', park: '#121424', text: '#eef0ff', subtext: '#8a8fb3', chipBg: '#10121f', chipBorder: '#262a45', car: '#eef0ff', carSide: '#8a8fb3', carGlass: '#07080f', beam: 0.25 },
  },

  // Soft pastel clay, with round little trees in the parks.
  clay: {
    kind: 'flat',
    ...MINIMAL_DECOR,
    trees: 'round',
    margin: 0.15,
    light: { skyTop: '#fdf6ee', skyBottom: '#fdf6ee', slabTop: '#efe4d6', slabLeft: '#e3d3c0', slabRight: '#d6c4ae', slabGrass: '#e3d3c0', road: '#efe4d6', curbTop: '#fffaf3', curbSide: '#eadfce', ramp: ['#f6d7c3', '#f3b9a5', '#e98f84', 'ACCENT'], park: '#cfe5c4', treeColor: '#9fcf8f', text: '#4a3b32', subtext: '#8a776a', chipBg: '#fffaf3', chipBorder: '#eadfce', car: '#ffffff', carSide: '#eadfce', carGlass: '#4a3b32' },
    dark: { skyTop: '#1d1a24', skyBottom: '#1d1a24', slabTop: '#29242f', slabLeft: '#221e28', slabRight: '#1a171f', slabGrass: '#221e28', road: '#29242f', curbTop: '#332d3a', curbSide: '#2c2733', ramp: ['#4a4152', '#6b5866', '#9a6f7a', 'ACCENT'], park: '#2f3d33', treeColor: '#4f7a5a', text: '#f1e9f5', subtext: '#a99db3', chipBg: '#29242f', chipBorder: '#3d3646', car: '#f1e9f5', carSide: '#a99db3', carGlass: '#1d1a24', beam: 0 },
  },
};
