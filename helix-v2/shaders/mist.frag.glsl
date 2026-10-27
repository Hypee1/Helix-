varying float vA;
varying vec3 vC;
void main(){
  vec2 d = gl_PointCoord - .5;
  float r = length(d);
  if (r > .5 || vA < .003) discard;
  float a = vA * smoothstep(.5, .0, r);
  gl_FragColor = vec4(vC, a);
  #include <encodings_fragment>
}
