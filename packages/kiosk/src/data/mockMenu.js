// Mock menu data — SmashMe brand (burgeri reali de pe smashme.ro)
export const SMASHME_CATEGORIES = [
  { id: 'smash-burgers',  name: 'Smash Burgers',  icon: '🍔', color: '#EE3B24' },
  { id: 'pizza',          name: 'Pizza',           icon: '🍕', color: '#FF8C00' },
  { id: 'salate',         name: 'Salate',          icon: '🥗', color: '#2E7D32' },
  { id: 'deserturi',      name: 'Deserturi',       icon: '🍰', color: '#E91E8C' },
  { id: 'bauturi',        name: 'Băuturi',         icon: '🥤', color: '#1565C0' },
];

export const SMASHME_PRODUCTS = [
  {
    id: 'sm1', categoryId: 'smash-burgers',
    name: 'Classic Smash',
    price: 42,
    description: 'Cotlet de vită smash 180g, cheddar topit, salată, roșie, murături, sos special Smash Me',
    image: 'https://backend.smashme.ro/uploads/products/classic-smash.jpg',
    badge: 'Best Seller',
    allergens: ['gluten', 'lactate', 'ou'],
    modifiers: [
      { id: 'size', name: 'Mărime', required: true, options: [
        { id: 'single', name: 'Single 180g', priceDiff: 0 },
        { id: 'double', name: 'Double 360g', priceDiff: 16 },
        { id: 'triple', name: 'Triple 540g', priceDiff: 30 },
      ]},
      { id: 'side', name: 'Garnitură', required: true, options: [
        { id: 'fries',   name: 'Cartofi prăjiți', priceDiff: 0 },
        { id: 'coleslaw',name: 'Coleslaw',         priceDiff: 0 },
        { id: 'sweet',   name: 'Cartofi dulci',    priceDiff: 7 },
      ]},
    ],
  },
  {
    id: 'sm2', categoryId: 'smash-burgers',
    name: 'BBQ Bacon Smash',
    price: 48,
    description: 'Cotlet de vită 180g, bacon crispy, sos BBQ, ceapă caramelizată, cheddar, castraveți murați',
    image: 'https://backend.smashme.ro/uploads/products/bbq-bacon-smash.jpg',
    badge: 'Nou',
    allergens: ['gluten', 'lactate'],
    modifiers: [
      { id: 'size2', name: 'Mărime', required: true, options: [
        { id: 'single2', name: 'Single 180g', priceDiff: 0 },
        { id: 'double2', name: 'Double 360g', priceDiff: 16 },
      ]},
    ],
  },
  {
    id: 'sm3', categoryId: 'smash-burgers',
    name: 'Crispy Chicken Smash',
    price: 39,
    description: 'Piept de pui pane 180g, sos ranch, varză murată, castraveți, roșie',
    image: '',
    badge: null,
    allergens: ['gluten', 'ou'],
    modifiers: [],
  },
  {
    id: 'sm4', categoryId: 'smash-burgers',
    name: 'Mushroom Swiss Smash',
    price: 44,
    description: 'Cotlet de vită 180g, ciuperci sautéed, brânză elvețiană, maioneză trufe, rucola',
    image: '',
    badge: 'Chef Pick',
    allergens: ['gluten', 'lactate', 'ou'],
    modifiers: [
      { id: 'size3', name: 'Mărime', required: true, options: [
        { id: 'single3', name: 'Single 180g', priceDiff: 0 },
        { id: 'double3', name: 'Double 360g', priceDiff: 16 },
      ]},
    ],
  },
  {
    id: 'sm5', categoryId: 'bauturi',
    name: 'Limonadă Smash',
    price: 18,
    description: 'Lămâie proaspătă, mentă, apă minerală, sirop natural',
    image: '',
    badge: null,
    allergens: [],
    modifiers: [
      { id: 'flavor', name: 'Aromă', required: true, options: [
        { id: 'lemon',   name: 'Lămâie clasic',      priceDiff: 0 },
        { id: 'berry',   name: 'Fructe de pădure',   priceDiff: 0 },
        { id: 'ginger',  name: 'Ghimbir & lemon',    priceDiff: 0 },
      ]},
    ],
  },
  {
    id: 'sm6', categoryId: 'bauturi',
    name: 'Milkshake',
    price: 24,
    description: 'Înghețată artizanală, lapte integral, sirop natural — 400ml',
    image: '',
    badge: null,
    allergens: ['lactate'],
    modifiers: [
      { id: 'shflavor', name: 'Aromă', required: true, options: [
        { id: 'vanilla',    name: 'Vanilie',       priceDiff: 0 },
        { id: 'chocolate',  name: 'Ciocolată',     priceDiff: 0 },
        { id: 'strawberry', name: 'Căpșuni',       priceDiff: 0 },
        { id: 'caramel',    name: 'Caramel sărat', priceDiff: 0 },
      ]},
    ],
  },
  {
    id: 'sm7', categoryId: 'deserturi',
    name: 'Brownie Smash',
    price: 22,
    description: 'Brownie cald de ciocolată, înghețată de vanilie, sos caramel',
    image: '',
    badge: null,
    allergens: ['gluten', 'lactate', 'ou'],
    modifiers: [],
  },
];

