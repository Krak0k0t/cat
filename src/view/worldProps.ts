import * as THREE from 'three';
import type { SolidCollider, WalkSurface } from '../systems/parkour';
import type { WorldMaterialSet } from './materials';

function makePitchedRoofGeometry(spanWidth: number, length: number, height: number): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-spanWidth * 0.5, 0);
  shape.lineTo(0, height);
  shape.lineTo(spanWidth * 0.5, 0);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: length,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.04,
    bevelSegments: 2,
  });
  geo.translate(0, 0, -length * 0.5);
  return geo;
}

export type DoorFace = 'east' | 'west' | 'north' | 'south';
export type DoorState = 'open' | 'ajar';
export type InteriorTheme = 'clocksmith' | 'tavern' | 'chandlery' | 'bakery';

export interface EnterableHouseSpec {
  face: DoorFace;
  /** Offset along the doorway wall (Z for east/west walls; X for north/south walls) */
  offset: number;
  doorState: DoorState;
  theme: InteriorTheme;
  withInteriorLight?: boolean;
}

export interface BuildingPhysics {
  gableSurface: WalkSurface | null;
  extraSurfaces?: WalkSurface[];
  colliders: SolidCollider[];
  chimneyTop: { x: number; y: number; z: number } | null;
}

interface LocalBox {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  minY: number;
  maxY: number;
}

interface LocalRect {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  topY: number;
}

interface RoomPropPos {
  kind: 'hearth' | 'table' | 'bench' | 'shelf' | 'stool' | 'rug' | 'sconce';
  bx: number;
  bz: number;
  rotY: number;
  spanX: number;
  spanZ: number;
}

interface EnterableLayout {
  wallT: number;
  halfW: number;
  halfD: number;
  floorY: number;
  ceilingY: number;
  masonryTop: number;
  doorW: number;
  doorH: number;
  doorOffset: number;
  doorRotY: number;
  doorWallCenterX: number;
  doorWallCenterZ: number;
  roomRotY: number;
  roomSpanX: number;
  roomSpanZ: number;
  wallBoxes: LocalBox[];
  ceilingBox: LocalBox;
  underfloorBox: LocalBox;
  ajarLeafBox: LocalBox | null;
  floorSurface: LocalRect;
  sillSurface: LocalRect;
  propSurfaces: LocalRect[];
  propColliders: LocalBox[];
  props: RoomPropPos[];
}

function rotateLocalBox(
  id: string,
  cx: number,
  cz: number,
  rx: number,
  rz: number,
  halfX: number,
  halfZ: number,
  minY: number,
  maxY: number,
  rotY: number
): LocalBox {
  const cos = Math.round(Math.cos(rotY));
  const sin = Math.round(Math.sin(rotY));
  const bx = cx + rx * cos + rz * sin;
  const bz = cz - rx * sin + rz * cos;
  const hx = Math.abs(cos) > 0 ? halfX : halfZ;
  const hz = Math.abs(cos) > 0 ? halfZ : halfX;
  return {
    id,
    minX: bx - hx,
    maxX: bx + hx,
    minZ: bz - hz,
    maxZ: bz + hz,
    minY,
    maxY,
  };
}

function computeEnterableLayout(
  width: number,
  depth: number,
  topY: number,
  spec: EnterableHouseSpec
): EnterableLayout {
  const wallT = 0.28;
  const halfW = width * 0.5;
  const halfD = depth * 0.5;
  const floorY = 0.52;
  const deckThickness = 0.24;
  const masonryTop = topY - deckThickness - 0.02;
  const ceilingY = topY - 0.30;
  const doorW = 1.52;
  const doorH = Math.min(2.05, Math.max(1.78, masonryTop - floorY - 0.22));
  const wallBottom = -1.0;

  const isEW = spec.face === 'east' || spec.face === 'west';
  const wallAxisHalf = isEW ? halfD : halfW;
  const maxOff = Math.max(0, wallAxisHalf - wallT - doorW * 0.5 - 0.45);
  const doorOffset = Math.max(-maxOff, Math.min(maxOff, spec.offset));

  const wallBoxes: LocalBox[] = [];
  let doorRotY = 0;
  let doorWallCenterX = 0;
  let doorWallCenterZ = 0;
  let sillSurface: LocalRect;

  if (isEW) {
    // North & South full walls
    wallBoxes.push(
      {
        id: 'wall_n',
        minX: -halfW,
        maxX: halfW,
        minZ: -halfD,
        maxZ: -halfD + wallT,
        minY: wallBottom,
        maxY: masonryTop,
      },
      {
        id: 'wall_s',
        minX: -halfW,
        maxX: halfW,
        minZ: halfD - wallT,
        maxZ: halfD,
        minY: wallBottom,
        maxY: masonryTop,
      }
    );
    const doorMinX = spec.face === 'east' ? halfW - wallT : -halfW;
    const doorMaxX = spec.face === 'east' ? halfW : -halfW + wallT;
    const backMinX = spec.face === 'east' ? -halfW : halfW - wallT;
    const backMaxX = spec.face === 'east' ? -halfW + wallT : halfW;

    wallBoxes.push({
      id: 'wall_back',
      minX: backMinX,
      maxX: backMaxX,
      minZ: -halfD + wallT,
      maxZ: halfD - wallT,
      minY: wallBottom,
      maxY: masonryTop,
    });
    wallBoxes.push(
      {
        id: 'jamb_a',
        minX: doorMinX,
        maxX: doorMaxX,
        minZ: -halfD + wallT,
        maxZ: doorOffset - doorW * 0.5,
        minY: wallBottom,
        maxY: masonryTop,
      },
      {
        id: 'jamb_b',
        minX: doorMinX,
        maxX: doorMaxX,
        minZ: doorOffset + doorW * 0.5,
        maxZ: halfD - wallT,
        minY: wallBottom,
        maxY: masonryTop,
      },
      {
        id: 'lintel',
        minX: doorMinX,
        maxX: doorMaxX,
        minZ: doorOffset - doorW * 0.5,
        maxZ: doorOffset + doorW * 0.5,
        minY: floorY + doorH,
        maxY: masonryTop,
      }
    );

    doorRotY = spec.face === 'east' ? Math.PI * 0.5 : -Math.PI * 0.5;
    doorWallCenterX = spec.face === 'east' ? halfW - wallT * 0.5 : -halfW + wallT * 0.5;
    doorWallCenterZ = doorOffset;
    sillSurface = {
      id: 'sill',
      minX: spec.face === 'east' ? halfW - wallT - 0.14 : -halfW - 0.18,
      maxX: spec.face === 'east' ? halfW + 0.18 : -halfW + wallT + 0.14,
      minZ: doorOffset - doorW * 0.48,
      maxZ: doorOffset + doorW * 0.48,
      topY: floorY - 0.01,
    };
  } else {
    // West & East full walls
    wallBoxes.push(
      {
        id: 'wall_w',
        minX: -halfW,
        maxX: -halfW + wallT,
        minZ: -halfD,
        maxZ: halfD,
        minY: wallBottom,
        maxY: masonryTop,
      },
      {
        id: 'wall_e',
        minX: halfW - wallT,
        maxX: halfW,
        minZ: -halfD,
        maxZ: halfD,
        minY: wallBottom,
        maxY: masonryTop,
      }
    );
    const doorMinZ = spec.face === 'south' ? halfD - wallT : -halfD;
    const doorMaxZ = spec.face === 'south' ? halfD : -halfD + wallT;
    const backMinZ = spec.face === 'south' ? -halfD : halfD - wallT;
    const backMaxZ = spec.face === 'south' ? -halfD + wallT : halfD;

    wallBoxes.push({
      id: 'wall_back',
      minX: -halfW + wallT,
      maxX: halfW - wallT,
      minZ: backMinZ,
      maxZ: backMaxZ,
      minY: wallBottom,
      maxY: masonryTop,
    });
    wallBoxes.push(
      {
        id: 'jamb_a',
        minX: -halfW + wallT,
        maxX: doorOffset - doorW * 0.5,
        minZ: doorMinZ,
        maxZ: doorMaxZ,
        minY: wallBottom,
        maxY: masonryTop,
      },
      {
        id: 'jamb_b',
        minX: doorOffset + doorW * 0.5,
        maxX: halfW - wallT,
        minZ: doorMinZ,
        maxZ: doorMaxZ,
        minY: wallBottom,
        maxY: masonryTop,
      },
      {
        id: 'lintel',
        minX: doorOffset - doorW * 0.5,
        maxX: doorOffset + doorW * 0.5,
        minZ: doorMinZ,
        maxZ: doorMaxZ,
        minY: floorY + doorH,
        maxY: masonryTop,
      }
    );

    doorRotY = spec.face === 'south' ? 0 : Math.PI;
    doorWallCenterX = doorOffset;
    doorWallCenterZ = spec.face === 'south' ? halfD - wallT * 0.5 : -halfD + wallT * 0.5;
    sillSurface = {
      id: 'sill',
      minX: doorOffset - doorW * 0.48,
      maxX: doorOffset + doorW * 0.48,
      minZ: spec.face === 'south' ? halfD - wallT - 0.14 : -halfD - 0.18,
      maxZ: spec.face === 'south' ? halfD + 0.18 : -halfD + wallT + 0.14,
      topY: floorY - 0.01,
    };
  }

  // Compact ajar door-leaf collider on the right hinged leaf (leaves ~0.92m wide open walkway on the left!)
  const ajarLeafBox =
    spec.doorState === 'ajar'
      ? rotateLocalBox(
          'door_leaf_ajar',
          doorWallCenterX,
          doorWallCenterZ,
          0.48,
          -0.38,
          0.24,
          0.26,
          floorY,
          floorY + doorH,
          doorRotY
        )
      : null;

  const roomRotY = doorRotY;
  const roomSpanX = isEW ? depth - wallT * 2 : width - wallT * 2;
  const roomSpanZ = isEW ? width - wallT * 2 : depth - wallT * 2;

  const propSurfaces: LocalRect[] = [];
  const propColliders: LocalBox[] = [];
  const props: RoomPropPos[] = [];

  const addPropItem = (
    id: string,
    kind: RoomPropPos['kind'],
    rx: number,
    rz: number,
    spanX: number,
    spanZ: number,
    colH: number,
    walkTopY?: number
  ) => {
    const rot = rotateLocalBox(
      id,
      0,
      0,
      rx,
      rz,
      spanX * 0.5,
      spanZ * 0.5,
      floorY,
      floorY + colH,
      roomRotY
    );
    const bx = (rot.minX + rot.maxX) * 0.5;
    const bz = (rot.minZ + rot.maxZ) * 0.5;
    props.push({ kind, bx, bz, rotY: roomRotY, spanX, spanZ });
    if (colH > 0.05) {
      propColliders.push(rot);
    }
    if (walkTopY !== undefined) {
      propSurfaces.push({
        id,
        minX: rot.minX - 0.02,
        maxX: rot.maxX + 0.02,
        minZ: rot.minZ - 0.02,
        maxZ: rot.maxZ + 0.02,
        topY: walkTopY,
      });
    }
  };

  // Back-wall stone fireplace / hearth
  addPropItem('hearth', 'hearth', 0, -roomSpanZ * 0.5 + 0.34, 1.35, 0.64, Math.max(1.8, masonryTop - floorY));
  // Left-wall sturdy workbench / counter (walkable!)
  addPropItem(
    'table',
    'table',
    -roomSpanX * 0.5 + 0.56,
    -0.35,
    0.76,
    1.62,
    0.56,
    floorY + 0.64
  );
  // Right-wall cushioned bench / cat bed (walkable!)
  addPropItem(
    'bench',
    'bench',
    roomSpanX * 0.5 - 0.52,
    -0.35,
    0.68,
    1.48,
    0.32,
    floorY + 0.40
  );
  // Back-left shelf & spice jars
  addPropItem(
    'shelf',
    'shelf',
    -roomSpanX * 0.5 + 1.15,
    -roomSpanZ * 0.5 + 0.30,
    1.10,
    0.46,
    1.72
  );
  // Back-right oak barrel stool / cask (walkable!)
  addPropItem(
    'stool',
    'stool',
    roomSpanX * 0.5 - 1.05,
    -roomSpanZ * 0.5 + 0.48,
    0.62,
    0.62,
    0.38,
    floorY + 0.46
  );

  // Decorative central woven rug (non-colliding)
  const rugRot = rotateLocalBox('rug', 0, 0, 0, 0.25, 1.05, 0.78, floorY, floorY + 0.02, roomRotY);
  props.push({
    kind: 'rug',
    bx: (rugRot.minX + rugRot.maxX) * 0.5,
    bz: (rugRot.minZ + rugRot.maxZ) * 0.5,
    rotY: roomRotY,
    spanX: 2.1,
    spanZ: 1.56,
  });

  // Back-wall amber sconce position
  const sconceRot = rotateLocalBox(
    'sconce',
    0,
    0,
    roomSpanX * 0.24,
    -roomSpanZ * 0.5 + 0.14,
    0.1,
    0.1,
    floorY + 1.4,
    floorY + 1.8,
    roomRotY
  );
  props.push({
    kind: 'sconce',
    bx: (sconceRot.minX + sconceRot.maxX) * 0.5,
    bz: (sconceRot.minZ + sconceRot.maxZ) * 0.5,
    rotY: roomRotY,
    spanX: 0.2,
    spanZ: 0.2,
  });

  return {
    wallT,
    halfW,
    halfD,
    floorY,
    ceilingY,
    masonryTop,
    doorW,
    doorH,
    doorOffset,
    doorRotY,
    doorWallCenterX,
    doorWallCenterZ,
    roomRotY,
    roomSpanX,
    roomSpanZ,
    wallBoxes,
    ceilingBox: {
      id: 'ceiling',
      minX: -halfW,
      maxX: halfW,
      minZ: -halfD,
      maxZ: halfD,
      minY: ceilingY,
      maxY: topY - 0.06,
    },
    underfloorBox: {
      id: 'underfloor',
      minX: -halfW + 0.08,
      maxX: halfW - 0.08,
      minZ: -halfD + 0.08,
      maxZ: halfD - 0.08,
      minY: -1.0,
      maxY: floorY - 0.06,
    },
    ajarLeafBox,
    floorSurface: {
      id: 'floor',
      minX: -halfW + wallT - 0.04,
      maxX: halfW - wallT + 0.04,
      minZ: -halfD + wallT - 0.04,
      maxZ: halfD - wallT + 0.04,
      topY: floorY,
    },
    sillSurface,
    propSurfaces,
    propColliders,
    props,
  };
}

