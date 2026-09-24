// ---------------------------------------------------------------------------
// Global configuration shared by every module
// ---------------------------------------------------------------------------
const CONFIG = {
  // direction TOWARDS the sun (late afternoon, low in the north-west, behind the temple)
  SUN_DIR: new THREE.Vector3(-0.42, 0.30, -0.86).normalize(),
  SUN_COLOR: new THREE.Color(1.0, 0.78, 0.55),
  FOG_COLOR: new THREE.Color(0.50, 0.50, 0.50),
  FOG_SUN_COLOR: new THREE.Color(1.0, 0.72, 0.45),
  FOG_DENSITY: 0.0048,
  FOG_BASE: 0.0,          // world height where height-fog is densest
  FOG_FALLOFF: 0.045,     // height falloff of the fog
  WORLD_SIZE: 400,        // terrain spans [-200, 200] on x and z
};
