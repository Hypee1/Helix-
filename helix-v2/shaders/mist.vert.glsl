// Particelle morbide (nebulizzazione di sangue, polvere, fumo, scintille)
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
uniform float uScale;
varying float vA;
varying vec3 vC;
void main(){
  vA = aAlpha; vC = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / max(.05, -mv.z);
  gl_Position = projectionMatrix * mv;
}
