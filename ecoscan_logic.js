// ── CARBON DATABASE (from IPCC, ecoinvent, Quantis LCA studies) ────────────
// Each entry: { co2, rating, stages:{raw,mfg,ship,use,eol}, unit, desc, alts }

// ── FIREBASE (loaded after page ready) ──
let _fbApp=null, _fbAuth=null, _fbDb=null, _fbUser=null;
async function initFirebase() {
  // dynamically import to avoid blocking scanner load
  const {initializeApp}  = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js');
  const {getAuth, onAuthStateChanged, signOut} = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
  const {getFirestore, doc, setDoc, updateDoc, collection, addDoc, increment, serverTimestamp} = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
  _fbApp  = initializeApp(FIREBASE_CONFIG);
  _fbAuth = getAuth(_fbApp);
  _fbDb   = getFirestore(_fbApp);
  // expose firestore helpers on window for saveScan
  window._fs = {doc, setDoc, updateDoc, collection, addDoc, increment, serverTimestamp};
  onAuthStateChanged(_fbAuth, user => {
    _fbUser = user;
    if (!user) { window.location.href='login.html'; return; }
    const initials=(user.displayName||user.email).slice(0,2).toUpperCase();
    const navAvatar = document.getElementById('userInitial');
    if(navAvatar) {
      if(user.photoURL) {
        navAvatar.innerHTML = `<img src="${user.photoURL}" alt="${initials}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;">`;
      } else {
        navAvatar.textContent = initials;
      }
    }
    const navUname = document.getElementById('userName');
    if(navUname) navUname.textContent = user.displayName||user.email.split('@')[0];
    const logoutBtn = document.getElementById('logoutBtn');
    if(logoutBtn) logoutBtn.onclick = () => { import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js').then(m=>m.signOut(_fbAuth)).then(()=>location.href='login.html'); };
    // load scan history for this user
    loadScanHistory();
  });
}

async function saveScan(d) {
  if (!_fbUser || !_fbDb) return;
  const {doc, setDoc, updateDoc, collection, addDoc, increment, serverTimestamp} = window._fs;
  try {
    const regId = _fbUser.email.split('@')[0].toUpperCase();
    const dept  = ''; // we'd fetch from student profile
    // 1. Add scan document
    await addDoc(collection(_fbDb,'scans'),{
      uid: _fbUser.uid,
      studentId: regId,
      productName: d.name,
      category: d.catKey,
      co2: d.total,
      rating: d.rating,
      barcode: d.barcode||'',
      method: d.method,
      timestamp: serverTimestamp()
    });
    // 2. Update student aggregate
    await updateDoc(doc(_fbDb,'students',_fbUser.uid),{
      totalScans: increment(1),
      totalCO2: increment(d.total||0),
    }).catch(async ()=>{
      // first scan — create student doc
      await setDoc(doc(_fbDb,'students',_fbUser.uid),{email:_fbUser.email,name:_fbUser.displayName||'',regId,dept:'Other',totalScans:1,totalCO2:d.total||0,joinedAt:new Date().toISOString()});
    });
    // 3. Update campus stats
    const statsRef = doc(_fbDb,'stats','global');
    const today = new Date().toISOString().slice(0,10);
    await setDoc(statsRef,{
      totalScans: increment(1),
      totalCo2: increment(d.total||0),
      [`catBreakdown.${d.catKey}`]: increment(1),
      lastUpdated: serverTimestamp()
    },{merge:true}).catch(()=>{});
    toast('Scan saved to VIT campus database!');
    // refresh history
    loadScanHistory();
  } catch(e) { console.warn('Firestore save failed:',e); }
}

const CDB = {
  // ── BEVERAGES ──
  cola:      {co2:0.4, r:'B', st:[15,30,20,25,10], unit:'500ml can', desc:'Carbonated soft drinks have moderate footprints. Aluminium cans are highly recyclable.', alts:['Tap water','Home-made lemonade','Reusable bottle refill']},
  beer:      {co2:0.5, r:'B', st:[20,35,22,15,8],  unit:'500ml bottle', desc:'Barley cultivation and malting dominate the footprint. Draught has lower packaging impact.', alts:['Local craft draught beer','Home-brew kit','Kombucha']},
  wine:      {co2:1.5, r:'C', st:[25,20,35,10,10], unit:'750ml bottle', desc:'Glass bottling and long-distance shipping drive emissions. Local wines cut transport CO₂.', alts:['Local winery wine','Bag-in-box wine','Biodynamic wine']},
  spirits:   {co2:2.0, r:'C', st:[30,25,25,10,10], unit:'700ml bottle', desc:'Distillation is energy-intensive and glass shipping adds significant transport emissions.', alts:['Local gin/whisky','Wine-based drinks','Non-alcoholic alternatives']},
  water_bottle:{co2:0.15, r:'A', st:[10,40,20,5,25], unit:'500ml PET', desc:'PET plastic production and end-of-life disposal are the key hotspots. Plastic waste is significant.', alts:['Tap water + reusable bottle','Filtered tap water','Glass bottle water']},
  coffee:    {co2:0.28, r:'B', st:[60,10,12,10,8], unit:'cup/200ml', desc:'Coffee farming (land use, fertilizers) is the dominant stage. Espresso uses 5× less water than filter.', alts:['Shade-grown certified coffee','Local chicory blend','Tea (5× lower CO₂)']},
  tea:       {co2:0.05, r:'A', st:[55,15,12,10,8], unit:'cup', desc:'Tea has the lowest CO₂ of all hot drinks. Avoid boiling excess water to minimise usage emissions.', alts:['Loose-leaf tea','Herbal tea','Local herb infusions']},
  milk:      {co2:1.0, r:'C', st:[65,10,8,12,5],   unit:'1L', desc:'Dairy cattle produce methane, making conventional milk one of the highest food-category emitters.', alts:['Oat milk (80% less CO₂)','Soy milk','Almond milk (dry regions only)']},
  oat_milk:  {co2:0.2, r:'A', st:[50,20,15,8,7],   unit:'1L', desc:'Oat milk requires far less land and water than dairy and emits ~80% less CO₂ per litre.', alts:['Homemade oat milk','Rice milk','Soy milk']},
  juice:     {co2:0.6, r:'B', st:[30,25,25,8,12],  unit:'1L carton', desc:'Juice requires large amounts of fruit and pasteurisation energy. Local seasonal juice is better.', alts:['Whole fresh fruit','Local pressed juice','Water + fruit slice']},

  // ── FOOD ──
  beef:      {co2:27.0, r:'D', st:[72,8,7,7,6],  unit:'1kg', desc:'Beef has the highest carbon footprint of all foods due to methane emissions from cattle and land use change.', alts:['Chicken (4× less CO₂)','Lentils (50× less CO₂)','Plant-based burger']},
  chicken:   {co2:6.9,  r:'C', st:[50,18,10,14,8], unit:'1kg', desc:'Poultry is significantly lower than beef but still has considerable footprint from feed production.', alts:['Lentils','Tofu','Eggs']},
  pork:      {co2:12.0, r:'D', st:[55,15,10,12,8], unit:'1kg', desc:'Pig farming produces significant methane and nitrous oxide from manure management.', alts:['Chicken','Fish (wild caught)','Legumes']},
  fish_wild: {co2:3.0,  r:'B', st:[40,15,25,10,10], unit:'1kg', desc:'Wild-caught fish has variable footprint based on fishing method. Trawling is most intensive.', alts:['Farmed mussels/oysters','Tinned sardines','Plant protein']},
  fish_farmed:{co2:5.0, r:'C', st:[50,20,15,10,5], unit:'1kg', desc:'Aquaculture feed (often fish meal) and energy use drive the footprint of farmed fish.', alts:['Wild-caught local fish','Mussels (lowest seafood CO₂)','Canned fish']},
  eggs:      {co2:4.5,  r:'B', st:[60,12,10,10,8], unit:'12 eggs', desc:'Egg production is driven primarily by feed crops and housing energy. Free-range has similar footprint.', alts:['Tofu scramble','Lentil dishes','Local backyard eggs']},
  cheese:    {co2:13.5, r:'D', st:[65,10,8,10,7], unit:'1kg', desc:'Cheese requires ~10L of milk per kg, concentrating all dairy emissions. Hard cheeses are worst.', alts:['Nutritional yeast','Cashew cheese','Reduced-fat soft cheese']},
  bread:     {co2:0.8,  r:'A', st:[45,25,12,10,8], unit:'800g loaf', desc:'Wheat farming, milling and baking are the main stages. Sourdough requires less yeast energy.', alts:['Home-baked bread','Wholegrain loaf','Local artisan bakery']},
  pasta:     {co2:1.5,  r:'A', st:[50,20,15,8,7],  unit:'500g', desc:'Durum wheat cultivation and drying dominate. Wholewheat pasta uses less processing energy.', alts:['Wholewheat pasta','Legume-based pasta','Homemade pasta']},
  rice:      {co2:2.7,  r:'B', st:[70,10,8,7,5],   unit:'1kg', desc:'Flooded paddy fields produce significant methane. Basmati and jasmine have lower footprints than risotto rice.', alts:['Lentils and legumes','Quinoa','Wholegrain couscous']},
  chocolate: {co2:19.0, r:'D', st:[75,8,8,5,4],   unit:'1kg', desc:'Cocoa farming drives deforestation and high land-use emissions. Dark chocolate is slightly better than milk.', alts:['Fair-trade dark chocolate','Carob products','Fruit & nut mix']},
  chips:     {co2:2.5,  r:'B', st:[30,35,15,8,12], unit:'200g bag', desc:'Potato growing has a modest footprint but frying, packaging and the plastics disposal drive overall impact.', alts:['Home-baked crisps','Fresh vegetables','Rice cakes']},
  cookies:   {co2:3.5,  r:'C', st:[35,30,15,8,12], unit:'400g pack', desc:'Butter, sugar and packaging contribute most. Palm oil in biscuits links to deforestation.', alts:['Oat flapjack (no palm oil)','Home-baked biscuits','Fresh fruit']},
  frozen_pizza:{co2:4.5, r:'C', st:[30,30,15,15,10], unit:'500g', desc:'Refrigerated transport and storage account for ~15% of footprint alongside cheese and meat toppings.', alts:['Homemade pizza','Veggie pizza','Flatbread wrap pizza']},
  cereal:    {co2:1.8,  r:'B', st:[40,25,15,10,10], unit:'500g box', desc:'Grain farming and processing are the primary sources. Whole grain options with less sugar are better.', alts:['Oat porridge (lowest)','Muesli','Home-made granola']},
  nuts:      {co2:2.3,  r:'B', st:[55,15,15,8,7],  unit:'200g pack', desc:'Nut trees sequester carbon but irrigation (especially almonds) can be intensive. Local hazelnuts are best.', alts:['Local hazelnuts / walnuts','Sunflower seeds','Legumes']},
  vegetables:{co2:0.4,  r:'A', st:[45,15,20,12,8], unit:'1kg', desc:'Fresh vegetables have the lowest food footprint. Seasonal local produce eliminates air freight emissions.', alts:['Home-grown vegetables','Farmers market produce','CSA box']},
  fruits:    {co2:0.5,  r:'A', st:[35,10,35,12,8], unit:'1kg', desc:'Seasonal local fruit has a very low footprint. Imported tropical fruit by air can be 50× higher.', alts:['Local seasonal fruit','Home-grown berries','Frozen local fruit']},
  tofu:      {co2:2.0,  r:'A', st:[55,20,10,8,7],  unit:'400g', desc:'Tofu provides similar protein to meat at a fraction of the carbon footprint. Look for non-GMO soy.', alts:['Home-made tofu','Lentils (even lower)','Chickpeas']},
  lentils:   {co2:0.9,  r:'A', st:[55,15,12,10,8], unit:'500g', desc:'Legumes fix their own nitrogen, cutting fertilizer needs. One of the lowest-footprint protein sources.', alts:['Chickpeas','Kidney beans','Home-grown beans']},
  yogurt:    {co2:2.2,  r:'B', st:[60,18,10,7,5],  unit:'500g', desc:'Dairy yogurt carries the full footprint of milk production. Greek yogurt uses ~3× more milk per jar.', alts:['Oat yogurt','Coconut yogurt','Soy yogurt']},
  butter:    {co2:9.0,  r:'D', st:[68,10,9,7,6],   unit:'250g', desc:'Butter requires ~20L of milk per kg, concentrating all dairy emissions significantly.', alts:['Olive oil','Plant-based spread','Nut butter']},

  // ── PERSONAL CARE ──
  shampoo:   {co2:2.8,  r:'B', st:[20,35,20,15,10], unit:'250ml bottle', desc:'HDPE plastic bottles and surfactant production dominate. Solid shampoo bars cut plastic by 99%.', alts:['Shampoo bar (zero plastic)','Refillable shampoo subscription','DIY egg/oil treatment']},
  shower_gel:{co2:3.2,  r:'C', st:[20,35,18,17,10], unit:'250ml bottle', desc:'Similar profile to shampoo. The hot-water shower phase contributes ~17% of lifecycle emissions.', alts:['Bar soap (1.5× less CO₂)','Solid body wash bar','Natural soap']},
  toothpaste:{co2:0.5,  r:'A', st:[20,35,20,15,10], unit:'100ml tube', desc:'Toothpaste tubes are difficult to recycle. Toothpaste tablets eliminate the tube entirely.', alts:['Toothpaste tablets','Bamboo toothbrush combo','Baking soda + coconut oil']},
  deodorant: {co2:1.5,  r:'B', st:[15,40,20,15,10], unit:'150ml', desc:'Aerosol propellants and aluminium can manufacture are the main hotspots.', alts:['Deodorant stick (no aerosol)','Natural crystal deodorant','Cream deodorant in glass jar']},
  sunscreen: {co2:2.0,  r:'B', st:[25,35,20,10,10], unit:'200ml', desc:'Chemical UV filter synthesis and plastic packaging drive emissions. Reef-safe mineral options exist.', alts:['Mineral zinc sunscreen in tin','Solid sunscreen bar','SPF clothing as supplement']},

  // ── HOUSEHOLD ──
  detergent: {co2:3.5,  r:'C', st:[30,30,18,12,10], unit:'1.5kg box', desc:'Surfactant synthesis from petrochemicals is the biggest hotspot. Concentrated formats need less packaging.', alts:['Eco concentrate strips','Refillable laundry brand','Washing soda + soap flakes']},
  dishwasher_tabs:{co2:2.0, r:'B', st:[35,25,18,12,10], unit:'40 tabs', desc:'Phosphate production and packaging plastic contribute most. Eco-certified tabs use plant surfactants.', alts:['DIY citric acid + baking soda','Eco-certified brand','Hand washing (less) hot water']},
  toilet_paper:{co2:1.4, r:'B', st:[40,25,15,12,8], unit:'4 rolls', desc:'Virgin wood pulp and bleaching processes are the main hotspots. Recycled content cuts footprint by 30%.', alts:['100% recycled TP','Bamboo toilet paper','Bidet + cloth']},
  plastic_bag:{co2:0.033, r:'B', st:[30,45,10,5,10], unit:'single bag', desc:'Each plastic bag has small individual footprint but billions are used — collective impact is enormous.', alts:['Reusable cotton tote','Jute bag','Reusable nylon bag']},

  // ── ELECTRONICS ──
  smartphone:{co2:70, r:'D', st:[70,15,5,8,2], unit:'device lifetime', desc:'Manufacturing — especially the processor and display — accounts for 70% of a smartphone\'s total emissions.', alts:['Refurbished phone','Fairphone (repairability)','Keep phone 3+ years']},
  laptop:    {co2:330, r:'D', st:[68,15,5,10,2], unit:'device lifetime', desc:'Chip fabrication, aluminium chassis and battery production dominate the manufacturing stage.', alts:['Refurbished laptop','Cloud thin client','Extend device lifespan']},
  earphones: {co2:12, r:'C', st:[60,20,8,9,3], unit:'pair', desc:'Small electronics have hidden footprints due to rare earth materials in drivers and rechargeable cells.', alts:['Wired earphones (no battery)','Repaired earphones','Second-hand headphones']},
  charger:   {co2:3.5, r:'B', st:[55,25,10,5,5], unit:'usb charger', desc:'Copper winding and transformer core materials drive manufacturing emissions.', alts:['Multi-device universal charger','Solar charging bank','Extend charger lifespan']},

  // ── PACKAGING ──
  glass_bottle:{co2:0.5, r:'B', st:[50,30,12,3,5], unit:'500ml', desc:'Glass production is energy-intensive but infinitely recyclable. Reuse cuts emissions by 90%.', alts:['Reuse & refill glass bottle','Carton','Aluminium bottle']},
  aluminium_can:{co2:0.17, r:'A', st:[35,40,10,5,10], unit:'330ml can', desc:'Aluminium smelting is energy-intensive but recycling uses 95% less energy. Always recycle.', alts:['Glass bottle refillable','Tap water','Home-brewed kombucha']},
  cardboard: {co2:0.3, r:'A', st:[40,30,15,5,10], unit:'1kg', desc:'Cardboard from recycled fibre uses 50% less energy than virgin pulp. Compostable at end of life.', alts:['Recycled cardboard','Mushroom packaging','Reusable containers']},
  plastic_bottle:{co2:0.33, r:'C', st:[30,40,10,5,15], unit:'500ml PET', desc:'PET plastic requires crude oil and creates persistent waste. Only 30% of plastic bottles are recycled.', alts:['Reusable steel bottle','Glass bottle','Tap water filter']},

  // ── DEFAULT FALLBACK ──
  generic:   {co2:2.0, r:'B', st:[30,30,20,12,8], unit:'product', desc:'Based on average consumer product lifecycle data. Actual values vary by specific product and region.', alts:['Buy second-hand','Choose products with eco-labels','Extend product lifespan']},

  // ── CLOTHING ──
  tshirt:    {co2:7.0,  r:'C', st:[40,35,10,8,7],  unit:'cotton T-shirt', desc:'Cotton farming uses 20,000L of water per kg. Dyeing and finishing add chemical and energy loads.', alts:['Organic cotton tee','Second-hand/thrifted shirt','Bamboo fabric tee']},
  jeans:     {co2:33.4, r:'D', st:[35,40,10,8,7],  unit:'pair of jeans', desc:'Denim production — from cotton to stonewashing — is one of the most water- and chemical-intensive processes.', alts:['Thrifted denim','Organic cotton jeans','Repair & extend jeans life']},
  hoodie:    {co2:20.0, r:'D', st:[35,40,10,8,7],  unit:'polyester hoodie', desc:'Synthetic fibres shed microplastics with every wash and are derived from crude oil.', alts:['Secondhand hoodie','Organic cotton sweater','Fleece from recycled bottles']},
  shoes:     {co2:14.0, r:'D', st:[40,40,10,6,4],  unit:'pair of shoes', desc:'Rubber soles, synthetic uppers and gluing processes create a high manufacturing footprint.', alts:['Vegan leather shoes','Second-hand trainers','Repair soles rather than replace']},

  // ── STATIONERY ──
  notebook:  {co2:1.9,  r:'B', st:[50,25,12,8,5],  unit:'80-page notebook', desc:'Virgin paper production consumes trees and bleaching chemicals. Recycled notebooks cut footprint by ~30%.', alts:['Recycled-paper notebook','Digital note-taking','Refillable paper pads']},
  pen:       {co2:0.3,  r:'A', st:[30,45,15,5,5],  unit:'ballpoint pen', desc:'Plastic barrel and ink production are the main hotspots. Refillable pens eliminate barrel waste.', alts:['Refillable ballpoint pen','Pencil (renewable wood)','Digital stylus']},
  marker:    {co2:0.9,  r:'B', st:[25,45,15,8,7],  unit:'marker/highlighter', desc:'Solvent-based ink and plastic barrel contribute most. Water-based markers are better.', alts:['Water-based markers','Refillable markers','Coloured pencils']},

  // ── COOKING ──
  cooking_oil:{co2:3.8, r:'C', st:[60,15,12,8,5],  unit:'1L bottle', desc:'Palm oil drives deforestation; sunflower oil is water-intensive. Olive oil from Mediterranean is moderate.', alts:['Locally-pressed mustard oil','Cold-pressed sunflower oil','Certified RSPO palm oil']},
  ice_cream:  {co2:4.5, r:'C', st:[55,20,12,10,3], unit:'500ml tub', desc:'Dairy base and freezer energy chain (from factory to home) drive the footprint. Vegan options emit 50% less.', alts:['Oat milk ice cream','Sorbet (fruit-based)','Home-made banana nice cream']},

  // ── HEALTH & HYGIENE ──
  medicine:  {co2:1.2,  r:'B', st:[20,50,15,5,10], unit:'blister pack', desc:'Active pharmaceutical ingredient synthesis is energy-intensive. Blister PVC is hard to recycle.', alts:['Generic drugs (same formula)','Glass-bottle medicines','Preventive healthcare']},
  sanitizer: {co2:1.0,  r:'B', st:[20,45,18,10,7], unit:'200ml bottle', desc:'Ethanol production and HDPE plastic bottle drive emissions. Refillable dispensers cut waste significantly.', alts:['Refillable hand sanitizer','Soap and water (equally effective)','Ethanol from sugarcane']},
  face_mask:  {co2:0.08, r:'A', st:[25,50,15,5,5],  unit:'single-use mask', desc:'Each disposable mask is small but billions used daily add up. N95 has higher mfg footprint than surgical.', alts:['Reusable cloth mask','Washable N95','Upcycled-fabric mask']},
  hair_dye:  {co2:3.5,  r:'C', st:[20,45,15,12,8], unit:'kit', desc:'PPD and ammonia synthesis are petrochemical-intensive. Packaging (foil, plastic tub) adds to waste.', alts:['Henna (plant-based)','Semi-permanent dye','Ammonia-free brand']},
  soap_bar:  {co2:0.9,  r:'A', st:[15,40,20,15,10], unit:'100g bar', desc:'Bar soap uses 5× less packaging than liquid soap bottles and has a lower water footprint per wash.', alts:['Zero-waste soap bar','Organic castile bar','Shampoo + body bar combo']},

  // ── HOME & LIFESTYLE ──
  newspaper: {co2:0.9,  r:'B', st:[45,25,15,8,7],  unit:'daily newspaper', desc:'Newsprint from virgin pulp and water-based inks contribute most. Digital news eliminates paper entirely.', alts:['Digital news subscription','Recycled newsprint paper','Share/borrow newspaper']},
  candle:    {co2:3.0,  r:'C', st:[20,45,15,15,5], unit:'200g candle', desc:'Paraffin wax is derived from petroleum. Burning releases soot and VOCs. Soy/beeswax are cleaner.', alts:['Soy wax candle','Beeswax candle','LED candle (zero emissions)']},
  paint:     {co2:4.5,  r:'C', st:[35,35,15,10,5], unit:'1L tin', desc:'Titanium dioxide pigment and solvent production are major hotspots. VOC emissions during application add indoor impact.', alts:['Low-VOC/zero-VOC paint','Natural clay plaster','Limewash paint']},
  fuel:      {co2:2.4,  r:'D', st:[10,10,5,70,5],  unit:'1 litre petrol', desc:'Combustion in engine dominates lifecycle. Each litre of petrol produces ~2.4 kg CO₂ directly on burning.', alts:['EV + renewable electricity','Public transport','Bicycle / walking']},
};

// ── CATEGORY KEYWORD MAP ──
// Covers: Open Food Facts categories, UPC Item DB categories, OCR text, brand names
const CAT_MAP = [
  // beverages
  [['cola','pepsi','coca-cola','fanta','sprite','soda','soft drink','carbonated','aerated','fizzy'],  'cola'],
  [['beer','lager','ale','stout','pilsner','bier','kingfisher','budweiser','heineken'],               'beer'],
  [['wine','vino','vin','prosecco','champagne','cava','merlot','cabernet'],                           'wine'],
  [['whisky','whiskey','vodka','rum','gin','tequila','brandy','spirits','liqueur'],                   'spirits'],
  [['mineral water','still water','sparkling water','drinking water','packaged water'],               'water_bottle'],
  [['coffee','espresso','latte','cappuccino','nescafe','nespresso','bru coffee'],                     'coffee'],
  [['tea','chai','matcha','herbal tea','green tea','black tea','tata tea','lipton'],                  'tea'],
  [['whole milk','skimmed milk','dairy milk','semi-skimmed','full cream milk','toned milk','lait'],   'milk'],
  [['oat milk','oat drink','oat-based','oatly'],                                                      'oat_milk'],
  [['juice','orange juice','apple juice','smoothie','nectar','real juice','tropicana'],               'juice'],
  // food
  [['beef','steak','mince','hamburger','burger','ground beef'],                                       'beef'],
  [['chicken','poultry','broiler','hen'],                                                             'chicken'],
  [['pork','pig','ham','bacon','sausage','salami','chorizo'],                                        'pork'],
  [['salmon','tuna','cod','haddock','trout','fish fillet','aquaculture'],                            'fish_farmed'],
  [['sardine','mackerel','herring','anchovy','wild caught fish'],                                    'fish_wild'],
  [['eggs','egg carton','dozen eggs'],                                                               'eggs'],
  [['cheese','cheddar','mozzarella','brie','camembert','parmesan','gouda','paneer'],                 'cheese'],
  [['bread','loaf','baguette','sourdough','toast','roll bun','whole wheat bread'],                   'bread'],
  [['pasta','spaghetti','penne','fusilli','noodle','macaroni','maggi','yippee'],                     'pasta'],
  [['rice','basmati','jasmine','brown rice','india gate','daawat'],                                  'rice'],
  [['chocolate','cocoa','cacao','nutella','dark chocolate','cadbury','kitkat','dairy milk bar'],      'chocolate'],
  [['chips','crisps','pringles','doritos','nachos','kurkure','lays','bingo','haldiram snack'],       'chips'],
  [['biscuit','cookie','digestive','oreo','crackers','wafer','britannia','hide & seek','parle'],     'cookies'],
  [['pizza','frozen pizza'],                                                                          'frozen_pizza'],
  [['cereal','granola','muesli','cornflakes','porridge','oats','kelloggs','quaker'],                 'cereal'],
  [['nuts','almond','walnut','cashew','hazelnut','peanut','pistachio','mixed nuts'],                 'nuts'],
  [['vegetables','broccoli','spinach','lettuce','cauliflower','capsicum'],                           'vegetables'],
  [['fruits','apple pack','orange bag','banana bunch','mango'],                                      'fruits'],
  [['tofu','soya','tempeh','edamame','soy protein'],                                                 'tofu'],
  [['lentil','legume','chickpea','rajma','kidney bean','dhal','dal','moong'],                        'lentils'],
  [['yogurt','yoghurt','curd','dahi','quark','fromage'],                                             'yogurt'],
  [['butter','margarine','ghee','cooking butter'],                                                   'butter'],
  // personal care — most specific first to avoid false matches
  [['deodorant','antiperspirant','body spray','deo spray','deo stick','underarm'],                  'deodorant'],
  [['shampoo','hair wash','hair care','conditioner','hair fall','hair oil treatment'],               'shampoo'],
  [['shower gel','body wash','body foam','bathing gel','bath gel'],                                  'shower_gel'],
  [['hand wash','handwash','hand soap','foam soap','liquid soap'],                                   'shower_gel'],
  [['soap bar','bathing bar','toilet soap','beauty soap'],                                           'shower_gel'],
  [['toothpaste','tooth paste','toothbrush','dental','mouth wash','oral care'],                     'toothpaste'],
  [['sunscreen','sunblock','spf','sun protection','uv cream','sun lotion'],                         'sunscreen'],
  [['face wash','face cream','moisturiser','moisturizer','lotion','serum','toner','face care'],     'shower_gel'],
  // household
  [['detergent','laundry powder','washing powder','fabric softener','washing liquid','surf','ariel'],'detergent'],
  [['dishwash','dish soap','utensil cleaner','vim','pril dish'],                                    'dishwasher_tabs'],
  [['toilet paper','tissue','paper towel','kitchen roll','napkins'],                                'toilet_paper'],
  // electronics
  [['smartphone','mobile phone','cell phone','android phone','iphone model','galaxy phone'],        'smartphone'],
  [['laptop','notebook computer','macbook','chromebook'],                                            'laptop'],
  [['earphone','earbud','headphone','airpod','tws','true wireless','neckband'],                     'earphones'],
  [['charger','usb cable','adapter','power bank','charging'],                                       'charger'],
  // packaging / generic containers
  [['glass bottle','glass jar','ketchup jar'],                                                      'glass_bottle'],
  [['aluminium can','aluminum can','tin can','canned'],                                             'aluminium_can'],
  [['cardboard box','corrugated','carton box'],                                                     'cardboard'],
  // water bottle LAST (most generic, don't let it grab deodorant etc.)
  [['water bottle','reusable bottle','sipper','flask'],                                             'water_bottle'],
  // clothing
  [['t-shirt','tshirt','cotton shirt','polo shirt','graphic tee','vest top'],                      'tshirt'],
  [['jeans','denim','trousers','jeans pant','slim fit denim'],                                      'jeans'],
  [['hoodie','sweatshirt','pullover','fleece jacket','polyester jacket'],                           'hoodie'],
  [['shoes','sneakers','trainers','boots','sandals','footwear','running shoe'],                     'shoes'],
  // stationery
  [['notebook','exercise book','composition book','spiral pad','ruled book'],                      'notebook'],
  [['ballpoint pen','ball pen','gel pen','ink pen','reynolds','cello pen','classmate pen'],         'pen'],
  [['marker','highlighter','felt tip','whiteboard marker','sketch pen'],                           'marker'],
  // cooking
  [['cooking oil','vegetable oil','sunflower oil','palm oil','saffola','fortune oil'],              'cooking_oil'],
  [['ice cream','gelato','frozen dessert','kwality walls','amul ice cream','magnum'],               'ice_cream'],
  // health
  [['tablet','capsule','syrup','medicine','paracetamol','ibuprofen','dolo','crocin','strip'],       'medicine'],
  [['hand sanitizer','sanitiser','antiseptic gel','dettol sanitizer','savlon spray'],              'sanitizer'],
  [['surgical mask','face mask','n95','kn95','disposable mask'],                                   'face_mask'],
  [['hair dye','hair color','hair colour','loreal color','garnier color','streaks'],               'hair_dye'],
  [['soap bar','bathing soap bar','lifebuoy','dettol bar','dove bar','pears soap'],                'soap_bar'],
  // home
  [['newspaper','times of india','the hindu','daily','newsprint'],                                 'newspaper'],
  [['candle','wax candle','tea light','scented candle','pillar candle'],                           'candle'],
  [['wall paint','paint tin','asian paints','berger paint','emulsion','primer'],                   'paint'],
  [['petrol','diesel','fuel','gasoline','cng cylinder'],                                           'fuel'],
];

const STAGE_META = [
  {key:'raw_materials', icon:'<i data-lucide="pickaxe" style="width:20px;height:20px"></i>', name:'Raw Materials', cls:'st1'},
  {key:'manufacturing', icon:'<i data-lucide="factory" style="width:20px;height:20px"></i>', name:'Manufacturing',  cls:'st2'},
  {key:'shipping',      icon:'<i data-lucide="ship" style="width:20px;height:20px"></i>', name:'Shipping',       cls:'st3'},
  {key:'usage',         icon:'<i data-lucide="plug" style="width:20px;height:20px"></i>', name:'Usage Phase',    cls:'st4'},
  {key:'end_of_life',   icon:'<i data-lucide="recycle" style="width:20px;height:20px"></i>', name:'End-of-Life',   cls:'st5'},
];

const STAGE_DETAILS = {
  cola:      ['Sugar cane & CO₂ gas production','Canning, bottling, carbonation','Global distribution network','Chilling energy (refrigeration)','Aluminium can recycling saves 95% energy'],
  beef:      ['Cattle methane & pasture land use','Slaughter, processing, cold chain','Refrigerated global shipping','Cooking at home (gas/electric)','Organic waste composting'],
  smartphone:['Rare earth mining, silicon wafer fab','PCB manufacture & screen coating','Air freight from Asia','Charging over 2-year lifespan','E-waste — only 20% properly recycled'],
  generic:   ['Raw material extraction & processing','Product manufacturing & assembly','Road, sea & air transport','Consumer use phase energy','Landfill, incineration or recycling'],
};

function getStageDetails(key) {
  return STAGE_DETAILS[key] || STAGE_DETAILS.generic;
}

// ── MAP CATEGORY TEXT → CDB KEY ──
function mapCategory(text) {
  const t = text.toLowerCase();
  for (const [kws, key] of CAT_MAP) {
    if (kws.some(kw => t.includes(kw))) return key;
  }
  return 'generic';
}

// ── BRAND → CATEGORY MAP ──────────────────────────────────────────────
// Maps popular brand names to CDB keys for fast recognition
const BRAND_MAP = [
  // beverages
  [['coca-cola','pepsi','sprite','fanta','thumbs up','limca','7up','mountain dew'], 'cola'],
  [['kingfisher','heineken','budweiser','corona','hoegaarden','tuborg','foster'],   'beer'],
  [['johnnie walker','jack daniels','old monk','royal stag','imperial blue'],       'spirits'],
  [['nescafe','bru','davidoff','starbucks','blue tokai','sleepy owl coffee'],        'coffee'],
  [['tata tea','lipton','red label','green label','tetley','twining'],              'tea'],
  [['amul milk','nandini','mother dairy milk','aavin','heritage milk'],             'milk'],
  [['oatly','alpro oat','wealthgrain oat'],                                         'oat_milk'],
  [['real fruit','tropicana','minute maid','maaza','frooti','slice juice'],         'juice'],
  // food
  [['amul butter','nutralite butter'],                                               'butter'],
  [['haldiram','bingo','kurkure','lays','pringles','doritos'],                      'chips'],
  [['britannia','parle-g','oreo','hide seek','good day','sunfeast'],               'cookies'],
  [['mccain pizza','dr oetker pizza'],                                              'frozen_pizza'],
  [['kellogg','quaker','saffola muesli','bagrry'],                                  'cereal'],
  [['nandos','mcdonalds','subway','dominos'],                                       'chicken'],
  [['cadbury','kitkat','ferrero','lindt','toblerone','5-star'],                    'chocolate'],
  [['india gate','daawat','kohinoor rice'],                                         'rice'],
  [['maggi','yippee','top ramen','mama noodles'],                                   'pasta'],
  [['amul cheese','kraft','laughing cow'],                                          'cheese'],
  [['nestle yogurt','epigamia','danone'],                                           'yogurt'],
  // personal care
  [['dove shampoo','pantene','head shoulders','tresemme','loreal shampoo'],        'shampoo'],
  [['dove body','lux shower','fiama shower','nivea shower'],                        'shower_gel'],
  [['colgate','pepsodent','sensodyne','patanjali toothpaste'],                     'toothpaste'],
  [['axe deo','rexona','fogg','engage','nivea deo'],                               'deodorant'],
  [['neutrogena sun','lotus sunscreen','lakme sun'],                               'sunscreen'],
  [['loreal hair color','garnier hair','streax','schwarzkopf'],                   'hair_dye'],
  [['lifebuoy bar','lux bar','dove bar soap','dettol bar','hamam'],               'soap_bar'],
  [['dettol sanitizer','savlon','lifebuoy sanitizer','purell'],                   'sanitizer'],
  // household
  [['surf excel','ariel','henko','tide detergent','rin'],                          'detergent'],
  [['vim','pril','exo dishwash'],                                                   'dishwasher_tabs'],
  // electronics
  [['samsung galaxy','iphone','oneplus','realme','poco','vivo phone','oppo'],      'smartphone'],
  [['macbook','dell laptop','hp laptop','lenovo ideapad','asus laptop'],           'laptop'],
  [['airpods','galaxy buds','boat earphone','jbl earphone','sony earphone'],       'earphones'],
  // clothing brands
  [['zara','h&m','uniqlo','gap tshirt','levis tshirt'],                            'tshirt'],
  [['levis jeans','wrangler jeans','pepe jeans','lee jeans'],                      'jeans'],
  [['nike shoes','adidas shoes','puma shoes','new balance','reebok'],              'shoes'],
  // cooking
  [['saffola oil','fortune oil','sunflower','dalda','dhara oil'],                  'cooking_oil'],
  [['kwality walls','amul ice cream','naturals ice','magnum ice'],                 'ice_cream'],
  // medicine
  [['dolo 650','crocin','combiflam','disprin','aspirin tablet'],                   'medicine'],
  // misc
  [['asian paints','berger paints','nerolac','dulux'],                             'paint'],
];

function mapBrand(text) {
  const t = text.toLowerCase();
  for (const [kws, key] of BRAND_MAP) {
    if (kws.some(kw => t.includes(kw))) return key;
  }
  return null;
}

// ── NORMALIZE OPEN FOOD FACTS CATEGORY TEXT ──
// OFF returns: "en:beverages, en:soft-drinks, en:colas" → "beverages soft drinks colas"
function normalizeOFFText(text) {
  return (text || '')
    .replace(/[a-z]{2}:/g, ' ')  // strip language prefix: "en:", "fr:", "hi:" etc
    .replace(/-/g, ' ')           // "soft-drink" → "soft drink"
    .replace(/,/g, ' ')           // split commas
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

let camStream=null, facing='environment';
let analyzing=false;
let _scanningActive = false;
let _bgScanTimer = null;
let _lastBgCode  = '';
let _lastAnalyzedCode = '';

// ── INIT ──
window.addEventListener('DOMContentLoaded', () => {
  const u = document.getElementById('upArea');
  u.addEventListener('dragover', e => { e.preventDefault(); u.style.borderColor='var(--g1)'; });
  u.addEventListener('dragleave', () => { u.style.borderColor=''; });
  u.addEventListener('drop', e => { e.preventDefault(); u.style.borderColor=''; const f=e.dataTransfer.files[0]; if(f) processFile(f); });
  checkServerReady();
  // Init Firebase auth (non-blocking)
  if(typeof FIREBASE_CONFIG!=='undefined') initFirebase().catch(console.warn);
});

async function checkServerReady() {
  setModelStatus('Connecting to OCR server...', 10);
  try {
    const r = await fetch('http://localhost:5001/api/health', { signal: AbortSignal.timeout(5000) });
    if (r.ok) {
      setModelStatus('Server OCR ready — OpenCV + EasyOCR + PyTesseract', 100);
      setTimeout(() => { document.getElementById('modelBar').style.opacity='0.5'; }, 2000);
      toast('Ready! Point camera at barcode — auto-detects number in real time!');
      return;
    }
  } catch(e) {}
  setModelStatus('OCR server not reachable — start server.py on port 5001', 0);
  toast('Server not running. Start: python server.py', 5000);
}

function setModelStatus(msg, pct) {
  document.getElementById('modelStatus').textContent = msg;
  document.getElementById('modelPct').textContent = pct + '%';
  document.getElementById('modelFill').style.width = pct + '%';
}

// ── CAMERA ──
async function startCam() {
  try {
    if (camStream) { camStream.getTracks().forEach(t => t.stop()); stopBgScan(); }
    camStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: facing, width:{ideal:1920}, height:{ideal:1080} }
    });
    const vid = document.getElementById('vid');
    vid.srcObject = camStream;
    await new Promise(r => vid.addEventListener('loadedmetadata', r, {once:true}));
    document.getElementById('camCover').classList.add('hidden');
    document.getElementById('camStat').textContent = 'Live — scanning...';
    document.getElementById('startBtn').style.display = 'none';
    document.getElementById('capBtn').style.display = 'flex';
    document.getElementById('capBtn').disabled = false;
    document.getElementById('switchBtn').style.display = 'flex';
    document.getElementById('aimHint').style.display = 'block';
    resizeOverlay();
    startBgScan();
  } catch(e) { toast('Camera: ' + e.message); }
}
function switchCam() {
  facing = facing==='environment'?'user':'environment';
  startCam();
}

