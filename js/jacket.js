import * as THREE from 'three';
import { watchQuality } from './quality.js';
import { buildSheetModel } from './sheet3d.js';

function softShadow() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 8, 128, 128, 128);
  g.addColorStop(0, 'rgba(0,0,0,.55)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 0.6),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }),
  );
  mesh.rotation.x = -Math.PI / 2.3;
  return mesh;
}

function buildSnow(count) {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions.set([(Math.random() - 0.5) * 11, Math.random() * 8, (Math.random() - 0.5) * 5 + 0.3], i * 3);
    seeds[i] = Math.random();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: { value: 0 }, uAmount: { value: 0 }, uWind: { value: 0 }, uPixel: { value: 1 } },
    vertexShader: `
      attribute float aSeed;
      uniform float uTime, uAmount, uWind, uPixel;
      varying float vA;
      void main() {
        vec3 p = position;
        float fall = uTime * (.25 + aSeed * .5);
        p.y = mod(p.y - fall, 8.) - 4.;
        p.x = mod(p.x + uWind * uTime * (.6 + aSeed) + sin(uTime + aSeed * 30.) * .12 + 5.5, 11.) - 5.5;
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (2.2 + aSeed * aSeed * 7.) * uPixel * (7. / -mv.z);
        vA = step(aSeed, uAmount) * (.45 + aSeed * .5);
      }`,
    fragmentShader: `
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - .5);
        gl_FragColor = vec4(1., 1., 1., smoothstep(.5, .2, d) * vA);
      }`,
  });
  return new THREE.Points(g, material);
}

export function createJacket(canvas, { isSmall }) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  const pixelRatio = Math.min(window.devicePixelRatio, isSmall ? 1.5 : 2);
  renderer.setPixelRatio(pixelRatio);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);

  const jacket = new THREE.Group();
  scene.add(jacket);

  // The jacket is shaped from the turnaround sheet, and only its colour changes
  const tint = new THREE.Color(0xee6a0c);
  let material = null;
  buildSheetModel({
    src: 'assets/img/C-05.webp', sideFacesRight: true, power: 2.3, limbDepth: 1, step: isSmall ? 0.03 : 0.022,
  }).then((model) => {
    material = model.material;
    material.uniforms.uTint.value = tint;
    material.uniforms.uRecolor.value = 1;
    material.uniforms.uGloss.value = 0.12;
    jacket.add(model.mesh);
  });

  const shadow = softShadow();
  scene.add(shadow);

  const snow = buildSnow(isSmall ? 700 : 1500);
  snow.material.uniforms.uPixel.value = pixelRatio;
  scene.add(snow);

  const state = {
    x: 0, y: 0, rotY: 0, rotX: 0, camZ: 6.6, inflate: 1, snow: 0, wind: 0.1, shadow: 1,
  };
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  window.addEventListener('pointermove', (e) => {
    pointer.x = e.clientX / window.innerWidth - 0.5;
    pointer.y = e.clientY / window.innerHeight - 0.5;
  }, { passive: true });

  const resize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);
  resize();
  watchQuality(renderer, resize);

  let windTime = 0;
  let lastTime = 0;

  function frame(time) {
    pointer.sx += (pointer.x - pointer.sx) * 0.06;
    pointer.sy += (pointer.y - pointer.sy) * 0.06;
    // Deflated, the surface sinks in and gets flatter
    if (material) material.uniforms.uInflate.value = (state.inflate - 1) * 0.1;
    jacket.scale.set(0.9 + state.inflate * 0.1, 0.96 + state.inflate * 0.04, 0.7 + state.inflate * 0.3);

    jacket.position.set(state.x, state.y + Math.sin(time * 0.9) * 0.02, 0);
    jacket.rotation.set(state.rotX + pointer.sy * 0.12, state.rotY + pointer.sx * 0.45, Math.sin(time * 0.6) * 0.008);
    shadow.position.set(state.x, state.y - 1.08, 0.2);
    shadow.material.opacity = state.shadow;
    shadow.visible = state.shadow > 0.01;

    windTime += (time - lastTime) * state.wind;
    lastTime = time;
    const u = snow.material.uniforms;
    u.uTime.value = time;
    u.uAmount.value = state.snow;
    u.uWind.value = windTime / Math.max(time, 1);
    snow.visible = state.snow > 0.01;

    camera.position.z = state.camZ;
    renderer.render(scene, camera);
  }

  return { state, frame, tint };
}
