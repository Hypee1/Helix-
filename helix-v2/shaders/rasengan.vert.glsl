// Vertex condiviso: Rasengan, guscio raggi-X, onda d'urto
varying vec3 vN;
varying vec3 vV;
varying vec3 vP;
void main(){
  vP = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
