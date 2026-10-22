/* =====================================================================
   BRICK: the Mathcade player character, drawn on a <canvas>.
   No libraries. Used by the website pages now and by the canvas games
   (Speed Run, Lava, live-race ghosts) next.

   Art: site/brick/ (layered SVGs on one 240 design grid, viewBox -20 -40 280 300),
   particles: site/brick/fx/*.png (white on transparent, tinted at runtime).
   Rules follow the character handover (HANDOVER.md sections 5, 6, 9 and 10).

   Quick start (games):
     const look   = Brick.lookOf(MC.user);                 // {base, hat, shoes, skin, fx}
     const sprite = await Brick.sprite(look, { height:64 }); // 64 px from head top to soles
     // every frame:
     sprite.draw(ctx, x, feetY, { t:now/1000, state:'run', facing:1 });
     sprite.hitbox(x, feetY)  // {x,y,w,h}: the same for every look
   Pages:
     const view = Brick.mount(el, look, { animate:true });  view.set(newLook); view.destroy();
   ===================================================================== */
(function(){
'use strict';
const DATA = /*BRICK-DATA*/{"bases":[{"id":"brick_orange","name":"Brick Orange","main":"#F26B3A","shadow":"#C4481D"},{"id":"sunny_yellow","name":"Sunny Yellow","main":"#F5C431","shadow":"#C8951A"},{"id":"mint_teal","name":"Mint Teal","main":"#2EC4A5","shadow":"#1E9480"},{"id":"sky_blue","name":"Sky Blue","main":"#5AAEF2","shadow":"#3580C9"},{"id":"grape_purple","name":"Grape Purple","main":"#7A4FCC","shadow":"#5A35A3"}],"items":[{"id":"H01","slot":"hat","name":"Baseball Cap (Forward)","rarity":"Common","price":40,"buy":true},{"id":"H02","slot":"hat","name":"Pom Beanie","rarity":"Common","price":40,"buy":true},{"id":"H03","slot":"hat","name":"Bucket Hat","rarity":"Common","price":40,"buy":true},{"id":"H04","slot":"hat","name":"Hard Hat","rarity":"Common","price":40,"buy":true},{"id":"H05","slot":"hat","name":"Graduation Cap","rarity":"Uncommon","price":90,"buy":true},{"id":"H06","slot":"hat","name":"Party Hat","rarity":"Uncommon","price":90,"buy":true},{"id":"H07","slot":"hat","name":"Top Hat","rarity":"Rare","price":200,"buy":true},{"id":"H08","slot":"hat","name":"Chef Hat","rarity":"Uncommon","price":90,"buy":true},{"id":"H09","slot":"hat","name":"Royal Crown","rarity":"Rare","price":200,"buy":true},{"id":"H10","slot":"hat","name":"Wizard Hat","rarity":"Rare","price":200,"buy":true},{"id":"H11","slot":"hat","name":"Propeller Cap","rarity":"Uncommon","price":90,"buy":true},{"id":"H12","slot":"hat","name":"Cowboy Hat","rarity":"Uncommon","price":90,"buy":true},{"id":"H13","slot":"hat","name":"Starry Wizard Hat","rarity":"Legendary","price":450,"buy":true},{"id":"H14","slot":"hat","name":"White Cowboy Hat","rarity":"Uncommon","price":90,"buy":true},{"id":"H15","slot":"hat","name":"Ninja Headband","rarity":"Uncommon","price":90,"buy":true},{"id":"H16","slot":"hat","name":"Backwards Cap","rarity":"Common","price":40,"buy":true},{"id":"H17","slot":"hat","name":"Sailor Hat","rarity":"Uncommon","price":90,"buy":true},{"id":"H18","slot":"hat","name":"Bandana","rarity":"Common","price":40,"buy":true},{"id":"H19","slot":"hat","name":"Knight Helm","rarity":"Rare","price":200,"buy":true},{"id":"H20","slot":"hat","name":"Sleepy Jelly","rarity":"Rare","price":200,"buy":true},{"id":"H21","slot":"hat","name":"Flat Cap","rarity":"Common","price":40,"buy":true},{"id":"H22","slot":"hat","name":"Gym Sweatband","rarity":"Common","price":40,"buy":true},{"id":"H23","slot":"hat","name":"Straw Hat","rarity":"Common","price":40,"buy":true},{"id":"H24","slot":"hat","name":"Paper Boat Hat","rarity":"Common","price":40,"buy":true},{"id":"H25","slot":"hat","name":"Earmuffs","rarity":"Common","price":40,"buy":true},{"id":"H26","slot":"hat","name":"Sun Visor","rarity":"Common","price":40,"buy":true},{"id":"H27","slot":"hat","name":"Pirate Tricorn","rarity":"Uncommon","price":90,"buy":true},{"id":"H28","slot":"hat","name":"Viking Helmet","rarity":"Uncommon","price":90,"buy":true},{"id":"H29","slot":"hat","name":"Detective Deerstalker","rarity":"Uncommon","price":90,"buy":true},{"id":"H30","slot":"hat","name":"Bunny Ears","rarity":"Uncommon","price":90,"buy":true},{"id":"H31","slot":"hat","name":"Jester Hat","rarity":"Legendary","price":450,"buy":true},{"id":"H32","slot":"hat","name":"Pharaoh Headdress","rarity":"Legendary","price":450,"buy":true},{"id":"H33","slot":"hat","name":"Dragon Crown","rarity":"Legendary","price":450,"buy":true},{"id":"H34","slot":"hat","name":"Golden Laurel","rarity":"Rare","price":200,"buy":true},{"id":"H35","slot":"hat","name":"Diamond Tiara","rarity":"Legendary","price":450,"buy":true},{"id":"H36","slot":"hat","name":"Lava Crown","rarity":"Legendary","price":450,"buy":true},{"id":"H37","slot":"hat","name":"Phoenix Crown","rarity":"Collector","price":900,"buy":true,"fx":"HFX_PHOENIX"},{"id":"H38","slot":"hat","name":"Celestial Crown","rarity":"Collector","price":900,"buy":true,"fx":"HFX_CELESTIAL"},{"id":"H39","slot":"hat","name":"Crystal Ice Crown","rarity":"Collector","price":900,"buy":true,"fx":"HFX_ICE"},{"id":"S00","slot":"shoes","name":"Classic Soles","rarity":"Free","price":0,"buy":false},{"id":"S01","slot":"shoes","name":"Court High-Tops","rarity":"Common","price":40,"buy":true},{"id":"S02","slot":"shoes","name":"Teal Runners","rarity":"Uncommon","price":90,"buy":true},{"id":"S03","slot":"shoes","name":"Skate Low-Tops","rarity":"Common","price":40,"buy":true},{"id":"S04","slot":"shoes","name":"Rain Boots","rarity":"Common","price":40,"buy":true},{"id":"S05","slot":"shoes","name":"Hiking Boots","rarity":"Uncommon","price":90,"buy":true},{"id":"S06","slot":"shoes","name":"Fuzzy Slippers","rarity":"Uncommon","price":90,"buy":true},{"id":"S07","slot":"shoes","name":"Light-Ups","rarity":"Legendary","price":450,"buy":true,"fx":"SFX_LIGHTUPS"},{"id":"S08","slot":"shoes","name":"Rocket Boots","rarity":"Legendary","price":450,"buy":true,"fx":"SFX_ROCKET"},{"id":"S09","slot":"shoes","name":"Golden Kicks","rarity":"Legendary","price":450,"buy":true,"fx":"SFX_GOLDEN"},{"id":"S10","slot":"shoes","name":"Pink High Heels","rarity":"Uncommon","price":90,"buy":true},{"id":"S11","slot":"shoes","name":"Roller Skates","rarity":"Rare","price":200,"buy":true},{"id":"S12","slot":"shoes","name":"Classic Sneakers","rarity":"Common","price":40,"buy":true},{"id":"S13","slot":"shoes","name":"Formal Shoes","rarity":"Uncommon","price":90,"buy":true},{"id":"S14","slot":"shoes","name":"Boots","rarity":"Common","price":40,"buy":true},{"id":"S15","slot":"shoes","name":"Cowboy Boots","rarity":"Uncommon","price":90,"buy":true},{"id":"S16","slot":"shoes","name":"Sandals","rarity":"Common","price":40,"buy":true},{"id":"S17","slot":"shoes","name":"Scuba Flippers","rarity":"Rare","price":200,"buy":true,"big":1},{"id":"S18","slot":"shoes","name":"Clown Shoes","rarity":"Rare","price":200,"buy":true,"big":1},{"id":"S19","slot":"shoes","name":"Snow Skis","rarity":"Rare","price":200,"buy":true,"big":1},{"id":"S20","slot":"shoes","name":"Moon Boots","rarity":"Rare","price":200,"buy":true},{"id":"S21","slot":"shoes","name":"Boing Boots","rarity":"Rare","price":200,"buy":true},{"id":"S22","slot":"shoes","name":"Plasma Hovers","rarity":"Legendary","price":450,"buy":true,"fx":"SFX_PLASMA"},{"id":"S23","slot":"shoes","name":"Storm Striders","rarity":"Legendary","price":450,"buy":true,"fx":"SFX_STORM"},{"id":"S24","slot":"shoes","name":"Frostbite Skates","rarity":"Legendary","price":450,"buy":true,"fx":"SFX_FROST"},{"id":"SK01","slot":"skin","name":"Astronaut","rarity":"Collector","price":900,"buy":true,"fx":"KFX_GALAXY"},{"id":"SK02","slot":"skin","name":"Motorbike Helmet","rarity":"Rare","price":200,"buy":true},{"id":"SK03","slot":"skin","name":"Brass Diving Helmet","rarity":"Rare","price":200,"buy":true},{"id":"SK04","slot":"skin","name":"Snowboard Helmet & Goggles","rarity":"Collector","price":900,"buy":true,"fx":"KFX_SNOW"},{"id":"SK05","slot":"skin","name":"Welder's Helmet","rarity":"Collector","price":900,"buy":true,"fx":"KFX_WELDER"},{"id":"SK06","slot":"skin","name":"Knight Armour","rarity":"Rare","price":200,"buy":true},{"id":"SK07","slot":"skin","name":"Robot Suit","rarity":"Legendary","price":450,"buy":true},{"id":"SK08","slot":"skin","name":"Bubble Helmet","rarity":"Rare","price":200,"buy":true},{"id":"SK09","slot":"skin","name":"Firefighter","rarity":"Collector","price":900,"buy":true,"fx":"KFX_FIRE"},{"id":"SK10","slot":"skin","name":"Racing Helmet","rarity":"Rare","price":200,"buy":true},{"id":"SK11","slot":"skin","name":"Beekeeper Suit","rarity":"Collector","price":900,"buy":true,"fx":"KFX_BEES"},{"id":"SK12","slot":"skin","name":"Hazmat Suit","rarity":"Collector","price":900,"buy":true,"fx":"KFX_TOXIC"},{"id":"SK13","slot":"skin","name":"Gridiron Helmet","rarity":"Uncommon","price":90,"buy":true},{"id":"SK14","slot":"skin","name":"Goalie Mask","rarity":"Uncommon","price":90,"buy":true},{"id":"SK15","slot":"skin","name":"Fencing Mask","rarity":"Uncommon","price":90,"buy":true},{"id":"SK16","slot":"skin","name":"Samurai Armour","rarity":"Legendary","price":450,"buy":true},{"id":"SK17","slot":"skin","name":"Dino Costume","rarity":"Rare","price":200,"buy":true},{"id":"SK18","slot":"skin","name":"Shark Costume","rarity":"Legendary","price":450,"buy":true},{"id":"SK19","slot":"skin","name":"Pumpkin Head","rarity":"Uncommon","price":90,"buy":true},{"id":"SK20","slot":"skin","name":"Cardboard Box Robot","rarity":"Uncommon","price":90,"buy":true},{"id":"SK21","slot":"skin","name":"Ghost Sheet","rarity":"Uncommon","price":90,"buy":true},{"id":"SK22","slot":"skin","name":"Golden Knight","rarity":"Legendary","price":450,"buy":true},{"id":"SK23","slot":"skin","name":"Crimson Dragon","rarity":"Legendary","price":450,"buy":true},{"id":"SK24","slot":"skin","name":"Royal Monarch","rarity":"Legendary","price":450,"buy":true},{"id":"FX01","slot":"fx","name":"Sparkle Dust","rarity":"Legendary","price":450,"buy":true},{"id":"FX02","slot":"fx","name":"Bubbles","rarity":"Legendary","price":450,"buy":true},{"id":"FX03","slot":"fx","name":"Floating Hearts","rarity":"Legendary","price":450,"buy":true},{"id":"FX04","slot":"fx","name":"Steam Puffs","rarity":"Legendary","price":450,"buy":true},{"id":"FX05","slot":"fx","name":"Magic Swirl","rarity":"Collector","price":900,"buy":true},{"id":"FX06","slot":"fx","name":"Storm Cloud","rarity":"Legendary","price":450,"buy":true},{"id":"FX07","slot":"fx","name":"Flame Crown","rarity":"Collector","price":900,"buy":true},{"id":"FX08","slot":"fx","name":"Starburst Halo","rarity":"Legendary","price":450,"buy":true},{"id":"FX09","slot":"fx","name":"Galaxy","rarity":"Collector","price":900,"buy":true},{"id":"FX10","slot":"fx","name":"Golden Aura","rarity":"Collector","price":900,"buy":true},{"id":"FX11","slot":"fx","name":"Aurora","rarity":"Collector","price":900,"buy":true},{"id":"FX12","slot":"fx","name":"Phoenix Feathers","rarity":"Collector","price":900,"buy":true}],"fx":{"FX01":{"layer":"front","glow":"#fff3a8","outline":true,"em":[["star_07",["#ffd23f"],9,"twinkle_spin",1.5,[22,34],[40,200],[-40,60]]],"planet":0},"FX02":{"layer":"front","glow":"#bfe8ff","outline":true,"em":[["circle_02",["#2fa8ff"],8,"bubble",2.6,[18,28],[40,200],[30,55]]],"planet":0},"FX03":{"layer":"front","glow":"#ffc2dc","outline":true,"em":[["symbol_01",["#ff3d8e"],6,"heart",2.8,[22,30],[40,200],[30,55]]],"planet":0},"FX04":{"layer":"front","glow":"#9aa6b2","outline":true,"em":[["smoke_04",["#ffffff"],5,"drift",3.2,[46,60],[80,160],[0,20]]],"planet":0},"FX05":{"layer":"front","glow":null,"outline":false,"em":[["twirl_01",["#b98cff"],1,"spin",2.4,96,[120,120],[-10,-10]],["twirl_01",["#7de8ff"],1,"spin_reverse",3.0,70,[120,120],[-10,-10]],["star_04",["#ffffff"],3,"twinkle",1.4,[14,20],[40,200],[-40,60]]],"planet":0},"FX06":{"layer":"front","glow":null,"outline":false,"em":[["smoke_07",["#6b7280"],1,"cloud",3,96,[120,120],[-28,-28]],["spark_02",["#7de8ff","#c6f4ff"],3,"crackle",1.8,[30,40],[96,146],[-6,6]]],"planet":0},"FX07":{"layer":"front","glow":"#ff8a2a","outline":false,"em":[["muzzle_02",["#ff5a14"],5,"flame",0.7,[40,60],[70,170],[36,36]],["muzzle_02",["#ffd23f"],5,"flame",0.55,[22,33],[70,170],[42,42]],["circle_05",["#ffb02e","#ffe14f","#ff6a1a"],8,"ember",1.6,[10,16],[70,170],[42,42]]],"planet":0},"FX08":{"layer":"behind","glow":null,"outline":false,"em":[["magic_03",["#ffd23f"],1,"spin",6,120,[120,120],[-4,-4]],["star_09",["#fff3a8"],4,"twinkle",1.8,[18,26],[40,200],[-40,60]]],"planet":0},"FX09":{"layer":"behind","glow":null,"outline":false,"em":[["light_02",["#8a6cff"],1,"spin",8,130,[120,120],[-4,-4]],["light_02",["#4fd8ff"],1,"spin_reverse",6,92,[120,120],[-4,-4]],["star_04",["#ffffff"],6,"twinkle",1.5,[12,20],[40,200],[-40,60]]],"planet":0},"FX10":{"layer":"behind","glow":null,"outline":false,"em":[["circle_05",["#ffd23f"],1,"pulse",2.2,130,[120,120],[2,2]],["star_06",["#ffe14f"],5,"rise",2.6,[18,24],[60,180],[20,50]]],"planet":0},"FX11":{"layer":"behind","glow":null,"outline":false,"em":[["ribbon_01",["#39ffb0","#4fd8ff","#b98cff"],3,"pulse",[3.2,4.4],[150,170],[92,148],[-6,2]],["ribbon_01",["#7dffc8","#39ffb0"],2,"cloud",3.6,[120,140],[100,140],[12,20]],["star_04",["#ffffff","#c6fff0"],6,"twinkle",1.6,[10,18],[40,200],[-40,50]]],"planet":0},"FX12":{"layer":"behind+front","glow":"#ff8a2a","outline":false,"em":[["circle_05",["#ff8a2a"],1,"pulse",2.0,120,[120,120],[6,6]],["feather_01",["#ffb02e","#ff5a14","#ffe14f","#e2525a"],7,"feather",[2.6,3.6],[28,38],[44,196],[-40,-12]],["circle_05",["#ffe14f","#ff6a1a"],6,"ember",1.5,[8,13],[70,170],[30,44]]],"planet":0},"SFX_LIGHTUPS":{"layer":"behind+front","glow":null,"outline":false,"planet":0,"em":[["circle_05",["#00F5FF","#FF2BD6","#FFF200","#39FF14"],4,"pulse",0.5,92,[80,160],[218,218]],["star_04",["#00F5FF","#FF2BD6","#FFF200","#39FF14","#FFFFFF"],14,"twinkle",0.55,[20,32],[40,200],[190,236]],["spark_02",["#FFFFFF","#00F5FF","#FF2BD6","#FFF200"],4,"crackle",0.8,[28,38],[70,170],[204,230]]]},"SFX_ROCKET":{"layer":"front","glow":"#ff8a2a","outline":false,"em":[["muzzle_02",["#ff5a14"],2,"jet",0.35,52,[86,154],[242,242]],["muzzle_02",["#ffe14f"],2,"jet",0.3,32,[86,154],[234,234]],["smoke_04",["#d8d2c8"],4,"drift",1.6,[34,46],[76,164],[260,260]]],"planet":0},"SFX_GOLDEN":{"layer":"behind+front","glow":null,"outline":false,"em":[["circle_05",["#ffd23f"],2,"pulse",1.6,72,[86,154],[208,208]],["star_06",["#ffd23f","#fff3a8"],6,"twinkle_spin",1.4,[18,30],[50,190],[184,230]]],"planet":0},"SFX_PLASMA":{"layer":"behind+front","glow":"#4fd8ff","outline":false,"em":[["circle_05",["#4fd8ff"],2,"pulse",1.1,74,[86,154],[216,216]],["muzzle_02",["#4fd8ff"],2,"jet",0.3,54,[86,154],[240,240]],["muzzle_02",["#e6f6ff"],2,"jet",0.25,24,[86,154],[230,230]],["star_04",["#4fd8ff","#ffffff"],6,"twinkle",0.9,[10,18],[50,190],[210,240]]],"planet":0},"SFX_STORM":{"layer":"behind+front","glow":"#ffe14f","outline":false,"em":[["circle_05",["#ffe14f"],2,"pulse",0.7,64,[86,154],[212,212]],["spark_02",["#ffe14f","#ffffff","#fff3a8"],6,"crackle",0.9,[30,46],[50,190],[186,232]],["star_04",["#ffe14f","#ffffff"],6,"ember",1.1,[10,16],[60,180],[212,222]]],"planet":0},"SFX_FROST":{"layer":"behind+front","glow":"#7fb8e6","outline":true,"em":[["circle_05",["#bfe8ff"],2,"pulse",1.8,70,[86,154],[214,214]],["smoke_04",["#e6f6ff","#bfe8ff"],4,"drift",2.4,[28,40],[56,184],[212,224]],["star_04",["#ffffff","#bfe8ff"],8,"twinkle",1.3,[14,22],[46,194],[196,236]]],"planet":0},"KFX_GALAXY":{"layer":"behind+front","glow":null,"outline":false,"em":[["light_02",["#8a6cff"],1,"spin",10,270,[120,120],[115,115]],["light_02",["#4fd8ff"],1,"spin_reverse",7,195,[120,120],[115,115]],["star_04",["#ffffff","#fff3a8","#bfe8ff"],14,"twinkle",[1.2,2.2],[13,24],[-10,250],[-30,240]]],"planet":1},"KFX_SNOW":{"layer":"front","glow":"#7fb8e6","outline":true,"em":[["circle_05",["#ffffff"],10,"fall",[2.2,3.4],[9,15],[0,240],[-30,0]],["star_04",["#ffffff"],6,"fall",[2.2,3.4],[9,15],[0,240],[-30,0]]],"planet":0},"KFX_WELDER":{"layer":"front","glow":null,"outline":false,"em":[["muzzle_02",["#ff5a14","#ffd23f"],6,"flame",0.6,[24,54],[90,150],[26,32]],["star_04",["#ffe14f","#ffb02e","#ffffff"],8,"ember",1.2,[11,17],[160,230],[180,235]]],"planet":0},"KFX_FIRE":{"layer":"behind+front","glow":null,"outline":false,"em":[["muzzle_02",["#ff5a14","#ff7a1a"],5,"flame",0.7,[98,130],[33,207],[24,138]],["muzzle_02",["#ffd23f","#ffe14f"],3,"flame",0.55,[55,70],[33,207],[40,144]],["circle_05",["#ffb02e","#ffe14f","#ff6a1a"],10,"ember",1.6,[11,16],[44,196],[40,105]]],"planet":0},"KFX_BEES":{"layer":"front","glow":null,"outline":false,"em":[["bee",[],7,"orbit",[4,6],0,[0,0],[0,0]]],"planet":0},"KFX_TOXIC":{"layer":"behind+front","glow":null,"outline":false,"em":[["smoke_04",["#7dff6a","#39d353","#b6ff4a"],5,"drift",[2.8,3.8],[44,65],[33,207],[60,190]],["smoke_07",["#7dff6a","#39d353","#b6ff4a"],4,"drift",[2.8,3.8],[44,65],[33,207],[60,190]],["circle_02",["#39d353"],6,"bubble",2.4,[13,20],[44,196],[140,215]]],"planet":0},"HFX_PHOENIX":{"layer":"behind+front","glow":"#ff8a2a","outline":false,"em":[["circle_05",["#ff8a2a"],1,"pulse",2.0,150,[120,120],[16,16]],["muzzle_02",["#ff7a1a"],2,"flame",0.6,34,[52,188],[12,12]],["circle_05",["#ffe14f","#ffb02e","#ff6a1a"],6,"ember",1.5,[8,13],[50,190],[0,40]]],"planet":0},"HFX_CELESTIAL":{"layer":"behind+front","glow":"#b98cff","outline":false,"em":[["light_02",["#8a6cff"],1,"spin",9,150,[120,120],[10,10]],["star_09",["#ffffff","#7de8ff","#ffb8f4","#fff3a8"],4,"halo",4.2,[30,38],[4,236],[8,76]],["star_04",["#ffffff","#fff3a8"],3,"twinkle",1.6,[10,16],[30,210],[-40,30]]],"planet":0},"HFX_ICE":{"layer":"behind+front","glow":"#7fb8e6","outline":true,"em":[["circle_05",["#bfe8ff"],1,"pulse",2.4,150,[120,120],[12,12]],["snowflake_01",["#ffffff","#e6f6ff"],4,"twinkle_spin",1.8,[16,24],[24,216],[-36,40]],["snowflake_01",["#ffffff"],3,"fall",[2.6,3.4],[10,14],[14,226],[-30,0]]],"planet":0}},"rarity":{"Common":40,"Uncommon":90,"Rare":200,"Legendary":450,"Collector":900}}/*END-BRICK-DATA*/;
const SCRIPT = document.currentScript;
let ROOT = new URL('brick/', SCRIPT && SCRIPT.src ? SCRIPT.src : location.href).href;

/* ---------- the 240 design grid ---------- */
const FRAME = { x:-20, y:-40, w:280, h:300 };          // every SVG's viewBox
const CX = 120, FEET = 207, HEAD = 64, UNIT_H = FEET - HEAD;  // 143 grid units from head top to soles
const HITBOX = { x:30, y:64, w:180, h:143 };            // body width x head-to-soles; cosmetics never change it
const VIEW = { x0:-20, y0:-40, x1:260, y1:260 };        // default area shown by mount()/render()
const INK = '#4a2c22';
const PIV = { armL:[27,123], armR:[213,123], legL:[86,160], legR:[154,160] };  // shoulder / hip pivots
// Layer crops (grid units). The limbs and shoes layers are one file each, so they are split per side here.
const R = {
  armL:{ x0:-20, y0:80,  x1:60,  y1:240 }, legL:{ x0:60,  y0:120, x1:120, y1:260 },
  legR:{ x0:120, y0:120, x1:180, y1:260 }, armR:{ x0:180, y0:80,  x1:260, y1:240 },
  shoeL:{ x0:-20, y0:140, x1:120, y1:260 }, shoeR:{ x0:120, y0:140, x1:260, y1:260 },
  body:{ x0:20, y0:50, x1:220, y1:200 }, shell:{ x0:-20, y0:-40, x1:260, y1:235 }, hat:{ x0:-20, y0:-40, x1:260, y1:120 },
};

/* ---------- catalogue ---------- */
const ITEMS = {}, BASES = {};
DATA.items = DATA.items || []; DATA.bases = DATA.bases || []; DATA.fx = DATA.fx || {};
/* Companions (21 Oct 2026): a small friend that stands (later: walks) beside Brick. Their own slot, 'companion'; drawn in
   code by drawCompanion() below (no SVG files), so they can blink and fidget. Kept out of the generated BRICK-DATA block
   so brick_build.py doesn't remove them; the matching mc_items rows are in setup/mathcade-setup.sql (COMPANIONS). */
const COMPANIONS = [
  { id:'CP01', slot:'companion', name:'Ammy\'s Ruler', rarity:'Collector', price:900, buy:true },
];
COMPANIONS.forEach(c => { if(!DATA.items.some(i => i.id === c.id)) DATA.items.push(c); });
DATA.items.forEach(it => {
  it.files = it.slot === 'hat' ? ['hat/' + it.id + '.svg'] : it.slot === 'shoes' ? ['shoe/' + it.id + '.svg']
    : it.slot === 'skin' ? ['skin/' + it.id + '_limbs.svg', 'skin/' + it.id + '_shell.svg'] : [];
  ITEMS[it.id] = it;
});
DATA.bases.forEach(b => { b.slot = 'base'; b.rarity = 'Free'; b.price = 0; b.buy = false; BASES[b.id] = b; });
const RARITY_COLOURS = { Free:'#C9D3DA', Common:'#9AA8B6', Uncommon:'#3DBE6E', Rare:'#3A8DFF', Legendary:'#FF9F2E', Collector:'#FF3DCB' };
const CATALOGUE = {
  items:DATA.items, bases:DATA.bases, prices:DATA.rarity, rarityColours:RARITY_COLOURS,
  slots:[['hat','Hats'],['shoes','Shoes'],['skin','Costumes'],['fx','Hat effects']],
  item:id => ITEMS[id] || BASES[id] || null,
  bySlot:slot => slot === 'base' ? DATA.bases : DATA.items.filter(i => i.slot === slot),
};
const DEFAULT_LOOK = Object.freeze({ base:'brick_orange', hat:null, shoes:'S00', skin:null, fx:null });

/* A look is the student's equipped slots. Accepts a look, MC look (look.brick) or equipped map. */
function normalize(look){
  look = look || {};
  if(look.brick && typeof look.brick === 'object') look = look.brick;
  const pick = (id, slot) => id && ITEMS[id] && ITEMS[id].slot === slot ? id : null;
  return { base:BASES[look.base] ? look.base : 'brick_orange', hat:pick(look.hat, 'hat'),
    shoes:pick(look.shoes, 'shoes') || 'S00', skin:pick(look.skin, 'skin'), fx:pick(look.fx, 'fx'), companion:pick(look.companion, 'companion') };
}
/* The look of a Mathcade user (MC.user / a leaderboard row / a live-race player): look.brick, else equipped. */
function lookOf(u){
  if(!u) return Object.assign({}, DEFAULT_LOOK);
  if(u.look && u.look.brick) return normalize(u.look.brick);
  if(u.brick) return normalize(u.brick);
  if(u.equipped) return normalize(u.equipped);
  return normalize(u);
}
const lookKey = l => { l = normalize(l); return [l.base, l.hat, l.shoes, l.skin, l.fx].join('|'); };
/* What is actually visible: a skin hides the hat and shoes (they stay saved). */
function visible(l){ l = normalize(l); return l.skin ? { base:l.base, hat:null, shoes:null, skin:l.skin, fx:l.fx, companion:l.companion } : l; }

/* ---------- reduced motion ---------- */
let reduceOverride = null;
const mq = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : null;
const reducedMotion = () => reduceOverride != null ? reduceOverride : !!(mq && mq.matches);

/* ---------- loading ---------- */
const imgCache = new Map(), textCache = new Map();
function loadImg(url){
  if(!imgCache.has(url)) imgCache.set(url, new Promise(res => {
    const im = new Image(); im.decoding = 'async';
    im.onload = () => res(im); im.onerror = () => { console.warn('Brick: could not load ' + url); res(null); };
    im.src = url;
  }));
  return imgCache.get(url);
}
function loadText(url){
  if(!textCache.has(url)) textCache.set(url, fetch(url).then(r => r.ok ? r.text() : null).catch(() => null));
  return textCache.get(url);
}
const svgURL = s => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
function baseImgs(id){
  const b = BASES[id] || BASES.brick_orange, key = 'base:' + b.id;
  if(!imgCache.has(key)) imgCache.set(key, Promise.all([loadText(ROOT + 'base/limbs.svg'), loadText(ROOT + 'base/body.svg')]).then(([l, bd]) => {
    const tok = s => s ? svgURL(s.replace(/TOKEN_MAIN/g, b.main).replace(/TOKEN_SHADOW/g, b.shadow)) : null;
    return Promise.all([l ? loadImg(tok(l)) : null, bd ? loadImg(tok(bd)) : null]);
  }));
  return imgCache.get(key);
}
const BEE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 18" width="48" height="36"><ellipse cx="9" cy="5" rx="5" ry="4" fill="#ffffff" opacity="0.85" stroke="#4a2c22" stroke-width="1.2"/><ellipse cx="15" cy="5" rx="5" ry="4" fill="#ffffff" opacity="0.85" stroke="#4a2c22" stroke-width="1.2"/><ellipse cx="12" cy="11" rx="8" ry="5.5" fill="#ffd23f" stroke="#4a2c22" stroke-width="1.6"/><path d="M10 6.5 V15.5 M14 6.5 V15.5" stroke="#4a2c22" stroke-width="2"/><circle cx="18" cy="10" r="1.2" fill="#4a2c22"/><path d="M4 11 L1.5 11.5" stroke="#4a2c22" stroke-width="1.6" stroke-linecap="round"/></svg>';
const PLANET_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" width="60" height="40"><ellipse cx="15" cy="10" rx="14" ry="4" fill="none" stroke="#ffd23f" stroke-width="2"/><circle cx="15" cy="10" r="6.5" fill="#ff8a5a" stroke="#4a2c22" stroke-width="1.6"/><path d="M2 10 A13 4 0 0 0 28 10" fill="none" stroke="#ffd23f" stroke-width="2"/></svg>';

function canvas(w, h){ const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
/* rasterise one region of a full-frame SVG at k device px per grid unit */
function raster(img, r, k){
  if(!img) return null;
  const c = canvas((r.x1 - r.x0) * k, (r.y1 - r.y0) * k), g = c.getContext('2d');
  g.drawImage(img, (FRAME.x - r.x0) * k, (FRAME.y - r.y0) * k, FRAME.w * k, FRAME.h * k);
  return { c, x:r.x0, y:r.y0, w:r.x1 - r.x0, h:r.y1 - r.y0 };
}

/* ---------- particles ---------- */
const texCache = new Map();
/* white sprite -> tinted canvas, optionally with a thin dark outline and a soft glow (shop-tier rule) */
function texture(name, tint, outline, glow){
  const key = [name, tint, outline, glow].join('|');
  if(!texCache.has(key)) texCache.set(key, loadImg(ROOT + 'fx/' + name + '.png').then(img => {
    if(!img) return null;
    const S = img.width, pad = glow ? Math.round(S * 0.3) : outline ? Math.round(S * 0.08) : 0;
    const solid = col => { const c = canvas(S, S), g = c.getContext('2d'); g.drawImage(img, 0, 0, S, S); g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, S, S); return c; };
    const t = solid(tint), c = canvas(S + pad * 2, S + pad * 2), g = c.getContext('2d');
    if(outline){ const o = solid(INK), r = Math.max(1.5, S * 0.045);
      for(let i = 0; i < 8; i++){ const a = i * Math.PI / 4; g.drawImage(o, pad + Math.cos(a) * r, pad + Math.sin(a) * r); } }
    if(glow){ g.save(); g.shadowColor = glow; g.shadowBlur = S * 0.3; g.drawImage(t, pad, pad); g.restore(); }
    g.drawImage(t, pad, pad);
    return { c, k:(S + pad * 2) / S };
  }));
  return texCache.get(key);
}
const rnd = (a, b, c) => { const x = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453; return x - Math.floor(x); };
const lerp = (a, b, u) => a + (b - a) * u;
const smooth = u => u * u * (3 - 2 * u);
/* piecewise keyframes: ts = [0,..,1], vs = values; eased like CSS ease-in-out */
function kf(u, ts, vs){
  for(let i = 1; i < ts.length; i++) if(u <= ts[i]){ const w = (u - ts[i - 1]) / ((ts[i] - ts[i - 1]) || 1); return lerp(vs[i - 1], vs[i], smooth(w)); }
  return vs[vs.length - 1];
}
const fadeInOut = (u, inEnd, peak) => u < inEnd ? (u / inEnd) * (peak || 1) : (peak || 1) * (1 - (u - inEnd) / (1 - inEnd));
const D2R = Math.PI / 180;
/* motion(u in 0..1 of one cycle, particle) -> {dx, dy, s, sx, sy, rot(deg), skew(deg), a, base:true when scaled from the bottom} */
const MOTION = {
  twinkle:u => { const e = Math.sin(Math.PI * u); return { s:0.3 + 0.7 * e, a:e }; },
  twinkle_spin:u => { const e = Math.sin(Math.PI * u); return { s:0.2 + 0.9 * e, rot:45 * e, a:e }; },
  rise:u => ({ dy:-70 * u, s:0.6 + 0.4 * u, a:fadeInOut(u, 0.2) }),
  bubble:u => { const T = [0, 0.5, 1]; return { dx:kf(u, T, [0, 9, -7]), dy:kf(u, T, [0, -42, -88]), s:kf(u, T, [0.5, 0.95, 1.1]), a:fadeInOut(u, 0.15) }; },
  heart:u => { const T = [0, 0.15, 0.3, 0.6, 1]; return { dx:kf(u, T, [0, 0, 0, 10, -8]), dy:kf(u, T, [0, -8, -20, -52, -88]), s:kf(u, T, [0.4, 1.2, 1, 1, 0.9]), a:fadeInOut(u, 0.15) }; },
  drift:u => ({ dx:12 * u, dy:-60 * u, s:0.6 + 0.6 * u, a:fadeInOut(u, 0.25, 0.8) }),
  spin:u => ({ rot:360 * u, a:1 }),
  spin_reverse:u => ({ rot:-360 * u, a:1 }),
  flame:u => { const T = [0, 0.25, 0.5, 0.75, 1]; return { sx:kf(u, T, [1, 0.9, 1.06, 0.94, 1]), sy:kf(u, T, [1, 1.2, 0.88, 1.14, 1]), skew:kf(u, T, [0, -7, 5, -3, 0]), a:1, base:true }; },
  ember:(u, p) => ({ dx:p.dx * u, dy:-95 * u, s:1 - 0.7 * u, a:fadeInOut(u, 0.1) }),
  crackle:u => ({ a:kf(u, [0, 0.6, 0.62, 0.66, 0.7, 1], [0, 0, 1, 0.3, 1, 0]) }),
  pulse:u => { const e = 0.5 - 0.5 * Math.cos(2 * Math.PI * u); return { s:0.92 + 0.13 * e, a:0.45 + 0.3 * e }; },
  cloud:u => ({ dx:-4 * Math.cos(2 * Math.PI * u), a:1 }),
  fall:u => ({ dx:10 * u, dy:72 * u, a:fadeInOut(u, 0.15) }),
  jet:u => { const e = 0.5 - 0.5 * Math.cos(2 * Math.PI * u); return { rot:180, sx:1 - 0.12 * e, sy:1 + 0.25 * e, a:1 }; },
  feather:(u, p) => { const w = Math.sin(2 * Math.PI * u * 1.5 + p.seed); return { dx:14 * w + p.dx * 0.3 * u, dy:80 * u, rot:25 * w, a:fadeInOut(u, 0.15) }; },
  // round a flat ellipse (rx, ry) about the crown; near side (sin > 0) is bigger and brighter and drawn in front of the hat
  halo:(u, p) => { const a = 2 * Math.PI * u, f = Math.sin(a); return { dx:p.rx * Math.cos(a), dy:p.ry * f, s:0.8 + 0.25 * f, rot:60 * u, a:0.7 + 0.3 * f }; },
};
const FIXED = { spin:1, spin_reverse:1, pulse:1, cloud:1, flame:1, jet:1, halo:1 };       // stay in place
const BACK_MOTIONS = { pulse:1, spin:1, spin_reverse:1, flame:1, drift:1 };       // for 'behind+front' effects
// bee / planet orbits (from the skins board, converted to the 240 grid): [cx, cy, rx, ry, seconds]
const ORBITS = [[120, 126.5, 113.5, 87.3, 4], [120, 113.5, 102.5, 104.7, 5], [120, 137.5, 120, 72, 6]];

/* Build the particle list for a look: hat effect + a hat's own effect (H37-H39, data.fx; not under a skin)
   + shoe effect (no skin) + skin effect, capped at maxParticles. */
async function buildFX(L, maxParticles){
  const groups = [];
  if(L.fx && DATA.fx[L.fx]) groups.push({ id:L.fx, at:'hat' });
  if(!L.skin && ITEMS[L.hat] && ITEMS[L.hat].fx && DATA.fx[ITEMS[L.hat].fx]) groups.push({ id:ITEMS[L.hat].fx, at:'hat' });
  if(!L.skin && ITEMS[L.shoes] && ITEMS[L.shoes].fx && DATA.fx[ITEMS[L.shoes].fx]) groups.push({ id:ITEMS[L.shoes].fx, at:'shoe' });
  if(L.skin && ITEMS[L.skin].fx && DATA.fx[ITEMS[L.skin].fx]) groups.push({ id:ITEMS[L.skin].fx, at:'skin' });
  let keep = 0, many = 0;                                  // emitters of 1-2 (halos, jets) always stay; the rest share the budget
  groups.forEach(g => { if(DATA.fx[g.id].planet) keep++; DATA.fx[g.id].em.forEach(em => { if(em[2] <= 2) keep += em[2]; else many += em[2]; }); });
  const scale = many && keep + many > maxParticles ? Math.max(0, maxParticles - keep) / many : 1;
  const out = [], waits = [];
  groups.forEach((g, gi) => {
    const E = DATA.fx[g.id];
    if(E.planet) out.push({ orbit:ORBITS[0], dur:9, dir:1, delay:0, img:'planet', at:g.at, w:33, h:22 });
    E.em.forEach((em, ei) => {
      const [sprite, tints, count, motion, dur, size, ax, ay] = em;
      const n = count <= 2 ? count : Math.max(1, Math.floor(count * scale));
      for(let i = 0; i < n; i++){
        const seed = gi * 1000 + ei * 50 + i + 1;
        if(motion === 'orbit'){
          const o = i % 3;
          out.push({ orbit:ORBITS[o], dur:ORBITS[o][4], dir:i % 2 ? -1 : 1, delay:-0.9 * i, img:'bee', at:g.at, w:24, h:18.5 });
          continue;
        }
        const d = Array.isArray(dur) ? lerp(dur[0], dur[1], rnd(seed, 7, 1)) : dur;
        const p = { motion, dur:d, phase:rnd(seed, 3, 9) * d, seed, at:g.at, fixed:!!FIXED[motion], ax, ay, size,
          back:E.layer === 'behind' || (E.layer === 'behind+front' && !!BACK_MOTIONS[motion]) };
        if(p.fixed){
          const f = n > 1 ? i / (n - 1) : 0.5;
          p.x = lerp(ax[0], ax[1], n > 1 ? f : 0.5);
          p.y = ay[0] === ay[1] ? ay[0] : lerp(ay[0], ay[1], rnd(seed, 5, 2));
          p.sz = Array.isArray(size) ? lerp(size[0], size[1], n > 2 ? 1 - Math.abs(2 * f - 1) : rnd(seed, 4, 4)) : size;
          if(motion === 'flame' || motion === 'jet') p.phase = (n > 1 ? ((i * 0.37) % 1) : 0) * d;
          if(motion === 'halo'){ p.x = (ax[0] + ax[1]) / 2; p.rx = (ax[1] - ax[0]) / 2; p.y = (ay[0] + ay[1]) / 2; p.ry = (ay[1] - ay[0]) / 2; p.phase = i / n * d; }
        }
        const tint = tints[i % tints.length];
        waits.push(texture(sprite, tint, E.outline, E.glow).then(t => { p.tex = t; }));
        out.push(p);
      }
    });
  });
  if(out.some(p => p.img === 'bee')) waits.push(loadImg(svgURL(BEE_SVG)).then(im => out.forEach(p => { if(p.img === 'bee') p.tex = { c:im, k:1 }; })));
  if(out.some(p => p.img === 'planet')) waits.push(loadImg(svgURL(PLANET_SVG)).then(im => out.forEach(p => { if(p.img === 'planet') p.tex = { c:im, k:1 }; })));
  await Promise.all(waits);
  return out.filter(p => p.tex && p.tex.c);
}

function drawParticle(g, p, T){
  if(p.orbit){
    const [cx, cy, rx, ry] = p.orbit, ph = 2 * Math.PI * ((T + p.delay) / p.dur) * p.dir;
    const x = cx - rx * Math.cos(ph), y = cy + ry * Math.sin(ph), vx = rx * Math.sin(ph) * p.dir;
    const buzz = p.img === 'bee' ? 2 * Math.sin(T * Math.PI / 0.18) : 0;
    g.save(); g.translate(x, y + buzz); if(vx < 0 && p.img === 'bee') g.scale(-1, 1);
    g.drawImage(p.tex.c, -p.w / 2, -p.h / 2, p.w, p.h); g.restore();
    return;
  }
  const tt = T + p.phase, cyc = Math.floor(tt / p.dur), u = tt / p.dur - cyc;
  let x = p.x, y = p.y, sz = p.sz;
  if(!p.fixed){
    x = lerp(p.ax[0], p.ax[1], rnd(p.seed, cyc, 1)); y = lerp(p.ay[0], p.ay[1], rnd(p.seed, cyc, 2));
    sz = Array.isArray(p.size) ? lerp(p.size[0], p.size[1], rnd(p.seed, cyc, 3)) : p.size;
    p.dx = (rnd(p.seed, cyc, 4) * 40 - 20);
  }
  const m = MOTION[p.motion] ? MOTION[p.motion](u, p) : { a:1 };
  const a = m.a == null ? 1 : m.a; if(a <= 0.01) return;
  const s = m.s == null ? 1 : m.s, sx = (m.sx || 1) * s, sy = (m.sy || 1) * s, D = sz * p.tex.k;
  g.save();
  g.globalAlpha *= Math.min(1, a);
  g.translate(x + (m.dx || 0), y + (m.dy || 0) + (m.base ? sz / 2 : 0));
  if(m.rot) g.rotate(m.rot * D2R);
  if(m.skew) g.transform(1, 0, Math.tan(m.skew * D2R), 1, 0, 0);
  g.scale(sx, sy);
  g.drawImage(p.tex.c, -D / 2, m.base ? -sz / 2 - D / 2 : -D / 2, D, D);
  g.restore();
}

/* ---------- pose (HANDOVER section 10, timings from BrickPlay) ---------- */
function pose(o, look, blinkOffset){
  const t = o.t, st = o.state || 'idle', f = o.facing || 0, since = o.since == null ? 1 : o.since;
  const P = { legL:0, legR:0, armL:0, armR:0, bob:0, lean:0, sx:1, sy:1, eye:1, shake:0 };
  const shoe = !look.skin && ITEMS[look.shoes], big = shoe && shoe.big, ski = look.shoes === 'S19' && !look.skin, skate = look.shoes === 'S11' && !look.skin;
  const legK = ski ? 0.15 : big ? 0.4 : skate ? 0.55 : 1;
  if(st === 'run' || st === 'walk'){
    const run = st === 'run', half = run ? 0.18 : 0.32, c = Math.cos(Math.PI * t / half);
    const L = (run ? 26 : 16) * legK, A = run ? 32 : 18;
    const inK = c > 0 ? 0.55 : 1;                          // feet swing inward less, so they never cross
    P.legL = -L * c * inK; P.legR = L * c * inK; P.armL = A * c; P.armR = -A * c;
    P.bob = -(ski ? 2 : run ? 6 : 4) * (0.5 - 0.5 * Math.cos(Math.PI * t / (run ? 0.09 : 0.16)));
    P.lean = (run ? 6 : 3) * f;
    if(big && !ski) P.lean += 5 * c;                       // oversized shoes: wide waddle
  } else if(st === 'jump'){
    const falling = (o.vy || 0) > 0;
    P.armL = falling ? 35 : 55; P.armR = -P.armL; P.legL = falling ? 14 : 8; P.legR = -P.legL;
    P.sx = falling ? 1 : 0.95; P.sy = falling ? 1.02 : 1.06; P.lean = 3 * f;
  } else if(st === 'land'){
    const q = Math.max(0, 1 - since / 0.2); P.sx = 1 + 0.12 * q; P.sy = 1 - 0.12 * q; P.armL = 20 * q; P.armR = -20 * q;
  } else if(st === 'hurt'){
    const q = Math.max(0, 1 - since / 0.45);
    P.shake = 4 * q * Math.sin(t * 70); P.eye = 0.3; P.armL = 70; P.armR = -70; P.legL = 10; P.legR = -10; P.lean = -8 * (f || 1) * Math.max(0.4, q);
  } else {                                                 // idle: gentle squash, 1.3 s
    const e = 0.5 - 0.5 * Math.cos(Math.PI * t / 1.3);
    P.sx = 1 + 0.03 * e; P.sy = 1 - 0.04 * e; P.armL = 3 * e; P.armR = -3 * e;
  }
  if(st !== 'hurt' && !o.still){                           // blink about every 3.6 s
    const b = ((t + blinkOffset) % 3.6) / 3.6;
    if(b > 0.93) P.eye = kf(b, [0.93, 0.96, 1], [1, 0.12, 1]);
  }
  return P;
}

/* ---------- Sprite ---------- */
let spriteSeq = 0;
class Sprite {
  constructor(look, L, height, dpr, parts, fx){
    this.look = look; this.layers = L; this.height = height; this.dpr = dpr; this.unit = height / UNIT_H;
    this.parts = parts; this.fx = fx; this.blink = (++spriteSeq * 1.37) % 3.6;
    this.width = FRAME.w * this.unit;                     // full frame size in CSS px (hats + effects room)
    this.frameHeight = FRAME.h * this.unit;
  }
  /* hitbox in CSS px for a character drawn at (cx, feetY) with the same scale */
  hitbox(cx, feetY, scale){ const u = this.unit * (scale || 1);
    return { x:cx - (CX - HITBOX.x) * u, y:feetY - (FEET - HITBOX.y) * u, w:HITBOX.w * u, h:HITBOX.h * u }; }
  /* draw centred at cx with the soles on feetY (CSS px of ctx). See the README block at the top for options. */
  draw(g, cx, feetY, o){
    o = o || {};
    const t = o.t == null ? performance.now() / 1000 : o.t, still = reducedMotion() || o.still;
    const opt = { t:still ? 0 : t, state:still ? 'idle' : (o.state || 'idle'), facing:o.facing || 0, since:o.since, vy:o.vy, still };
    if(still && o.state === 'hurt'){ opt.state = 'hurt'; opt.since = 9; }
    const P = pose(opt, this.layers, this.blink), u = this.unit * (o.scale || 1), p = this.parts;
    g.save();
    if(o.alpha != null) g.globalAlpha *= o.alpha;
    g.translate(cx, feetY);
    if(o.shadow){ g.save(); g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); g.ellipse(0, 2 * u, 82 * u, 10 * u, 0, 0, 7); g.fill(); g.restore(); }
    g.rotate(P.lean * D2R); g.scale(u * P.sx, u * P.sy); g.translate(-CX + P.shake, -FEET);
    const fxOn = o.fx !== false && this.fx.length, T = still ? 1.234 : t, bob = P.bob;
    const part = (L, pv, ang, dy) => { if(!L) return; g.save(); g.translate(pv[0], pv[1] + dy); if(ang) g.rotate(ang * D2R); g.translate(-pv[0], -pv[1]); g.drawImage(L.c, L.x, L.y, L.w, L.h); g.restore(); };
    const fxLayer = back => {
      for(const q of this.fx){
        if(q.orbit){ const ph = 2 * Math.PI * ((T + q.delay) / q.dur) * q.dir; if((Math.sin(ph) < 0) !== back) continue; }
        else if(q.motion === 'halo'){ if((Math.sin(2 * Math.PI * (T + q.phase) / q.dur) < 0) !== back) continue; }
        else if(!!q.back !== back) continue;
        if(q.at === 'shoe'){ const left = (q.fixed ? q.x : 100) < CX, pv = left ? PIV.legL : PIV.legR, ang = left ? P.legL : P.legR;
          g.save(); g.translate(pv[0], pv[1]); g.rotate(ang * D2R); g.translate(-pv[0], -pv[1]); drawParticle(g, q, T); g.restore(); }
        else { g.save(); g.translate(0, bob); drawParticle(g, q, T); g.restore(); }
      }
    };
    if(fxOn) fxLayer(true);
    part(p.armL, PIV.armL, P.armL, bob); part(p.armR, PIV.armR, P.armR, bob);
    part(p.legL, PIV.legL, P.legL, 0); part(p.legR, PIV.legR, P.legR, 0);
    part(p.shoeL, PIV.legL, P.legL, 0); part(p.shoeR, PIV.legR, P.legR, 0);
    part(p.body, PIV.legL, 0, bob);
    this.eyes(g, bob, P.eye, opt.facing);
    part(p.shell, PIV.legL, 0, bob); part(p.hat, PIV.legL, 0, bob);
    if(fxOn) fxLayer(false);
    g.restore();
  }
  eyes(g, bob, open, facing){
    const look = facing < 0 ? -3 : 3;                       // the art looks slightly right; facing left glances left
    g.save(); g.translate(0, bob);
    for(const ex of [92, 148]){
      g.save(); g.translate(ex, 112); g.scale(1, open);
      g.beginPath(); g.ellipse(0, 0, 12, 21, 0, 0, 7); g.fillStyle = '#ffffff'; g.fill();
      g.lineWidth = 4; g.strokeStyle = INK; g.stroke();
      g.beginPath(); g.ellipse(look, 2, 4.5, 11, 0, 0, 7); g.fillStyle = '#141414'; g.fill();
      g.restore();
    }
    g.restore();
  }
}

const spriteCache = new Map();
/* Brick.sprite(look, {height, dpr, fx, maxParticles}) -> Promise<Sprite>
   height: CSS px from the top of the head to the soles (the hitbox height). Cached per look + size. */
function sprite(look, opts){
  opts = opts || {};
  const L = normalize(look), height = Math.max(8, opts.height || 96);
  const dpr = Math.min(3, Math.max(1, opts.dpr || window.devicePixelRatio || 1));
  const maxP = opts.maxParticles == null ? 20 : opts.maxParticles;
  const key = lookKey(L) + '@' + Math.round(height * 4) / 4 + 'x' + dpr + ':' + maxP + (opts.fx === false ? ':nofx' : '');
  if(spriteCache.has(key)){ const v = spriteCache.get(key); spriteCache.delete(key); spriteCache.set(key, v); return v; }
  const pr = (async () => {
    const V = visible(L), k = height / UNIT_H * dpr, skin = V.skin;
    const [[bLimbs, bBody], hat, shoe, sLimbs, sShell, fx] = await Promise.all([
      baseImgs(V.base), V.hat ? loadImg(ROOT + 'hat/' + V.hat + '.svg') : null, V.shoes ? loadImg(ROOT + 'shoe/' + V.shoes + '.svg') : null,
      skin ? loadImg(ROOT + 'skin/' + skin + '_limbs.svg') : null, skin ? loadImg(ROOT + 'skin/' + skin + '_shell.svg') : null,
      opts.fx === false || maxP <= 0 ? [] : buildFX(L, maxP)]);
    const limbs = skin ? sLimbs : bLimbs;
    const parts = { armL:raster(limbs, R.armL, k), armR:raster(limbs, R.armR, k), legL:raster(limbs, R.legL, k), legR:raster(limbs, R.legR, k),
      shoeL:raster(shoe, R.shoeL, k), shoeR:raster(shoe, R.shoeR, k), body:raster(bBody, R.body, k),
      shell:raster(sShell, R.shell, k), hat:raster(hat, R.hat, k) };
    return new Sprite(L, V, height, dpr, parts, fx);
  })();
  spriteCache.set(key, pr);
  while(spriteCache.size > 80) spriteCache.delete(spriteCache.keys().next().value);
  return pr;
}

/* ---------- DOM helpers ---------- */
/* ---------- companions ----------
   drawCompanion(g, id, cx, feetY, u, o): u = CSS px per Brick grid unit (Brick is 143 units head to soles), so a
   companion drawn with the same u stands beside Brick at the right size. o: { t (s), facing (-1 looks left, 1 right),
   state ('idle' | 'walk'), seed }. A companion is ~94 units tall (two thirds of Brick). */
const COMP_X = 168, COMP_W = 96, COMP_H = 94, COMP_VIEW = { x0:-58, y0:-124, x1:58, y1:10 };   // the grid area round one companion (feet at 0)
function drawCompanion(g, id, cx, feet, u, o){
  o = o || {}; if(id !== 'CP01') return;
  const t = o.still ? 1.2 : (o.t || 0) + (o.seed || 0), k = u * COMP_H / 150, f = o.facing || -1, walk = o.state === 'walk';
  g.save(); g.translate(cx, feet); g.scale(k, k); g.lineJoin = 'round'; g.lineCap = 'round';
  const L = (w, c) => { g.lineWidth = w; g.strokeStyle = c || INK; };
  const rr = (x, y, w, h, r) => { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); };
  // ground shadow
  g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.ellipse(0, 0, 30, 6, 0, 0, 7); g.fill();
  // legs and round feet; an impatient tap of one foot every few seconds (walking: they step)
  const tapping = !walk && (t % 3.2) < 1.3, tap = tapping ? Math.max(0, Math.sin(t * 15)) * 0.45 : 0, step = walk ? Math.sin(t * 11) : 0;
  for(const d of [-1, 1]){
    const lx = d * 11, lift = walk ? Math.max(0, d * step) * 6 : 0;
    g.save(); g.translate(lx, -6 - lift);
    if(d === -f && tap) { g.translate(0, 0); g.rotate(-d * tap); }
    L(7); g.beginPath(); g.moveTo(0, -28); g.lineTo(0, -2); g.stroke(); L(3.4, '#5B6773'); g.stroke();
    g.beginPath(); g.ellipse(d * 3, 0, 11, 7, 0, 0, 7); g.fillStyle = '#8A94A0'; g.fill(); L(3); g.stroke();
    g.beginPath(); g.ellipse(d * 1, -3, 5, 2, 0, 0, 7); g.fillStyle = 'rgba(255,255,255,.5)'; g.fill();
    g.restore();
  }
  const bob = walk ? -Math.abs(Math.sin(t * 11)) * 3 : Math.sin(t * 2.2) * 0.6, top = -150 + bob, x = -22, w = 44, bh = 118;
  g.save(); g.translate(0, bob);
  // the steel body: shadow tone, main tone lifted, outline (as Brick's body)
  rr(x, -150, w, bh, 7); g.fillStyle = '#A7AEB8'; g.fill();
  g.save(); rr(x, -150, w, bh, 7); g.clip(); rr(x, -158, w, bh, 7); g.fillStyle = '#D3D8DE'; g.fill(); g.restore();
  // the scale: line markings only (mm on the left, every 5 mm on the right; long lines every 10)
  L(1.4); g.beginPath();
  for(let n = 0, y = -86; y <= -40; n++, y += 3.2){ const len = n % 10 === 0 ? 9 : n % 5 === 0 ? 6 : 3.5; g.moveTo(x + 1, y); g.lineTo(x + 1 + len, y); }
  for(let n = 0, y = -86; y <= -40; n++, y += 6.4){ const len = n % 2 === 0 ? 9 : 5; g.moveTo(x + w - 1, y); g.lineTo(x + w - 1 - len, y); }
  g.stroke();
  rr(x, -150, w, bh, 7); L(4); g.stroke();
  rr(x - 1, -154, w + 2, 9, 4); g.fillStyle = '#6B7480'; g.fill(); L(3.4); g.stroke();
  L(2.6, 'rgba(255,255,255,.75)'); g.beginPath(); g.moveTo(x + w - 12, -66); g.lineTo(x + w - 17, -50); g.moveTo(x + w - 7, -68); g.lineTo(x + w - 12, -52); g.stroke();
  // the face: frowning brows, heavy annoyed lids, a sideways glare, gritted jagged teeth turned down at the corners
  const cyc = 3.6, b = ((t + 0.7) % cyc) / cyc, blink = b > 0.94 ? Math.sin((b - 0.94) / 0.06 * Math.PI) : 0;
  const glare = f * 2.6;
  for(const d of [-1, 1]){
    const ex = d * 10.5, ey = -118;
    g.save(); g.beginPath(); g.ellipse(ex, ey, 8.6, 10.5, 0, 0, 7); g.fillStyle = '#fff'; g.fill(); g.clip();
    g.beginPath(); g.ellipse(ex + glare, ey + 2.5, 4.4, 5.2, 0, 0, 7); g.fillStyle = '#141414'; g.fill();
    g.beginPath(); g.arc(ex + glare - 1.4, ey + 0.6, 1.4, 0, 7); g.fillStyle = '#fff'; g.fill();
    // the lid: down low and slanted towards the middle (cross), all the way down in a blink
    const drop = blink * 15, inner = ey - 1 + drop, outer = ey - 7 + drop;
    g.beginPath(); g.moveTo(ex - 12, ey - 14); g.lineTo(ex + 12, ey - 14);
    g.lineTo(ex + 12, d < 0 ? inner : outer); g.lineTo(ex - 12, d < 0 ? outer : inner); g.closePath();
    g.fillStyle = '#B9C0C8'; g.fill(); L(2.6); g.beginPath(); g.moveTo(ex - 12, d < 0 ? outer : inner); g.lineTo(ex + 12, d < 0 ? inner : outer); g.stroke();
    g.restore();
    g.beginPath(); g.ellipse(ex, ey, 8.6, 10.5, 0, 0, 7); L(3); g.stroke();
    // brow: a thick bar dipping hard towards the nose
    g.save(); g.translate(ex, ey - 15); g.rotate(d * -0.42); rr(-8, -2.6, 16, 5.2, 2.6); g.fillStyle = INK; g.fill(); g.restore();
  }
  L(1.8); g.beginPath(); g.moveTo(-1.5, -137); g.lineTo(-0.5, -132); g.moveTo(1.5, -137); g.lineTo(0.5, -132); g.stroke();   // the crease between the brows
  // gritted teeth: a wide grimace, corners pulled down, upper and lower jagged teeth clenched together
  const my = -98, mw = 12.5;
  g.beginPath(); g.moveTo(-mw, my + 2); g.quadraticCurveTo(0, my - 5, mw, my + 2); g.lineTo(mw - 1, my + 7); g.quadraticCurveTo(0, my + 3, -mw + 1, my + 7); g.closePath();
  g.fillStyle = '#7A1F2B'; g.fill(); g.save(); g.clip();
  g.fillStyle = '#fff'; g.beginPath(); g.moveTo(-mw, my - 6);
  for(let i = 0; i <= 8; i++) g.lineTo(-mw + i * mw / 4, my + (i % 2 ? 3.2 : 1.2)); g.lineTo(mw, my - 6); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(-mw, my + 10);
  for(let i = 0; i <= 8; i++) g.lineTo(-mw + i * mw / 4 + mw / 8, my + (i % 2 ? 3.4 : 5.4)); g.lineTo(mw, my + 10); g.closePath(); g.fill();
  g.restore();
  g.beginPath(); g.moveTo(-mw, my + 2); g.quadraticCurveTo(0, my - 5, mw, my + 2); g.lineTo(mw - 1, my + 7); g.quadraticCurveTo(0, my + 3, -mw + 1, my + 7); g.closePath(); L(2.6); g.stroke();
  L(2.4); g.beginPath(); g.moveTo(-mw - 1, my + 1); g.lineTo(-mw - 2.5, my + 5); g.moveTo(mw + 1, my + 1); g.lineTo(mw + 2.5, my + 5); g.stroke();
  // arms: folded across the body (walking: swinging at the sides)
  if(walk){
    for(const d of [-1, 1]){ const a = Math.sin(t * 11) * d * 0.5; g.save(); g.translate(d * 22, -82); g.rotate(a);
      L(5.5); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(d * 10, 8, d * 12, 22); g.stroke(); g.restore(); }
  } else {
    // folded: each arm comes round the front and its hand tucks in by the other side (the near one over the far one)
    L(5.5); g.beginPath(); g.moveTo(-22, -80); g.quadraticCurveTo(-8, -68, 14, -73); g.stroke();
    g.beginPath(); g.arc(15, -73, 3.6, 0, 7); g.fillStyle = INK; g.fill();
    L(9, '#D3D8DE'); g.beginPath(); g.moveTo(21, -81); g.quadraticCurveTo(8, -72, -13, -75); g.stroke();
    L(5.5); g.beginPath(); g.moveTo(22, -81); g.quadraticCurveTo(8, -71, -13, -75); g.stroke();
    g.beginPath(); g.arc(-14, -75, 3.6, 0, 7); g.fillStyle = INK; g.fill();
  }
  // an anger mark that throbs by the top corner, and a puff of steam now and then
  const throb = 1 + Math.max(0, Math.sin(t * 6)) * 0.18;
  g.save(); g.translate(f > 0 ? -27 : 27, -146); g.scale(throb, throb); L(3, '#E2483D');
  g.beginPath(); for(const [a, c] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]){ g.moveTo(a * 2, c * 7); g.quadraticCurveTo(a * 2, c * 2, a * 7, c * 2); } g.stroke(); g.restore();
  const sp = (t % 4.5) / 4.5;
  if(sp < 0.45){ const q = sp / 0.45; g.fillStyle = `rgba(255,255,255,${(1 - q) * 0.85})`;
    for(const d of [-1, 1]){ g.beginPath(); g.arc(d * (8 + q * 6), -158 - q * 22, 4 + q * 5, 0, 7); g.fill(); } }
  g.restore(); g.restore();
}