export function getBuildingPhysics(
  idPrefix: string,
  originX: number,
  originZ: number,
  width: number,
  depth: number,
  topY: number,
  withGable: boolean,
  enterable?: EnterableHouseSpec
): BuildingPhysics {
  const colliders: SolidCollider[] = [];
  const extraSurfaces: WalkSurface[] = [];

  if (enterable) {
    const layout = computeEnterableLayout(width, depth, topY, enterable);
    const toWorld = (b: LocalBox): SolidCollider => ({
      id: `${idPrefix}_${b.id}`,
      minX: originX + b.minX,
      maxX: originX + b.maxX,
      minZ: originZ + b.minZ,
      maxZ: originZ + b.maxZ,
      minY: b.minY,
      maxY: b.maxY,
    });
    for (const w of layout.wallBoxes) colliders.push(toWorld(w));
    colliders.push(toWorld(layout.ceilingBox));
    colliders.push(toWorld(layout.underfloorBox));
    if (layout.ajarLeafBox) colliders.push(toWorld(layout.ajarLeafBox));
    for (const p of layout.propColliders) colliders.push(toWorld(p));

    extraSurfaces.push(
      {
        id: `${idPrefix}_${layout.floorSurface.id}`,
        minX: originX + layout.floorSurface.minX,
        maxX: originX + layout.floorSurface.maxX,
        minZ: originZ + layout.floorSurface.minZ,
        maxZ: originZ + layout.floorSurface.maxZ,
        topY: layout.floorSurface.topY,
        kind: 'roof',
      },
      {
        id: `${idPrefix}_${layout.sillSurface.id}`,
        minX: originX + layout.sillSurface.minX,
        maxX: originX + layout.sillSurface.maxX,
        minZ: originZ + layout.sillSurface.minZ,
        maxZ: originZ + layout.sillSurface.maxZ,
        topY: layout.sillSurface.topY,
        kind: 'roof',
      }
    );
    for (const ps of layout.propSurfaces) {
      extraSurfaces.push({
        id: `${idPrefix}_${ps.id}`,
        minX: originX + ps.minX,
        maxX: originX + ps.maxX,
        minZ: originZ + ps.minZ,
        maxZ: originZ + ps.maxZ,
        topY: ps.topY,
        kind: 'roof',
      });
    }
  } else {
    colliders.push({
      id: `${idPrefix}_body`,
      minX: originX - width * 0.5 + 0.08,
      maxX: originX + width * 0.5 - 0.08,
      minZ: originZ - depth * 0.5 + 0.08,
      maxZ: originZ + depth * 0.5 - 0.08,
      minY: -1.0,
      maxY: topY - 0.14,
    });
  }

  if (!withGable) {
    return {
      gableSurface: null,
      extraSurfaces: extraSurfaces.length > 0 ? extraSurfaces : undefined,
      colliders,
      chimneyTop: null,
    };
  }

  const gableSpan = Math.min(2.3, width * 0.36);
  const gableLen = Math.min(2.8, depth * 0.44);
  const gableH = 1.25;
  const gx = -width * 0.32;
  const gz = -depth * 0.25;

  const dormerHalfW = (gableSpan * 0.88) * 0.5;
  const dormerHalfL = (gableLen * 0.88) * 0.5;

  const cx = width * 0.34;
  const cz = -depth * 0.34;

  colliders.push(
    {
      id: `${idPrefix}_dormer_wall`,
      minX: originX + gx - dormerHalfW,
      maxX: originX + gx + dormerHalfW,
      minZ: originZ + gz - dormerHalfL,
      maxZ: originZ + gz + dormerHalfL,
      minY: topY,
      maxY: topY + 0.52,
    },
    {
      id: `${idPrefix}_chimney`,
      minX: originX + cx - 0.29,
      maxX: originX + cx + 0.29,
      minZ: originZ + cz - 0.29,
      maxZ: originZ + cz + 0.29,
      minY: topY,
      maxY: topY + 2.25,
    }
  );

  const gableSurface: WalkSurface = {
    id: `${idPrefix}_gable_roof`,
    minX: originX + gx - gableSpan * 0.5 - 0.04,
    maxX: originX + gx + gableSpan * 0.5 + 0.04,
    minZ: originZ + gz - gableLen * 0.5 - 0.04,
    maxZ: originZ + gz + gableLen * 0.5 + 0.04,
    topY: topY + 0.49,
    kind: 'roof',
    gable: {
      axis: 'z',
      center: originX + gx,
      halfSpan: gableSpan * 0.5 + 0.04,
      eaveY: topY + 0.49,
      ridgeY: topY + 0.49 + gableH + 0.05,
    },
  };

  return {
    gableSurface,
    extraSurfaces: extraSurfaces.length > 0 ? extraSurfaces : undefined,
    colliders,
    chimneyTop: {
      x: originX + cx,
      y: topY + 2.38,
      z: originZ + cz,
    },
  };
}

