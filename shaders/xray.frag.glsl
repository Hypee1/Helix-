// Guscio "raggi X" del corpo nella killcam del cecchino
uniform vec3 uCol;
uniform float uOp;
varying vec3 vN;
varying vec3 vV;
varying vec3 vP;
void main(){
  float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.5);
  gl_FragColor = vec4(uCol * (.2 + f*1.4) * uOp, (.06 + f*.7) * uOp);
}