const mounts = new Set();
let raf = 0;
function loop(){
  raf = 0;
  const now = performance.now() / 1000;
  let any = false;
  mounts.forEach(m => { if(m.animated() && m.onscreen){ m.paint(now); any = true; } });
  if(any) raf = requestAnimationFrame(loop);
}
const kick = () => { if(!raf) raf = requestAnimationFrame(loop); };
const io = window.IntersectionObserver ? new IntersectionObserver(es => es.forEach(e => { const m = e.target.__brick; if(m){ m.onscreen = e.isIntersecting; if(m.onscreen) kick(); } })) : null;
document.addEventListener('visibilitychange', () => { if(!document.hidden) kick(); });
if(mq && mq.addEventListener) mq.addEventListener('change', () => mounts.forEach(m => { m.paint(performance.now() / 1000); kick(); }));

/* Brick.mount(el, look, {animate:true, fx:true, state:'idle', facing:0, view, shadow}) -> controller
   Fills el with a canvas (el needs a size). view = grid area to fit: {x0,y0,x1,y1}, default -20,-40 .. 260,260. */
function mount(el, look, opts){
  opts = Object.assign({ animate:true, fx:true, state:'idle', facing:0, view:VIEW }, opts || {});
  const cv = document.createElement('canvas');
  cv.className = 'brick-canvas'; cv.setAttribute('role', 'img');
  cv.style.cssText = 'display:block;width:100%;height:100%;';
  el.appendChild(cv);
  const g = cv.getContext('2d');
  let L = normalize(look), sp = null, W = 0, Hh = 0, dpr = 1, unitPx = 1, gen = 0, alive = true;
  // the area shown: a companion standing beside Brick widens it to the right; a companion on its own has its own view
  const viewNow = () => opts.only === 'companion' ? (opts.view && opts.view !== VIEW ? opts.view : COMP_VIEW)
    : (opts.companion && L.companion ? { x0:opts.view.x0, y0:opts.view.y0, x1:opts.view.x1 + COMP_W, y1:opts.view.y1 } : opts.view);
  const label = () => { const v = visible(L), n = id => (ITEMS[id] || BASES[id] || {}).name;
    cv.setAttribute('aria-label', 'Brick in ' + n(v.base) + [v.skin, v.hat, v.shoes !== 'S00' && v.shoes, v.fx].filter(Boolean).map(n).map(s => ', ' + s).join('')); };
  const ctl = {
    canvas:cv, onscreen:true, get look(){ return Object.assign({}, L); }, get sprite(){ return sp; }, opts,
    animated:() => alive && opts.animate && !reducedMotion() && !document.hidden,
    set(newLook, o){ if(o) Object.assign(opts, o); L = normalize(newLook); label(); return build(); },
    setState(state, facing){ opts.state = state; if(facing != null) opts.facing = facing; kick(); },
    paint(now){
      if(!W) return;
      const v = viewNow(), co = { t:now, still:!opts.animate || reducedMotion(), facing:-1 };
      if(opts.only === 'companion'){   // just the companion, centred (shop cards, locker tiles, capsule prize)
        g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, Hh);
        if(L.companion) drawCompanion(g, L.companion, (0 - (v.x0 + v.x1) / 2) * unitPx + W / 2, (0 - (v.y0 + v.y1) / 2) * unitPx + Hh / 2, unitPx, co);
        return;
      }
      if(!sp) return;
      const cx = (CX - (v.x0 + v.x1) / 2) * unitPx + W / 2, fy = (FEET - (v.y0 + v.y1) / 2) * unitPx + Hh / 2;
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, Hh);
      const withComp = opts.companion && L.companion;
      sp.draw(g, cx, fy, { t:now, state:opts.state, facing:opts.facing, fx:opts.fx, shadow:opts.shadow, still:!opts.animate });
      if(withComp) drawCompanion(g, L.companion, cx + COMP_X * unitPx, fy, unitPx, co);
    },
    destroy(){ alive = false; mounts.delete(ctl); if(io) io.unobserve(el); if(ro) ro.disconnect(); cv.remove(); delete el.__brick; },
  };
  async function build(){
    const my = ++gen;
    const r = el.getBoundingClientRect(); W = Math.round(r.width); Hh = Math.round(r.height);
    if(!W || !Hh) return ctl;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(Hh * dpr);
    const v = viewNow(); unitPx = Math.min(W / (v.x1 - v.x0), Hh / (v.y1 - v.y0));
    if(opts.only === 'companion'){ ctl.paint(performance.now() / 1000); kick(); return ctl; }
    const s = await sprite(L, { height:unitPx * UNIT_H, dpr, fx:opts.fx, maxParticles:opts.maxParticles });
    if(my !== gen || !alive) return ctl;
    sp = s; ctl.paint(performance.now() / 1000); kick();
    return ctl;
  }
  let rt = 0, lastW = 0, lastH = 0;
  const ro = window.ResizeObserver ? new ResizeObserver(() => { const r = el.getBoundingClientRect();
    if(Math.abs(r.width - lastW) < 1 && Math.abs(r.height - lastH) < 1) return; lastW = r.width; lastH = r.height;
    clearTimeout(rt); rt = setTimeout(build, sp ? 120 : 0); }) : null;
  if(ro) ro.observe(el);
  el.__brick = ctl; mounts.add(ctl); if(io) io.observe(el);
  label(); ctl.ready = build();
  return ctl;
}

