export interface ViewportProfile {
  width: number;
  height: number;
  isCoarsePointer: boolean;
  isCompactViewport: boolean;
  isLandscapePhone: boolean;
  isPortraitPhone: boolean;
}

export function classifyViewport(
  width: number,
  height: number,
  isCoarsePointer: boolean
): ViewportProfile {
  const safeW = Math.max(1, width);
  const safeH = Math.max(1, height);
  const isCompactViewport = safeW < 768 || safeH <= 520;
  const isLandscapePhone = isCompactViewport && safeW > safeH;
  const isPortraitPhone = isCompactViewport && safeH >= safeW;
  return {
    width: safeW,
    height: safeH,
    isCoarsePointer,
    isCompactViewport,
    isLandscapePhone,
    isPortraitPhone,
  };
}

export interface TitleCameraFraming {
  camPos: [number, number, number];
  lookAt: [number, number, number];
  catYaw: number;
}

/**
 * Computes title-screen camera position & lookAt target so the 3D cat hero sits
 * cleanly in the open bottom-left zone beneath the raised title/Start lockup,
 * while the right side holds the configuration card and harbor skyline.
 */
export function computeTitleCameraFraming(
  catPos: { x: number; y: number; z: number },
  aspect: number,
  fovDeg = 52,
  sway = 0
): TitleCameraFraming {
  const safeAspect = Math.max(0.35, Number.isFinite(aspect) ? aspect : 16 / 9);
  const isPortrait = safeAspect < 1.0;

  // Desired screen-space NDC for cat chest/head center (left: -1..+1 right, bottom: -1..+1 top)
  const targetNdcX = isPortrait ? -0.34 : -0.52;
  const targetNdcY = isPortrait ? -0.64 : -0.52;

  const distZ = isPortrait ? 3.55 : 2.70;
  const camOffX = (isPortrait ? 0.44 : 1.02) + sway * 0.55;
  const camOffY = isPortrait ? 1.06 : 0.90;

  const camX = catPos.x + camOffX;
  const camY = catPos.y + camOffY;
  const camZ = catPos.z + distZ;

  // Cat chest center slightly above paws
  const heroX = catPos.x;
  const heroY = catPos.y + 0.25;
  const heroZ = catPos.z;

  const tanHalfV = Math.tan((fovDeg * Math.PI) / 360);
  const tanHalfH = tanHalfV * safeAspect;

  // Ray from camera to hero point, rotated so hero lands at (targetNdcX, targetNdcY)
  const dx = heroX - camX;
  const dy = heroY - camY;
  const dz = heroZ - camZ;
  const depth = Math.hypot(dx, dy, dz);

  // Offset look-at target opposite to desired NDC shift at hero depth
  const lookX = heroX - targetNdcX * tanHalfH * depth;
  const lookY = heroY - targetNdcY * tanHalfV * depth;
  const lookZ = heroZ;

  return {
    camPos: [camX, camY, camZ],
    lookAt: [lookX, lookY, lookZ],
    // Turn cat ~32 deg toward camera & harbor right so face, bell, scarf, and breed fur show cleanly
    catYaw: 0.56,
  };
}

