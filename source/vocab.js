// Word decks. Nouns carry their article so gender is learned with the word.
//
// Each deck has three stages of increasing difficulty. Stage 1 of every original
// deck is the 120-word set the app shipped with — the Spanish text is the
// progress key, so those cards keep their history from before stages existed.
// Never rewrite an `es` string that has shipped: it silently orphans progress.

export const STAGE_NAMES = ['Basics', 'Everyday', 'Fluent'];
export const STAGE_COUNT = STAGE_NAMES.length;
export const ALL_DECK_ID = 'todos';

export const DECKS = [
  {
    id: 'comida',
    name: 'Food',
    emoji: '🍎',
    stages: [
      [
        { es: 'la manzana', en: 'apple' },
        { es: 'el pan', en: 'bread' },
        { es: 'el queso', en: 'cheese' },
        { es: 'la leche', en: 'milk' },
        { es: 'el huevo', en: 'egg' },
        { es: 'el pollo', en: 'chicken' },
        { es: 'el arroz', en: 'rice' },
        { es: 'la fresa', en: 'strawberry' },
        { es: 'la naranja', en: 'orange' },
        { es: 'el pescado', en: 'fish' },
        { es: 'la sal', en: 'salt' },
        { es: 'el azúcar', en: 'sugar' },
        { es: 'la cebolla', en: 'onion' },
        { es: 'el ajo', en: 'garlic' },
        { es: 'la sandía', en: 'watermelon' }
      ],
      [
        { es: 'la carne', en: 'meat' },
        { es: 'la sopa', en: 'soup' },
        { es: 'la ensalada', en: 'salad' },
        { es: 'el postre', en: 'dessert' },
        { es: 'la mantequilla', en: 'butter' },
        { es: 'el aceite', en: 'oil' },
        { es: 'el jamón', en: 'ham' },
        { es: 'la galleta', en: 'biscuit' },
        { es: 'el helado', en: 'ice cream' },
        { es: 'el limón', en: 'lemon' },
        { es: 'la uva', en: 'grape' },
        { es: 'la pera', en: 'pear' },
        { es: 'el tomate', en: 'tomato' },
        { es: 'la patata', en: 'potato' },
        { es: 'el pastel', en: 'cake' }
      ],
      [
        { es: 'el aguacate', en: 'avocado' },
        { es: 'la zanahoria', en: 'carrot' },
        { es: 'la lechuga', en: 'lettuce' },
        { es: 'el pepino', en: 'cucumber' },
        { es: 'la calabaza', en: 'pumpkin' },
        { es: 'el champiñón', en: 'mushroom' },
        { es: 'la harina', en: 'flour' },
        { es: 'el desayuno', en: 'breakfast' },
        { es: 'el almuerzo', en: 'lunch' },
        { es: 'la cena', en: 'dinner' },
        { es: 'el sabor', en: 'flavour' },
        { es: 'la receta', en: 'recipe' },
        { es: 'la ternera', en: 'veal' },
        { es: 'el trigo', en: 'wheat' },
        { es: 'la miel', en: 'honey' }
      ]
    ]
  },
  {
    id: 'animales',
    name: 'Animals',
    emoji: '🦊',
    stages: [
      [
        { es: 'el perro', en: 'dog' },
        { es: 'el gato', en: 'cat' },
        { es: 'el caballo', en: 'horse' },
        { es: 'el pájaro', en: 'bird' },
        { es: 'la vaca', en: 'cow' },
        { es: 'el cerdo', en: 'pig' },
        { es: 'la oveja', en: 'sheep' },
        { es: 'el conejo', en: 'rabbit' },
        { es: 'el ratón', en: 'mouse' },
        { es: 'la araña', en: 'spider' },
        { es: 'el oso', en: 'bear' },
        { es: 'el zorro', en: 'fox' },
        { es: 'la tortuga', en: 'turtle' },
        { es: 'la ballena', en: 'whale' },
        { es: 'el murciélago', en: 'bat' }
      ],
      [
        { es: 'el león', en: 'lion' },
        { es: 'el tigre', en: 'tiger' },
        { es: 'el elefante', en: 'elephant' },
        { es: 'el mono', en: 'monkey' },
        { es: 'la serpiente', en: 'snake' },
        { es: 'la abeja', en: 'bee' },
        { es: 'la mariposa', en: 'butterfly' },
        { es: 'el pato', en: 'duck' },
        { es: 'la gallina', en: 'hen' },
        { es: 'el burro', en: 'donkey' },
        { es: 'la rana', en: 'frog' },
        { es: 'el lobo', en: 'wolf' },
        { es: 'la cabra', en: 'goat' },
        { es: 'el gallo', en: 'rooster' },
        { es: 'la mosca', en: 'housefly' }
      ],
      [
        { es: 'el cocodrilo', en: 'crocodile' },
        { es: 'la jirafa', en: 'giraffe' },
        { es: 'el camello', en: 'camel' },
        { es: 'el delfín', en: 'dolphin' },
        { es: 'el tiburón', en: 'shark' },
        { es: 'el águila', en: 'eagle' },
        { es: 'el búho', en: 'owl' },
        { es: 'la hormiga', en: 'ant' },
        { es: 'el escarabajo', en: 'beetle' },
        { es: 'la ardilla', en: 'squirrel' },
        { es: 'el erizo', en: 'hedgehog' },
        { es: 'la foca', en: 'seal' },
        { es: 'el pingüino', en: 'penguin' },
        { es: 'el caracol', en: 'snail' },
        { es: 'la garra', en: 'claw' }
      ]
    ]
  },
  {
    id: 'casa',
    name: 'The Home',
    emoji: '🏠',
    stages: [
      [
        { es: 'la casa', en: 'house' },
        { es: 'la puerta', en: 'door' },
        { es: 'la ventana', en: 'window' },
        { es: 'la cocina', en: 'kitchen' },
        { es: 'el baño', en: 'bathroom' },
        { es: 'la cama', en: 'bed' },
        { es: 'la silla', en: 'chair' },
        { es: 'la mesa', en: 'table' },
        { es: 'el techo', en: 'roof' },
        { es: 'la llave', en: 'key' },
        { es: 'el espejo', en: 'mirror' },
        { es: 'la escalera', en: 'stairs' },
        { es: 'el jardín', en: 'garden' },
        { es: 'la almohada', en: 'pillow' },
        { es: 'el cajón', en: 'drawer' }
      ],
      [
        { es: 'el suelo', en: 'floor' },
        { es: 'la pared', en: 'wall' },
        { es: 'el sofá', en: 'sofa' },
        { es: 'la lámpara', en: 'lamp' },
        { es: 'la nevera', en: 'fridge' },
        { es: 'el horno', en: 'oven' },
        { es: 'el plato', en: 'plate' },
        { es: 'el vaso', en: 'drinking glass' },
        { es: 'la taza', en: 'cup' },
        { es: 'el cuchillo', en: 'knife' },
        { es: 'el tenedor', en: 'fork' },
        { es: 'la cuchara', en: 'spoon' },
        { es: 'la toalla', en: 'towel' },
        { es: 'el jabón', en: 'soap' },
        { es: 'la manta', en: 'blanket' }
      ],
      [
        { es: 'el pasillo', en: 'hallway' },
        { es: 'el sótano', en: 'basement' },
        { es: 'el desván', en: 'attic' },
        { es: 'la chimenea', en: 'fireplace' },
        { es: 'el enchufe', en: 'plug' },
        { es: 'la bombilla', en: 'light bulb' },
        { es: 'el grifo', en: 'tap' },
        { es: 'el fregadero', en: 'sink' },
        { es: 'la cortina', en: 'curtain' },
        { es: 'la alfombra', en: 'rug' },
        { es: 'el armario', en: 'wardrobe' },
        { es: 'el estante', en: 'shelf' },
        { es: 'la basura', en: 'rubbish' },
        { es: 'la cerradura', en: 'lock' },
        { es: 'el timbre', en: 'doorbell' }
      ]
    ]
  },
  {
    id: 'verbos',
    name: 'Verbs',
    emoji: '🏃',
    stages: [
      [
        { es: 'hablar', en: 'to speak' },
        { es: 'comer', en: 'to eat' },
        { es: 'beber', en: 'to drink' },
        { es: 'vivir', en: 'to live' },
        { es: 'correr', en: 'to run' },
        { es: 'dormir', en: 'to sleep' },
        { es: 'escribir', en: 'to write' },
        { es: 'leer', en: 'to read' },
        { es: 'comprar', en: 'to buy' },
        { es: 'trabajar', en: 'to work' },
        { es: 'salir', en: 'to leave' },
        { es: 'venir', en: 'to come' },
        { es: 'pensar', en: 'to think' },
        { es: 'entender', en: 'to understand' },
        { es: 'olvidar', en: 'to forget' }
      ],
      [
        { es: 'abrir', en: 'to open' },
        { es: 'cerrar', en: 'to close' },
        { es: 'empezar', en: 'to begin' },
        { es: 'terminar', en: 'to finish' },
        { es: 'llegar', en: 'to arrive' },
        { es: 'llevar', en: 'to carry' },
        { es: 'traer', en: 'to bring' },
        { es: 'pedir', en: 'to ask for' },
        { es: 'responder', en: 'to answer' },
        { es: 'buscar', en: 'to look for' },
        { es: 'encontrar', en: 'to find' },
        { es: 'perder', en: 'to lose' },
        { es: 'ganar', en: 'to win' },
        { es: 'jugar', en: 'to play' },
        { es: 'cantar', en: 'to sing' }
      ],
      [
        { es: 'construir', en: 'to build' },
        { es: 'romper', en: 'to break' },
        { es: 'crecer', en: 'to grow' },
        { es: 'elegir', en: 'to choose' },
        { es: 'prometer', en: 'to promise' },
        { es: 'mentir', en: 'to tell a lie' },
        { es: 'soñar', en: 'to dream' },
        { es: 'reír', en: 'to laugh' },
        { es: 'llorar', en: 'to cry' },
        { es: 'conseguir', en: 'to obtain' },
        { es: 'devolver', en: 'to give back' },
        { es: 'apagar', en: 'to turn off' },
        { es: 'encender', en: 'to turn on' },
        { es: 'avisar', en: 'to warn' },
        { es: 'lograr', en: 'to achieve' }
      ]
    ]
  },
  {
    id: 'viajes',
    name: 'Travel',
    emoji: '✈️',
    stages: [
      [
        { es: 'el aeropuerto', en: 'airport' },
        { es: 'el tren', en: 'train' },
        { es: 'el billete', en: 'ticket' },
        { es: 'la maleta', en: 'suitcase' },
        { es: 'el mapa', en: 'map' },
        { es: 'la playa', en: 'beach' },
        { es: 'el hotel', en: 'hotel' },
        { es: 'la calle', en: 'street' },
        { es: 'el puente', en: 'bridge' },
        { es: 'la ciudad', en: 'city' },
        { es: 'el pueblo', en: 'village' },
        { es: 'el viaje', en: 'trip' },
        { es: 'la frontera', en: 'border' },
        { es: 'el equipaje', en: 'luggage' },
        { es: 'la carretera', en: 'highway' }
      ],
      [
        { es: 'el avión', en: 'aeroplane' },
        { es: 'el barco', en: 'ship' },
        { es: 'el coche', en: 'car' },
        { es: 'el autobús', en: 'bus' },
        { es: 'la estación', en: 'station' },
        { es: 'el pasaporte', en: 'passport' },
        { es: 'la aduana', en: 'customs' },
        { es: 'el vuelo', en: 'flight' },
        { es: 'la llegada', en: 'arrival' },
        { es: 'la salida', en: 'departure' },
        { es: 'el asiento', en: 'seat' },
        { es: 'la reserva', en: 'booking' },
        { es: 'el destino', en: 'destination' },
        { es: 'la isla', en: 'island' },
        { es: 'el sendero', en: 'trail' }
      ],
      [
        { es: 'el crucero', en: 'cruise' },
        { es: 'la brújula', en: 'compass' },
        { es: 'el itinerario', en: 'itinerary' },
        { es: 'la escala', en: 'layover' },
        { es: 'el andén', en: 'platform' },
        { es: 'el peaje', en: 'toll' },
        { es: 'la mochila', en: 'backpack' },
        { es: 'el albergue', en: 'hostel' },
        { es: 'la aventura', en: 'adventure' },
        { es: 'el paisaje', en: 'landscape' },
        { es: 'la cumbre', en: 'summit' },
        { es: 'el desvío', en: 'detour' },
        { es: 'la travesía', en: 'crossing' },
        { es: 'el guía', en: 'tour guide' },
        { es: 'el retraso', en: 'delay' }
      ]
    ]
  },
  {
    id: 'cuerpo',
    name: 'The Body',
    emoji: '🖐️',
    stages: [
      [
        { es: 'la cabeza', en: 'head' },
        { es: 'la mano', en: 'hand' },
        { es: 'el pie', en: 'foot' },
        { es: 'el ojo', en: 'eye' },
        { es: 'la boca', en: 'mouth' },
        { es: 'la nariz', en: 'nose' },
        { es: 'la oreja', en: 'ear' },
        { es: 'el brazo', en: 'arm' },
        { es: 'la pierna', en: 'leg' },
        { es: 'el corazón', en: 'heart' },
        { es: 'el dedo', en: 'finger' },
        { es: 'la espalda', en: 'back' },
        { es: 'el hombro', en: 'shoulder' },
        { es: 'la rodilla', en: 'knee' },
        { es: 'el pelo', en: 'hair' }
      ],
      [
        { es: 'la cara', en: 'face' },
        { es: 'el cuello', en: 'neck' },
        { es: 'el diente', en: 'tooth' },
        { es: 'la lengua', en: 'tongue' },
        { es: 'el labio', en: 'lip' },
        { es: 'la ceja', en: 'eyebrow' },
        { es: 'el codo', en: 'elbow' },
        { es: 'la muñeca', en: 'wrist' },
        { es: 'el tobillo', en: 'ankle' },
        { es: 'la uña', en: 'fingernail' },
        { es: 'el pecho', en: 'chest' },
        { es: 'el estómago', en: 'stomach' },
        { es: 'la piel', en: 'skin' },
        { es: 'el hueso', en: 'bone' },
        { es: 'la sangre', en: 'blood' }
      ],
      [
        { es: 'el cerebro', en: 'brain' },
        { es: 'el pulmón', en: 'lung' },
        { es: 'el hígado', en: 'liver' },
        { es: 'el riñón', en: 'kidney' },
        { es: 'la costilla', en: 'rib' },
        { es: 'el músculo', en: 'muscle' },
        { es: 'la vena', en: 'vein' },
        { es: 'el nervio', en: 'nerve' },
        { es: 'la garganta', en: 'throat' },
        { es: 'la cadera', en: 'hip' },
        { es: 'la barbilla', en: 'chin' },
        { es: 'la mejilla', en: 'cheek' },
        { es: 'la pestaña', en: 'eyelash' },
        { es: 'el párpado', en: 'eyelid' },
        { es: 'el talón', en: 'heel' }
      ]
    ]
  },
  {
    id: 'tiempo',
    name: 'Days & Weather',
    emoji: '🗓️',
    stages: [
      [
        { es: 'el lunes', en: 'Monday' },
        { es: 'el martes', en: 'Tuesday' },
        { es: 'el miércoles', en: 'Wednesday' },
        { es: 'el jueves', en: 'Thursday' },
        { es: 'el viernes', en: 'Friday' },
        { es: 'el sábado', en: 'Saturday' },
        { es: 'el domingo', en: 'Sunday' },
        { es: 'hoy', en: 'today' },
        { es: 'mañana', en: 'tomorrow' },
        { es: 'ayer', en: 'yesterday' },
        { es: 'la semana', en: 'week' },
        { es: 'el mes', en: 'month' },
        { es: 'el año', en: 'year' },
        { es: 'la lluvia', en: 'rain' },
        { es: 'la nieve', en: 'snow' }
      ],
      [
        { es: 'el sol', en: 'sun' },
        { es: 'la luna', en: 'moon' },
        { es: 'la nube', en: 'cloud' },
        { es: 'el viento', en: 'wind' },
        { es: 'la tormenta', en: 'storm' },
        { es: 'el cielo', en: 'sky' },
        { es: 'la niebla', en: 'fog' },
        { es: 'el hielo', en: 'ice' },
        { es: 'el calor', en: 'heat' },
        { es: 'la primavera', en: 'spring' },
        { es: 'el verano', en: 'summer' },
        { es: 'el otoño', en: 'autumn' },
        { es: 'el invierno', en: 'winter' },
        { es: 'la hora', en: 'hour' },
        { es: 'el minuto', en: 'minute' }
      ],
      [
        { es: 'el amanecer', en: 'dawn' },
        { es: 'el atardecer', en: 'dusk' },
        { es: 'la medianoche', en: 'midnight' },
        { es: 'el mediodía', en: 'noon' },
        { es: 'el relámpago', en: 'lightning' },
        { es: 'el trueno', en: 'thunder' },
        { es: 'el granizo', en: 'hail' },
        { es: 'la sequía', en: 'drought' },
        { es: 'la inundación', en: 'flood' },
        { es: 'el arcoíris', en: 'rainbow' },
        { es: 'la brisa', en: 'breeze' },
        { es: 'la humedad', en: 'humidity' },
        { es: 'el pronóstico', en: 'forecast' },
        { es: 'el siglo', en: 'century' },
        { es: 'la década', en: 'decade' }
      ]
    ]
  },
  {
    id: 'adjetivos',
    name: 'Adjectives',
    emoji: '🎨',
    stages: [
      [
        { es: 'grande', en: 'big' },
        { es: 'pequeño', en: 'small' },
        { es: 'rápido', en: 'fast' },
        { es: 'lento', en: 'slow' },
        { es: 'feliz', en: 'happy' },
        { es: 'triste', en: 'sad' },
        { es: 'caro', en: 'expensive' },
        { es: 'barato', en: 'cheap' },
        { es: 'fuerte', en: 'strong' },
        { es: 'débil', en: 'weak' },
        { es: 'limpio', en: 'clean' },
        { es: 'sucio', en: 'dirty' },
        { es: 'caliente', en: 'hot' },
        { es: 'frío', en: 'cold' },
        { es: 'nuevo', en: 'new' }
      ],
      [
        { es: 'alto', en: 'tall' },
        { es: 'bajo', en: 'short' },
        { es: 'largo', en: 'long' },
        { es: 'corto', en: 'brief' },
        { es: 'joven', en: 'young' },
        { es: 'viejo', en: 'old' },
        { es: 'rico', en: 'rich' },
        { es: 'pobre', en: 'poor' },
        { es: 'fácil', en: 'easy' },
        { es: 'difícil', en: 'difficult' },
        { es: 'lleno', en: 'full' },
        { es: 'vacío', en: 'empty' },
        { es: 'claro', en: 'clear' },
        { es: 'oscuro', en: 'dark' },
        { es: 'bonito', en: 'pretty' }
      ],
      [
        { es: 'amable', en: 'kind' },
        { es: 'grosero', en: 'rude' },
        { es: 'valiente', en: 'brave' },
        { es: 'cobarde', en: 'cowardly' },
        { es: 'orgulloso', en: 'proud' },
        { es: 'humilde', en: 'humble' },
        { es: 'tranquilo', en: 'calm' },
        { es: 'ruidoso', en: 'noisy' },
        { es: 'profundo', en: 'deep' },
        { es: 'estrecho', en: 'narrow' },
        { es: 'ancho', en: 'wide' },
        { es: 'suave', en: 'soft' },
        { es: 'áspero', en: 'rough' },
        { es: 'brillante', en: 'bright' },
        { es: 'borroso', en: 'blurry' }
      ]
    ]
  },
  {
    id: 'familia',
    name: 'Family & People',
    emoji: '👪',
    stages: [
      [
        { es: 'la madre', en: 'mother' },
        { es: 'el padre', en: 'father' },
        { es: 'el hermano', en: 'brother' },
        { es: 'la hermana', en: 'sister' },
        { es: 'el hijo', en: 'son' },
        { es: 'la hija', en: 'daughter' },
        { es: 'el abuelo', en: 'grandfather' },
        { es: 'la abuela', en: 'grandmother' },
        { es: 'el amigo', en: 'friend' },
        { es: 'el niño', en: 'boy' },
        { es: 'la niña', en: 'girl' },
        { es: 'el hombre', en: 'man' },
        { es: 'la mujer', en: 'woman' },
        { es: 'el bebé', en: 'baby' },
        { es: 'la familia', en: 'family' }
      ],
      [
        { es: 'el tío', en: 'uncle' },
        { es: 'la tía', en: 'aunt' },
        { es: 'el primo', en: 'cousin' },
        { es: 'el sobrino', en: 'nephew' },
        { es: 'la sobrina', en: 'niece' },
        { es: 'el esposo', en: 'husband' },
        { es: 'la esposa', en: 'wife' },
        { es: 'el vecino', en: 'neighbour' },
        { es: 'el novio', en: 'boyfriend' },
        { es: 'la novia', en: 'girlfriend' },
        { es: 'el nieto', en: 'grandson' },
        { es: 'la nieta', en: 'granddaughter' },
        { es: 'el suegro', en: 'father-in-law' },
        { es: 'el cuñado', en: 'brother-in-law' },
        { es: 'el gemelo', en: 'twin' }
      ],
      [
        { es: 'el antepasado', en: 'ancestor' },
        { es: 'el pariente', en: 'relative' },
        { es: 'la pareja', en: 'partner' },
        { es: 'el huérfano', en: 'orphan' },
        { es: 'la viuda', en: 'widow' },
        { es: 'el padrino', en: 'godfather' },
        { es: 'la madrina', en: 'godmother' },
        { es: 'el yerno', en: 'son-in-law' },
        { es: 'la nuera', en: 'daughter-in-law' },
        { es: 'el compañero', en: 'companion' },
        { es: 'el desconocido', en: 'stranger' },
        { es: 'el invitado', en: 'guest' },
        { es: 'el anfitrión', en: 'host' },
        { es: 'la generación', en: 'generation' },
        { es: 'el apellido', en: 'surname' }
      ]
    ]
  },
  {
    id: 'numeros',
    name: 'Numbers & Money',
    emoji: '🔢',
    stages: [
      [
        { es: 'uno', en: 'one' },
        { es: 'dos', en: 'two' },
        { es: 'tres', en: 'three' },
        { es: 'cuatro', en: 'four' },
        { es: 'cinco', en: 'five' },
        { es: 'seis', en: 'six' },
        { es: 'siete', en: 'seven' },
        { es: 'ocho', en: 'eight' },
        { es: 'nueve', en: 'nine' },
        { es: 'diez', en: 'ten' },
        { es: 'el dinero', en: 'money' },
        { es: 'el precio', en: 'price' },
        { es: 'primero', en: 'first' },
        { es: 'último', en: 'last' },
        { es: 'medio', en: 'half' }
      ],
      [
        { es: 'veinte', en: 'twenty' },
        { es: 'treinta', en: 'thirty' },
        { es: 'cuarenta', en: 'forty' },
        { es: 'cincuenta', en: 'fifty' },
        { es: 'cien', en: 'a hundred' },
        { es: 'mil', en: 'a thousand' },
        { es: 'el número', en: 'number' },
        { es: 'la cuenta', en: 'bill' },
        { es: 'la moneda', en: 'coin' },
        { es: 'el efectivo', en: 'cash' },
        { es: 'la tarjeta', en: 'card' },
        { es: 'el descuento', en: 'discount' },
        { es: 'la propina', en: 'tip' },
        { es: 'el cambio', en: 'change' },
        { es: 'gratis', en: 'free of charge' }
      ],
      [
        { es: 'el tercio', en: 'a third' },
        { es: 'el porcentaje', en: 'percentage' },
        { es: 'la suma', en: 'sum' },
        { es: 'la resta', en: 'subtraction' },
        { es: 'el impuesto', en: 'tax' },
        { es: 'el préstamo', en: 'loan' },
        { es: 'la deuda', en: 'debt' },
        { es: 'el ahorro', en: 'savings' },
        { es: 'la ganancia', en: 'profit' },
        { es: 'la pérdida', en: 'loss' },
        { es: 'el presupuesto', en: 'budget' },
        { es: 'la factura', en: 'invoice' },
        { es: 'la inversión', en: 'investment' },
        { es: 'el sueldo', en: 'salary' },
        { es: 'la riqueza', en: 'wealth' }
      ]
    ]
  },
  {
    id: 'trabajo',
    name: 'Work & School',
    emoji: '🎓',
    stages: [
      [
        { es: 'la escuela', en: 'school' },
        { es: 'el libro', en: 'book' },
        { es: 'el papel', en: 'paper' },
        { es: 'el lápiz', en: 'pencil' },
        { es: 'la pluma', en: 'pen' },
        { es: 'el maestro', en: 'teacher' },
        { es: 'el estudiante', en: 'student' },
        { es: 'la clase', en: 'class' },
        { es: 'la tarea', en: 'homework' },
        { es: 'el examen', en: 'exam' },
        { es: 'la oficina', en: 'office' },
        { es: 'el trabajo', en: 'job' },
        { es: 'el jefe', en: 'boss' },
        { es: 'la reunión', en: 'meeting' },
        { es: 'el correo', en: 'mail' }
      ],
      [
        { es: 'la universidad', en: 'university' },
        { es: 'la carrera', en: 'degree' },
        { es: 'la nota', en: 'grade' },
        { es: 'la pregunta', en: 'question' },
        { es: 'la respuesta', en: 'reply' },
        { es: 'el cuaderno', en: 'notebook' },
        { es: 'la pizarra', en: 'blackboard' },
        { es: 'el horario', en: 'schedule' },
        { es: 'el proyecto', en: 'project' },
        { es: 'la empresa', en: 'company' },
        { es: 'el contrato', en: 'contract' },
        { es: 'el cliente', en: 'customer' },
        { es: 'la entrevista', en: 'interview' },
        { es: 'el informe', en: 'report' },
        { es: 'la fecha', en: 'date' }
      ],
      [
        { es: 'la beca', en: 'scholarship' },
        { es: 'la matrícula', en: 'tuition' },
        { es: 'el título', en: 'diploma' },
        { es: 'la investigación', en: 'research' },
        { es: 'la biblioteca', en: 'library' },
        { es: 'el conocimiento', en: 'knowledge' },
        { es: 'la habilidad', en: 'skill' },
        { es: 'el ascenso', en: 'promotion' },
        { es: 'la jubilación', en: 'retirement' },
        { es: 'el sindicato', en: 'trade union' },
        { es: 'la huelga', en: 'strike' },
        { es: 'el despido', en: 'dismissal' },
        { es: 'la plantilla', en: 'staff' },
        { es: 'el rendimiento', en: 'performance' },
        { es: 'la meta', en: 'goal' }
      ]
    ]
  },
  {
    id: 'ciudad',
    name: 'City & Places',
    emoji: '🏙️',
    stages: [
      [
        { es: 'la tienda', en: 'shop' },
        { es: 'el mercado', en: 'market' },
        { es: 'el parque', en: 'park' },
        { es: 'el banco', en: 'bank' },
        { es: 'la iglesia', en: 'church' },
        { es: 'el hospital', en: 'hospital' },
        { es: 'la plaza', en: 'square' },
        { es: 'el museo', en: 'museum' },
        { es: 'el cine', en: 'cinema' },
        { es: 'el restaurante', en: 'restaurant' },
        { es: 'el edificio', en: 'building' },
        { es: 'la farmacia', en: 'pharmacy' },
        { es: 'el barrio', en: 'neighbourhood' },
        { es: 'la esquina', en: 'street corner' },
        { es: 'el centro', en: 'centre' }
      ],
      [
        { es: 'el ayuntamiento', en: 'town hall' },
        { es: 'la comisaría', en: 'police station' },
        { es: 'el semáforo', en: 'traffic light' },
        { es: 'la acera', en: 'pavement' },
        { es: 'el cruce', en: 'crossroads' },
        { es: 'el aparcamiento', en: 'car park' },
        { es: 'la fuente', en: 'fountain' },
        { es: 'el quiosco', en: 'kiosk' },
        { es: 'la panadería', en: 'bakery' },
        { es: 'la carnicería', en: 'butcher shop' },
        { es: 'la peluquería', en: 'hair salon' },
        { es: 'el supermercado', en: 'supermarket' },
        { es: 'la gasolinera', en: 'petrol station' },
        { es: 'el teatro', en: 'theatre' },
        { es: 'el estadio', en: 'stadium' }
      ],
      [
        { es: 'el rascacielos', en: 'skyscraper' },
        { es: 'la catedral', en: 'cathedral' },
        { es: 'el cementerio', en: 'cemetery' },
        { es: 'la muralla', en: 'city wall' },
        { es: 'el callejón', en: 'alley' },
        { es: 'la avenida', en: 'avenue' },
        { es: 'el vertedero', en: 'landfill' },
        { es: 'la alcantarilla', en: 'sewer' },
        { es: 'el andamio', en: 'scaffolding' },
        { es: 'la obra', en: 'building site' },
        { es: 'el suburbio', en: 'suburb' },
        { es: 'las afueras', en: 'outskirts' },
        { es: 'el peatón', en: 'pedestrian' },
        { es: 'la multitud', en: 'crowd' },
        { es: 'el alcalde', en: 'mayor' }
      ]
    ]
  },
  {
    id: 'ropa',
    name: 'Clothing',
    emoji: '👕',
    stages: [
      [
        { es: 'la camisa', en: 'shirt' },
        { es: 'el pantalón', en: 'trousers' },
        { es: 'el vestido', en: 'dress' },
        { es: 'la falda', en: 'skirt' },
        { es: 'el zapato', en: 'shoe' },
        { es: 'el sombrero', en: 'hat' },
        { es: 'el abrigo', en: 'coat' },
        { es: 'el calcetín', en: 'sock' },
        { es: 'la chaqueta', en: 'jacket' },
        { es: 'el cinturón', en: 'belt' },
        { es: 'la bufanda', en: 'scarf' },
        { es: 'el guante', en: 'glove' },
        { es: 'la camiseta', en: 't-shirt' },
        { es: 'la ropa', en: 'clothes' },
        { es: 'la bota', en: 'boot' }
      ],
      [
        { es: 'el bolsillo', en: 'pocket' },
        { es: 'el botón', en: 'button' },
        { es: 'la cremallera', en: 'zip' },
        { es: 'la manga', en: 'sleeve' },
        { es: 'el collar', en: 'necklace' },
        { es: 'el anillo', en: 'ring' },
        { es: 'el reloj', en: 'watch' },
        { es: 'las gafas', en: 'spectacles' },
        { es: 'el paraguas', en: 'umbrella' },
        { es: 'la cartera', en: 'wallet' },
        { es: 'el bolso', en: 'handbag' },
        { es: 'la corbata', en: 'necktie' },
        { es: 'el pijama', en: 'pyjamas' },
        { es: 'el traje', en: 'suit' },
        { es: 'la sandalia', en: 'sandal' }
      ],
      [
        { es: 'el algodón', en: 'cotton' },
        { es: 'la lana', en: 'wool' },
        { es: 'la seda', en: 'silk' },
        { es: 'el cuero', en: 'leather' },
        { es: 'el encaje', en: 'lace' },
        { es: 'la costura', en: 'seam' },
        { es: 'el dobladillo', en: 'hem' },
        { es: 'la percha', en: 'coat hanger' },
        { es: 'la hebilla', en: 'buckle' },
        { es: 'el tejido', en: 'fabric' },
        { es: 'la prenda', en: 'garment' },
        { es: 'el disfraz', en: 'costume' },
        { es: 'el delantal', en: 'apron' },
        { es: 'la gorra', en: 'cap' },
        { es: 'el chaleco', en: 'waistcoat' }
      ]
    ]
  },
  {
    id: 'emociones',
    name: 'Feelings & Mind',
    emoji: '💭',
    stages: [
      [
        { es: 'el amor', en: 'love' },
        { es: 'el miedo', en: 'fear' },
        { es: 'la alegría', en: 'joy' },
        { es: 'la tristeza', en: 'sadness' },
        { es: 'la rabia', en: 'anger' },
        { es: 'la sorpresa', en: 'surprise' },
        { es: 'el sueño', en: 'dream' },
        { es: 'la idea', en: 'idea' },
        { es: 'la mente', en: 'mind' },
        { es: 'el deseo', en: 'wish' },
        { es: 'la duda', en: 'doubt' },
        { es: 'la esperanza', en: 'hope' },
        { es: 'la memoria', en: 'memory' },
        { es: 'el dolor', en: 'pain' },
        { es: 'la risa', en: 'laughter' }
      ],
      [
        { es: 'los celos', en: 'jealousy' },
        { es: 'la vergüenza', en: 'shame' },
        { es: 'el orgullo', en: 'pride' },
        { es: 'la culpa', en: 'guilt' },
        { es: 'el alivio', en: 'relief' },
        { es: 'la calma', en: 'calmness' },
        { es: 'el enojo', en: 'annoyance' },
        { es: 'la envidia', en: 'envy' },
        { es: 'la ternura', en: 'tenderness' },
        { es: 'el cariño', en: 'affection' },
        { es: 'la confianza', en: 'trust' },
        { es: 'el respeto', en: 'respect' },
        { es: 'la paciencia', en: 'patience' },
        { es: 'el ánimo', en: 'spirits' },
        { es: 'la soledad', en: 'loneliness' }
      ],
      [
        { es: 'la angustia', en: 'anguish' },
        { es: 'el desprecio', en: 'contempt' },
        { es: 'la nostalgia', en: 'nostalgia' },
        { es: 'el asombro', en: 'astonishment' },
        { es: 'la compasión', en: 'compassion' },
        { es: 'el rencor', en: 'resentment' },
        { es: 'la serenidad', en: 'serenity' },
        { es: 'el entusiasmo', en: 'enthusiasm' },
        { es: 'la melancolía', en: 'melancholy' },
        { es: 'el desánimo', en: 'discouragement' },
        { es: 'la gratitud', en: 'gratitude' },
        { es: 'el remordimiento', en: 'remorse' },
        { es: 'la euforia', en: 'euphoria' },
        { es: 'el recelo', en: 'mistrust' },
        { es: 'la añoranza', en: 'longing' }
      ]
    ]
  }
];

/** Stable identity for a word, used as the progress-map key. */
export function wordId(word) {
  return word.es;
}

export function getDeck(deckId) {
  return DECKS.find((deck) => deck.id === deckId) ?? null;
}

/** Words in one stage of one deck. `stage` is zero-based. */
export function stageWords(deckId, stage) {
  if (deckId === ALL_DECK_ID) return DECKS.flatMap((deck) => deck.stages[stage] ?? []);
  return getDeck(deckId)?.stages[stage] ?? [];
}

/** Every word in a deck, across all stages. */
export function deckWords(deckId) {
  if (deckId === ALL_DECK_ID) return DECKS.flatMap((deck) => deck.stages.flat());
  return getDeck(deckId)?.stages.flat() ?? [];
}
