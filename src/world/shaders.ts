import * as THREE from 'three';

// Simplex 2D noise GLSL snippet for Paper.design domain warping
const NOISE_GLSL = `
vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
           -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy) );
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
  + i.x + vec3(0.0, i1.x, 1.0 ));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m;
  m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float fbm(vec2 p, float t) {
  float f = 0.0;
  f += 0.5000 * snoise(p + t * 0.1); p *= 2.02;
  f += 0.2500 * snoise(p - t * 0.15); p *= 2.03;
  f += 0.1250 * snoise(p + t * 0.08);
  return f;
}
`;

export function iridescentShellMaterial(baseColor: number, accentColor: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uBaseColor: { value: new THREE.Color(baseColor) },
      uAccentColor: { value: new THREE.Color(accentColor) },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewDir;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewDir = normalize(-mvPosition.xyz);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uBaseColor;
      uniform vec3 uAccentColor;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      varying vec2 vUv;
      
      void main() {
        float fresnel = pow(1.0 - max(dot(vNormal, vViewDir), 0.0), 3.0);
        float shift = sin(vUv.y * 6.28 + uTime * 2.0) * 0.5 + 0.5;
        
        vec3 mixColor = mix(uBaseColor, uAccentColor, fresnel * 0.6 + shift * 0.2);
        vec3 finalColor = mixColor + pow(fresnel, 2.0) * 0.4;
        
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `,
  });
}

export function metallicShellMaterial(baseColor: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uBaseColor: { value: new THREE.Color(baseColor) },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewDir;
      varying vec3 vWorldPos;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        vec4 mvPosition = viewMatrix * worldPos;
        vViewDir = normalize(-mvPosition.xyz);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uBaseColor;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      varying vec3 vWorldPos;
      
      void main() {
        float fresnel = pow(1.0 - max(dot(vNormal, vViewDir), 0.0), 4.0);
        
        vec3 envColor = vec3(0.5, 0.7, 1.0) * max(0.0, vWorldPos.y * 0.5 + 0.5);
        vec3 reflection = envColor * fresnel;
        
        vec3 base = uBaseColor;
        vec3 finalColor = mix(base, reflection, fresnel);
        
        vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
        vec3 halfVector = normalize(lightDir + vViewDir);
        float specular = pow(max(dot(vNormal, halfVector), 0.0), 32.0);
        finalColor += specular * 0.5;
        
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `,
  });
}

export function holographicShellMaterial(baseColor: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uBaseColor: { value: new THREE.Color(baseColor) },
    },
    transparent: true,
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewDir = normalize(-mvPosition.xyz);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uBaseColor;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      
      vec3 hueShift(vec3 color, float hue) {
        const vec3 k = vec3(0.57735, 0.57735, 0.57735);
        float cosAngle = cos(hue);
        return vec3(color * cosAngle + cross(k, color) * sin(hue) + k * dot(k, color) * (1.0 - cosAngle));
      }

      void main() {
        float dotNV = dot(vNormal, vViewDir);
        
        float shift = sin(dotNV * 5.0 + uTime * 3.0);
        vec3 shiftedColor = hueShift(uBaseColor, shift * 3.14);
        
        float scanline = sin(gl_FragCoord.y * 0.5 - uTime * 10.0) * 0.5 + 0.5;
        
        vec3 finalColor = mix(shiftedColor, vec3(1.0), scanline * 0.3);
        float alpha = max(0.3, scanline * 0.8) * (1.0 - max(dotNV, 0.0));
        
        gl_FragColor = vec4(finalColor, alpha);
      }
    `,
  });
}

/** Paper.design inspired organic multi-point mesh gradient sky shader */
export function gradientSkyMaterial(topColor: number, midColor: number, botColor: number): THREE.ShaderMaterial {
  const topC = new THREE.Color(topColor);
  const midC = new THREE.Color(midColor);
  const botC = new THREE.Color(botColor);
  // Accent color derived from mid and top blend
  const accentC = new THREE.Color().lerpColors(midC, topC, 0.5).offsetHSL(0.1, 0.2, 0.1);

  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor1: { value: botC },
      uColor2: { value: midC },
      uColor3: { value: topC },
      uColor4: { value: accentC },
    },
    side: THREE.BackSide,
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPos = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColor1;
      uniform vec3 uColor2;
      uniform vec3 uColor3;
      uniform vec3 uColor4;
      varying vec3 vWorldPos;
      
      ${NOISE_GLSL}
      
      void main() {
        vec2 uv = normalize(vWorldPos).xz * 1.5;
        float h = normalize(vWorldPos).y;
        
        // Paper.design domain-warped mesh gradient
        vec2 q = vec2(fbm(uv + vec2(0.0, 0.0), uTime * 0.3), fbm(uv + vec2(5.2, 1.3), uTime * 0.3));
        vec2 r = vec2(fbm(uv + 3.0 * q + vec2(1.7, 9.2), uTime * 0.2), fbm(uv + 3.0 * q + vec2(8.3, 2.8), uTime * 0.2));
        float noiseVal = fbm(uv + 3.0 * r, uTime * 0.25);
        
        vec3 col = mix(uColor1, uColor2, smoothstep(-0.2, 0.4, h + noiseVal * 0.25));
        col = mix(col, uColor3, smoothstep(0.3, 0.9, h));
        col = mix(col, uColor4, clamp(length(q) * 0.45, 0.0, 0.6) * smoothstep(0.1, 0.8, h));
        
        // Subtle paper grain overlay
        float grain = (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.022;
        col += grain;
        
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

/** Paper.design inspired dynamic organic mesh gradient grass shader */
export function gradientGrassMaterial(centerColor: number, edgeColor: number, boundaryR: number): THREE.ShaderMaterial {
  const centerC = new THREE.Color(centerColor);
  const edgeC = new THREE.Color(edgeColor);
  const accentC = centerC.clone().offsetHSL(0.08, 0.15, 0.08);

  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uCenterColor: { value: centerC },
      uEdgeColor: { value: edgeC },
      uAccentColor: { value: accentC },
      uBoundary: { value: boundaryR },
    },
    vertexShader: `
      varying vec2 vPos;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vPos = worldPos.xz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uCenterColor;
      uniform vec3 uEdgeColor;
      uniform vec3 uAccentColor;
      uniform float uBoundary;
      varying vec2 vPos;
      
      ${NOISE_GLSL}
      
      void main() {
        float d = length(vPos) / uBoundary;
        vec2 st = vPos * 0.08;
        
        // Fluid paper.design style noise warp
        float n = fbm(st + vec2(uTime * 0.08), uTime * 0.15);
        
        vec3 color = mix(uCenterColor, uEdgeColor, smoothstep(0.2, 1.0, d + n * 0.12));
        color = mix(color, uAccentColor, smoothstep(0.6, 1.1, d) * (n * 0.4 + 0.4) * 0.3);
        
        // Dynamic mowed lawn pattern
        float stripe = sin(vPos.y * 2.2 + n * 0.4) * 0.03 + 0.97;
        color *= stripe;
        
        // Paper texture grain
        float grain = (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.018;
        color += grain;
        
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
}

export function glowTrailMaterial(color: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
  });
}
