// Sangue: forma irregolare, satelliti nella direzione del getto, colature per gravità,
// ossidazione nel tempo (rosso vivo -> bruno), anello di essiccazione e riflesso bagnato.
uniform float uTime;
uniform vec3 uSunDir, uSunCol, uAmb;
varying vec2 vUv;
varying float vSeed, vBorn, vKind, vAngle;
varying vec3 vN, vWP;
float h1(float n){ return fract(sin(n) * 43758.5453); }
float blob(vec2 p, float s, float rough){
  float a = atan(p.y, p.x), r = length(p);
  float n = .62 + rough * (.13*sin(a*3.0 + s*6.28) + .08*sin(a*7.0 + s*17.0) + .05*sin(a*13.0 + s*5.0) + .03*sin(a*23.0 + s*11.0));
  return 1.0 - smoothstep(n - .04, n + .01, r);
}
void main(){
  float age = uTime - vBorn;
  vec2 p = vUv;
  float ca = cos(vAngle), sa = sin(vAngle);
  vec2 q = vec2(ca*p.x + sa*p.y, -sa*p.x + ca*p.y);
  float a = 0.0, edge = 0.0;
  if (vKind < 0.5) {            // goccia a terra
    a = blob(p, vSeed, 1.0); edge = blob(p*1.15, vSeed, 1.0);
    for (int i = 0; i < 4; i++) { float fi = float(i);
      vec2 c = vec2(h1(vSeed*11.0+fi)-.5, h1(vSeed*23.0+fi)-.5) * 1.5;
      a = max(a, (1.0 - smoothstep(.05, .08, length(p - c))) * step(.4, h1(vSeed*3.0+fi)));
    }
  } else if (vKind < 1.5) {     // schizzo direzionale (muro / pavimento)
    vec2 qs = vec2(q.x*.7 + .15, q.y*1.3);
    a = blob(qs*1.25, vSeed, 1.2); edge = blob(qs*1.4, vSeed, 1.2);
    for (int i = 0; i < 10; i++) { float fi = float(i);
      float d = .35 + h1(vSeed*31.0+fi)*.6;
      float off = (h1(vSeed*17.0+fi) - .5) * .6 * d;
      float rr = .025 + .07*h1(vSeed*7.0+fi)*(1.0 - d*.6);
      vec2 dq = q - vec2(-d, off); dq.x *= .55;
      a = max(a, 1.0 - smoothstep(rr - .01, rr + .005, length(dq)));
    }
    // colature verso il basso (y locale = alto)
    for (int i = 0; i < 3; i++) { float fi = float(i);
      if (h1(vSeed*41.0+fi) < .35) continue;
      float x = (h1(vSeed*5.0+fi) - .5) * .7;
      float len = min(1.0, age*.06) * (.25 + .6*h1(vSeed*9.0+fi));
      float w = .02 + .018*h1(vSeed*3.0+fi);
      float inX = 1.0 - smoothstep(w*.6, w, abs(p.x - x));
      float inY = step(-len - .2, p.y) * step(p.y, -.1);
      float tip = 1.0 - smoothstep(w*.9, w*1.4, length(vec2(p.x - x, p.y + len + .2)));
      a = max(a, max(inX*inY, tip));
    }
  } else {                      // pozza che si allarga sotto un corpo
    a = blob(p, vSeed, .55); edge = blob(p*1.06, vSeed, .55);
  }
  if (a < .02) discard;
  float dryK = smoothstep(6.0, 150.0, age);
  vec3 fresh = vec3(.17, .006, .004), dried = vec3(.045, .009, .006); // lineari: ~#720c0a fresco, ~#3b1210 secco
  vec3 col = mix(fresh, dried, dryK);
  float ring = clamp(a - edge, 0.0, 1.0);
  col *= 1.0 - ring * (.25 + .4*dryK) - .1;
  if (vKind > 1.5) col *= .85 + .15*length(p);   // pozza: centro più profondo
  vec3 N = normalize(vN), V = normalize(cameraPosition - vWP), L = normalize(uSunDir);
  float diff = max(dot(N, L), 0.0);
  vec3 lit = col * (uAmb + uSunCol * diff);
  float wet = 1.0 - dryK * .85;
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), 120.0) * wet * 2.2 + pow(1.0 - max(dot(N, V), 0.0), 5.0) * .2 * wet;
  lit += uSunCol * spec + uAmb * .25 * wet * pow(1.0 - max(dot(N, V), 0.0), 3.0);
  gl_FragColor = vec4(lit, a * .97);
  #include <tonemapping_fragment>
  #include <encodings_fragment>
}