// ── REAL-TIME DETECTION LOOP (object-detection style) ──
function startBgScan() {
  stopBgScan();
  _lastBgCode = '';
  _lastAnalyzedCode = '';
  _scanningActive = true;
  bgScanLoop();
}

async function bgScanLoop() {
  if (!_scanningActive) return;
  const vid = document.getElementById('vid');
  if (vid && vid.readyState >= 2 && !analyzing) {
    try {
      const sc = document.createElement('canvas');
      sc.width = vid.videoWidth || 1280;
      sc.height = vid.videoHeight || 720;
      sc.getContext('2d').drawImage(vid, 0, 0);
      const result = await serverOcrBarcode(sc); // send full frame — server crops internally
      if (result && result.code) {
        _lastBgCode = result.code;
        drawDetectionBox(result.bbox, result.code, result.conf);
        const lock = document.getElementById('bcLock');
        if (lock) { lock.textContent = (result.valid ? '' : '') + result.code; lock.style.display = 'block'; }
        document.getElementById('camStat').textContent = (result.valid ? '' : '') + result.code;
        if (result.valid && result.code !== _lastAnalyzedCode) {
          _lastAnalyzedCode = result.code;
          const full = fullSnapshot();
          document.getElementById('prevThumb').src = full.toDataURL('image/jpeg', .9);
          document.getElementById('prevThumb').style.display = 'block';
          toast('Barcode: ' + result.code + ' — analysing...');
          await analyze(full, result.code, result.method + ' Auto');
          setTimeout(() => { if (_lastAnalyzedCode === result.code) _lastAnalyzedCode = ''; }, 20000);
        }
      } else {
        clearDetectionCanvas();
        document.getElementById('camStat').textContent = 'Scanning... aim at the barcode';
        const lock = document.getElementById('bcLock');
        if (lock) lock.style.display = 'none';
      }
    } catch(e) { console.warn('Scan loop:', e); }
  }
  if (_scanningActive) _bgScanTimer = setTimeout(bgScanLoop, 150);
}

