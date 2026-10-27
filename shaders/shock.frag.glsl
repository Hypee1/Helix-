// Onda d'urto / lampo (sfera in espansione, additiva)
uniform float uT;
uniform vec3 uCol;
varying vec3 vN;
varying vec3 vV;
varying vec3 vP;
void main(){
  float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 3.0);
  float a = f * (1.0 - uT) * (1.0 - uT);
  gl_FragColor = vec4(uCol * a, a);
}
