/**
 * visualFxUtils.js
 * Utilitar pentru determinarea efectelor vizuale pe produse.
 * 
 * Reguli stricte:
 * 1. Accesorii, ambalaje, bețe sushi, tacâmuri, sosuri, băuturi, deserturi -> NICIODATĂ ABUR.
 * 2. La brandurile asiatice/sushi (rollmaster, sushimaster, lovesushi, pokiwoki) sau produse de sushi/rolls:
 *    -> ABURI SUNT PERMIȘI DOAR LA SUPE ȘI WOK! (sushi-ul rece, platourile, seturile etc. NU au abur)
 * 3. La mâncare caldă de tip burger/chicken (smashme, crunch):
 *    -> Abur cald pe burgeri calzi, pui prăjit cald, cartofi prăjiți calzi.
 */

/**
 * visualFxUtils.js
 * Utilitar pentru determinarea efectelor vizuale pe produse.
 * 
 * Reguli stricte:
 * 1. Accesorii, ambalaje, bețe sushi, tacâmuri, sosuri de sine stătătoare, băuturi, deserturi -> NICIODATĂ ABUR.
 * 2. La brandurile asiatice/sushi (rollmaster, sushimaster, lovesushi, pokiwoki):
 *    -> ABURI SUNT PERMIȘI EXCLUSIV LA SUPE ȘI WOK! (sushi-ul rece, platourile, seturile, maki, nigiri NU au abur).
 * 3. La mâncare caldă de tip burger/chicken (smashme, crunch):
 *    -> Abur cald pe burgeri calzi, pui prăjit cald, cartofi prăjiți calzi.
 */

export function shouldShowSteam(product, brandId = '', categoryName = '') {
  if (!product) return false;

  const name = (product.name || '').toLowerCase();
  const cat = (categoryName || product.categoryName || product.parentGroupName || '').toLowerCase();
  const brand = (brandId || product._brand || '').toLowerCase();

  // 1. STANDALONE ACCESORIES / PACKAGING / EXTRAS (Niciodată aburi)
  if (
    name.startsWith('bete ') || name.startsWith('bețe ') || name.includes('chopstick') ||
    name.includes('tacam') || name.includes('tacâm') || name.includes('furculit') ||
    name.includes('lingur') || name.startsWith('punga') || name.startsWith('pungă') ||
    name.includes('sacosa') || name.includes('ambalaj') || name.includes('cutie') ||
    name.includes('servetel') || name === 'ghimbir' || name === 'wasabi'
  ) {
    return false;
  }

  // 2. STANDALONE SOSURI (Niciodată aburi)
  // Atenție: Verificăm categoria sau dacă numele produsului este un sos de sine stătător.
  // NU verificăm descrierea ingredientelor, deoarece mâncărurile gătite (wok, supe) conțin sosuri ca ingredient!
  const isStandaloneSauce = (
    cat === 'sos' || cat === 'sosuri' || cat.includes('sauce') ||
    name.startsWith('sos ') || name.startsWith('sosul ') || name.startsWith('dip ') ||
    name.startsWith('ketchup') || name.startsWith('maionez') || name.startsWith('mustar') || name.startsWith('muștar')
  );
  if (isStandaloneSauce) return false;

  // 3. STANDALONE BĂUTURI RECI (Niciodată aburi)
  const isColdDrink = (
    cat === 'bauturi' || cat === 'băuturi' || cat.includes('drink') || cat.includes('beverage') ||
    name.startsWith('coca-cola') || name.startsWith('pepsi') || name.startsWith('fanta') ||
    name.startsWith('sprite') || name.startsWith('apa ') || name.startsWith('apă ') ||
    name.startsWith('bere ') || name.startsWith('beer ') || name.startsWith('cidru') ||
    name.startsWith('suc ') || name.startsWith('juice') || name.startsWith('fresh ') ||
    name.startsWith('limonad') || name.startsWith('lemonade') || name.startsWith('smoothie') ||
    name.startsWith('frappe') || name.startsWith('ice tea') || name.startsWith('lipton') ||
    name.startsWith('fuze') || name.startsWith('red bull') || name.startsWith('energy drink')
  );
  if (isColdDrink) return false;

  // 4. STANDALONE DESERTURI (Niciodată aburi)
  const isDessert = (
    cat === 'desert' || cat === 'deserturi' || cat.includes('dessert') ||
    name.includes('mochi') || name.includes('cheesecake') || name.includes('tort') ||
    name.includes('clatit') || name.includes('clătit') || name.includes('waffle') ||
    name.includes('inghetat') || name.includes('înghețat') || name.includes('lava cake') ||
    name.includes('tiramisu') || name.includes('donut') || name.includes('gogoas') ||
    name.includes('churros')
  );
  if (isDessert) return false;

  // 5. WOK & SUPE (Trebuie să aibă aburi ÎNTOTDEAUNA, indiferent de brand!)
  const isWok = (
    cat.includes('wok') ||
    name.includes('wok') || name.includes('soba') || name.includes('udon') ||
    name.includes('noodles') || name.includes('nudli') || name.includes('taitei') ||
    name.includes('tăiței') || name.includes('yakisoba') || name.includes('pad thai')
  );

  const isSoup = (
    cat.includes('soup') || cat.includes('supa') || cat.includes('supă') || cat.includes('supe') || cat.includes('ciorb') ||
    name.includes('supa') || name.includes('supă') || name.includes('supe') ||
    name.includes('soup') || name.includes('miso') || name.includes('tom yum') ||
    name.includes('tom kha') || name.includes('pho ') || name.startsWith('pho') ||
    name.includes('ramen') || name.includes('ciorba') || name.includes('ciorbă')
  );

  // Excludem salatele reci sau poke bowls chiar dacă sunt în categoria YAKITORI&SOUP&SALAT
  const isColdSaladOrPoke = (
    name.includes('salat') || name.includes('salad') ||
    name.includes('poke') || name.includes('wakame') || name.includes('edamame')
  );

  if ((isWok || isSoup) && !isColdSaladOrPoke) {
    return true;
  }

  // 6. Bucătărie asiatică / Sushi (Roll Master, Sushi Master, Love Sushi, Poki Woki)
  const isAsianOrSushi = (
    brand.includes('roll') || brand.includes('sushi') || brand.includes('poki') ||
    cat.includes('sushi') || cat.includes('roll') || cat.includes('maki') || cat.includes('nigiri')
  );

  if (isAsianOrSushi) {
    // La sushi: STRICT DOAR SUPE ȘI WOK!
    // Sushi rolls, nigiri, sashimi, maki, platouri NU au abur!
    return false;
  }

  // 7. Burgeri & Pui cald (SmashMe, Crunch):
  const isHotBurgerOrChicken = (
    name.includes('burger') || name.includes('smash') || name.includes('crispy') ||
    name.includes('strips') || name.includes('wings') || name.includes('aripioar') ||
    name.includes('cartofi') || name.includes('fries') || name.includes('nuggets') ||
    name.includes('hot dog') || cat.includes('burger') || cat.includes('chicken') ||
    cat.includes('fries') || cat.includes('combo')
  );

  return isHotBurgerOrChicken;
}