function stopBgScan() {
  _scanningActive = false;
  if (_bgScanTimer) { clearTimeout(_bgScanTimer); _bgScanTimer = null; }
  clearDetectionCanvas();
}

// ── BARCODE CHECKSUM VALIDATION ──
function validateBarcode(code) {
  if (!code || !/^\d+$/.test(code)) return false;
  const len = code.length;
  if (len === 13) {
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += parseInt(code[i]) * (i % 2 === 0 ? 1 : 3);
    return (10 - (sum % 10)) % 10 === parseInt(code[12]);
  }
  if (len === 8) {
    let sum = 0;
    for (let i = 0; i < 7; i++) sum += parseInt(code[i]) * (i % 2 === 0 ? 3 : 1);
    return (10 - (sum % 10)) % 10 === parseInt(code[7]);
  }
  if (len === 12) {
    let sum = 0;
    for (let i = 0; i < 11; i++) sum += parseInt(code[i]) * (i % 2 === 0 ? 3 : 1);
    return (10 - (sum % 10)) % 10 === parseInt(code[11]);
  }
  return len >= 8 && len <= 14;
}

// ── CROP IMAGE TO SCAN BOX REGION ──
function cropToScanRegion(canvas) {
  const W = canvas.width, H = canvas.height;
  const bx = Math.floor(W * 0.075);
  const bw = Math.floor(W * 0.85);
  const bh = Math.floor(H * 0.50);
  const by = Math.floor((H - bh) / 2);
  const crop = document.createElement('canvas');
  crop.width = bw;
  crop.height = bh;
  crop.getContext('2d').drawImage(canvas, bx, by, bw, bh, 0, 0, bw, bh);
  return crop;
}

