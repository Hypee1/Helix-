// Decal di sangue (gocce, pozze, schizzi su muri) — istanziato
attribute float aSeed;
attribute float aBorn;
attribute float aKind;
attribute float aAngle;
varying vec2 vUv;
varying float vSeed, vBorn, vKind, vAngle;
varying vec3 vN, vWP;
void main(){
  vUv = uv * 2.0 - 1.0;
  vSeed = aSeed; vBorn = aBorn; vKind = aKind; vAngle = aAngle;
  mat4 m = modelMatrix;
  #ifdef USE_INSTANCING
    m = modelMatrix * instanceMatrix;
  #endif
  vec4 wp = m * vec4(position, 1.0);
  vWP = wp.xyz;
  vN = normalize(mat3(m) * vec3(0.0, 0.0, 1.0));
  gl_Position = projectionMatrix * viewMatrix * wp;
}
