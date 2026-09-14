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

export function shouldShowSteam(product, brandId = '') {
  if (!product) return false;

  const name = (product.name || '').toLowerCase();
  const cat = (product.categoryName || product.parentGroupName || product.categoryId || '').toLowerCase();
  const desc = (product.description || '').toLowerCase();
  const text = `${name} ${cat} ${desc}`;
  const brand = (brandId || product._brand || '').toLowerCase();

  // 1. Accesorii, bețe sushi, tacâmuri, ambalaje -> NICIODATĂ ABUR
  if (
    text.includes('bete') || text.includes('bețe') || text.includes('chopstick') ||
    text.includes('tacam') || text.includes('tacâm') || text.includes('furculit') ||
    text.includes('lingur') || text.includes('punga') || text.includes('pungă') ||
    text.includes('sacosa') || text.includes('ambalaj') || text.includes('cutie') ||
    text.includes('servetel') || text.includes('ghimbir') || text.includes('wasabi')
  ) {
    return false;
  }

  // 2. Sosuri, Băuturi reci, Deserturi -> NICIODATĂ ABUR
  if (
    text.includes('sos') || text.includes('sauce') || text.includes('dip') ||
    text.includes('ketchup') || text.includes('maionez') || text.includes('mayo') ||
    text.includes('mustar') || text.includes('muștar') || text.includes('bautur') ||
    text.includes('băutur') || text.includes('drink') || text.includes('cola') ||
    text.includes('pepsi') || text.includes('fanta') || text.includes('sprite') ||
    text.includes('apa') || text.includes('apă') || text.includes('water') ||
    text.includes('bere') || text.includes('beer') || text.includes('suc') ||
    text.includes('juice') || text.includes('shake') || text.includes('smoothie') ||
    text.includes('desert') || text.includes('dessert') || text.includes('inghetat') ||
    text.includes('înghețat') || text.includes('cake') || text.includes('dulce') ||
    text.includes('cookie') || text.includes('clatit') || text.includes('waffle')
  ) {
    return false;
  }

  // 3. Bucătărie asiatică / Sushi (Roll Master, Sushi Master, Love Sushi, Poki Woki)
  const isAsianOrSushi = (
    brand.includes('roll') || brand.includes('sushi') || brand.includes('poki') ||
    text.includes('sushi') || text.includes('roll') || text.includes('maki') ||
    text.includes('nigiri') || text.includes('sashimi') || text.includes('gunkan') ||
    text.includes('poke') || text.includes('edamame') || text.includes('tataki') ||
    text.includes('tempura')
  );

  if (isAsianOrSushi) {
    // SĂ RĂMÂNĂ ABURI DOAR LA SUPE ȘI WOK
    const isSoupOrWok = (
      text.includes('supa') || text.includes('supă') || text.includes('supe') ||
      text.includes('soup') || text.includes('ramen') || text.includes('miso') ||
      text.includes('tom yum') || text.includes('tom kha') || text.includes('pho') ||
      text.includes('udon') || text.includes('ciorba') || text.includes('ciorbă') ||
      text.includes('wok') || text.includes('noodles') || text.includes('nudli') ||
      text.includes('taitei') || text.includes('tăiței') || text.includes('yakisoba')
    );
    return isSoupOrWok;
  }

  // 4. Mâncare caldă generică (SmashMe, Crunch): burgeri, pui prăjit cald, cartofi
  const isHotBurgerOrChicken = (
    text.includes('burger') || text.includes('smash') || text.includes('crispy') ||
    text.includes('strips') || text.includes('wings') || text.includes('aripioar') ||
    text.includes('cartofi') || text.includes('fries') || text.includes('nuggets') ||
    text.includes('hot dog') || text.includes('calda') || text.includes('cald') ||
    text.includes('fierbinte')
  );

  return isHotBurgerOrChicken;
}