// ── DETECTION BOX (yellow, YOLO-style) ──
function resizeOverlay() {
  const oc = document.getElementById('overlayCanvas');
  const wrap = document.getElementById('camWrap');
  if (!oc || !wrap) return;
  oc.width = wrap.clientWidth;
  oc.height = wrap.clientHeight;
}

function clearDetectionCanvas() {
  const oc = document.getElementById('overlayCanvas');
  if (oc) oc.getContext('2d').clearRect(0, 0, oc.width, oc.height);
}

function drawDetectionBox(bbox, code, conf) {
  const oc = document.getElementById('overlayCanvas');
  if (!oc) return;
  const ctx = oc.getContext('2d');
  const W = oc.width, H = oc.height;
  ctx.clearRect(0, 0, W, H);
  if (!bbox || bbox.w <= 0 || bbox.h <= 0) return;

  const px = 10, py = 5;  // padding around detected region
  const x = Math.max(0, bbox.x * W - px);
  const y = Math.max(0, bbox.y * H - py);
  const w = Math.min(W - x, bbox.w * W + px * 2);
  const h = Math.min(H - y, bbox.h * H + py * 2);

  // Semi-transparent yellow fill
  ctx.fillStyle = 'rgba(255, 215, 0, 0.18)';
  ctx.fillRect(x, y, w, h);

  // Yellow border
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 2.5;
  ctx.shadowColor = '#FFD700';
  ctx.shadowBlur = 6;
  ctx.strokeRect(x, y, w, h);
  ctx.shadowBlur = 0;

  // Label: "8901396315803  0.97" — above box if room, else below
  const label = code + '  ' + (conf > 0 ? conf.toFixed(2) : '');
  ctx.font = 'bold 13px monospace';
  const textW = ctx.measureText(label).width + 10;
  const labelY = y > 22 ? y - 4 : y + h + 20;
  const labelX = Math.min(x, W - textW - 2);

  ctx.fillStyle = '#FFD700';
  ctx.shadowColor = '#000'; ctx.shadowBlur = 3;
  ctx.fillRect(labelX, labelY - 16, textW, 18);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#000';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(label, labelX + 5, labelY);
}

