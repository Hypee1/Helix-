// Sfera di energia rotante: vortice per latitudine, nucleo bianco, alone di Fresnel (blending additivo)
uniform float uTime;
uniform float uPower;
uniform float uShell;
varying vec3 vN;
varying vec3 vV;
varying vec3 vP;
float hash(vec3 p){ p = fract(p*.3183099 + .1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x + p.y + p.z)); }
float noise(vec3 x){
  vec3 i = floor(x), f = fract(x); f = f*f*(3.0 - 2.0*f);
  return mix(mix(mix(hash(i), hash(i+vec3(1,0,0)), f.x), mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x), mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z);
}
void main(){
  vec3 p = normalize(vP);
  float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
  float lat = p.y;
  float ang = atan(p.z, p.x) + uTime*14.0 + lat*6.0;
  float swirl  = pow(abs(sin(ang*5.0 + noise(p*4.0 + uTime*3.0)*4.0)), 6.0);
  float swirl2 = pow(abs(sin(ang*9.0 - uTime*5.0 + lat*10.0)), 12.0);
  float core = pow(1.0 - fres, 3.0);
  vec3 blue = vec3(.12, .42, 1.0), white = vec3(.85, .95, 1.0);
  vec3 col; float a;
  if (uShell > .5) {
    col = blue * 1.7;
    a = (pow(fres, 2.0)*.55 + swirl2*.2*fres) * uPower;
  } else {
    col = mix(blue, white, clamp(core*1.4 + swirl*.6, 0.0, 1.0)) * (1.1 + swirl*1.6);
    a = clamp(.3 + swirl*.6 + core*.8 + fres*.4, 0.0, 1.0) * uPower;
  }
  gl_FragColor = vec4(col * a, a);
}