// ─── SUSHI MASTER ────────────────────────────────────────────────────────────

export const SUSHIMASTER_CATEGORIES = [
  {
    "id": "b47b4c09-862a-47e6-a70c-5c35b84ec7b0",
    "name": "Set By Master",
    "emoji": "🍽️",
    "parentGroupId": "d3e3c5f2-5e15-400b-8197-d58fa63ed718"
  },
  {
    "id": "44dc2a71-657b-4a96-b7a9-dafe2d6ebc98",
    "name": "Fantasy By Master",
    "emoji": "🍽️",
    "parentGroupId": "d3e3c5f2-5e15-400b-8197-d58fa63ed718"
  },
  {
    "id": "749f5073-14dd-46d9-96c3-df04aa5c6dbf",
    "name": "Double Maki Rolls",
    "emoji": "🍣",
    "parentGroupId": "d3e3c5f2-5e15-400b-8197-d58fa63ed718"
  },
  {
    "id": "cac42b5e-a3d6-485c-9e3a-3c688c7576bc",
    "name": "Maki Rolls",
    "emoji": "🍣",
    "parentGroupId": "d3e3c5f2-5e15-400b-8197-d58fa63ed718"
  },
  {
    "id": "d9a2fa14-889e-48f0-a6d8-d5d39a85d5c7",
    "name": "Tempura",
    "emoji": "🍽️",
    "parentGroupId": "d3e3c5f2-5e15-400b-8197-d58fa63ed718"
  },
  {
    "id": "c80d09d1-975d-4781-ae52-442b11c1d7c9",
    "name": "Tempura & Grilled Rolls",
    "emoji": "🍣",
    "parentGroupId": "d3e3c5f2-5e15-400b-8197-d58fa63ed718"
  }
];