// ── SERVER OCR (pyzbar primary, EasyOCR fallback) ──
function _resizeCanvas(canvas, maxW) {
  if (canvas.width <= maxW) return canvas;
  const scale = maxW / canvas.width;
  const c = document.createElement('canvas');
  c.width = maxW;
  c.height = Math.round(canvas.height * scale);
  c.getContext('2d').drawImage(canvas, 0, 0, c.width, c.height);
  return c;
}

async function serverOcrBarcode(canvas) {
  try {
    // Resize to max 640px wide before sending — pyzbar works well at this size
    const small = _resizeCanvas(canvas, 640);
    const dataUrl = small.toDataURL('image/jpeg', 0.75);
    const r = await fetch('http://localhost:5001/api/ocr-barcode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: dataUrl }),
      signal: AbortSignal.timeout(5000)
    });
    if (!r.ok) return null;
    const j = await r.json();
    if (j.barcode) {
      return { code: j.barcode, method: j.method || 'OCR', valid: j.valid,
               bbox: j.bbox || null, conf: j.conf || 0 };
    }
  } catch(e) { console.warn('Server OCR failed:', e); }
  return null;
}

// ── COMBINED READ — server OCR on full + cropped + fuzzy match ──
async function readBarcode(canvas) {
  const unvalidated = [];
  toast('Reading number with OpenCV + EasyOCR + PyTesseract...');

  // 1. Server OCR on cropped scan region (best for number row)
  const cropped = cropToScanRegion(canvas);
  const croppedResult = await serverOcrBarcode(cropped);
  if (croppedResult) {
    if (croppedResult.valid) return { code: croppedResult.code, method: croppedResult.method };
    unvalidated.push({ code: croppedResult.code, method: croppedResult.method });
  }

  // 2. Server OCR on full image
  const fullResult = await serverOcrBarcode(canvas);
  if (fullResult) {
    if (fullResult.valid) return { code: fullResult.code, method: fullResult.method };
    unvalidated.push({ code: fullResult.code, method: fullResult.method });
  }

  // 3. Fuzzy match unvalidated results against known barcodes
  for (const r of unvalidated) {
    const fuzzy = await fuzzyMatchBarcode(r.code);
    if (fuzzy) return { code: fuzzy, method: r.method + ' + Fuzzy Match' };
  }

  // 4. Return best unvalidated result if any
  if (unvalidated.length > 0) {
    return { code: unvalidated[0].code, method: unvalidated[0].method + ' (unverified)' };
  }

  return { code: null, method: '' };
}

