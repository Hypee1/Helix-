// Cielo: sfera interna, passa la direzione al fragment
varying vec3 vP;
void main(){
  vP = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