function buildInteriorPropsAndDoor(
  g: THREE.Group,
  width: number,
  depth: number,
  topY: number,
  mats: WorldMaterialSet,
  spec: EnterableHouseSpec
): void {
  const layout = computeEnterableLayout(width, depth, topY, spec);
  const { wallT, halfW, halfD, floorY, ceilingY, masonryTop, doorW, doorH, doorOffset } = layout;

  // 1. Hollow exterior masonry wall segments (each BoxGeometry has proper outward normals on interior & exterior faces)
  for (const wb of layout.wallBoxes) {
    const bw = wb.maxX - wb.minX;
    const bd = wb.maxZ - wb.minZ;
    const bh = wb.maxY - wb.minY;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), mats.masonryWall);
    mesh.position.set((wb.minX + wb.maxX) * 0.5, (wb.minY + wb.maxY) * 0.5, (wb.minZ + wb.maxZ) * 0.5);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);
  }

  // 2. Submerged foundation plinth tucked strictly below floor level (keeps interior & doorway 100% open)
  const subPlinthH = floorY + 0.65;
  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.24, subPlinthH, depth + 0.24),
    mats.darkIron
  );
  plinth.position.set(0, floorY - 0.04 - subPlinthH * 0.5, 0);
  plinth.receiveShadow = true;
  g.add(plinth);

  // 3. Warm oak interior floorboards + granite threshold sill stone
  const innerW = width - wallT * 2 + 0.08;
  const innerD = depth - wallT * 2 + 0.08;
  const floorDeck = new THREE.Mesh(new THREE.BoxGeometry(innerW, 0.14, innerD), mats.woodCatwalk);
  floorDeck.position.set(0, floorY - 0.07, 0);
  floorDeck.receiveShadow = true;
  g.add(floorDeck);

  const sillW = layout.sillSurface.maxX - layout.sillSurface.minX;
  const sillD = layout.sillSurface.maxZ - layout.sillSurface.minZ;
  const sillMesh = new THREE.Mesh(new THREE.BoxGeometry(sillW, 0.12, sillD), mats.slateRoof);
  sillMesh.position.set(
    (layout.sillSurface.minX + layout.sillSurface.maxX) * 0.5,
    floorY - 0.07,
    (layout.sillSurface.minZ + layout.sillSurface.maxZ) * 0.5
  );
  sillMesh.receiveShadow = true;
  g.add(sillMesh);

  // 4. Warm interior plaster wall panels, corner timber beams, ceiling joists & timber wainscoting
  const plasterH = Math.max(0.8, masonryTop - floorY - 0.1);
  const plasterGroup = new THREE.Group();
  plasterGroup.rotation.y = layout.roomRotY;
  const halfRX = layout.roomSpanX * 0.5;
  const halfRZ = layout.roomSpanZ * 0.5;

  // Back plaster wall + back timber wainscot + framed tapestry plaque + side plaster walls
  const backPlaster = new THREE.Mesh(
    new THREE.BoxGeometry(layout.roomSpanX - 0.04, plasterH, 0.04),
    mats.interiorPlaster
  );
  backPlaster.position.set(0, floorY + plasterH * 0.5, -halfRZ + 0.02);
  backPlaster.receiveShadow = true;
  plasterGroup.add(backPlaster);

  const backWainscot = new THREE.Mesh(
    new THREE.BoxGeometry(layout.roomSpanX - 0.04, 0.62, 0.06),
    mats.woodCatwalk
  );
  backWainscot.position.set(0, floorY + 0.31, -halfRZ + 0.03);
  plasterGroup.add(backWainscot);

  const backRail = new THREE.Mesh(
    new THREE.BoxGeometry(layout.roomSpanX - 0.04, 0.06, 0.09),
    mats.woodCatwalk
  );
  backRail.position.set(0, floorY + 0.64, -halfRZ + 0.04);
  plasterGroup.add(backRail);

  // Framed harbor map / wall tapestry plaque on back wall (left of hearth or right of hearth)
  for (const fx of [-layout.roomSpanX * 0.28, layout.roomSpanX * 0.28]) {
    const frameW = 0.86;
    const frameH = 0.58;
    const fy = floorY + 1.48;
    const plaqueFrame = new THREE.Mesh(
      new THREE.BoxGeometry(frameW, frameH, 0.05),
      mats.woodCatwalk
    );
    plaqueFrame.position.set(fx, fy, -halfRZ + 0.055);
    plasterGroup.add(plaqueFrame);
    const plaqueCanvas = new THREE.Mesh(
      new THREE.BoxGeometry(frameW - 0.12, frameH - 0.12, 0.065),
      fx < 0 ? mats.interiorCushion : mats.interiorRug
    );
    plaqueCanvas.position.set(fx, fy, -halfRZ + 0.062);
    plasterGroup.add(plaqueCanvas);
    const plaqueSeal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 0.075, 10),
      mats.brassTrim
    );
    plaqueSeal.rotation.x = Math.PI * 0.5;
    plaqueSeal.position.set(fx, fy, -halfRZ + 0.068);
    plasterGroup.add(plaqueSeal);
  }

  for (const sx of [-1, 1]) {
    const sidePlaster = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, plasterH, layout.roomSpanZ - 0.04),
      mats.interiorPlaster
    );
    sidePlaster.position.set(sx * (halfRX - 0.02), floorY + plasterH * 0.5, 0);
    sidePlaster.receiveShadow = true;
    plasterGroup.add(sidePlaster);

    const wainscot = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.62, layout.roomSpanZ - 0.04),
      mats.woodCatwalk
    );
    wainscot.position.set(sx * (halfRX - 0.03), floorY + 0.31, 0);
    plasterGroup.add(wainscot);
  }

  // Four corner timber posts + 3 exposed ceiling rafters
  const postGeo = new THREE.BoxGeometry(0.14, plasterH + 0.08, 0.14);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const post = new THREE.Mesh(postGeo, mats.woodCatwalk);
      post.position.set(sx * (halfRX - 0.08), floorY + plasterH * 0.5, sz * (halfRZ - 0.08));
      plasterGroup.add(post);
    }
  }
  const rafterGeo = new THREE.BoxGeometry(layout.roomSpanX, 0.11, 0.14);
  for (const rz of [-halfRZ * 0.55, 0, halfRZ * 0.55]) {
    const beam = new THREE.Mesh(rafterGeo, mats.woodCatwalk);
    beam.position.set(0, ceilingY - 0.05, rz);
    plasterGroup.add(beam);
  }
  g.add(plasterGroup);

  // 5. Door frame jambs, header trim, warm overhead sconce lantern & hinged double door leaves (open vs ajar)
  const doorGroup = new THREE.Group();
  doorGroup.position.set(layout.doorWallCenterX, 0, layout.doorWallCenterZ);
  doorGroup.rotation.y = layout.doorRotY;

  for (const sx of [-1, 1]) {
    const jamb = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, doorH + 0.04, wallT + 0.08),
      mats.woodCatwalk
    );
    jamb.position.set(sx * (doorW * 0.5 + 0.02), floorY + doorH * 0.5, 0);
    jamb.castShadow = true;
    doorGroup.add(jamb);
  }
  const header = new THREE.Mesh(
    new THREE.BoxGeometry(doorW + 0.24, 0.14, wallT + 0.12),
    mats.woodCatwalk
  );
  header.position.set(0, floorY + doorH + 0.06, 0);
  header.castShadow = true;
  doorGroup.add(header);

  const brassPlate = new THREE.Mesh(
    new THREE.BoxGeometry(doorW + 0.16, 0.04, wallT + 0.15),
    mats.brassTrim
  );
  brassPlate.position.set(0, floorY + doorH + 0.14, 0);
  doorGroup.add(brassPlate);

  // Exterior doorway lantern glowing warmly above threshold
  const extBulb = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 1), mats.lanternGlow);
  extBulb.position.set(0, floorY + doorH + 0.26, wallT * 0.5 + 0.18);
  doorGroup.add(extBulb);
  const extCap = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.12, 8), mats.darkIron);
  extCap.position.set(0, floorY + doorH + 0.36, wallT * 0.5 + 0.18);
  doorGroup.add(extCap);

  // Hinged double wooden & brass cottage door leaves swinging inward (-Z in doorGroup local space)
  const leafW = (doorW - 0.08) * 0.5;
  const leafH = doorH - 0.04;
  const buildDoorLeaf = (side: -1 | 1): THREE.Group => {
    const pivot = new THREE.Group();
    pivot.position.set(side * (doorW * 0.5 - 0.04), floorY, -wallT * 0.42);
    const dir = -side; // left leaf (-1) extends +X; right leaf (+1) extends -X

    const plank = new THREE.Mesh(new THREE.BoxGeometry(leafW, leafH, 0.06), mats.woodCatwalk);
    plank.position.set(dir * leafW * 0.5, leafH * 0.5, 0);
    plank.castShadow = true;
    plank.receiveShadow = true;
    pivot.add(plank);

    // Upper glowing mullioned window pane inside the wood door
    const paneY = leafH * 0.72;
    const paneW = leafW * 0.52;
    const paneH = leafH * 0.24;
    const pane = new THREE.Mesh(
      new THREE.BoxGeometry(paneW, paneH, 0.07),
      mats.windowGlass
    );
    pane.position.set(dir * leafW * 0.5, paneY, 0);
    pivot.add(pane);

    const mullionV = new THREE.Mesh(new THREE.BoxGeometry(0.03, paneH + 0.02, 0.08), mats.woodCatwalk);
    mullionV.position.set(dir * leafW * 0.5, paneY, 0);
    pivot.add(mullionV);
    const mullionH = new THREE.Mesh(new THREE.BoxGeometry(paneW + 0.02, 0.03, 0.08), mats.woodCatwalk);
    mullionH.position.set(dir * leafW * 0.5, paneY, 0);
    pivot.add(mullionH);

    // Iron hinge straps cleanly on timber planks below the window pane (zero Z-fighting with glass)
    for (const hy of [0.28, leafH * 0.46]) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(leafW * 0.68, 0.055, 0.084), mats.darkIron);
      strap.position.set(dir * leafW * 0.36, hy, 0);
      pivot.add(strap);
    }
    const knob = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.015, 6, 12), mats.brassTrim);
    knob.position.set(dir * (leafW - 0.12), leafH * 0.44, 0.048);
    pivot.add(knob);
    const knobBack = knob.clone();
    knobBack.position.z = -0.045;
    pivot.add(knobBack);

    return pivot;
  };

  const leftLeaf = buildDoorLeaf(-1);
  const rightLeaf = buildDoorLeaf(1);
  if (spec.doorState === 'open') {
    leftLeaf.rotation.y = 1.64;  // ~94 deg open inward
    rightLeaf.rotation.y = -1.64; // ~94 deg open inward
  } else {
    leftLeaf.rotation.y = 1.56;  // ~89 deg open on left
    rightLeaf.rotation.y = -0.72; // ~41 deg ajar on right -> unmistakably half-open!
  }
  doorGroup.add(leftLeaf, rightLeaf);
  g.add(doorGroup);

  // 6. Furnish cozy themed interior props from shared layout positions
  for (const p of layout.props) {
    const pg = new THREE.Group();
    pg.position.set(p.bx, floorY, p.bz);
    pg.rotation.y = p.rotY;

    if (p.kind === 'rug') {
      const rug = new THREE.Mesh(new THREE.BoxGeometry(p.spanX, 0.024, p.spanZ), mats.interiorRug);
      rug.position.y = 0.012;
      rug.receiveShadow = true;
      pg.add(rug);

      const trim = new THREE.Mesh(
        new THREE.BoxGeometry(p.spanX - 0.18, 0.028, p.spanZ - 0.18),
        mats.brassTrim
      );
      trim.position.y = 0.014;
      pg.add(trim);

      const innerRug = new THREE.Mesh(
        new THREE.BoxGeometry(p.spanX - 0.30, 0.032, p.spanZ - 0.30),
        mats.interiorRug
      );
      innerRug.position.y = 0.016;
      innerRug.receiveShadow = true;
      pg.add(innerRug);
    } else if (p.kind === 'hearth') {
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.92, 0.60), mats.masonryWall);
      base.position.y = 0.46;
      base.castShadow = true;
      base.receiveShadow = true;
      pg.add(base);

      const firebox = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.54, 0.24), mats.darkIron);
      firebox.position.set(0, 0.32, 0.22);
      pg.add(firebox);

      const embers = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), mats.hearthGlow);
      embers.scale.set(1.6, 0.55, 0.8);
      embers.position.set(0, 0.18, 0.24);
      pg.add(embers);

      const mantle = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.1, 0.68), mats.woodCatwalk);
      mantle.position.y = 0.96;
      pg.add(mantle);

      const flueH = Math.max(0.5, ceilingY - floorY - 0.96);
      const flue = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, flueH, 10), mats.darkIron);
      flue.position.set(0, 0.96 + flueH * 0.5, -0.05);
      pg.add(flue);

      const kettle = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), mats.brassTrim);
      kettle.position.set(0.32, 1.12, 0.08);
      pg.add(kettle);
    } else if (p.kind === 'table') {
      const top = new THREE.Mesh(new THREE.BoxGeometry(p.spanX, 0.08, p.spanZ), mats.woodCatwalk);
      top.position.y = 0.60;
      top.castShadow = true;
      top.receiveShadow = true;
      pg.add(top);

      const legGeo = new THREE.BoxGeometry(0.08, 0.58, 0.08);
      for (const lx of [-p.spanX * 0.38, p.spanX * 0.38]) {
        for (const lz of [-p.spanZ * 0.42, p.spanZ * 0.42]) {
          const leg = new THREE.Mesh(legGeo, mats.woodCatwalk);
          leg.position.set(lx, 0.29, lz);
          pg.add(leg);
        }
      }

      // Theme-specific tabletop craftsmanship props
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.18, 8), mats.lanternGlow);
      lamp.position.set(-0.14, 0.73, -0.45);
      pg.add(lamp);
      const lampCap = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.09, 8), mats.darkIron);
      lampCap.position.set(-0.14, 0.85, -0.45);
      pg.add(lampCap);

      if (spec.theme === 'clocksmith') {
        const cog = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 8, 16), mats.brassTrim);
        cog.rotation.x = Math.PI * 0.5;
        cog.position.set(0.06, 0.66, 0.25);
        pg.add(cog);
      } else if (spec.theme === 'tavern') {
        const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.14, 8), mats.terracottaPot);
        mug.position.set(0.12, 0.71, 0.25);
        pg.add(mug);
        const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.15, 0.03, 12), mats.brassTrim);
        plate.position.set(-0.04, 0.655, 0.0);
        pg.add(plate);
      } else if (spec.theme === 'chandlery') {
        const coil = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.045, 8, 14), mats.interiorPlaster);
        coil.rotation.x = Math.PI * 0.5;
        coil.position.set(0.06, 0.68, 0.28);
        pg.add(coil);
        const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.04, 12), mats.brassTrim);
        dial.position.set(-0.08, 0.66, -0.05);
        pg.add(dial);
      } else {
        // Bakery
        const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.11, 0.11, 10), mats.terracottaPot);
        bowl.position.set(-0.04, 0.695, 0.02);
        pg.add(bowl);
        const loaf = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), mats.brassTrim);
        loaf.scale.set(1.1, 0.65, 1.5);
        loaf.position.set(0.08, 0.70, 0.36);
        pg.add(loaf);
      }
    } else if (p.kind === 'bench') {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(p.spanX, 0.28, p.spanZ), mats.woodCatwalk);
      frame.position.y = 0.14;
      frame.castShadow = true;
      frame.receiveShadow = true;
      pg.add(frame);

      const cushion = new THREE.Mesh(
        new THREE.BoxGeometry(p.spanX - 0.06, 0.12, p.spanZ - 0.08),
        mats.interiorCushion
      );
      cushion.position.y = 0.34;
      cushion.receiveShadow = true;
      pg.add(cushion);

      const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.36), mats.interiorRug);
      pillow.position.set(0.08, 0.44, -0.38);
      pillow.rotation.z = -0.22;
      pg.add(pillow);
    } else if (p.kind === 'shelf') {
      const shelfH = 1.66;
      // Open-front timber bookcase (back panel + side stiles + 4 open planks)
      const back = new THREE.Mesh(new THREE.BoxGeometry(p.spanX, shelfH, 0.06), mats.woodCatwalk);
      back.position.set(0, shelfH * 0.5, -p.spanZ * 0.5 + 0.03);
      back.castShadow = true;
      pg.add(back);

      for (const sx of [-1, 1]) {
        const stile = new THREE.Mesh(new THREE.BoxGeometry(0.06, shelfH, p.spanZ), mats.woodCatwalk);
        stile.position.set(sx * (p.spanX * 0.5 - 0.03), shelfH * 0.5, 0);
        stile.castShadow = true;
        pg.add(stile);
      }

      for (const sy of [0.08, 0.54, 1.02, 1.56]) {
        const plankShelf = new THREE.Mesh(
          new THREE.BoxGeometry(p.spanX - 0.06, 0.05, p.spanZ - 0.04),
          mats.woodCatwalk
        );
        plankShelf.position.set(0, sy, 0.01);
        plankShelf.receiveShadow = true;
        pg.add(plankShelf);
      }

      for (const [idx, sy] of [0.56, 1.04].entries()) {
        const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.19, 8), mats.terracottaPot);
        jar.position.set(-0.24 + idx * 0.08, sy + 0.10, 0.05);
        pg.add(jar);
        const pot = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), mats.brassTrim);
        pot.position.set(0.02, sy + 0.09, 0.05);
        pg.add(pot);
        const book = new THREE.Mesh(
          new THREE.BoxGeometry(0.22, 0.22, 0.18),
          idx === 0 ? mats.interiorCushion : mats.interiorRug
        );
        book.position.set(0.26, sy + 0.11, 0.05);
        pg.add(book);
      }
    } else if (p.kind === 'stool') {
      const keg = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.22, 0.46, 12), mats.woodCatwalk);
      keg.position.y = 0.23;
      keg.castShadow = true;
      pg.add(keg);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.05, 12), mats.darkIron);
      band.position.y = 0.36;
      pg.add(band);
    } else if (p.kind === 'sconce') {
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.22), mats.darkIron);
      bracket.position.y = 1.62;
      pg.add(bracket);
      const bulb = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 1), mats.lanternGlow);
      bulb.position.set(0, 1.50, 0.08);
      pg.add(bulb);
    }

    g.add(pg);
  }

  // 7. Optional subtle interior PointLight for hero harbor houses (strictly capped by helloScene)
  if (spec.withInteriorLight) {
    const pt = new THREE.PointLight('#FFB46E', 4.2, 7.6, 1.5);
    pt.position.set(0, Math.min(ceilingY - 0.35, floorY + 1.85), 0);
    g.add(pt);
  }
}