// ── FUZZY MATCH: try known barcodes that are similar to OCR read ──
async function fuzzyMatchBarcode(code) {
  if (!code || code.length < 8) return null;
  try {
    // First, try to get full list of known barcodes from local server
    let knownBarcodes = null;
    try {
      const r = await fetch('http://localhost:5001/api/barcodes',
        { signal: AbortSignal.timeout(2000) });
      if (r.ok) {
        const j = await r.json();
        knownBarcodes = j.barcodes || [];
      }
    } catch(e) {}

    if (knownBarcodes && knownBarcodes.length > 0) {
      // Strategy 1: Check if code is a SUFFIX of a known barcode (dropped leading digits)
      // E.g., OCR reads "722315803" but actual is "8901396315803"
      // Or OCR reads "901396315803" but actual is "8901396315803"
      for (const known of knownBarcodes) {
        if (known.endsWith(code) || code.endsWith(known)) {
          console.log(`Fuzzy suffix match: ${code} → ${known}`);
          return known;
        }
      }

      // Strategy 2: Check if the last N digits match (most reliable part of barcode)
      // OCR often misreads the first 1-3 digits but gets the rest right
      const tail = code.slice(-8); // last 8 digits are usually most accurate
      for (const known of knownBarcodes) {
        if (known.endsWith(tail) && Math.abs(known.length - code.length) <= 2) {
          console.log(`Fuzzy tail match (last 8): ${code} → ${known}`);
          return known;
        }
      }

      // Strategy 3: Hamming distance ≤ 2 (allow up to 2 digit misreads)
      for (const known of knownBarcodes) {
        if (known.length === code.length) {
          let diff = 0;
          for (let i = 0; i < known.length; i++) {
            if (known[i] !== code[i]) diff++;
            if (diff > 2) break;
          }
          if (diff <= 2) {
            console.log(`Fuzzy Hamming match (dist ${diff}): ${code} → ${known}`);
            return known;
          }
        }
      }

      // Strategy 4: Try adding a prefix digit (OCR dropped leading digit)
      for (let d = 0; d <= 9; d++) {
        const withPrefix = d + code;
        if (knownBarcodes.includes(withPrefix)) {
          console.log(`Fuzzy prefix match: ${code} → ${withPrefix}`);
          return withPrefix;
        }
      }
    }

    // Fallback: if no known barcode list, try single-digit swaps with checksum validation
    for (let i = 0; i < code.length; i++) {
      for (let d = 0; d <= 9; d++) {
        if (d === parseInt(code[i])) continue;
        const trial = code.slice(0, i) + d + code.slice(i + 1);
        if (validateBarcode(trial)) {
          try {
            const r = await fetch(`http://localhost:5001/api/lookup/${trial}`,
              { signal: AbortSignal.timeout(1500) });
            if (r.ok) {
              const j = await r.json();
              if (j.source !== 'not_found') {
                console.log(`Fuzzy swap match: ${code} → ${trial} (${j.name})`);
                return trial;
              }
            }
          } catch(e) {}
        }
      }
    }
  } catch(e) {}
  return null;
}

// Manual barcode entry (when camera scan fails)
async function manualLookup() {
  const input = document.getElementById('manualBarcode');
  if (!input) return;
  const barcode = input.value.trim().replace(/\D/g, '');
  if (!barcode || barcode.length < 4) {
    toast('Enter a valid barcode number (8–13 digits)');
    input.focus();
    return;
  }
  toast('Looking up barcode: ' + barcode + '...');
  input.value = '';
  const sc = document.createElement('canvas');
  sc.width = 100; sc.height = 100;
  sc.getContext('2d').fillStyle = '#000';
  sc.getContext('2d').fillRect(0, 0, 100, 100);
  await analyze(sc, barcode, 'Manual Entry');
}

// ── SNAPSHOT & ANALYZE ──
function fullSnapshot() {
  const vid = document.getElementById('vid'), sc = document.getElementById('snapCanvas');
  sc.width = vid.videoWidth || 1280;
  sc.height = vid.videoHeight || 720;
  sc.getContext('2d').drawImage(vid, 0, 0);
  return sc;
}

async function captureAnalyze() {
  if (analyzing) return;
  _lastAnalyzedCode = ''; // manual capture always triggers fresh analysis

  const sc = fullSnapshot();
  document.getElementById('prevThumb').src = sc.toDataURL('image/jpeg', .9);
  document.getElementById('prevThumb').style.display = 'block';

  // If background scan already found a code, use it
  let code = null;
  let method = '';

  if (_lastBgCode && validateBarcode(_lastBgCode)) {
    code = _lastBgCode;
    method = 'Auto-Detect ✓';
  } else if (_lastBgCode) {
    toast('Verifying number ' + _lastBgCode + '...');
    const fuzzy = await fuzzyMatchBarcode(_lastBgCode);
    if (fuzzy) {
      code = fuzzy;
      method = 'Auto-Detect + Fuzzy Match';
    }
  }

  if (!code) {
    toast('Reading barcode from image...');
    const result = await readBarcode(sc);
    code = result.code;
    method = result.method;
  }

  if (!code) {
    toast('Could not read barcode — try holding phone steady, closer, or type it manually', 5000);
    return;
  }

  toast('Found barcode: ' + code + ' (' + method + ')');
  const lock = document.getElementById('bcLock');
  if (lock) { lock.textContent = code; lock.style.display = 'block'; }
  _lastBgCode = '';  // reset for next scan

  await analyze(sc, code, method);
}

// ── FILE UPLOAD ──
function handleUpload(e) { const f=e.target.files[0]; if(f) processFile(f); }
async function processFile(f) {
  const url = URL.createObjectURL(f);
  const img = new Image(); img.src = url;
  await new Promise(r => { img.onload=r; });
  const sc = document.createElement('canvas');
  sc.width=img.width; sc.height=img.height;
  sc.getContext('2d').drawImage(img,0,0);
  document.getElementById('prevThumb').src = sc.toDataURL('image/jpeg',.9);
  document.getElementById('prevThumb').style.display = 'block';
  // Multi-method barcode reading on uploaded image
  let code = '', fmt = '';
  toast('Reading barcode from uploaded image...');
  const result = await readBarcode(sc);
  if (result.code) { code = result.code; fmt = result.method; toast('Found: ' + code + ' (' + fmt + ')'); }
  await analyze(sc, code, fmt);
  URL.revokeObjectURL(url);
}

// ── LOCAL PYTHON SERVER LOOKUP (fastest — no CORS, pre-built Indian DB) ──
async function lookupLocalServer(barcode) {
  if (!barcode) return null;
  try {
    const r = await fetch(`http://localhost:5001/api/lookup/${barcode}`,
      { signal: AbortSignal.timeout(3000) }); // fast timeout — it's local
    if (!r.ok) return null;
    const j = await r.json();
    if (j.source === 'not_found') return null;
    return j; // { name, brand, category, categories, ecoscore, co2_100g, ... }
  } catch(e) { return null; } // server not running — fall through to APIs
}