export const SUSHIMASTER_PRODUCTS = [
  {
    "id": "9c7b052c-2d55-487a-a2c7-75fb70d31e9b",
    "categoryId": "b47b4c09-862a-47e6-a70c-5c35b84ec7b0",
    "name": "Lots Of Salmon Set",
    "description": "Philadelphia Classic, Shrimp Lux, Dragon Grill, Double Somon&Avocado Maki, Green Somon - 1254g. (40 buc.)\nAdițional (porționat): Sos de soia-150ml (Alergen:SOIA), Wasabi-25g(Alergen:MUȘTAR), Ghimbir murat-50g, Bețe sushi-3 buc.\nValori nutritive per 100g: Grăsimi-7,12, Acizi grași-2,33, Proteine-8,41, Carbohidrați-20,1, Zahăr-1,97, Sare-0,52, Kcal-179,9.\nE-uri: Coloranți-E110; E133; E129; E151; 124; 124; E150a; Potențiator de aromă-E627; E631; Stabilizatori-E415; E451.\nAlergeni: Cereale, Crustacee, Ouă, Pește, Soia, Lapte/Lactoză, Muștar.",
    "price": 236,
    "image": "https://storage.cdneu.syrve.com/nomenclature_images/295833/93ef1ab1-2c7f-4285-859f-b6522198331b.png",
    "weight": 1.254,
    "energyAmount": 124.421,
    "allergenGroups": [],
    "tags": [],
    "isNew": false,
    "modifierGroups": [
      {
        "id": "87a848ea-5cd3-46f8-9fe8-89cbeade363e",
        "name": "Opțiuni",
        "required": false,
        "minAmount": 0,
        "maxAmount": 1,
        "options": []
      }
    ]
  },
  {
    "id": "ac343e83-5147-4454-9b73-00907a979670",
    "categoryId": "b47b4c09-862a-47e6-a70c-5c35b84ec7b0",
    "name": "SushiMaster 1kg NEW",
    "description": "Double Philadelphia Somon&Ton, Somon Grill Caramel, Tuna House Avocado, Somon Mango Blue Cheese - 1208g. (32 buc.)\nAdițional (porționat): Sos de soia-120ml (Alergen:SOIA), Wasabi-20g (Alergen:MUȘTAR), Ghimbir murat-40g, Bețe sushi-2 buc.\nValori nutritive per 100g: Grăsimi-7,13, Acizi grași-2,42, Proteine-9,06, Carbohidrați-18,21, Zahăr-1,89, Sare-0,51, Kcal-174,65.\nE-uri: Coloranți-E110; E133; E129; E151; Emulgatori-E473; E472a; Stabilizatori-E415.\nAlergeni: Cereale, Crustacee, Ouă, Pește, Soia, Lapte/Lactoză, Muștar, Susan.",
    "price": 216,
    "image": "https://storage.cdneu.syrve.com/nomenclature_images/295833/35c937ce-f358-4d63-b637-e0a840462b20.png",
    "weight": 1.208,
    "energyAmount": 170.698,
    "allergenGroups": [],
    "tags": [],
    "isNew": false,
    "modifierGroups": [
      {
        "id": "87a848ea-5cd3-46f8-9fe8-89cbeade363e",
        "name": "Opțiuni",
        "required": false,
        "minAmount": 0,
        "maxAmount": 1,
        "options": []
      }
    ]
  },
  {
    "id": "1b1b4142-d824-430e-879c-6b9ff927b837",
    "categoryId": "b47b4c09-862a-47e6-a70c-5c35b84ec7b0",
    "name": "SushiMaster All In Remix",
    "description": "Double Canada Mango Shrimps, Philadelphia Grill, Double Creveți Tempura Maki, Double Somon&Avocado Maki, Double Fish Maki, Tempura Ton, Tempura Fume - 1442g. (56 buc.)\nAdițional (porționat): Sos de soia-210ml (Alergen:SOIA), Wasabi-35g (Alergen:MUȘTAR), Ghimbir murat-70g, Bețe sushi-4 buc.\nValori nutritive per 100g: Grăsimi-6,63, Acizi grași-2,88, Proteine-8,35, Carbohidrați-26,78, Zahăr-1,92, Sare-0,62, Kcal-202,52.\nE-uri: Stabilizatori-E451; E415; Potențiator de aromă-E627; E631; Coloranți-E110; E133; E129; E151.\nAlergeni: Cereale, Crustacee, Pește, Soia, Lapte/Lactoză, Muștar.",
    "price": 289,
    "image": "https://storage.cdneu.syrve.com/nomenclature_images/295833/3efa829c-3bd7-4b91-9a75-bd86026fb3f2.png",
    "weight": 1.442,
    "energyAmount": 197.034,
    "allergenGroups": [],
    "tags": [],
    "isNew": false,
    "modifierGroups": [
      {
        "id": "87a848ea-5cd3-46f8-9fe8-89cbeade363e",
        "name": "Opțiuni",
        "required": false,
        "minAmount": 0,
        "maxAmount": 1,
        "options": []
      }
    ]
  },
  {
    "id": "60aca4e5-2a12-4e93-84b0-03b96ed03630",
    "categoryId": "b47b4c09-862a-47e6-a70c-5c35b84ec7b0",
    "name": "SushiMaster Big in Japan",
    "description": "California Tuna, Green Dragon, Double Philadelphia Somon&Ton, Double Somon&Avocado Maki, Shrimp Tempura, Philadelphia Tempura - 1448g. (48 buc.)\nAdițional (porționat): Sos de soia-180ml (Alergen:SOIA), Wasabi-30g (Alergen:MUȘTAR), Ghimbir murat-60g, Bețe sushi-3 buc.\nValori nutritive per 100g: Grăsimi-6,62, Acizi grași-2,48, Proteine-7,94, Carbohidrați-24,24, Zahăr-3,06, Sare-0,7, Kcal-191,31.\nE-uri: Coloranți-E110; E133; E129; E151; Stabilizatori-E451; E415; Acizi-E260; E330; Potențiator de aromă-E621; Conservant-E202; Antioxidant-E319.\nAlergeni: Cereale, Crustacee, Ouă, Pește, Soia, Lapte/Lactoză, Muștar.",
    "price": 256,
    "image": "https://storage.cdneu.syrve.com/nomenclature_images/295833/6feb48c5-2886-4da5-b10d-47097fd98821.png",
    "weight": 1.448,
    "energyAmount": 183.393,
    "allergenGroups": [],
    "tags": [],
    "isNew": false,
    "modifierGroups": [
      {
        "id": "87a848ea-5cd3-46f8-9fe8-89cbeade363e",
        "name": "Opțiuni",
        "required": false,
        "minAmount": 0,
        "maxAmount": 1,
        "options": []
      }
    ]
  },
  {
    "id": "d5edd6b9-a731-4b0f-8998-557e8f6c76b9",
    "categoryId": "b47b4c09-862a-47e6-a70c-5c35b84ec7b0",
    "name": "SushiMaster Big Party Set",
    "description": "Philadelphia Tobiko, California Fume, Somon Mango Blue Cheese, Double Tuna Maki, Double Somon&Avocado Maki, Tempura Fume, Tempura Ton - 1539g. (56 buc.)\nAdițional (porționat): Sos de soia-210ml (Alergen:SOIA), Wasabi-35g (Alergen:MUȘTAR), Ghimbir murat-70g, Bețe sushi-4 buc.\nValori nutritive per 100g: Grăsimi-5,88, Acizi grași-2,36, Proteine-8,24, Carbohidrați-26,54, Zahăr-2,15, Sare-0,64, Kcal-193,96.\nE-uri: Coloranți-E110; E133; E129; E151; E151; 124; Emulgatori-E473; E472a; Stabilizatori-E415.\nAlergeni: Cereale, Pește, Soia, Lapte/Lactoză, Muștar, Susan.",
    "price": 297,
    "image": "https://storage.cdneu.syrve.com/nomenclature_images/295833/4660855e-dbb6-43f8-bf73-86dd8e1f3705.png",
    "weight": 1.539,
    "energyAmount": 97.937,
    "allergenGroups": [],
    "tags": [],
    "isNew": false,
    "modifierGroups": [
      {
        "id": "87a848ea-5cd3-46f8-9fe8-89cbeade363e",
        "name": "Opțiuni",
        "required": false,
        "minAmount": 0,
        "maxAmount": 1,
        "options": []
      }
    ]
  },
  {
    "id": "94a7179f-679a-450b-bef9-a6fe724f2dbc",
    "categoryId": "b47b4c09-862a-47e6-a70c-5c35b84ec7b0",
    "name": "SushiMaster Chef's Set",
    "description": "Somon Grill Caramel, Shanghai, Maguro Spicy, Tuna House Somon&Avocado - 1168g. (32 buc.)\nAdițional (porționat): Sos de soia-120ml (Alergen:SOIA), Wasabi-20g (Alergen:MUȘTAR), Ghimbir murat-40g, Bețe sushi-2 buc.\nValori nutritive per 100g: Grăsimi-6,46, Acizi grași-2,09, Proteine-9,57, Carbohidrați-19,55, Zahăr-2,48, Sare-0,73, Kcal-175,51.\nE-uri: Emulgatori-E473; E472a; E415; Coloranți-E110; E133; E129; E151; Acizi-E260; E330; Potențiator de aromă-E621; Conservant-E202; Antioxidant-E319; Stabilizatori-E451.\nAlergeni: Cereale, Crustacee, Pește, Soia, Lapte/Lactoză, Muștar, Susan.",
    "price": 221,
    "image": "https://storage.cdneu.syrve.com/nomenclature_images/295833/2d9ca6de-83c8-460b-be44-150dcbe9748a.png",
    "weight": 1.16796436,
    "energyAmount": 173.325,
    "allergenGroups": [],
    "tags": [],
    "isNew": false,
    "modifierGroups": [
      {
        "id": "87a848ea-5cd3-46f8-9fe8-89cbeade363e",
        "name": "Opțiuni",
        "required": false,
        "minAmount": 0,
        "maxAmount": 1,
        "options": []
      }
    ]
  },
  {
    "id": "48d104a8-88cd-491b-831b-2f40d9f58f50",
    "categoryId": "b47b4c09-862a-47e6-a70c-5c35b84ec7b0",
    "name": "SushiMaster Fancy",
    "description": "Somon Grill Caramel, Double Philadelphia Somon&Ton, California Creveți, Maguro Spicy - 1108g. (32 buc.)\nAdițional (porționat): Sos de soia-120ml (Alergen:SOIA), Wasabi-20g (Alergen:MUȘTAR), Ghimbir murat-40g, Bețe sushi-2 buc.\nValori nutritive per 100g: Grăsimi-5,35, Acizi grași-1,99, Proteine-10,04, Carbohidrați-19,03, Zahăr-2,57, Sare-0,79, Kcal-165,48.\nE-uri: Coloranți-E110; E133; E129; E151; E124; Emulgatori-E473; E472a; E415; E151; Acizi-E260; E330; Potențiator de aromă-E621; Conservant-E202; Antioxidant-E319.\nAlergeni: Cereale, Crustacee, Ouă, Pește, Soia, Lapte/Lactoză, Muștar.",
    "price": 228,
    "image": "https://storage.cdneu.syrve.com/nomenclature_images/295833/41dc70b3-7b07-47e1-aab1-9af54d845186.png",
    "weight": 1.108,
    "energyAmount": 163.739,
    "allergenGroups": [],
    "tags": [],
    "isNew": false,
    "modifierGroups": [
      {
        "id": "87a848ea-5cd3-46f8-9fe8-89cbeade363e",
        "name": "Opțiuni",
        "required": false,
        "minAmount": 0,
        "maxAmount": 1,
        "options": []
      }
    ]
  },
  {
    "id": "3a39f276-e04f-41ab-9b97-467dddacfd1d",
    "categoryId": "b47b4c09-862a-47e6-a70c-5c35b84ec7b0",
    "name": "SushiMaster First Class",
    "description": "Shanghai, California Classic, Double SunKiss, Philadelphia Classic, Avocado Fried Salmon, Philadelphia Grill - 1566g. (48 buc.)\nAdițional (porționat): Sos de soia-180ml (Alergen:SOIA), Wasabi-30g (Alergen:MUȘTAR), Ghimbir murat-60g, Bețe sushi-3 buc.\nValori nutritive per 100g: Grăsimi-7,44, Acizi grași-2,27, Proteine-7,61, Carbohidrați-22,01, Zahăr-2,49, Sare-0,67, Kcal-186,23\nE-uri: Emulgatori-E473; E472a; E473; Stabilizatori-E451; E415;E450iii; E451i; E452i; Regulator de aciditate-E260; E270; E170; Conservant-E202; Bisulfit de sodiu-E222; Potențiator de aromă-E635; Coloranți-E110; E133; E129; E151\nAlergeni: Cereale, Crustacee, Ouă, Pește, Soia, Lapte/Lactoză, Muștar, Susan.",
    "price": 275,
    "image": "https://storage.cdneu.syrve.com/nomenclature_images/295833/17c2abac-5aef-4f5c-9883-8eacb1426177.png",
    "weight": 1.5639627,
    "energyAmount": 184.096,
    "allergenGroups": [],
    "tags": [],
    "isNew": false,
    "modifierGroups": [
      {
        "id": "87a848ea-5cd3-46f8-9fe8-89cbeade363e",
        "name": "Opțiuni",
        "required": false,
        "minAmount": 0,
        "maxAmount": 1,
        "options": []
      }
    ]
  },
  {
    "id": "a6de8a67-133d-444e-baec-593b9ce2d575",
    "categoryId": "b47b4c09-862a-47e6-a70c-5c35b84ec7b0",
    "name": "SushiMaster Fish&Cheese",
    "description": "North Sea, Philadephia Caviar, Philadephia Tobiko, Avocado Fried Salmon - 1025g. (32 buc.)\nAdițional (porționat): Sos de soia-120ml (Alergen:SOIA), Wasabi-20g (Alergen:MUȘTAR), Ghimbir murat-40g, Bețe sushi-2 buc.\nValori nutritive per 100g: Grăsimi-8,92, Acizi grași-3,18, Proteine-7,13, Carbohidrați-21,61, Zahăr-2,4, Sare-0,59, Kcal-195,61.\nE-uri: Emulgatori-E473; E472a; Stabilizatori-E415; Regulator de aciditate-E260; Conservant-E202; Bisulfit de sodiu-E222; Colorant-E150a; Potențiator de aromă-E627; E631; Coloranți-E110; E133; E129; E151; 124.\nAlergeni: Cereale, Ouă, Pește, Soia, Lapte/Lactoză, Muștar, Susan.",
    "price": 207,
    "image": "https://storage.cdneu.syrve.com/nomenclature_images/295833/a4eb1831-0a19-4f5f-af77-8d9d7f024e8d.png",
    "weight": 1.025,
    "energyAmount": 127.838,
    "allergenGroups": [],
    "tags": [],
    "isNew": false,
    "modifierGroups": [
      {
        "id": "87a848ea-5cd3-46f8-9fe8-89cbeade363e",
        "name": "Opțiuni",
        "required": false,
        "minAmount": 0,
        "maxAmount": 1,
        "options": []
      }
    ]
  },
  {
    "id": "2ea84b56-dbaf-43a1-978f-406151af5057",
    "categoryId": "b47b4c09-862a-47e6-a70c-5c35b84ec7b0",
    "name": "SushiMaster For You",
    "description": "Philadephia Anghilă, Green Dragon, Somon Mango Blue Cheese, Double SunKiss - 1126g. (32 buc.)\nAdițional (porționat): Sos de soia-120ml (Alergen:SOIA), Wasabi-20g (Alergen:MUȘTAR), Ghimbir murat-40g, Bețe sushi-2 buc.\nValori nutritive per 100g: Grăsimi-7,73, Acizi grași-2,85, Proteine-7,16, Carbohidrați-21,26, Zahăr-2,63, Sare-0,67, Kcal-184,29.\nE-uri: Stabilizatori-E451; E415; Acizi-E260; E330; Conservant-E202; Antioxidant-E319; Coloranți-E110; E133; E129; E151; E150a; Potențiator de aromă-E627; E631; E621; Emulgatori-E473; E472a.\nAlergeni: Cereale, Crustacee, Ouă, Pește, Soia, Lapte/Lactoză, Muștar, Susan.",
    "price": 207,
    "image": "https://storage.cdneu.syrve.com/nomenclature_images/295833/b5ae598e-c09f-4d49-a944-910bd2bc6400.png",
    "weight": 1.144,
    "energyAmount": 182.056,
    "allergenGroups": [],
    "tags": [],
    "isNew": false,
    "modifierGroups": [
      {
        "id": "87a848ea-5cd3-46f8-9fe8-89cbeade363e",
        "name": "Opțiuni",
        "required": false,
        "minAmount": 0,
        "maxAmount": 1,
        "options": []
      }
    ]
  },
  {
    "id": "9eaacadb-a950-4ad1-86ea-ba06786d6e90",
    "categoryId": "b47b4c09-862a-47e6-a70c-5c35b84ec7b0",
    "name": "SushiMaster Full House",
    "description": "Philadelphia Classic, Green Somon, Philadelphia Tobiko, Philadelphia Grill, Dragon Grill, Double Fish Maki, Double Anghilă Cheese Maki, Double Somon&Avocado Maki - 1780g. (64 buc.)\nAdițional (porționat): Sos de soia-240ml (Alergen:SOIA), Wasabi-40g (Alergen:MUȘTAR), Ghimbir murat-80g, Bețe sushi-4 buc.\nValori nutritive per 100g: Grăsimi-6,79, Acizi grași-2,38, Proteine-8,29, Carbohidrați-20,90, Zahăr-2,09, Sare-0,51, Kcal-179,02.\nE-uri: Emulgatori-E473; E472a; Bisulfit de sodiu-E222; Potențiator de aromă-E627; E631; Coloranți-E110; E133; E129; E151; Stabilizatori-E415: E451.\nAlergeni: Cereale, Crustacee, Pește, Soia, Lapte/Lactoză, Muștar.",
    "price": 352,
    "image": "https://storage.cdneu.syrve.com/nomenclature_images/295833/ec6bdfea-5e95-4f2d-b8ad-fdb340afc579.png",
    "weight": 1.78,
    "energyAmount": 178.883,
    "allergenGroups": [],
    "tags": [],
    "isNew": false,
    "modifierGroups": [
      {
        "id": "87a848ea-5cd3-46f8-9fe8-89cbeade363e",
        "name": "Opțiuni",
        "required": false,
        "minAmount": 0,
        "maxAmount": 1,
        "options": []
      }
    ]
  },
  {
    "id": "f7c630c2-7a62-44d8-8b67-ea992f9e57ee",
    "categoryId": "b47b4c09-862a-47e6-a70c-5c35b84ec7b0",
    "name": "Sushimaster Fusion Set",
    "description": "Double Canada Mango Shrimps, Double Fish Maki, Somon Grill Caramel, Maguro Spicy - 1014g. (32 buc.)\nAdițional (porționat): Sos de soia-120ml (Alergen:SOIA), Wasabi-20g (Alergen:MUȘTAR), Ghimbir murat-40g, Bețe sushi-2 buc.\nValori nutritive per 100g: Grăsimi-5,82, Acizi grași-2,63, Proteine-9,99, Carbohidrați-18,36, Zahăr-2,25, Sare-0,79, Kcal-165,97.\nE-uri: Potențiator de aromă-E627; E631; Stabilizatori-E415; Coloranți-E110; E133; E129; E151; Emulgatori-E473; E472a; E415; Acizi-E260; E330; Potențiator de aromă-E621; Conservant-E202; Antioxidant-E319.\nAlergeni: Cereale, Crustacee, Pește, Soia, Lapte/Lactoză, Muștar.",
    "price": 222,
    "image": "https://storage.cdneu.syrve.com/nomenclature_images/295833/6e17ce44-cc0a-4b76-b9fe-38516258526a.png",
    "weight": 1.014,
    "energyAmount": 166.672,
    "allergenGroups": [],
    "tags": [],
    "isNew": false,
    "modifierGroups": [
      {
        "id": "87a848ea-5cd3-46f8-9fe8-89cbeade363e",
        "name": "Opțiuni",
        "required": false,
        "minAmount": 0,
        "maxAmount": 1,
        "options": []
      }
    ]
  },
  {
    "id": "0b88b242-2790-4c4a-886e-ea38a524c9df",
    "categoryId": "b47b4c09-862a-47e6-a70c-5c35b84ec7b0",
    "name": "SushiMaster Kanji",
    "description": "California Tempura, Tempura Ton, Tempura Fume, Philadelphia Tempura - 1036g. (32 buc.)\nAdițional (porționat): Sos de soia-120ml (Alergen:SOIA), Wasabi-20g (Alergen:MUȘTAR), Ghimbir murat-40g, Bețe sushi-2 buc.\nValori nutritive per 100g: Grăsimi-5,66, Acizi grași-2,25, Proteine-6,69, Carbohidrați-35,1, Zahăr-2,4, Sare-0,71, Kcal-222,59.\nE-uri: Stabilizatori-E450iii; E451i; E452i; Regulator de aciditate-E260; E270; E170; Potențiator de aromă-E635; Coloranți-E110; E133; E129; E151.\nAlergeni: Cereale, Crustacee, Ouă, Pește, Soia, Lapte/Lactoză, Muștar, Susan.",
    "price": 166,
    "image": "https://storage.cdneu.syrve.com/nomenclature_images/295833/01378f00-19f5-4ddf-a0cd-39dcfc6540b9.png",
    "weight": 1.036,
    "energyAmount": 121.087,
    "allergenGroups": [],
    "tags": [],
    "isNew": false,
    "modifierGroups": [
      {
        "id": "87a848ea-5cd3-46f8-9fe8-89cbeade363e",
        "name": "Opțiuni",
        "required": false,
        "minAmount": 0,
        "maxAmount": 1,
        "options": []
      }
    ]
  },
  {
    "id": "acc30b1e-6225-4feb-8094-ed282c67369a",
    "categoryId": "b47b4c09-862a-47e6-a70c-5c35b84ec7b0",
    "name": "SushiMaster Phi♥LOVE♥delphia",
    "description": "Philadelphia Classic, Philadelphia Grill, Double Salmon Cheesy Maki, Philadelphia Tempura - 949g. (32 buc.)\nAdițional (porționat): Sos de soia-120ml (Alergen:SOIA), Wasabi-20g (Alergen:MUȘTAR), Ghimbir murat-40g, Bețe sushi-2 buc.\nValori nutritive per 100g: Grăsimi-7,13, Acizi grași-2,83, Proteine-8,28, Carbohidrați-23, Zahăr-1,74, Sare-0,44, Kcal-190,63.\nE-uri: Coloranți-E124; E110Alergeni: Cereale, Pește, Soia, Lapte/Lactoză, Muștar.",
    "price": 182,
    "image": "https://storage.cdneu.syrve.com/nomenclature_images/295833/4dcb55c2-3226-40ee-a2fa-2da7bda91eee.png",
    "weight": 0.949,
    "energyAmount": 128.997,
    "allergenGroups": [],
    "tags": [],
    "isNew": false,
    "modifierGroups": [
      {
        "id": "87a848ea-5cd3-46f8-9fe8-89cbeade363e",
        "name": "Opțiuni",
        "required": false,
        "minAmount": 0,
        "maxAmount": 1,
        "options": []
      }
    ]
  },
  {
    "id": "11275f81-d890-49bf-93ae-c861db78e018",
    "categoryId": "b47b4c09-862a-47e6-a70c-5c35b84ec7b0",
    "name": "Sushimaster Phila Number One",
    "description": "Green Somon, Philadelphia Classic, Philadelphia Big Cheese, Double Salmon Cheesy Maki, Tempura Fume, Philadelphia Tempura - 1528g. (48 buc.)\nAdițional (porționat): Sos de soia-180ml (Alergen:SOIA), Wasabi-30g (Alergen:MUȘTAR), Ghimbir murat-60g, Bețe sushi-3 buc.\nValori nutritive per 100g: Grăsimi-8,03, Acizi grași-3,12, Proteine-7,73, Carbohidrați-24,01, Zahăr-2,08, Sare-0,55, Kcal-201,41.\nE-uri: Coloranți-E110; E133; E129; E151; 124; Potențiator de aromă-E627; E631; Stabilizatori-E415; E151.\nAlergeni: Cereale, Ouă, Pește, Soia, Lapte/Lactoză, Muștar, Susan.",
    "price": 284,
    "image": "https://storage.cdneu.syrve.com/nomenclature_images/295833/8c217bdc-dbaf-4967-85ec-50a7a3aca3ac.png",
    "weight": 1.528,
    "energyAmount": 199.952,
    "allergenGroups": [],
    "tags": [],
    "isNew": false,
    "modifierGroups": [
      {
        "id": "87a848ea-5cd3-46f8-9fe8-89cbeade363e",
        "name": "Opțiuni",
        "required": false,
        "minAmount": 0,
        "maxAmount": 1,
        "options": []
      }
    ]
  },
  {
    "id": "08c8417f-0c0a-497a-b253-09d6a74224c8",
    "categoryId": "b47b4c09-862a-47e6-a70c-5c35b84ec7b0",
    "name": "SushiMaster Premium",
    "description": "Philadelphia Classic, California Fume, Somon Grill Caramel, Double California Mango, Philadelphia Tempura, Tempura Ton - 1536g. (48 buc.)\nAdițional (porționat): Sos de soia-180ml (Alergen:SOIA), Wasabi-30g (Alergen:MUȘTAR), Ghimbir murat-60g, Bețe sushi-3 buc.\nValori nutritive per 100g: Grăsimi-6,31, Acizi grași-2,39, Proteine-8,07, Carbohidrați-23,45, Zahăr-2,22, Sare-0,61, Kcal-183,46.\nE-uri: Stabilizatori-E451; E260; Coloranți-E110; E133; E129; E151; Conservant-E202; Bisulfit de sodiu-E222.\nAlergeni: Cereale, Crustacee, Ouă, Pește, Soia, Lapte/Lactoză, Muștar, Susan.",
    "price": 294,
    "image": "https://storage.cdneu.syrve.com/nomenclature_images/295833/684f9a72-47d0-42d1-90ab-3d5dead43c6c.png",
    "weight": 1.536,
    "energyAmount": 121.013,
    "allergenGroups": [],
    "tags": [],
    "isNew": false,
    "modifierGroups": [
      {
        "id": "87a848ea-5cd3-46f8-9fe8-89cbeade363e",
        "name": "Opțiuni",
        "required": false,
        "minAmount": 0,
        "maxAmount": 1,
        "options": []
      }
    ]
  }
];

// Selector per brand
export function getMenuData(brandId) {
  if (brandId === "sushimaster" || brandId === "ikura" || brandId === "welovesushi") {
    return { categories: SUSHIMASTER_CATEGORIES, products: SUSHIMASTER_PRODUCTS };
  }
  return { categories: SMASHME_CATEGORIES, products: SMASHME_PRODUCTS };
}