export function buildRooftopBuilding(
  width: number,
  depth: number,
  topY: number,
  mats: WorldMaterialSet,
  withGable = true,
  withRailing = false,
  withLivingProps = false,
  enterable?: EnterableHouseSpec
): THREE.Group {
  const g = new THREE.Group();
  const deckThickness = 0.24;
  const masonryTop = topY - deckThickness - 0.02;
  const baseHeight = masonryTop + 2.6;

  let doorSkipFaceZ: -1 | 1 | 0 = 0;
  let doorSkipOffsetX = 0;
  let doorSkipMargin = 0;

  if (enterable) {
    buildInteriorPropsAndDoor(g, width, depth, topY, mats, enterable);
    if (enterable.face === 'south') {
      doorSkipFaceZ = 1;
      doorSkipOffsetX = enterable.offset;
      doorSkipMargin = 1.35;
    } else if (enterable.face === 'north') {
      doorSkipFaceZ = -1;
      doorSkipOffsetX = enterable.offset;
      doorSkipMargin = 1.35;
    }
  } else {
    // 1. Weathered Venetian masonry tower body (solid monolith for non-enterable backdrop towers)
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(width, baseHeight, depth),
      mats.masonryWall
    );
    body.position.set(0, masonryTop - baseHeight * 0.5, 0);
    body.receiveShadow = true;
    body.castShadow = true;
    g.add(body);

    // 2. Waterline stone plinth collar + recessed canal boat-arch relief
    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.24, 1.15, depth + 0.24),
      mats.darkIron
    );
    plinth.position.set(0, 0.32, 0);
    plinth.receiveShadow = true;
    g.add(plinth);

    // Venetian stone pilasters + dark recessed boat-gate arch near canal water
    if (width >= 5.5) {
      const gateW = Math.min(1.85, width * 0.32);
      const gateVoid = new THREE.Mesh(
        new THREE.BoxGeometry(gateW, 1.35, 0.12),
        mats.darkIron
      );
      gateVoid.position.set(0, 0.55, depth * 0.5 + 0.04);
      g.add(gateVoid);

      const gateArch = new THREE.Mesh(
        new THREE.TorusGeometry(gateW * 0.5, 0.08, 8, 16, Math.PI),
        mats.brassTrim
      );
      gateArch.position.set(0, 1.22, depth * 0.5 + 0.08);
      g.add(gateArch);
    }
  }

  // Vertical corner copper rainwater downspouts bolted to masonry
  const pipeH = topY + 0.6;
  const downspoutGeo = new THREE.CylinderGeometry(0.055, 0.055, pipeH, 8);
  const strapGeo = new THREE.TorusGeometry(0.075, 0.018, 6, 10);
  for (const sx of [-1, 1]) {
    const px = sx * (width * 0.48);
    const pz = depth * 0.5 + 0.08;
    const pipe = new THREE.Mesh(downspoutGeo, mats.verdigrisRoof);
    pipe.position.set(px, pipeH * 0.5 - 0.5, pz);
    g.add(pipe);

    for (const sy of [0.8, topY - 1.2]) {
      const strap = new THREE.Mesh(strapGeo, mats.brassTrim);
      strap.rotation.x = Math.PI * 0.5;
      strap.position.set(px, sy, pz);
      g.add(strap);
    }
  }

  // 3. Wet slate rooftop walking deck
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.22, deckThickness, depth + 0.22),
    mats.slateRoof
  );
  deck.position.set(0, topY - deckThickness * 0.5, 0);
  deck.receiveShadow = true;
  deck.castShadow = true;
  g.add(deck);

  // Brass rain-gutter trim framing rooftop perimeter
  const gutterF = new THREE.Mesh(new THREE.BoxGeometry(width + 0.34, 0.06, 0.09), mats.brassTrim);
  gutterF.position.set(0, topY - 0.04, depth * 0.5 + 0.13);
  g.add(gutterF);
  const gutterB = gutterF.clone();
  gutterB.position.z = -(depth * 0.5 + 0.13);
  g.add(gutterB);

  // 4. Stepped tarnished brass cornice eaves under deck
  const cornice = new THREE.Mesh(
    new THREE.BoxGeometry(width + 0.38, 0.11, depth + 0.38),
    mats.brassTrim
  );
  cornice.position.set(0, topY - 0.27, 0);
  cornice.castShadow = true;
  g.add(cornice);

  // Exposed timber rafter corbels along front & back eaves
  const rafterCount = Math.max(3, Math.floor(width / 1.1));
  const rafterGeo = new THREE.BoxGeometry(0.11, 0.14, 0.28);
  for (let i = 0; i < rafterCount; i++) {
    const rx = -width * 0.42 + (i / Math.max(1, rafterCount - 1)) * (width * 0.84);
    for (const side of [-1, 1]) {
      const rafter = new THREE.Mesh(rafterGeo, mats.woodCatwalk);
      rafter.position.set(rx, topY - 0.39, side * (depth * 0.5 + 0.08));
      g.add(rafter);
    }
  }

  // 5. Recessed Venetian arched windows on front/back masonry
  const winW = Math.min(0.68, width * 0.18);
  const winH = 0.92;
  const winPaneGeo = new THREE.BoxGeometry(winW, winH, 0.05);
  const frameGeo = new THREE.BoxGeometry(winW + 0.16, winH + 0.18, 0.1);
  const sillGeo = new THREE.BoxGeometry(winW + 0.24, 0.08, 0.18);
  const archGeo = new THREE.TorusGeometry(winW * 0.5, 0.055, 8, 16, Math.PI);
  const barVGeo = new THREE.BoxGeometry(0.035, winH, 0.07);
  const barHGeo = new THREE.BoxGeometry(winW, 0.035, 0.07);
  const shutterGeo = new THREE.BoxGeometry(0.18, winH + 0.04, 0.05);

  for (const sideX of [-1, 1]) {
    for (const faceZ of [1, -1] as const) {
      if (faceZ === -1 && topY < 3.4) continue;
      const wx = sideX * (width * 0.25);
      if (faceZ === doorSkipFaceZ && Math.abs(wx - doorSkipOffsetX) < doorSkipMargin) {
        continue;
      }
      const wy = topY - 1.5;
      const wz = faceZ * (depth * 0.5 + 0.01);

      const frame = new THREE.Mesh(frameGeo, mats.darkIron);
      frame.position.set(wx, wy, wz);
      g.add(frame);

      const arch = new THREE.Mesh(archGeo, mats.brassTrim);
      arch.position.set(wx, wy + winH * 0.5 + 0.03, wz + faceZ * 0.045);
      g.add(arch);

      const pane = new THREE.Mesh(winPaneGeo, mats.windowGlass);
      pane.position.set(wx, wy, wz + faceZ * 0.032);
      g.add(pane);

      // Louvered weathered wooden shutters flanking each window
      for (const sSide of [-1, 1]) {
        const shutter = new THREE.Mesh(shutterGeo, mats.verdigrisRoof);
        shutter.position.set(wx + sSide * (winW * 0.5 + 0.18), wy, wz + faceZ * 0.04);
        shutter.rotation.y = faceZ * -sSide * 0.18;
        g.add(shutter);
      }

      const barV = new THREE.Mesh(barVGeo, mats.darkIron);
      barV.position.set(wx, wy, wz + faceZ * 0.048);
      g.add(barV);

      const barH = new THREE.Mesh(barHGeo, mats.darkIron);
      barH.position.set(wx, wy + 0.08, wz + faceZ * 0.048);
      g.add(barH);

      const sill = new THREE.Mesh(sillGeo, mats.brassTrim);
      sill.position.set(wx, wy - winH * 0.5 - 0.06, wz + faceZ * 0.05);
      g.add(sill);
    }
  }

  // 6. Pitched Venetian Verdigris Gable Wing + Copper Chimney Stack
  if (withGable) {
    const gableSpan = Math.min(2.3, width * 0.36);
    const gableLen = Math.min(2.8, depth * 0.44);
    const gableH = 1.25;
    const gx = -width * 0.32;
    const gz = -depth * 0.25;

    const dormerBase = new THREE.Mesh(
      new THREE.BoxGeometry(gableSpan * 0.88, 0.45, gableLen * 0.88),
      mats.masonryWall
    );
    dormerBase.position.set(gx, topY + 0.22, gz);
    dormerBase.castShadow = true;
    dormerBase.receiveShadow = true;
    g.add(dormerBase);

    // Organic damp moss tufts creeping along dormer base seam
    const mossOffsets: Array<[number, number, number]> = [
      [0.44, 0.32, 0.09],
      [0.45, 0.14, 0.07],
      [0.41, 0.42, 0.06],
    ];
    for (const [ox, oz, rad] of mossOffsets) {
      const tuft = new THREE.Mesh(new THREE.DodecahedronGeometry(rad, 0), mats.mossFoliage);
      tuft.position.set(gx + gableSpan * ox, topY + rad * 0.45, gz + gableLen * oz);
      tuft.scale.set(1.25, 0.55, 1.35);
      tuft.rotation.y = ox * 3.1;
      g.add(tuft);
    }

    const roofGeo = makePitchedRoofGeometry(gableSpan, gableLen, gableH);
    const pitchedRoof = new THREE.Mesh(roofGeo, mats.verdigrisRoof);
    pitchedRoof.position.set(gx, topY + 0.44, gz);
    pitchedRoof.castShadow = true;
    pitchedRoof.receiveShadow = true;
    g.add(pitchedRoof);

    // Brass circular attic porthole window on front gable face
    const bullseyeRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.22, 0.038, 8, 18),
      mats.brassTrim
    );
    bullseyeRing.position.set(gx, topY + 0.88, gz + gableLen * 0.5 + 0.05);
    g.add(bullseyeRing);

    const bullseyeGlass = new THREE.Mesh(
      new THREE.CircleGeometry(0.19, 16),
      mats.windowGlass
    );
    bullseyeGlass.position.set(gx, topY + 0.88, gz + gableLen * 0.5 + 0.055);
    g.add(bullseyeGlass);

    // Brass ridge cap beam + rooftop finial
    const ridgeBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, gableLen + 0.16, 8),
      mats.brassTrim
    );
    ridgeBeam.rotation.x = Math.PI * 0.5;
    ridgeBeam.position.set(gx, topY + 0.44 + gableH, gz);
    g.add(ridgeBeam);

    // Ornate brick, copper & terracotta chimney stack on opposite rear corner
    const cx = width * 0.34;
    const cz = -depth * 0.34;
    const brickPlinth = new THREE.Mesh(
      new THREE.BoxGeometry(0.56, 0.55, 0.56),
      mats.masonryWall
    );
    brickPlinth.position.set(cx, topY + 0.27, cz);
    brickPlinth.castShadow = true;
    g.add(brickPlinth);

    const flue = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.21, 1.55, 14),
      mats.brassTrim
    );
    flue.position.set(cx, topY + 1.25, cz);
    flue.castShadow = true;
    g.add(flue);

    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.15, 0.24, 12),
      mats.terracottaPot
    );
    pot.position.set(cx, topY + 2.08, cz);
    g.add(pot);

    const collar = new THREE.Mesh(
      new THREE.TorusGeometry(0.19, 0.032, 8, 16),
      mats.darkIron
    );
    collar.rotation.x = Math.PI * 0.5;
    collar.position.set(cx, topY + 1.92, cz);
    g.add(collar);

    const cowl = new THREE.Mesh(
      new THREE.ConeGeometry(0.29, 0.22, 12),
      mats.darkIron
    );
    cowl.position.set(cx, topY + 2.28, cz);
    g.add(cowl);
  }

  // 7. Living rooftop details (terracotta moss planter, weathered crate, brass pressure gauge)
  if (withLivingProps) {
    const potX = width * 0.36;
    const potZ = depth * 0.32;
    const planter = new THREE.Mesh(
      new THREE.BoxGeometry(0.68, 0.28, 0.36),
      mats.terracottaPot
    );
    planter.position.set(potX, topY + 0.14, potZ);
    planter.castShadow = true;
    g.add(planter);

    for (let k = -1; k <= 1; k++) {
      const bush = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.16 - Math.abs(k) * 0.02, 1),
        mats.mossFoliage
      );
      bush.position.set(potX + k * 0.18, topY + 0.31, potZ);
      bush.scale.set(1.1, 0.85, 1.0);
      g.add(bush);
    }

    const crate = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.42, 0.52),
      mats.woodCatwalk
    );
    crate.position.set(-width * 0.34, topY + 0.21, depth * 0.34);
    crate.rotation.y = 0.24;
    crate.castShadow = true;
    crate.receiveShadow = true;
    g.add(crate);

    const crateBand = new THREE.Mesh(
      new THREE.BoxGeometry(0.54, 0.06, 0.54),
      mats.darkIron
    );
    crateBand.position.copy(crate.position);
    crateBand.rotation.copy(crate.rotation);
    g.add(crateBand);
  }

  // 8. Optional wrought-iron rooftop perimeter balustrade along rear edge
  if (withRailing) {
    const railLen = width * 0.72;
    const railZ = -depth * 0.46;
    const topBar = new THREE.Mesh(new THREE.BoxGeometry(railLen, 0.045, 0.045), mats.darkIron);
    topBar.position.set(0, topY + 0.52, railZ);
    g.add(topBar);

    const postCount = 6;
    const postGeo = new THREE.CylinderGeometry(0.025, 0.03, 0.52, 6);
    for (let i = 0; i < postCount; i++) {
      const px = -railLen * 0.5 + (i / (postCount - 1)) * railLen;
      const post = new THREE.Mesh(postGeo, mats.darkIron);
      post.position.set(px, topY + 0.26, railZ);
      g.add(post);
    }
  }

  return g;
}