// ── OPEN FOOD FACTS — with ecoscore + CO₂ + v0 fallback ──
async function lookupOFF(barcode) {
  if (!barcode || barcode.length < 4) return null;
  try {
    const fields = 'product_name,brands,categories,ecoscore_grade,ecoscore_score,carbon_footprint_from_known_ingredients_100g,origins,packaging,quantity,nutriments';
    // Try v2 first
    let r = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=${fields}`,
      { signal: AbortSignal.timeout(12000) }
    );
    let j = r.ok ? await r.json() : null;
    if (j && j.status === 1) return j.product;

    // Fallback: v0 API (sometimes has products v2 doesn't return)
    r = await fetch(
      `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`,
      { signal: AbortSignal.timeout(10000) }
    );
    j = r.ok ? await r.json() : null;
    return (j && j.status === 1) ? j.product : null;
  } catch(e) { return null; }
}

// ── OPEN BEAUTY FACTS — cosmetics, personal care, beauty products ──
async function lookupOBF(barcode) {
  if (!barcode || barcode.length < 4) return null;
  try {
    const r = await fetch(
      `https://world.openbeautyfacts.org/api/v2/product/${barcode}.json?fields=product_name,brands,categories`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!r.ok) return null;
    const j = await r.json();
    return j.status === 1 ? j.product : null;
  } catch(e) { return null; }
}

