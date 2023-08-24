varying vec2 vUv;
uniform float uProgress;
// uniform float uForcePower;
// uniform float uEnsuing;
// uniform float uDis;
uniform sampler2D uCurrentPosition;
uniform sampler2D uOrgPos;
uniform sampler2D uOrgPos2;
uniform vec3 mouse;
void main() {
    vec2 position = texture2D( uCurrentPosition, vUv ).xy;
    vec2 original = texture2D( uOrgPos, vUv ).xy;
    vec2 original2 = texture2D( uOrgPos2, vUv ).xy;

    vec2 finalOriginal = mix(original, original2, uProgress);

    vec2 force = finalOriginal - mouse.xy;

    // To make distribution circle smaller instead of all the particles
    float forceFactor = 1./max(1., length(force)*230.);

    // To make it a bit later
    vec2 positionToGo = finalOriginal + normalize(force) * forceFactor * 0.15;

    position += (positionToGo - position.xy) * 0.1;

    // position.xy += normalize(position.xy - mouse.xy) * 0.001;

    gl_FragColor = vec4(position, 0., 1. );
}