export function buildLanternPost(mats: WorldMaterialSet, withPointLight = false): THREE.Group {
  const g = new THREE.Group();

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.22, 0.24, 8), mats.darkIron);
  base.position.y = 0.12;
  base.castShadow = true;
  g.add(base);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.025, 8, 12), mats.brassTrim);
  collar.rotation.x = Math.PI * 0.5;
  collar.position.y = 0.25;
  g.add(collar);

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 1.32, 10), mats.darkIron);
  pole.position.y = 0.9;
  pole.castShadow = true;
  g.add(pole);

  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.05, 0.05), mats.brassTrim);
  arm.position.set(0.14, 1.54, 0);
  g.add(arm);

  const brace = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.035, 0.035), mats.darkIron);
  brace.position.set(0.1, 1.42, 0);
  brace.rotation.z = 0.65;
  g.add(brace);

  const lx = 0.28;
  const ly = 1.32;
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 2), mats.lanternGlow);
  core.position.set(lx, ly, 0);
  g.add(core);

  const ribGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.3, 6);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI * 0.25;
    const rib = new THREE.Mesh(ribGeo, mats.darkIron);
    rib.position.set(lx + Math.cos(a) * 0.14, ly, Math.sin(a) * 0.14);
    g.add(rib);
  }

  const hood = new THREE.Mesh(new THREE.ConeGeometry(0.23, 0.2, 8), mats.darkIron);
  hood.position.set(lx, ly + 0.19, 0);
  g.add(hood);

  const finial = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.1, 6), mats.brassTrim);
  finial.position.set(lx, ly + 0.32, 0);
  g.add(finial);

  const haloCone = new THREE.Mesh(
    new THREE.ConeGeometry(1.15, 2.1, 20, 1, true),
    mats.beamMaterial
  );
  haloCone.position.set(lx, ly - 0.92, 0);
  g.add(haloCone);

  if (withPointLight) {
    const pt = new THREE.PointLight('#F4A949', 5.2, 10.5, 1.5);
    pt.position.set(lx, ly - 0.05, 0);
    g.add(pt);
  }

  return g;
}

