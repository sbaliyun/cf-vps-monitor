// ---------------------------------------------------------------------------
// Height fog with sun in-scattering. Overrides three.js fog chunks globally so
// every built-in material (and any ShaderMaterial that includes the fog chunks
// and has `vec4 mvPosition` in scope) gets the same atmospheric fog.
// ---------------------------------------------------------------------------
(() => {
  const v3 = v => `vec3(${v.x.toFixed(4)}, ${v.y.toFixed(4)}, ${v.z.toFixed(4)})`;
  const c3 = c => `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`;
  THREE.ShaderChunk.fog_pars_vertex = /* glsl */`
#ifdef USE_FOG
  varying vec3 vFogWorldPos;
#endif`;
  THREE.ShaderChunk.fog_vertex = /* glsl */`
#ifdef USE_FOG
  vFogWorldPos = transpose(mat3(viewMatrix)) * (mvPosition.xyz - viewMatrix[3].xyz);
#endif`;
  THREE.ShaderChunk.fog_pars_fragment = /* glsl */`
#ifdef USE_FOG
  uniform vec3 fogColor;
  varying vec3 vFogWorldPos;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear;
    uniform float fogFar;
  #endif
  vec3 applyWorldFog(vec3 col, vec3 wp) {
    vec3 ray = wp - cameraPosition;
    float dist = length(ray);
    #ifdef FOG_EXP2
      float dens = fogDensity;
    #else
      float dens = 2.0 / max(fogFar, 1.0);
    #endif
    float hf = ${CONFIG.FOG_FALLOFF.toFixed(4)};
    float y0 = cameraPosition.y - ${CONFIG.FOG_BASE.toFixed(3)};
    float dy = ray.y;
    float e0 = exp(-hf * max(y0, -20.0));
    float integ = abs(dy) > 0.05 ? (e0 - exp(-hf * max(y0 + dy, -20.0))) / (hf * dy) : e0;
    float amt = 1.0 - exp(-dens * dist * (0.35 + 1.4 * integ));
    vec3 dir = ray / max(dist, 1e-3);
    float sunAmt = pow(max(dot(dir, ${v3(CONFIG.SUN_DIR)}), 0.0), 6.0);
    vec3 fc = mix(fogColor, ${c3(CONFIG.FOG_SUN_COLOR)}, sunAmt * 0.85);
    return mix(col, fc, clamp(amt, 0.0, 1.0));
  }
#endif`;
  THREE.ShaderChunk.fog_fragment = /* glsl */`
#ifdef USE_FOG
  gl_FragColor.rgb = applyWorldFog(gl_FragColor.rgb, vFogWorldPos);
#endif`;
})();