// ── UPC ITEM DB — electronics, household, general products ──
async function lookupUPC(barcode) {
  if (!barcode || barcode.length < 4) return null;
  try {
    const r = await fetch(
      `https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!r.ok) return null;
    const j = await r.json();
    if (j.code !== 'OK' || !j.items?.length) return null;
    return j.items[0];
  } catch(e) { return null; }
}

// ── MAIN ANALYZE ──
async function analyze(canvas, barcode='', format='') {
  analyzing = true;
  showLoader(true);
  setStep(1); await sleep(150);

  let catKey = 'generic', productName = '', brand = '', method = 'Carbon DB';
  let realCo2 = null;   // CO₂ from live API (overrides CDB estimate)
  let realGrade = null; // Ecoscore grade from OFF

  // ── Step 2: Product lookup from barcode ──
  setStep(2);
  if (barcode) {
    toast('Looking up ' + barcode + '...');

    // ─ Priority 0: Local Python server — instant, pre-built Indian DB ─
    const local = await lookupLocalServer(barcode);
    if (local) {
      productName = [local.brand, local.name].filter(Boolean).join(' — ');
      brand       = local.brand || '';
      // Server returns direct category key for pre-built entries
      if (local.category && local.category !== 'generic' && CDB[local.category]) {
        catKey = local.category;
        method = local.source === 'local_db' ? 'Local DB' : local.source;
      } else {
        const st = normalizeOFFText(`${local.categories||''} ${local.name||''} ${local.brand||''}`);
        catKey = mapBrand(st) || mapCategory(st) || 'generic';
        method = 'Local Server';
      }
      if (local.co2_100g > 0) {
        const qty = parseInt(local.quantity) || 200;
        realCo2 = +((local.co2_100g * qty / 100) / 1000).toFixed(3);
        method = 'OFF Live CO2 Data';
      }
      if (local.ecoscore && !['unknown','not-applicable','not-computable',''].includes(local.ecoscore)) {
        realGrade = ({'A+':'A',A:'A',B:'B',C:'C',D:'D',E:'D',F:'D'})[local.ecoscore.toUpperCase()] || null;
      }
    }

    // ─ Priority 1-3: External APIs (only if local server didn't resolve) ─
    if (catKey === 'generic') {
      const [off, upc, obf] = await Promise.all([
        lookupOFF(barcode),
        lookupUPC(barcode),
        lookupOBF(barcode)
      ]);

      if (off) {
        productName = productName || [off.brands, off.product_name].filter(Boolean).join(' — ');
        brand       = brand || off.brands || '';
        if (off.ecoscore_grade && !['unknown','not-applicable','not-computable'].includes(off.ecoscore_grade)) {
          realGrade = ({'A+':'A',A:'A',B:'B',C:'C',D:'D',E:'D',F:'D'})[off.ecoscore_grade.toUpperCase()] || null;
        }
        if (off.carbon_footprint_from_known_ingredients_100g > 0) {
          realCo2 = +((off.carbon_footprint_from_known_ingredients_100g * (parseInt(off.quantity)||200) / 100) / 1000).toFixed(3);
          method  = 'OFF Live CO2 Data';
        }
        const st = normalizeOFFText(`${off.categories||''} ${off.product_name||''} ${off.brands||''}`);
        catKey = mapBrand(st) || mapCategory(st);
        if (catKey !== 'generic' && method === 'Carbon DB') method = 'Open Food Facts';
      }

      if (catKey === 'generic' && obf) {
        productName = productName || [obf.brands, obf.product_name].filter(Boolean).join(' — ');
        brand = brand || obf.brands || '';
        const st = normalizeOFFText(`${obf.categories||''} ${obf.product_name||''} ${obf.brands||''}`);
        catKey = mapBrand(st) || mapCategory(st);
        if (catKey !== 'generic') method = 'Open Beauty Facts';
      }

      if (catKey === 'generic' && upc) {
        productName = productName || [upc.brand, upc.title].filter(Boolean).join(' — ');
        brand = brand || upc.brand || '';
        const st = normalizeOFFText(`${upc.category||''} ${upc.title||''} ${upc.brand||''} ${upc.description||''}`);
        catKey = mapBrand(st) || mapCategory(st) || 'generic';
        if (catKey !== 'generic') method = 'UPC Item DB';
      }

      // Last-ditch: try mapping just the product name
      if (catKey === 'generic' && productName) {
        catKey = mapBrand(productName) || mapCategory(normalizeOFFText(productName)) || 'generic';
      }
    }

    if (!productName) toast('Barcode ' + barcode + ' not in any database', 4000);
  } else {
    toast('No barcode detected — aim at barcode and try again!', 5000);
  }

  // ── Step 3: Finalize result from barcode lookup only ──
  setStep(3);

  // ── Step 4: Carbon calculation ──
  setStep(4);
  const entry   = CDB[catKey] || CDB.generic;
  const details = getStageDetails(catKey);
  // Use live CO₂ from API if available; fall back to CDB estimate
  const total  = realCo2 ?? entry.co2;
  const rating = realGrade ?? entry.r;
  const stages = STAGE_META.map((m, i) => ({
    ...m,
    co2: +(total * entry.st[i] / 100).toFixed(3),
    pct: entry.st[i],
    detail: details[i]
  }));

  setStep(5); await sleep(200);
  showLoader(false);
  analyzing = false;

  // If product name found but category still unknown → let user pick category
  if (catKey === 'generic' && productName && productName.length > 3) {
    showCategoryPicker(productName, barcode, format, method);
    return;
  }

  renderResult({
    name:   productName || catKey.replace(/_/g,' '),
    barcode, format, method,
    brand, catKey,
    total, rating,
    unit:  entry.unit,
    desc:  entry.desc,
    stages, alts: entry.alts,
    isLiveData: !!realCo2   // flag to show "live data" badge
  });
}

// ── RENDER ──
function renderResult(d) {
  document.getElementById('phEl').style.display='none';
  document.getElementById('prodCard').classList.add('on');
  document.getElementById('errCard').classList.remove('on');
  document.getElementById('ts').textContent = new Date().toLocaleTimeString();
  const methodEl = document.getElementById('methodBadge');
  methodEl.textContent = d.method;
  // Highlight real API data vs estimated
  if (d.isLiveData) {
    methodEl.style.background = 'rgba(107,158,120,.15)';
    methodEl.style.borderColor = 'rgba(107,158,120,.4)';
    methodEl.style.color = 'var(--g1)';
    methodEl.textContent = d.method + ' (real product data)';
  } else {
    methodEl.style.background = '';
    methodEl.style.borderColor = '';
    methodEl.style.color = '';
  }

  const bcBox = document.getElementById('bcBox');
  if (d.barcode) {
    bcBox.classList.add('on');
    document.getElementById('bcVal').textContent = d.barcode;
    document.getElementById('bcType').textContent = d.format || 'Barcode';
  } else bcBox.classList.remove('on');

  document.getElementById('prodName').textContent = d.name || 'Product';
  document.getElementById('prodDesc').textContent = d.desc;
  document.getElementById('co2Num').textContent = fmtCO2(d.total);

  const rc = document.getElementById('rCirc');
  rc.textContent = d.rating; rc.className = 'r-circle r' + d.rating;

  const te = document.getElementById('prodTags');
  const tg = {'A':'g','B':'g','C':'y','D':'r'}[d.rating]||'';
  te.innerHTML = `<div class="tag ${tg}">Grade ${d.rating}</div>`;
  te.innerHTML += `<div class="tag">${d.catKey.replace(/_/g,' ')}</div>`;
  if (d.unit) te.innerHTML += `<div class="tag">per ${d.unit}</div>`;

  // pipeline
  const pipe = document.getElementById('pipe');
  pipe.innerHTML = '';
  d.stages.forEach((s, i) => {
    const el = document.createElement('div');
    el.className = `stage ${s.cls}`;
    el.innerHTML = `<div class="s-num">Stage ${i+1}</div><div class="s-ico">${s.icon}</div><div class="s-name">${s.name}</div><div class="bar-wrap"><div class="bar" data-p="${Math.max(4,s.pct)}"></div></div><div class="s-co2">${fmtCO2(s.co2)}<span class="s-unit"> kg CO₂e</span></div><div class="s-pct">${s.pct}% of total</div><div class="s-det">${s.detail}</div>`;
    pipe.appendChild(el);
  });
  requestAnimationFrame(() => { document.querySelectorAll('.bar').forEach(b => setTimeout(() => b.style.width = b.dataset.p + '%', 80)); if(typeof lucide!=='undefined') lucide.createIcons(); });

  // alternatives
  const ae = document.getElementById('alts');
  ae.innerHTML = '';
  const savePcts = [60, 45, 30];
  const altIcons = ['<i data-lucide="leaf" style="width:18px;height:18px;color:var(--g1)"></i>','<i data-lucide="recycle" style="width:18px;height:18px;color:var(--g1)"></i>','<i data-lucide="sprout" style="width:18px;height:18px;color:var(--g1)"></i>'];
  (d.alts || []).forEach((a, i) => {
    const el = document.createElement('div'); el.className = 'alt';
    el.innerHTML = `<div class="alt-h"><div class="alt-ico">${altIcons[i]||altIcons[0]}</div><div class="alt-n">${a}</div><div class="alt-sv">-${savePcts[i]||30}% CO2</div></div><div class="alt-d">Switching to this option can significantly reduce your product carbon footprint.</div><div class="alt-tips"><div class="alt-tip">Look for eco-certified versions</div><div class="alt-tip">Check local suppliers first</div></div>`;
    ae.appendChild(el);
  });

  document.getElementById('results').classList.add('on');
  if(typeof lucide!=='undefined') lucide.createIcons();
  setTimeout(() => document.getElementById('results').scrollIntoView({behavior:'smooth', block:'start'}), 300);
  // Save to Firebase
  saveScan(d);
  if (autoMode) {
    document.getElementById('autoStat').textContent = 'Done! Move to next product...';
    setTimeout(() => { document.getElementById('autoStat').textContent='scanning...'; detectedCode=''; drawOverlay(false); document.getElementById('bcLock').style.display='none'; }, 3000);
  }
}

function fmtCO2(v) { if(!v&&v!==0)return'—'; if(v<0.01)return(v*1000).toFixed(1)+'g'; if(v<0.1)return(v*1000).toFixed(0)+'g'; if(v<10)return v.toFixed(2); return v.toFixed(1); }
function showLoader(on) { document.getElementById('loader').classList.toggle('on',on); if(on) document.querySelectorAll('.ld-step').forEach(s=>s.classList.remove('act','done')); }
function setStep(n) { for(let i=1;i<=5;i++){const e=document.getElementById('ls'+i);if(i<n){e.classList.add('done');e.classList.remove('act');}else if(i===n){e.classList.add('act');e.classList.remove('done');}else e.classList.remove('act','done');} }
function sleep(ms) { return new Promise(r=>setTimeout(r,ms)); }
function toast(msg, dur=3200) { const t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),dur); }
window.addEventListener('resize', () => { if(camStream) resizeOverlay(); });

// ── SCAN HISTORY ──────────────────────────────────────────────────────
let _histUnsubscribe = null;

async function loadScanHistory() {
  if (!_fbUser || !_fbDb) return;
  // Unsubscribe previous listener
  if (_histUnsubscribe) _histUnsubscribe();
  const {collection, query, where, orderBy, limit, onSnapshot} = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
  const q = query(
    collection(_fbDb, 'scans'),
    where('uid', '==', _fbUser.uid),
    orderBy('timestamp', 'desc'),
    limit(20)
  );
  _histUnsubscribe = onSnapshot(q, snap => {
    const listEl  = document.getElementById('histList');
    const emptyEl = document.getElementById('histEmpty');
    const countEl = document.getElementById('histCount');
    if (!listEl) return;
    if (snap.empty) {
      listEl.innerHTML  = '';
      emptyEl.style.display = 'block';
      countEl.textContent = '0';
      return;
    }
    emptyEl.style.display = 'none';
    countEl.textContent = snap.size + ' scans';
    const gradeColors = {A:'#6b9e78',B:'#4a7c6f',C:'#c9a96e',D:'#c47060'};
    listEl.innerHTML = snap.docs.map(doc => {
      const d = doc.data();
      const grade = d.rating || 'B';
      const color = gradeColors[grade] || '#8a99aa';
      const ts = d.timestamp?.toDate ? d.timestamp.toDate().toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : 'Just now';
      const co2 = d.co2 != null ? (d.co2 < 0.1 ? (d.co2*1000).toFixed(0)+'g' : d.co2.toFixed(2)+' kg') : '—';
      return `<div class="hist-card">
        <div class="hist-grade" style="border-color:${color};background:${color}18;color:${color}">${grade}</div>
        <div class="hist-info">
          <div class="hist-name">${d.productName || d.category?.replace(/_/g,' ') || 'Product'}</div>
          <div class="hist-meta">
            <span>${(d.category||'generic').replace(/_/g,' ')}</span>
            <span>${d.method||'Carbon DB'}</span>
            <span>${ts}</span>
          </div>
        </div>
        <div class="hist-co2" style="color:${color}">${co2}<span>CO₂e</span></div>
      </div>`;
    }).join('');
  }, err => console.warn('History error:', err));
}

function toggleHistory() {
  const panel = document.getElementById('histPanel');
  const icon  = document.getElementById('histToggleIcon');
  const open  = panel.style.display !== 'none';
  panel.style.display = open ? 'none' : 'block';
  icon.textContent = open ? '▶' : '▼';
}

// ── MANUAL CATEGORY PICKER (shown when product found but category mapping fails) ──
function showCategoryPicker(productName, barcode, format, method) {
  // Remove existing picker
  const old = document.getElementById('catPickerModal');
  if (old) old.remove();

  const categories = [
    { key:'cola',        label:'Soft Drink'     },
    { key:'coffee',      label:'Coffee'          },
    { key:'tea',         label:'Tea'             },
    { key:'milk',        label:'Milk'            },
    { key:'juice',       label:'Juice'           },
    { key:'water_bottle',label:'Water Bottle'    },
    { key:'chips',       label:'Chips / Snacks'  },
    { key:'chocolate',   label:'Chocolate'       },
    { key:'cookies',     label:'Biscuit/Cookie'  },
    { key:'bread',       label:'Bread / Bakery'  },
    { key:'rice',        label:'Rice / Grains'   },
    { key:'vegetables',  label:'Vegetables'      },
    { key:'shampoo',     label:'Shampoo'         },
    { key:'shower_gel',  label:'Body Wash / Soap'},
    { key:'toothpaste',  label:'Oral Care'       },
    { key:'deodorant',   label:'Deodorant'       },
    { key:'medicine',    label:'Medicine'        },
    { key:'sanitizer',   label:'Sanitizer'       },
    { key:'detergent',   label:'Detergent'       },
    { key:'cooking_oil', label:'Cooking Oil'     },
    { key:'notebook',    label:'Stationery'      },
    { key:'smartphone',  label:'Electronics'     },
    { key:'generic',     label:'Other Product'   },
  ];

  const modal = document.createElement('div');
  modal.id = 'catPickerModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(6,10,15,.92);backdrop-filter:blur(16px);display:flex;align-items:center;justify-content:center;padding:20px;';
  modal.innerHTML = `
    <div style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.15);border-radius:24px;padding:28px 24px;max-width:480px;width:100%;max-height:90vh;overflow-y:auto">
      <div style="font-family:'Space Grotesk',sans-serif;font-size:1.1rem;font-weight:700;margin-bottom:4px">What type of product is this?</div>
      <div style="color:#8a9882;font-size:.8rem;margin-bottom:20px">Found: <strong style="color:#e8ece6">${productName}</strong></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        ${categories.map(c => `<button onclick="pickCategory('${c.key}','${productName.replace(/'/g,"\\'")}','${barcode}','${format}','${method}')"
          style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:11px 14px;color:#e8ece6;font-size:.82rem;cursor:pointer;text-align:left;transition:all .15s"
          onmouseover="this.style.borderColor='#6b9e78';this.style.background='rgba(107,158,120,.1)'"
          onmouseout="this.style.borderColor='';this.style.background='rgba(255,255,255,.06)'">${c.label}</button>`).join('')}
      </div>
    </div>`;
  document.body.appendChild(modal);
}

function pickCategory(catKey, productName, barcode, format, method) {
  const modal = document.getElementById('catPickerModal');
  if (modal) modal.remove();
  const entry   = CDB[catKey] || CDB.generic;
  const details = getStageDetails(catKey);
  const total   = entry.co2;
  const stages  = STAGE_META.map((m, i) => ({
    ...m,
    co2: +(total * entry.st[i] / 100).toFixed(3),
    pct: entry.st[i],
    detail: details[i]
  }));
  renderResult({
    name: productName, barcode, format,
    method: method + ' + Manual Category',
    brand: '', catKey, total,
    rating: entry.r, unit: entry.unit,
    desc: entry.desc, stages, alts: entry.alts,
    isLiveData: false
  });
}