export function buildClockworkGear(
  radius: number,
  teethCount: number,
  thickness: number,
  mats: WorldMaterialSet
): THREE.Group {
  const g = new THREE.Group();

  const outerRim = new THREE.Mesh(
    new THREE.TorusGeometry(radius, thickness * 0.38, 10, 36),
    mats.brassTrim
  );
  outerRim.castShadow = true;
  g.add(outerRim);

  const innerTrack = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.88, thickness * 0.22, 8, 32),
    mats.darkIron
  );
  g.add(innerTrack);

  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.24, radius * 0.24, thickness * 1.35, 18),
    mats.darkIron
  );
  hub.rotation.x = Math.PI * 0.5;
  hub.castShadow = true;
  g.add(hub);

  const axleCap = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.11, radius * 0.11, thickness * 1.65, 12),
    mats.brassTrim
  );
  axleCap.rotation.x = Math.PI * 0.5;
  g.add(axleCap);

  const spokeGeo = new THREE.BoxGeometry(radius * 1.78, thickness * 0.34, thickness * 0.42);
  for (let i = 0; i < 3; i++) {
    const spoke = new THREE.Mesh(spokeGeo, mats.brassTrim);
    spoke.rotation.z = (i * Math.PI) / 3;
    spoke.castShadow = true;
    g.add(spoke);
  }

  const toothGeo = new THREE.BoxGeometry(radius * 0.15, radius * 0.21, thickness * 0.82);
  for (let i = 0; i < teethCount; i++) {
    const ang = (i / teethCount) * Math.PI * 2;
    const tooth = new THREE.Mesh(toothGeo, mats.brassTrim);
    tooth.position.set(
      Math.cos(ang) * (radius + radius * 0.13),
      Math.sin(ang) * (radius + radius * 0.13),
      0
    );
    tooth.rotation.z = ang + Math.PI * 0.5;
    tooth.castShadow = true;
    g.add(tooth);
  }

  return g;
}

