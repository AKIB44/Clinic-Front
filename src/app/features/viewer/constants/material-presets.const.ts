// Default material + lighting presets for the viewer (PRD §5.2 step 7-8).
// STL/OBJ get a neutral clinical grey; PLY/GLB keep embedded vertex colours.

export const MATERIAL_PRESETS = {
  stlColor:   0xe5e7ec,   // light clinical grey
  metalness:  0.08,
  roughness:  0.55,
  background: 0x0f1115,    // dark viewport for contrast
};

export const LIGHTING = {
  ambient:      { color: 0xffffff, intensity: 0.65 },
  key:          { color: 0xffffff, intensity: 0.9,  position: [1, 1, 1]    as const },
  fill:         { color: 0x88aaff, intensity: 0.4,  position: [-1, -0.5, -1] as const },
  rim:          { color: 0xffffff, intensity: 0.3,  position: [0, -1, 0.5] as const },
};
