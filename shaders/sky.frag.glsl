// Cielo: gradiente zenit/orizzonte + disco solare + leggera foschia di Mie
uniform vec3 top, hor, sun, sunCol;
uniform float cloud, time;
varying vec3 vP;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float a = .5, s = 0.0; for(int i = 0; i < 5; i++){ s += a*n2(p); p *= 2.03; a *= .5; } return s; }
void main(){
  float hgt = max(vP.y, 0.0);
  vec3 c = mix(hor, top, pow(hgt, .55));
  float s = max(dot(vP, normalize(sun)), 0.0);
  c += sunCol * (pow(s, 600.0) * 4.0 + pow(s, 8.0) * .35);
  // nuvole procedurali (solo sopra l'orizzonte)
  if (vP.y > 0.02 && cloud > 0.0) {
    vec2 uv = vP.xz / (vP.y + .15) * 1.4 + vec2(time * .004, 0.0);
    float cl = smoothstep(.48, .8, fbm(uv)) * cloud * smoothstep(.02, .25, vP.y);
    c = mix(c, mix(vec3(1.0), sunCol, .25) * (.75 + .35 * s), cl * .8);
  }
  if (vP.y < 0.0) c = hor * .6;
  gl_FragColor = vec4(c, 1.0);
}