export function buildCopperPipeBridge(
  x1: number,
  y1: number,
  z1: number,
  x2: number,
  y2: number,
  z2: number,
  mats: WorldMaterialSet
): THREE.Group {
  const g = new THREE.Group();
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dz = z2 - z1;
  const len = Math.hypot(dx, dy, dz) + 0.28; // slight overlap at both rooftop edges so zero seam gap

  const pipeGroup = new THREE.Group();
  pipeGroup.position.set((x1 + x2) * 0.5, (y1 + y2) * 0.5 - 0.16, (z1 + z2) * 0.5);
  pipeGroup.lookAt(x2, y2 - 0.16, z2);

  for (const offsetX of [-0.26, 0.26]) {
    const pipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.125, 0.125, len, 12),
      mats.verdigrisRoof
    );
    pipe.rotation.x = Math.PI * 0.5;
    pipe.position.set(offsetX, -0.02, 0);
    pipe.castShadow = true;
    pipe.receiveShadow = true;
    pipeGroup.add(pipe);
  }

  // Solid wider timber plank deck (top surface sits exact y1 -> y2)
  const plank = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.08, len), mats.woodCatwalk);
  plank.position.y = 0.12;
  plank.castShadow = true;
  plank.receiveShadow = true;
  pipeGroup.add(plank);

  // Low brass curb rails & wood cleats for catwalk readability
  for (const curbX of [-0.46, 0.46]) {
    const curb = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, len), mats.brassTrim);
    curb.position.set(curbX, 0.18, 0);
    pipeGroup.add(curb);
  }

  for (const zOff of [-len * 0.42, -len * 0.14, len * 0.14, len * 0.42]) {
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.14, 0.11), mats.brassTrim);
    bracket.position.set(0, 0.02, zOff);
    pipeGroup.add(bracket);
  }

  g.add(pipeGroup);
  return g;
}

export function buildHangingCable(
  start: THREE.Vector3,
  end: THREE.Vector3,
  sag: number,
  mats: WorldMaterialSet
): THREE.Mesh {
  const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  mid.y -= sag;
  const curve = new THREE.CatmullRomCurve3([start, mid, end]);
  const geo = new THREE.TubeGeometry(curve, 16, 0.022, 6, false);
  return new THREE.Mesh(geo, mats.darkIron);
}

export function buildCanalMooringPost(x: number, z: number, height: number, mats: WorldMaterialSet): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, 0, z);

  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.14, height + 1.0, 10),
    mats.woodCatwalk
  );
  post.position.y = height * 0.5 - 0.3;
  post.castShadow = true;
  g.add(post);

  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.16, 10), mats.brassTrim);
  cap.position.y = height + 0.25;
  g.add(cap);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.022, 6, 12), mats.brassTrim);
  ring.rotation.x = Math.PI * 0.5;
  ring.position.y = height * 0.62;
  g.add(ring);

  return g;
}

/**
 * Venetian wooden skiff moored in the canal with brass bow lantern & thwart bench.
 */
export function buildCanalSkiff(mats: WorldMaterialSet): THREE.Group {
  const g = new THREE.Group();

  const hull = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.34, 3.1), mats.woodCatwalk);
  hull.position.y = 0.06;
  hull.castShadow = true;
  hull.receiveShadow = true;
  g.add(hull);

  // Tapered prow & stern peaks
  const prowGeo = new THREE.ConeGeometry(0.52, 1.05, 4);
  prowGeo.rotateY(Math.PI * 0.25);
  prowGeo.rotateX(Math.PI * 0.5);
  const bow = new THREE.Mesh(prowGeo, mats.woodCatwalk);
  bow.scale.set(1.0, 0.65, 1.0);
  bow.position.set(0, 0.09, 2.02);
  g.add(bow);

  const stern = bow.clone();
  stern.rotation.y = Math.PI;
  stern.position.set(0, 0.09, -2.02);
  g.add(stern);

  // Brass gunwale trim + bench seat
  const bench = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.06, 0.34), mats.woodCatwalk);
  bench.position.set(0, 0.24, 0.15);
  g.add(bench);

  const bowCap = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 6, 10), mats.brassTrim);
  bowCap.position.set(0, 0.3, 2.45);
  g.add(bowCap);

  const lanternOrb = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 1), mats.lanternGlow);
  lanternOrb.position.set(0, 0.44, 2.32);
  g.add(lanternOrb);

  return g;
}

/**
 * Distant Venetian clockwork bell-tower (Campanile) framing the misty horizon skyline.
 */
export function buildDistantCampanile(width: number, height: number, mats: WorldMaterialSet): THREE.Group {
  const g = new THREE.Group();

  const shaft = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, width),
    mats.masonryWall
  );
  shaft.position.y = height * 0.5 - 1.5;
  g.add(shaft);

  const belfry = new THREE.Mesh(
    new THREE.BoxGeometry(width * 1.12, width * 0.72, width * 1.12),
    mats.darkIron
  );
  belfry.position.y = height - 1.1;
  g.add(belfry);

  const spire = new THREE.Mesh(
    new THREE.ConeGeometry(width * 0.85, width * 1.9, 4),
    mats.verdigrisRoof
  );
  spire.rotation.y = Math.PI * 0.25;
  spire.position.y = height - 1.1 + width * 1.3;
  g.add(spire);

  // Glowing golden clock dial on tower face
  const clockRim = new THREE.Mesh(new THREE.TorusGeometry(width * 0.32, 0.08, 8, 20), mats.brassTrim);
  clockRim.position.set(0, height - 2.6, width * 0.52);
  g.add(clockRim);

  const clockFace = new THREE.Mesh(new THREE.CircleGeometry(width * 0.28, 18), mats.windowGlass);
  clockFace.position.set(0, height - 2.6, width * 0.53);
  g.add(clockFace);

  return g;
}

/**
 * Stepped Venetian stone canal embankment / flooded cobblestone quay grounding city blocks along the waterway.
 */
export function buildCanalQuayWall(
  width: number,
  length: number,
  quayY: number,
  mats: WorldMaterialSet
): THREE.Group {
  const g = new THREE.Group();

  const body = new THREE.Mesh(new THREE.BoxGeometry(width, quayY + 1.4, length), mats.masonryWall);
  body.position.y = quayY - (quayY + 1.4) * 0.5;
  body.receiveShadow = true;
  g.add(body);

  const deck = new THREE.Mesh(new THREE.BoxGeometry(width + 0.18, 0.16, length + 0.18), mats.slateRoof);
  deck.position.y = quayY - 0.06;
  deck.receiveShadow = true;
  g.add(deck);

  // Partially awash stone steps descending into the canal water
  for (let s = 0; s < 3; s++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(width * 0.72, 0.18, 1.4), mats.masonryWall);
    step.position.set(width * 0.52 - s * 0.16, quayY - 0.14 - s * 0.14, length * 0.18);
    g.add(step);
  }

  // Iron dock bollards along the quay rim
  const bollardCount = Math.max(2, Math.floor(length / 7));
  for (let i = 0; i < bollardCount; i++) {
    const bz = -length * 0.4 + (i / Math.max(1, bollardCount - 1)) * (length * 0.8);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.42, 8), mats.darkIron);
    b.position.set(width * 0.42, quayY + 0.2, bz);
    g.add(b);
  }

  return g;
}

/**
 * Venetian masonry arch bridge connecting canal embankments across the flooded avenue.
 */
