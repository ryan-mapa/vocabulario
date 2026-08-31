// Word decks. Nouns carry their article so gender is learned with the word.

export const DECKS = [
  {
    id: 'comida',
    name: 'Food',
    emoji: '🍎',
    words: [
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
    ]
  },
  {
    id: 'animales',
    name: 'Animals',
    emoji: '🦊',
    words: [
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
    ]
  },
  {
    id: 'casa',
    name: 'The Home',
    emoji: '🏠',
    words: [
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
    ]
  },
  {
    id: 'verbos',
    name: 'Verbs',
    emoji: '🏃',
    words: [
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
    ]
  },
  {
    id: 'viajes',
    name: 'Travel',
    emoji: '✈️',
    words: [
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
    ]
  },
  {
    id: 'cuerpo',
    name: 'The Body',
    emoji: '🖐️',
    words: [
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
    ]
  },
  {
    id: 'tiempo',
    name: 'Days & Weather',
    emoji: '🗓️',
    words: [
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
    ]
  },
  {
    id: 'adjetivos',
    name: 'Adjectives',
    emoji: '🎨',
    words: [
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

/** Words for a deck id, or every word when given 'todos'. */
export function wordsFor(deckId) {
  if (deckId === 'todos') return DECKS.flatMap((deck) => deck.words);
  return getDeck(deckId)?.words ?? [];
}
