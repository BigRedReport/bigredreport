# Hoja de ruta de Big Red Report

Lo que falta para la versión final del port, **en orden de prioridad**. Se va tachando según se termina.
¿Has visto un fallo? Repórtalo en [Issues](../../issues) o desde la [web](https://bigredreport.github.io/bigredreport/#fallos).

## Hecho hasta ahora
- [x] El juego completo en el navegador: 25 circuitos, 20 vehículos, música del CD y menú original de 1995
- [x] Gráficos modernos: resolución, iluminación y sombras, agua con olas, luces de freno, antialiasing
- [x] Rivales originales (las carreras grabadas del juego) e IA nueva
- [x] Rivales en pelotón: adelantamientos y choques toda la carrera, sin puesto obligado
- [x] Menú nuevo con mando, campeonato, contrarreloj con clasificación online y modo libre
- [x] Pantalla partida hasta 8 jugadores y online sin servidor hasta 12 (chat de texto y de voz)
- [x] Personalización: piloto, logos (también propios), color RGB y 31 bocinas
- [x] Cámaras nuevas (también las de televisión del original), modo foto y marcador configurable
- [x] Sonido: mezcla por canales, sonido en 3D, eco en túneles y música propia
- [x] Perfiles, estadísticas y récords; mods básicos (sustituir archivos)
- [x] Juego en 6 idiomas: español, inglés, francés, alemán, italiano y portugués (la web, con traducción automática)

## 1. Online más sólido
- [x] Predicción e interpolación mejores de los coches de los demás
- [x] Reconexión automática si se cae alguien
- [x] Migración de anfitrión si el que creó la partida se va
- [x] Expulsar jugadores y bloquear usuarios
- [ ] Límites de tamaño y formato para logos y bocinas propios

## 2. Físicas originales
- [ ] Manejo del juego de 1995 leído del ejecutable original, como opción
- [ ] Modo clásico auténtico: resolución, distancia, iluminación, marcador y sonido como en 1995
- [ ] Mezclar a gusto: gráficos modernos con física antigua, y al revés

## 3. Web y comunidad
- [ ] Contador de descargas (versiones publicadas en Releases)
- [ ] Comentarios en la web (GitHub Discussions)
- [ ] Clasificaciones verificadas, separadas entre juego original, con mods y experimental

## 4. Versión para Windows, Linux y Steam Deck
- [ ] Programa instalable, con servidor online incluido
- [ ] Volantes, pedales y cambio de marchas; force feedback si es posible
- [ ] Publicación en lanzadores de ports (PortMaster, Lutris…)

## 5. Mods de verdad
- [ ] Coches y circuitos completamente nuevos en formatos normales (glTF, OBJ, imagen de alturas)
- [ ] Gestor de mods con perfiles, dependencias y avisos de incompatibilidad
- [ ] Generador automático de rutas de IA para circuitos nuevos
- [ ] Editor de circuitos (controles, rutas, objetos, superficies)
- [ ] Documentación de formatos y ejemplos (SDK)
- [ ] Catálogo comunitario de coches, circuitos, pinturas y sonidos

## 6. Gráficos
- [ ] Suelo suavizado (sin las "placas" cuadradas) y bordes del césped bien unidos
- [ ] Clima y horas del día: lluvia, niebla, amanecer, atardecer
- [ ] Efectos modernos: oclusión ambiental, reflejos, humo de neumáticos, polvo volumétrico
- [ ] Daños visuales en los vehículos
- [ ] Texturas en alta resolución

## 7. Editor de decoración
- [ ] Pintura metalizada, vinilos y varias capas de pegatinas con posición y tamaño
- [ ] Exportar e importar diseños, y que se vean en online

## 8. Modos de juego
- [ ] Modo «Mario Kart»: objetos, misiles, aceite y turbos, también online
- [ ] Acrobacias y desafíos
- [ ] Fantasmas descargables
- [ ] Retos semanales iguales para todos

## 9. Social
- [ ] Amigos, grupos e invitaciones; revancha inmediata
- [ ] Ligas y eventos en servidores dedicados

## 10. Sonido
- [ ] Motores mejorados (más muestras y transiciones suaves)
- [ ] Banda sonora remasterizada (si se consigue)

## 11. Realidad virtual
- [ ] Jugar con gafas de realidad virtual desde el navegador (WebXR: Quest, PC VR), cabina con vista 3D real

## 12. Android
- [ ] Cargar los archivos del juego en el móvil (el navegador de Android no deja elegir carpetas: con un .zip de la carpeta BIGRED o con una app)
- [ ] Controles táctiles en pantalla (y mando Bluetooth)
- [ ] App instalable (PWA o APK) que recuerde los archivos del juego
- Viable: el juego ya funciona en el navegador; lo más difícil es el rendimiento en móviles modestos

## Pendientes de comprobar o pequeños
- [ ] La IA nueva en el primer circuito de Marte sigue lenta
- [ ] Pantalla partida de 5 a 8 jugadores en pantallas grandes
