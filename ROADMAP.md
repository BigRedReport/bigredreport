# Hoja de ruta de Big Red Report

Lo que falta para la versión final del port, **en bloques, del más rápido y fácil al más largo y difícil**. Se va tachando según se termina.
¿Has visto un fallo? Repórtalo en [Issues](../../issues) o desde la [web](https://bigredreport.github.io/bigredreport/#fallos).

## Hecho hasta ahora
- [x] El juego completo en el navegador: 25 circuitos, 20 vehículos, música del CD y menú original de 1995
- [x] Gráficos modernos: resolución, iluminación y sombras, agua con olas, luces de freno, antialiasing
- [x] Suelo suavizado, humo de neumáticos, polvo flotante y nube al aterrizar; imágenes del menú en HD
- [x] Rivales originales (las carreras grabadas del juego) e IA nueva, en pelotón y con salidas limpias
- [x] Menú nuevo con mando, campeonato, contrarreloj con clasificación online y modo libre
- [x] Pantalla partida hasta 8 jugadores y online sin servidor hasta 12 (chat de texto y de voz)
- [x] Online sólido: reconexión, cambio de anfitrión, expulsar y silenciar, límites del contenido propio
- [x] Escudería: piloto, nombre de equipo, logos del juego, nuevos y propios, color RGB y bocinas
- [x] Cámaras nuevas (también las de televisión del original), modo foto y marcador configurable
- [x] Sonido: mezcla por canales, sonido en 3D, eco en túneles y música propia
- [x] Perfiles, estadísticas y récords; mods básicos (sustituir archivos)
- [x] Juego en 6 idiomas (la web, con traducción automática)
- [x] Web: descargas con contador, noticias, clasificaciones, fallos y comentarios
- [x] Pilotos con cabeza y cuerpo a elegir por separado; logos originales con el color RGB
- [x] Controles a gusto, 21 logros, ayudas de conducción, colores para daltonismo y menús grandes
- [x] Comentarista con más frases, aviso automático de fallos e instalable desde el navegador
- [x] Pantalla de inicio con PRESS START y la portada nueva

## Bloque 1 · Modo libre y diversión (rápido)
- [x] Modo libre + acrobacias en uno: sin cronómetro de vueltas y con un botón que pone una rampa (las marrones de los circuitos de ciudad) pegada al suelo unos metros por delante; una por jugador, solo en este modo
- [x] Desafíos de acrobacias: puntos por saltos, vueltas de campana y aterrizajes
- [x] Pilotos nuevos con el estilo del original: niño y gordo

## Bloque 2 · Nostalgia (rápido-medio)
- [ ] Modo clásico auténtico: resolución, distancia, iluminación, marcador y sonido como en 1995

## Bloque 3 · Ambiente (medio)
- [x] Clima y horas del día: lluvia, niebla, nieve, nublado, amanecer, mediodía, atardecer y noche con faros
- [ ] Efectos modernos: oclusión ambiental y reflejos
- [ ] Motores con mejor sonido (más muestras y transiciones suaves)

## Bloque 4 · Competir (medio)
- [ ] Fantasmas descargables y retos semanales iguales para todos
- [ ] Repeticiones: guardar la carrera, verla con las cámaras de televisión y exportarla a vídeo
- [ ] Modo espectador en online

## Bloque 5 · Mi coche (medio)
- [ ] Editor de decoración: metalizados, vinilos y capas de pegatinas, que se vean en online
- [ ] Garaje con mejoras (motor, ruedas, nitro) pagadas con lo ganado en el campeonato

## Bloque 6 · Social (medio-largo)
- [ ] Amigos, invitaciones y revancha inmediata
- [ ] Ligas y eventos en servidores dedicados

## Bloque 7 · Plataformas (medio-largo)
- [x] Windows y Linux: programa con lanzador (carpeta del juego, opciones, servidor online, donaciones y Jugar)
- [ ] Steam Deck (probar y ajustar controles)
- [ ] Volantes, pedales y cambio de marchas; force feedback si es posible
- [ ] Realidad virtual (Quest, PC VR), junto con la versión de Windows
- [ ] Android: cargar el juego desde un .zip, controles táctiles y app instalable

## Bloque 8 · Modos locos (largo)
- [ ] Modo «Mario Kart»: objetos, misiles, aceite y turbos, también online
- [ ] Daños visuales en los vehículos
- [ ] 79 Modo «Mario Kart / Crazy Kart»: objetos para recoger y usar, como modo aparte
- [ ] 80 Eliminación por tiempo: cada minuto cae el último, hasta que quede uno
- [ ] 81 Bomba caliente: bomba flotante encima del coche con 60 s; se pasa al chocar; si explota, eliminado y pasa al más cercano
- [ ] 82 Policías y cacos: por equipos en mapa abierto, una vida, 5 minutos
- [ ] Modo eliminación: el último en pasar por un checkpoint queda eliminado y gana el último que queda. Según el tamaño del mapa: en los grandes cada X checkpoints; en los pequeños a mitad de vuelta o por vuelta

## Bloque 9 · Creadores (largo)
- [ ] Coches y circuitos nuevos en formatos normales (glTF, OBJ, imagen de alturas), gestor de mods y catálogo
- [ ] Editor de circuitos y generador automático de rutas de IA
- [ ] Documentación de formatos y ejemplos (SDK)
- [ ] Clasificaciones verificadas, separadas entre juego original, con mods y experimental

## Bloque 10 · Física original (lo más difícil)
- [ ] Manejo del juego de 1995 leído del ejecutable original, como opción (ingeniería inversa)
- [ ] Mezclar a gusto: gráficos modernos con física antigua, y al revés

## Lista de pruebas (28 oct 2026)
- [x] Mandos que no respondían en carrera (Vader 4/5, Xbox Elite, 8BitDo…): ahora vale cualquier mando conectado
Fallos y mejoras encontrados probando la 0.13. Se van tachando según se arreglan.

**Menús e interfaz**
- [x] 1 PRESS START lleva directo al menú nuevo
- [x] 2 Un jugador: bola del mundo grande del mapa en vez de la imagen
- [x] 3 El equipo y su color solo se cambian en el perfil, no al elegir mapa
- [x] 4 Un jugador: el piloto sale solo con la cabeza al mostrar equipo y coche
- [x] 5 Texto «Contrareloj»
- [x] 6 Contrarreloj: tu mejor tiempo del mapa en el panel derecho
- [x] 7 Piloto y escudería: un récord por mapa (el mejor de cualquier coche)
- [x] 8 Piloto niño: cabeza un poco más pequeña
- [x] 9 Actualizaciones desde GitHub (lanzador y juego)
- [x] 10 Envío automático de fallos, sin pulsar nada
- [x] 11 Revisar el número de versión según lo avanzado
- [x] 12 Mensajes de saltos más pequeños, sin fondo y arriba
- [x] 13 Minimapa: checkpoints como línea amarilla que cruza la pista
- [x] 14 Cuenta atrás sin recuadro: números negros, gruesos y llamativos
- [x] 15 Quitar el parpadeo negro al empezar la carrera
- [x] 16 Start del mando: la pausa se cierra sola (sobre todo a mucha velocidad)

**Vehículos y jugabilidad**
- [x] 17 Daños del original: progresivos hasta romperse al 100 %
- [x] 18 Modo libre: marcar los vehículos del mapa pero dejar elegir cualquiera
- [x] 19 Modo libre: cambiar de vehículo desde la pausa
- [x] 20 Funciones nuevas activadas por defecto (menos las ayudas de conducción)
- [x] 21 Excavadora y dumper hundidos en el suelo
- [x] 22 Quitanieves (SNOW1) hundida
- [x] 23 Luces de freno con halo de luz (los faros, con el ciclo de día y noche)
- [x] 24 Sombra de los vehículos también apoyados en el suelo
- [x] 25 Buggy lunar: faltan las ruedas del lado derecho
- [x] 26 Jet Car: sin marcas de ruedas; polvo bajo la nave
- [x] 27 Modo libre: turbo infinito
- [x] 28 Color del nitro = color del equipo
- [ ] 29 Garaje (futuro): color del turbo aparte
- [x] 30 Tarjeta del menú principal: logo con sus colores originales
- [x] 31 El recuadro del logo no recibe sombras (monster truck)
- [x] 32 Carteles golpeables: girar por el eje correcto (las plantas y las lanchas ya van bien)
- [x] 33 Bocinas nuevas que no suenan; un solo icono para todas
- [x] 36 Modo libre: segunda rampa tipo half pipe (cruceta →); la original sigue en ←
- [x] 37 Botón de salto moderado (cruceta libre)
- Se conservan tal cual: las rampas actuales (34) y el aplastamiento de ovejas (35)

**Online**
- [x] Partidas en red local (LAN), con las mismas salas que el online
- [x] Monster truck: los bujes de las ruedas no cogían el color RGB
- [x] 38 Modo libre online
- [x] 39 Quitar la elección de coche de Multijugador > Online (se elige en la sala)
- [x] 40 Bola del mundo del mapa bajo el código de invitación
- [x] 72 Clasificaciones online fiables: una sola fuente para juego y web, sin perder tiempos si falla la conexión

**Suelo, cielo y objetos**
- [x] 41 Texturas del suelo en tiras e invertidas; dientes de sierra
- [x] 42 Opción de suelo: bloques originales o suavizado
- [x] 43 RIG1: la bandera de cuadros del suelo levanta los bordes
- [x] 44 RUF1: la bandera de cuadros sale de lado
- [x] 45 Nubes y cielos más realistas (Alemania…)
- [x] 46 Cielo coherente con el clima
- [x] 47 Vallas y carteles flotantes: apoyarlos y seguir la pendiente

**Mapas**
- [x] Corrección general en 0.53: lo que flota se apoya solo en el suelo (y lo que tiene encima baja con ello); carteles y vallas siguen la pendiente; el magenta «de recorte» del original ya no se pinta
- [x] Puentes y pasarelas que flotaban: pilares en las esquinas hasta el suelo o el agua
- [x] 48 WATER1 y 49 WATER2 (India): puentes flotantes (pilares hasta el agua)
- [ ] 50 RUF2 (Egipto): texturas de las pirámides flotando
- [x] 51 Banderas de checkpoint: solo la salida pone START
- [ ] 52 WATER3 (China): casa flotante
- [x] 53–56 DIRT1 (Japón): nubes rosas, arcos rojos flotantes, árboles tumbados, árbol golpeable desmontado
- [x] 57 TEST1: bandera START a ras de suelo
- [ ] 58 SNOW1 (Ártico): montañas flotantes o partidas
- [x] 59–60 CITY4 (Italia): texturas lilas junto a las escaleras y línea lila en la salida
- [ ] 61–63, 66 MOON1/2/3: torres, puentes, carteles, vallas y edificios flotantes; parrilla de salida torcida
- [ ] 64 SNOW2 (Escocia): carteles flotantes y montaña del checkpoint 2 rota
- [x] 65 RUF3 (Francia): muro invisible en el puente rojo; carteles flotantes (ya se pasa por debajo)
- [x] 67 RIG3: cartel START pequeño; árboles flotantes
- [ ] 68 RIG4 (España): piedras amarillas mal colocadas
- [x] 69 CHOPPER1: postes de checkpoint que no llegan al suelo
- [x] 70 CITY1: cuadrados lilas flotando tras los edificios
- [x] 71 DIRT1/2/3: techos transparentes

**Logros**
- [x] 73 Un logro por visitar cada circuito, uno por usar todos los coches, uno por 10 rampas; pantalla partida con 2 jugadores

**Más (repaso)**
- [x] Pausa: entrar al modo foto; cambiar de vehículo con un menú de fotos
- [x] Bocinas sin «(del juego)» y traducidas
- [x] Monster truck: se pinta la carrocería (no la ventana) en todos los circuitos
- [x] Cristales de los vehículos como cristal tintado (antes salían lilas o morados según el circuito)
- [x] Buggy lunar del tamaño correcto al elegir vehículo y con dirección 6×6 (delante y detrás giran al revés)
- [x] Salto con carga más rápido (≈0,7 s y ≈1,5 s)
- [x] Cabezas con el mismo tamaño en el menú y dos cabezas nuevas de mujer
- [x] 83 WATER1: la IA de las lanchas intenta ir por las montañas
- [x] 84 Lanchas: pierden demasiada velocidad al subir rampas
- [x] 85 WATER2: voz «This is wet and wild like me» que se repetía (fallo del juego original)

**Más grandes (después)**
- [ ] 74 Recuperar los efectos originales de derrape, polvo y turbo (de los .ENV del juego)
- [ ] 75 Cámara cenital lejana estilo Micro Machines
- [ ] 76 Interiores originales de los coches (volante, salpicadero)
- [ ] 77 Sprites con más resolución
- [ ] 78 Editor de circuitos al estilo LittleBigPlanet Karting: brochas de terreno, carretera dibujada con waypoints y checkpoints automáticos, biblioteca de objetos, cielo y luz, guardar, probar y volver a editar

## Pendientes
- [ ] Afinar la IA nueva en el primer circuito de Marte (mejorada, sigue algo lenta)

## Depende de material externo
- [ ] Texturas en alta resolución (hay que redibujarlas)
- [ ] Banda sonora remasterizada (si se consigue)
