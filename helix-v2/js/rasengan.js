// HELIX · Rasengan (arma leggendaria): sfera di energia con shader GLSL + anelli di vento
import { THREE, SHADERS } from './core.js';

let geo;
export function makeRasengan(r, withLight = false) {
  geo = geo || new THREE.SphereGeometry(1, 40, 28);
  const mk = shell => new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPower: { value: 1 }, uShell: { value: shell } },
    vertexShader: SHADERS['rasengan.vert'], fragmentShader: SHADERS['rasengan.frag'],
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: shell ? THREE.BackSide : THREE.FrontSide
  });
  const g = new THREE.Group();
  const core = new THREE.Mesh(geo, mk(0)); core.scale.setScalar(r);
  const shell = new THREE.Mesh(geo, mk(1)); shell.scale.setScalar(r * 1.28);
  g.add(core, shell);
  const rings = [];
  const ringMat = new THREE.MeshBasicMaterial({ color: '#bfe3ff', transparent: true, opacity: .35, blending: THREE.AdditiveBlending, depthWrite: false });
  for (let i = 0; i < 3; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(r * (1.12 + i * .12), r * .025, 6, 40), ringMat); t.rotation.set(Math.random() * 3, Math.random() * 3, 0); g.add(t); rings.push(t); }
  const light = withLight ? new THREE.PointLight('#6fb4ff', 0, 3, 2) : null; if (light) g.add(light);
  g.renderOrder = 12; g.traverse(o => { o.renderOrder = 12; o.frustumCulled = false; });
  g.userData.update = (t, power = 1) => {
    for (const m of [core, shell]) { m.material.uniforms.uTime.value = t; m.material.uniforms.uPower.value = power; }
    rings.forEach((rg, i) => { rg.rotation.x += .21 + i * .05; rg.rotation.y += .13 - i * .04; rg.material.opacity = .35 * power; });
    core.rotation.y = t * 9; if (light) light.intensity = power * 2.2;
  };
  g.userData.dispose = () => { core.material.dispose(); shell.material.dispose(); rings.forEach(r => r.geometry.dispose()); };
  return g;
}