export function buildStoneCanalBridge(spanX: number, bridgeY: number, depth: number, mats: WorldMaterialSet): THREE.Group {
  const g = new THREE.Group();

  // Bridge deck
  const deck = new THREE.Mesh(new THREE.BoxGeometry(spanX, 0.34, depth), mats.slateRoof);
  deck.position.y = bridgeY;
  deck.castShadow = true;
  deck.receiveShadow = true;
  g.add(deck);

  // Side masonry piers dipping into canal water
  for (const sx of [-1, 1]) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(1.1, bridgeY + 1.2, depth + 0.2), mats.masonryWall);
    pier.position.set(sx * (spanX * 0.46), bridgeY * 0.5 - 0.4, 0);
    g.add(pier);
  }

  // Twin curved masonry arch ribs tucked cleanly underneath the front & back bridge faces
  const archRadius = spanX * 0.28;
  const archGeo = new THREE.TorusGeometry(archRadius, 0.16, 8, 20, Math.PI);
  for (const sz of [-depth * 0.42, depth * 0.42]) {
    const arch = new THREE.Mesh(archGeo, mats.masonryWall);
    arch.position.set(0, bridgeY - archRadius - 0.16, sz);
    g.add(arch);
  }

  // Parapet side rails
  for (const sz of [-depth * 0.44, depth * 0.44]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(spanX, 0.36, 0.14), mats.darkIron);
    rail.position.set(0, bridgeY + 0.32, sz);
    g.add(rail);
  }

  return g;
}

/**
 * Monumental sunken clockwork aqueduct & hydro-dam wall housing the rotating waterwheels.
 */
export function buildClockworkDamWall(width: number, height: number, mats: WorldMaterialSet): THREE.Group {
  const g = new THREE.Group();

  const wall = new THREE.Mesh(new THREE.BoxGeometry(width, height, 3.6), mats.masonryWall);
  wall.position.y = height * 0.5 - 1.0;
  wall.receiveShadow = true;
  g.add(wall);

  // Coping stone crest + verdigris pediment
  const crest = new THREE.Mesh(new THREE.BoxGeometry(width + 0.5, 0.42, 4.0), mats.slateRoof);
  crest.position.y = height - 0.9;
  g.add(crest);

  // Heavy iron buttress piers supporting clockwork wheel axles
  for (const px of [-4.8, 2.3]) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(1.4, height + 0.6, 4.2), mats.darkIron);
    pier.position.set(px, height * 0.5 - 0.7, 0.2);
    g.add(pier);

    // Tall copper boiler smokestack behind dam
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.54, 4.6, 12), mats.brassTrim);
    stack.position.set(px + 1.6, height + 1.1, -0.4);
    g.add(stack);
  }

  // Warm recessed sluice arches at waterline
  for (let i = -2; i <= 2; i++) {
    const sx = i * 4.4;
    const archVoid = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.6, 0.3), mats.darkIron);
    archVoid.position.set(sx, 1.1, 1.78);
    g.add(archVoid);

    const archTrim = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.14, 8, 16, Math.PI), mats.brassTrim);
    archTrim.position.set(sx, 2.4, 1.84);
    g.add(archTrim);
  }

  return g;
}

/**
 * Partially submerged Venetian storefront awning & half-drowned streetlamp showing the lower city is underwater.
 */
export function buildFloodedShopAwning(mats: WorldMaterialSet): THREE.Group {
  const g = new THREE.Group();

  const canopy = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 1.25), mats.verdigrisRoof);
  canopy.position.set(0, 0.68, 0);
  canopy.rotation.x = 0.34;
  g.add(canopy);

  for (const sx of [-1.05, 1.05]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.08, 8), mats.darkIron);
    pole.position.set(sx, -0.36, 0.54);
    g.add(pole);
  }

  return g;
}

/**
 * Festive Venetian canal bunting cord with alternating triangular cloth pennants that sway in the breeze.
 */
export function buildBuntingLine(
  start: THREE.Vector3,
  end: THREE.Vector3,
  sag: number,
  mats: WorldMaterialSet
): { group: THREE.Group; flags: THREE.Mesh[]; disposedMats: THREE.Material[]; disposedGeos: THREE.BufferGeometry[] } {
  const group = new THREE.Group();
  const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  mid.y -= sag;
  const curve = new THREE.CatmullRomCurve3([start, mid, end]);
  const cordGeo = new THREE.TubeGeometry(curve, 14, 0.015, 5, false);
  group.add(new THREE.Mesh(cordGeo, mats.darkIron));

  const flagShape = new THREE.Shape();
  flagShape.moveTo(-0.14, 0);
  flagShape.lineTo(0.14, 0);
  flagShape.lineTo(0, -0.36);
  flagShape.closePath();
  const flagGeo = new THREE.ShapeGeometry(flagShape);

  const flagColors = ['#D46B43', '#F4A949', '#3F7D70', '#E8D8BE'];
  const flagMats = flagColors.map(
    (hex) =>
      new THREE.MeshStandardMaterial({
        color: hex,
        roughness: 0.78,
        metalness: 0.04,
        side: THREE.DoubleSide,
      })
  );

  const flags: THREE.Mesh[] = [];
  const count = 9;
  const dir = new THREE.Vector3().subVectors(end, start).normalize();
  const yaw = Math.atan2(dir.x, dir.z) + Math.PI * 0.5;
  for (let i = 1; i <= count; i++) {
    const t = i / (count + 1);
    const pt = curve.getPoint(t);
    const mesh = new THREE.Mesh(flagGeo, flagMats[i % flagMats.length]);
    mesh.position.copy(pt);
    mesh.rotation.y = yaw;
    group.add(mesh);
    flags.push(mesh);
  }

  return { group, flags, disposedMats: flagMats, disposedGeos: [cordGeo, flagGeo] };
}

/**
 * Weathered oak harbor wine barrels banded in wrought iron.
 */
export function buildPierBarrels(mats: WorldMaterialSet): THREE.Group {
  const g = new THREE.Group();
  const barrelPositions: Array<[number, number, number]> = [
    [0, 0.34, 0],
    [0.52, 0.34, 0.18],
    [0.24, 0.34, -0.46],
  ];
  const bodyGeo = new THREE.CylinderGeometry(0.22, 0.21, 0.68, 12);
  const hoopGeo = new THREE.TorusGeometry(0.225, 0.018, 6, 14);
  for (const [bx, by, bz] of barrelPositions) {
    const barrel = new THREE.Mesh(bodyGeo, mats.woodCatwalk);
    barrel.position.set(bx, by, bz);
    barrel.castShadow = true;
    barrel.receiveShadow = true;
    g.add(barrel);

    for (const hy of [-0.18, 0.18]) {
      const hoop = new THREE.Mesh(hoopGeo, mats.darkIron);
      hoop.rotation.x = Math.PI * 0.5;
      hoop.position.set(bx, by + hy, bz);
      g.add(hoop);
    }
  }
  return g;
}

/**
 * Venetian terracotta urn planted with lush dawn olive-green foliage.
 */
export function buildOlivePot(mats: WorldMaterialSet): THREE.Group {
  const g = new THREE.Group();
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.18, 0.42, 12), mats.terracottaPot);
  pot.position.y = 0.21;
  pot.castShadow = true;
  g.add(pot);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.032, 6, 14), mats.terracottaPot);
  rim.rotation.x = Math.PI * 0.5;
  rim.position.y = 0.42;
  g.add(rim);

  const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32, 1), mats.mossFoliage);
  crown.position.y = 0.64;
  crown.scale.set(1.05, 1.15, 1.0);
  crown.castShadow = true;
  g.add(crown);
  return g;
}

/**
 * Subtle warm golden dawn sun-shaft beam adding atmospheric depth across canal gaps.
 */
export function buildDawnSunShaft(
  height: number,
  radius: number
): { mesh: THREE.Mesh; geo: THREE.BufferGeometry; mat: THREE.Material } {
  const geo = new THREE.ConeGeometry(radius, height, 18, 1, true);
  const mat = new THREE.MeshBasicMaterial({
    color: '#FFE0AE',
    transparent: true,
    opacity: 0.055,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.z = -0.34;
  mesh.rotation.x = 0.18;
  return { mesh, geo, mat };
}

/**
 * Composite Venetian Harbor Lighthouse anchoring the expanded southern bay breakwater.
 */
export function buildHarborLighthouse(mats: WorldMaterialSet): THREE.Group {
  const g = new THREE.Group();

  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 3.15, 2.4, 8), mats.darkIron);
  plinth.position.y = 1.2;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  g.add(plinth);

  const deck = new THREE.Mesh(new THREE.CylinderGeometry(2.95, 2.95, 0.24, 8), mats.slateRoof);
  deck.position.y = 2.45;
  deck.receiveShadow = true;
  g.add(deck);

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 2.05, 11.2, 12), mats.masonryWall);
  shaft.position.y = 8.1;
  shaft.castShadow = true;
  shaft.receiveShadow = true;
  g.add(shaft);

  const gallery = new THREE.Mesh(new THREE.CylinderGeometry(1.95, 1.55, 0.55, 12), mats.brassTrim);
  gallery.position.y = 13.85;
  g.add(gallery);

  const rail = new THREE.Mesh(new THREE.TorusGeometry(1.88, 0.05, 6, 16), mats.darkIron);
  rail.rotation.x = Math.PI * 0.5;
  rail.position.y = 14.42;
  g.add(rail);

  const lanternGlass = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 1.65, 10), mats.lanternGlow);
  lanternGlass.position.y = 14.9;
  g.add(lanternGlass);

  const cupola = new THREE.Mesh(new THREE.ConeGeometry(1.45, 1.75, 10), mats.verdigrisRoof);
  cupola.position.y = 16.55;
  cupola.castShadow = true;
  g.add(cupola);

  const spire = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.2, 8), mats.brassTrim);
  spire.position.y = 17.9;
  g.add(spire);

  return g;
}