/* Brick.render(look, {height, state, t, fx, view}) -> Promise<canvas>: one still picture (CSS px = height of the view). */
async function render(look, opts){
  opts = Object.assign({ height:200, view:VIEW, state:'idle', t:0 }, opts || {});
  const v = opts.view, dpr = Math.min(2, window.devicePixelRatio || 1), unitPx = opts.height / (v.y1 - v.y0);
  const sp = await sprite(look, { height:unitPx * UNIT_H, dpr, fx:opts.fx });
  const c = canvas((v.x1 - v.x0) * unitPx * dpr, (v.y1 - v.y0) * unitPx * dpr), g = c.getContext('2d');
  g.scale(dpr, dpr);
  sp.draw(g, (CX - v.x0) * unitPx, (FEET - v.y0) * unitPx, { t:opts.t, state:opts.state, fx:opts.fx, still:true });
  return c;
}

/* load everything a list of looks needs (e.g. all racers) before the game starts */
const preload = (looks, opts) => Promise.all((looks || []).map(l => sprite(l, opts)));

window.Brick = {
  CATALOGUE, DEFAULT_LOOK, HITBOX, drawCompanion, COMP_VIEW, COMP_H, FRAME, UNIT_H, FEET_Y:FEET, HEAD_Y:HEAD, CENTRE_X:CX,
  normalize, lookOf, visible, lookKey, sprite, preload, mount, render, reducedMotion,
  setReducedMotion(v){ reduceOverride = v == null ? null : !!v; kick(); },
  setRoot(url){ ROOT = new URL(url, location.href).href.replace(/\/?$/, '/'); },
  get root(){ return ROOT; },
};
})();
