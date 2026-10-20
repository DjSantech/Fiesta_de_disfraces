# Créditos de recursos de terceros

## Susto al entrar (`frontend/public/susto/`)

| Archivo | Origen | Licencia |
|---|---|---|
| `cara.jpg` | Fotograma de *Nosferatu* (F. W. Murnau, 1922) con Max Schreck como el conde Orlok. Archivo Spaarnestad (SFA008003709), vía Wikimedia Commons: [Film Nosferatu (van F, SFA008003709.jpg](https://commons.wikimedia.org/wiki/File:Film_Nosferatu_(van_F,_SFA008003709.jpg) | Dominio público |
| `grito.mp3` | Mezcla de dos grabaciones: [Demonic Woman Scream](https://freesound.org/people/nick121087/sounds/333832/) de nick121087 y [ahhh](https://commons.wikimedia.org/wiki/File:UncleSigmund_-_ahhh_(cc0)_(freesound).mp3) de UncleSigmund (Freesound, vía Wikimedia Commons) | CC0 1.0 |

Cómo se procesaron (ffmpeg):

- **cara.jpg**: recorte cuadrado de 1000 px sobre la cara (x 680, y 0 del original de 2539×3587), escala de grises, caída radial que oscurece el cielo alrededor de la cabeza, curva de contraste y un poco de enfoque. El tinte rojo, los ojos encendidos y el glitch se hacen en el navegador (`Jumpscare.jsx`).
- **grito.mp3**: grito demoníaco desde 0,35 s (para que arranque a todo volumen) + "ahhh" al 45 % + un golpe grave sintetizado al inicio; compresión fuerte y limitador a −1 dBFS. 2,2 s, mono, 96 kbps (≈ 27 KB).
