# Architecture

Core architecture and subsystems of the Pitch Bugs 3D cricket game.

## Skin System

The skin and theme system defines visual palettes, materials, and stadium colors across different squads.

It is implemented in [[src/config/skins.ts#SKINS]] with storage persistence in [[src/config/skins.ts#loadSkin]] and [[src/config/skins.ts#saveSkin]], and is integrated into the UI in [[src/ui/overlay.ts#Overlay#render]] and game scene rendering in [[src/engine/game.ts#Game#buildTitleScene]].

## Shaders Pipeline

Custom GLSL shaders provide high-fidelity visual effects for characters and stadium environments.

Material factories such as [[src/world/shaders.ts#iridescentShellMaterial]], [[src/world/shaders.ts#metallicShellMaterial]], [[src/world/shaders.ts#holographicShellMaterial]], [[src/world/shaders.ts#gradientSkyMaterial]], and [[src/world/shaders.ts#gradientGrassMaterial]] define dynamic shaders.

## Uncertainty System

The probabilistic uncertainty system replaces deterministic fielding and catch outcomes with realistic drops and miracle catches.

Configured via [[src/config/constants.ts#UNCERTAINTY]], this system introduces drop chances on regulation catches, miracle catches in extended radiuses, and misfield overthrows.

## UI Icons Library

The UI icon library supplies scalable SVG icons for buttons and overlay menus.

The helper function [[src/ui/icons.ts#icon]] renders inline SVG icons across overlay modes and title controls.

## Crowd Craze Animation System

Dynamic stadium crowd animation system that reacts with jumping craze motion, wave patterns, and emissive stadium light flashes when hitting boundary shots.

Implemented in [[src/world/stadium.ts#animateCrowd]] and triggered alongside Web Audio crowd shout synthesizers [[src/audio/audio.ts#AudioEngine#cheerCrazyFour]] and [[src/audio/audio.ts#AudioEngine#cheerCrazySix]].

## Paper.design Shader Gradients

Multi-point organic mesh gradient shaders featuring Simplex noise domain warping and subtle paper texture grain inspired by paper.design.

Shader factories [[src/world/shaders.ts#gradientSkyMaterial]] and [[src/world/shaders.ts#gradientGrassMaterial]] synthesize fluid domain-warped mesh gradients across stadium environments.
