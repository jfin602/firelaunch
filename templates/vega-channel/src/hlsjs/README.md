# Vega adaptive HLS source

`hls.mjs` is Hls.js 1.5.11 (upstream commit `61dd3f5e792421080ce21bb0ce5edc2943b0f16f`)
with Amazon's Vega `v1.5.11-r1.7` patch set. The patch archive was downloaded
from `https://amzndevresources.com/vega/media-player/hls-rel-v1.5.11-r1.7-devices_scope.tar.gz`
(SHA-256 `cc652c54357e071a2a9af9031bc8963e6c4ef3b234f7e729e411c7bf43a1e44e`),
applied to the upstream tag, then built with `npm run build`. The resulting
`hls.mjs` has SHA-256 `d954fa4cbb8555695ada1fb846b9577dda9e4ea916eeca8274cabcc137760ed1`
after removing the upstream source-map reference and trailing whitespace.
`LICENSE-hlsjs.txt` is the upstream license. The five `polyfills` files come
from the same Amazon archive and retain their notices.

The adapter selects MSE with workers and DRM disabled for approved free HLS.
The source is bundled into each generated project, so creator export remains
an ordinary self-contained source tree. This build of the player was checked
with Vega CLI 1.4.4 / SDK 0.24.12112; actual playback still requires P4 device
qualification.
