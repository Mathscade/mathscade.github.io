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
  { id:'CP01', slot:'companion', name:"Ammy's Ruler", rarity:'Collector', price:900, buy:true },
  { id:'CP02', slot:'companion', name:"Beed's Baseball Bat", rarity:'Rare', price:200, buy:true },
  { id:'CP03', slot:'companion', name:"Jon's Golden Calculator", rarity:'Legendary', price:450, buy:true },
  { id:'CP04', slot:'companion', name:"Rish's Chipped Tooth", rarity:'Collector', price:900, buy:true },
  { id:'CP05', slot:'companion', name:"Karla's Cats", rarity:'Collector', price:900, buy:true },
  { id:'CP06', slot:'companion', name:"Heyden's iPad", rarity:'Legendary', price:450, buy:true },
  { id:'CP07', slot:'companion', name:"Oli's Skateboard", rarity:'Collector', price:900, buy:true },
  { id:'CP08', slot:'companion', name:"Cathy's Golf Bag", rarity:'Legendary', price:450, buy:true },
  { id:'CP09', slot:'companion', name:"Hadleigh's Cricket Ball", rarity:'Rare', price:200, buy:true },
  { id:'CP10', slot:'companion', name:"Teearsha's Microphone", rarity:'Rare', price:200, buy:true },
  { id:'CP11', slot:'companion', name:"Toebee's Squash Racket", rarity:'Rare', price:200, buy:true },
  { id:'CP12', slot:'companion', name:"Marc's Handball", rarity:'Rare', price:200, buy:true },
  { id:'CP13', slot:'companion', name:"Alix's Laptop", rarity:'Collector', price:900, buy:true },
  { id:'CP14', slot:'companion', name:"Makenzy's Drama Mask", rarity:'Rare', price:200, buy:true },
  { id:'CP15', slot:'companion', name:"Tilly's Art Book", rarity:'Legendary', price:450, buy:true },
  { id:'CP16', slot:'companion', name:"Gab's Golden Coin", rarity:'Legendary', price:450, buy:true },
  { id:'CP17', slot:'companion', name:"Lilli's Netball", rarity:'Rare', price:200, buy:true },
  { id:'CP18', slot:'companion', name:"Chappy's Chicken Handbag", rarity:'Common', price:2000, buy:true },
  { id:'CP19', slot:'companion', name:"ElJay's Basketball", rarity:'Rare', price:200, buy:true },
  { id:'CP20', slot:'companion', name:"Eev's Baker's Hat", rarity:'Rare', price:200, buy:true },
  { id:'CP21', slot:'companion', name:"Tendeye's Gaming Keyboard", rarity:'Collector', price:900, buy:true },
  { id:'CP22', slot:'companion', name:"Hepzee's Hockey Stick", rarity:'Rare', price:200, buy:true },
  { id:'CP23', slot:'companion', name:"Nirika's Queen", rarity:'Rare', price:200, buy:true },
  { id:'CP24', slot:'companion', name:"Locklan's Guitar", rarity:'Legendary', price:450, buy:true },
  { id:'CP25', slot:'companion', name:"Divyeah's Dance Shoes", rarity:'Rare', price:200, buy:true },
  { id:'CP26', slot:'companion', name:"Gorje's Movie Reel", rarity:'Legendary', price:450, buy:true },
  { id:'CP27', slot:'companion', name:"Sara's Book", rarity:'Rare', price:200, buy:true },
  { id:'CP28', slot:'companion', name:"Noargh's Basketball Boots", rarity:'Legendary', price:450, buy:true },
  { id:'CP29', slot:'companion', name:"Henree's Golf Driver", rarity:'Rare', price:200, buy:true },
  { id:'CP30', slot:'companion', name:"Aron's MTB", rarity:'Legendary', price:450, buy:true },
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
/*COMPANION-DESIGNS*/ /* copied from tools/companion-designs.js (22 Oct 2026): every companion's drawing */
/* Mathcade companions (design proposals, 21 Oct 2026). Same drawing rules as Brick and Ammy's Ruler:
   thick #4a2c22 outlines, a shadow tone with the main tone lifted over it, one white highlight, big oval eyes with
   lids that blink, stick limbs with round hands and feet. Drawn in code so every companion can move.
   COMPANION.draw(g, id, cx, feetY, u, { t, facing, state:'idle'|'walk', still })   u = CSS px per Brick grid unit.
   Each companion is drawn in its own units: feet at y = 0, about 150 tall (balls are shorter), then scaled so it
   stands about two thirds of Brick's height. Ready to move into brick.js as drawCompanion(). */
(function(root){
  const INK = '#4a2c22', COMP_H = 94;
  let g, T = 0;                                    // the canvas and the time, set for each draw
  const L = (w, c) => { g.lineWidth = w; g.strokeStyle = c || INK; };
  const rr = (x, y, w, h, r) => { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); };
  const ell = (x, y, rx, ry, rot) => { g.beginPath(); g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, Math.PI * 2); };
  const fill = c => { g.fillStyle = c; g.fill(); };
  const ink = (w, c) => { L(w || 4, c); g.stroke(); };
  const P = d => { g.beginPath(); const p = new Path2D(d); return p; };
  // two-tone body: the shadow colour, the main colour lifted up inside it, then the outline (as Brick's body)
  function tone(path, main, shade, lift, w){
    g.fillStyle = shade; g.fill(path);
    g.save(); g.clip(path); g.translate(0, -(lift == null ? 8 : lift)); g.fillStyle = main; g.fill(path); g.restore();
    L(w || 4); g.stroke(path);
  }
  const shadow = (rx) => { g.fillStyle = 'rgba(0,0,0,.2)'; ell(0, 0, rx || 28, 6); g.fill(); };
  const wave = (sp, ph) => Math.sin(T * sp + (ph || 0));
  // a blink: 0 open .. 1 shut, about once every `every` seconds
  function blinkAt(every, off, len){ const b = ((T + (off || 0)) % every) / every, d = (len || 0.06); return b > 1 - d ? Math.sin((b - (1 - d)) / d * Math.PI) : 0; }

  /* an eye. lid: how far the top lid is down (0-1); slant: how much lower the lid's inner end is (+ cross, - sad);
     side: -1 left eye, 1 right eye; lower: bottom lid up (0-1, a smiling squint); look: pupil offset */
  function eye(x, y, o){
    o = o || {};
    const rx = o.rx || 8.6, ry = o.ry || 10.5, lid = Math.min(1, (o.lid || 0) + (o.blink || 0)), side = o.side || 1;
    g.save(); ell(x, y, rx, ry); fill(o.white || '#fff'); g.clip();
    if(o.veins){ L(1, '#E2483D'); g.beginPath(); for(const [a, b, c, d] of [[-1, .2, -.4, .1], [1, .3, .45, .05], [-.9, -.4, -.5, -.2], [.9, -.3, .4, -.25]]){ g.moveTo(x + a * rx, y + b * ry); g.lineTo(x + c * rx, y + d * ry); } g.stroke(); }
    const [lx, ly] = o.look || [0, 2.5], prx = o.prx || rx * 0.52, pry = o.pry || ry * 0.5;
    if(!o.noPupil){
      if(o.iris){ ell(x + lx, y + ly, prx * 1.35, pry * 1.35); fill(o.iris); }
      ell(x + lx, y + ly, prx, pry); fill(o.pupil || '#141414');
      if(o.star){ g.save(); g.translate(x + lx - prx * 0.3, y + ly - pry * 0.35); star(prx * 0.75, '#fff'); g.restore(); }
      else { ell(x + lx - prx * 0.32, y + ly - pry * 0.42, prx * 0.33, prx * 0.33); fill('#fff'); }
      if(o.shine2){ ell(x + lx + prx * 0.35, y + ly + pry * 0.4, prx * 0.16, prx * 0.16); fill('#fff'); }
    }
    if(o.tears){ g.fillStyle = 'rgba(127,208,255,.55)'; g.fillRect(x - rx, y + ry * 0.35, rx * 2, ry); }
    const lidC = o.lidCol || o.skin || '#D3D8DE';
    if(lid > 0){
      const yl = y - ry + 2 * ry * lid, inner = yl + (o.slant || 0), outer = yl - (o.slant || 0);
      g.beginPath(); g.moveTo(x - rx - 2, y - ry - 2); g.lineTo(x + rx + 2, y - ry - 2);
      g.lineTo(x + rx + 2, side < 0 ? inner : outer); g.lineTo(x - rx - 2, side < 0 ? outer : inner); g.closePath(); fill(lidC);
      L(2.4); g.beginPath(); g.moveTo(x - rx - 2, side < 0 ? outer : inner); g.lineTo(x + rx + 2, side < 0 ? inner : outer); g.stroke();
    }
    if(o.lower){ const yb = y + ry - 2 * ry * o.lower; g.beginPath(); g.moveTo(x - rx - 2, y + ry + 2); g.lineTo(x + rx + 2, y + ry + 2); g.lineTo(x + rx + 2, yb + 1.5); g.quadraticCurveTo(x, yb - 3, x - rx - 2, yb + 1.5); g.closePath(); fill(lidC); L(2.2); g.beginPath(); g.moveTo(x - rx, yb + 1); g.quadraticCurveTo(x, yb - 3, x + rx, yb + 1); g.stroke(); }
    g.restore();
    ell(x, y, rx, ry); ink(o.w || 3);
    if(o.bags){ L(2, o.bags); g.beginPath(); g.moveTo(x - rx * 0.8, y + ry + 2.5); g.quadraticCurveTo(x, y + ry + 6, x + rx * 0.8, y + ry + 2.5); g.stroke(); }
  }
  function brow(x, y, ang, len, th){ g.save(); g.translate(x, y); g.rotate(ang || 0); rr(-(len || 16) / 2, -(th || 5) / 2, len || 16, th || 5, (th || 5) / 2); fill(INK); g.restore(); }
  function star(r, c){ g.beginPath(); for(let i = 0; i < 10; i++){ const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * 0.45 : r; g.lineTo(Math.cos(a) * q, Math.sin(a) * q); } g.closePath(); fill(c); }
  function twinkle(x, y, r, c){ g.save(); g.translate(x, y); g.beginPath(); for(const [a, b] of [[0, -1], [.25, -.25], [1, 0], [.25, .25], [0, 1], [-.25, .25], [-1, 0], [-.25, -.25]]) g.lineTo(a * r, b * r); g.closePath(); fill(c || '#FFF3B0'); L(1.4); g.stroke(); g.restore(); }
  function cheeks(x, y, gap, a){ g.fillStyle = `rgba(255,120,150,${a || .45})`; for(const d of [-1, 1]){ ell(x + d * gap, y, 5, 3); g.fill(); } }
  // mouths
  function smile(x, y, w, d, open, tongue){
    if(!open){ L(3.2); g.beginPath(); g.moveTo(x - w, y); g.quadraticCurveTo(x, y + d, x + w, y); g.stroke(); return; }
    const m = new Path2D(`M${x - w} ${y} Q${x} ${y - d * 0.15} ${x + w} ${y} Q${x + w * 0.9} ${y + d * 1.3} ${x} ${y + d * 1.3} Q${x - w * 0.9} ${y + d * 1.3} ${x - w} ${y} Z`);
    g.fillStyle = '#7A1F2B'; g.fill(m);
    if(tongue){ g.save(); g.clip(m); ell(x, y + d * 1.25, w * 0.55, d * 0.55); fill('#FF7A93'); g.restore(); }
    L(3); g.stroke(m);
  }
  function wobble(x, y, w, down, wig){ L(3); g.beginPath(); g.moveTo(x - w, y + down); for(let i = 1; i <= 6; i++){ const xx = x - w + i * w / 3; g.lineTo(xx, y + (i % 2 ? -wig : wig) - Math.sin(i / 6 * Math.PI) * down + down); } g.stroke(); }
  function oMouth(x, y, rx, ry){ ell(x, y, rx, ry); fill('#7A1F2B'); ink(3); }
  // stick limbs with round hands and feet (the ruler's)
  function legs(xs, top, foot, o){
    o = o || {}; const walk = o.walk, tap = o.tap || 0;
    xs.forEach((lx, i) => {
      const d = i ? 1 : -1, lift = walk ? Math.max(0, d * wave(11)) * 6 : 0;
      g.save(); g.translate(lx, -lift);
      if(tap && i === 1) g.rotate(-tap);
      L(7); g.beginPath(); g.moveTo(0, top); g.lineTo(0, -8); g.stroke(); L(3.4, o.col || '#5B6773'); g.stroke();
      if(o.shoe === 'sneaker'){ rr(d * 3 - 11, -10, 22, 10, 5); fill('#fff'); ink(3); L(2, '#E2483D'); g.beginPath(); g.moveTo(d * 3 - 6, -6); g.lineTo(d * 3 + 6, -6); g.stroke(); }
      else if(o.shoe === 'sandal'){ ell(d * 3, -3, 11, 4.5); fill('#C08A55'); ink(2.6); L(2.4, INK); g.beginPath(); g.moveTo(-4, -8); g.lineTo(4, -4); g.stroke(); }
      else { ell(d * 3, -6, 11, 7); fill(foot || '#8A94A0'); ink(3); ell(d * 1, -9, 5, 2); fill('rgba(255,255,255,.5)'); }
      g.restore();
    });
  }
  function arm(x0, y0, cx, cy, x1, y1, hand){ L(5.5); g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(cx, cy, x1, y1); g.stroke(); if(hand !== false){ ell(x1, y1, 4.2, 4.2); fill(hand || INK); if(hand && hand !== INK) ink(2); } }
  function swingArms(x, y, len){ for(const d of [-1, 1]){ const a = wave(11) * d * 0.5; g.save(); g.translate(d * x, y); g.rotate(a); arm(0, 0, d * 9, 8, d * 11, len || 22); g.restore(); } }
  function text(s, x, y, size, col, font, align){ g.font = `${font || '900'} ${size}px ${font && font.includes('mono') ? '' : ''}Menlo,Consolas,monospace`; g.textAlign = align || 'center'; g.fillStyle = col; g.fillText(s, x, y); }

  const C = {};
  /* ---------- CP01 Ammy's Ruler (Collector): frustrated (built) ---------- */
  C.CP01 = { name:"Ammy's Ruler", rarity:'Collector', mood:'Frustrated and annoyed', draw(f, walk){
    const tapping = !walk && (T % 3.2) < 1.3, tap = tapping ? Math.max(0, Math.sin(T * 15)) * 0.45 : 0;
    shadow(30); legs([-11, 11], -34, '#8A94A0', { walk, tap });
    const bob = walk ? -Math.abs(wave(11)) * 3 : wave(2.2) * 0.6; g.save(); g.translate(0, bob);
    const body = new Path2D(); body.roundRect(-22, -150, 44, 118, 7); tone(body, '#D3D8DE', '#A7AEB8', 8);
    L(1.4); g.beginPath();
    for(let n = 0, y = -86; y <= -40; n++, y += 3.2){ const len = n % 10 === 0 ? 9 : n % 5 === 0 ? 6 : 3.5; g.moveTo(-21, y); g.lineTo(-21 + len, y); }
    for(let n = 0, y = -86; y <= -40; n++, y += 6.4){ const len = n % 2 === 0 ? 9 : 5; g.moveTo(21, y); g.lineTo(21 - len, y); } g.stroke();
    rr(-23, -154, 46, 9, 4); fill('#6B7480'); ink(3.4);
    L(2.6, 'rgba(255,255,255,.75)'); g.beginPath(); g.moveTo(10, -66); g.lineTo(5, -50); g.moveTo(15, -68); g.lineTo(10, -52); g.stroke();
    const bl = blinkAt(3.6, .7);
    for(const d of [-1, 1]){ eye(d * 10.5, -118, { side:d, lid:.42, slant:4, blink:bl, look:[f * 2.6, 2.5], prx:4.4, pry:5.2, lidCol:'#B9C0C8' }); brow(d * 10.5, -133, d * -0.42, 16, 5.2); }
    L(1.8); g.beginPath(); g.moveTo(-1.5, -137); g.lineTo(-.5, -132); g.moveTo(1.5, -137); g.lineTo(.5, -132); g.stroke();
    const my = -98, mw = 12.5, mp = new Path2D(`M${-mw} ${my + 2} Q0 ${my - 5} ${mw} ${my + 2} L${mw - 1} ${my + 7} Q0 ${my + 3} ${-mw + 1} ${my + 7} Z`);
    g.fillStyle = '#7A1F2B'; g.fill(mp); g.save(); g.clip(mp); g.fillStyle = '#fff';
    g.beginPath(); g.moveTo(-mw, my - 6); for(let i = 0; i <= 8; i++) g.lineTo(-mw + i * mw / 4, my + (i % 2 ? 3.2 : 1.2)); g.lineTo(mw, my - 6); g.fill();
    g.beginPath(); g.moveTo(-mw, my + 10); for(let i = 0; i <= 8; i++) g.lineTo(-mw + i * mw / 4 + mw / 8, my + (i % 2 ? 3.4 : 5.4)); g.lineTo(mw, my + 10); g.fill(); g.restore(); L(2.6); g.stroke(mp);
    L(2.4); g.beginPath(); g.moveTo(-mw - 1, my + 1); g.lineTo(-mw - 2.5, my + 5); g.moveTo(mw + 1, my + 1); g.lineTo(mw + 2.5, my + 5); g.stroke();
    if(walk) swingArms(22, -82);
    else { arm(-22, -80, -8, -68, 14, -73); L(9, '#D3D8DE'); g.beginPath(); g.moveTo(21, -81); g.quadraticCurveTo(8, -72, -13, -75); g.stroke(); arm(22, -81, 8, -71, -13, -75); }
    const th = 1 + Math.max(0, wave(6)) * 0.18; g.save(); g.translate(f > 0 ? -27 : 27, -146); g.scale(th, th); L(3, '#E2483D');
    g.beginPath(); for(const [a, c] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]){ g.moveTo(a * 2, c * 7); g.quadraticCurveTo(a * 2, c * 2, a * 7, c * 2); } g.stroke(); g.restore();
    const sp = (T % 4.5) / 4.5; if(sp < .45){ const q = sp / .45; g.fillStyle = `rgba(255,255,255,${(1 - q) * .85})`; for(const d of [-1, 1]){ ell(d * (8 + q * 6), -158 - q * 22, 4 + q * 5, 4 + q * 5); g.fill(); } }
    g.restore(); } };

  /* ---------- CP02 Beed's Baseball Bat (Rare): tired and worn out ---------- */
  C.CP02 = { name:"Beed's Baseball Bat", rarity:'Rare', mood:'Tired and worn out', draw(f, walk){
    const sway = walk ? 0 : wave(1.1) * 0.035; shadow(24);
    legs([-7, 7], -30, '#8A5A2B', { walk, col:'#6B4A2E' });
    g.save(); g.rotate(sway); const bob = walk ? -Math.abs(wave(11)) * 2.5 : wave(1.1, 1) * 1.2; g.translate(0, bob);
    const body = new Path2D('M-17 -135 Q-17 -153 0 -153 Q17 -153 17 -135 C17 -100 8 -80 7 -50 L-7 -50 C-8 -80 -17 -100 -17 -135 Z');
    tone(body, '#E9BE84', '#C08A55', 7);
    g.save(); g.clip(body); L(1.3, 'rgba(120,70,30,.35)'); g.beginPath(); for(const x of [-9, -3, 5, 11]){ g.moveTo(x, -150); g.bezierCurveTo(x + 2, -120, x - 2, -95, x * 0.4, -55); } g.stroke(); g.restore();
    // grip tape and the knob
    rr(-7.5, -52, 15, 18, 3); fill('#2B3240'); ink(3); L(1.6, '#5B6773'); g.beginPath(); for(let y = -49; y < -36; y += 4){ g.moveTo(-7, y); g.lineTo(7, y + 3); } g.stroke();
    ell(0, -32, 11, 4.5); fill('#C08A55'); ink(3);
    // worn: a crack, scuffs and a plaster
    L(2); g.beginPath(); g.moveTo(-15, -143); g.lineTo(-11, -138); g.lineTo(-13, -133); g.lineTo(-9, -127); g.stroke();
    L(1.6, 'rgba(255,255,255,.55)'); g.beginPath(); g.moveTo(8, -100); g.lineTo(12, -96); g.moveTo(-10, -88); g.lineTo(-6, -91); g.moveTo(4, -82); g.lineTo(8, -79); g.stroke();
    g.save(); g.translate(-9, -92); g.rotate(-0.5); rr(-8, -3.5, 16, 7, 2.5); fill('#F7D9B0'); ink(2); ell(0, 0, 2.6, 2); fill('#E9B98A'); g.restore();
    // face: heavy droopy lids with bags, eyes looking down; a long slow blink; a yawn now and then
    const yawnP = (T % 7) / 7, yawn = yawnP > .7 && yawnP < .9 ? Math.sin((yawnP - .7) / .2 * Math.PI) : 0;
    const bl = blinkAt(4.2, 0, 0.14);
    for(const d of [-1, 1]) eye(d * 7.5, -125, { side:d, rx:6.4, ry:7.8, lid:.58 + yawn * .3, slant:-2.2, blink:bl, look:[f * 1.2, 3.5], lidCol:'#D7A36C', bags:'rgba(122,79,140,.6)', w:2.6 });
    for(const d of [-1, 1]){ L(2.4); g.beginPath(); g.moveTo(d * 4, -136); g.lineTo(d * 11, -133.5); g.stroke(); }   // flat, droopy brows
    if(yawn > .1) oMouth(0, -108, 3.5 + yawn * 2.5, 2.5 + yawn * 6); else wobble(0, -109, 5.5, 1.2, .8);
    // a bead of sweat; a sigh puff after the yawn
    const sw = (T % 3) / 3; g.fillStyle = 'rgba(127,208,255,.9)'; ell(15 + sw * 2, -136 + sw * 18, 2.2, 3.2); g.fill(); L(1.4); g.stroke();
    if(yawnP > .88 && yawnP < 1){ const q = (yawnP - .88) / .12; g.fillStyle = `rgba(255,255,255,${(1 - q) * .8})`; ell(f * (8 + q * 12), -108 - q * 6, 3 + q * 4, 2.4 + q * 3); g.fill(); }
    // limp arms hanging forward
    if(walk) swingArms(12, -85, 20); else { arm(-12, -88, -18, -74, -14, -60); arm(12, -88, 18, -74, 14, -60); }
    g.restore(); g.restore(); } };

  /* ---------- CP03 Jon's Golden Calculator (Legendary): unphased ---------- */
  C.CP03 = { name:"Jon's Golden Calculator", rarity:'Legendary', mood:'Unphased', draw(f, walk){
    shadow(30); legs([-10, 10], -40, '#C8951A', { walk, col:'#8A6416' });
    const bob = walk ? -Math.abs(wave(11)) * 2.5 : 0; g.save(); g.translate(0, bob);
    const body = new Path2D(); body.roundRect(-24, -150, 48, 112, 9); tone(body, '#F5C431', '#C8951A', 8);
    // the screen: it keeps working things out
    rr(-18, -143, 36, 20, 4); fill('#B8D8A0'); ink(3);
    const sums = ['3.14159', '42', '7×8=56', '1000000', '√144=12', '0.5'], s = sums[Math.floor(T / 1.1) % sums.length];
    g.font = "900 9px Menlo,Consolas,monospace"; g.textAlign = 'right'; g.fillStyle = '#2B3A1E'; g.fillText(s, 15, -129);
    // face: level half-lids, eyes straight ahead, one brow very slightly up, a flat line of a mouth
    const bl = blinkAt(4.6, 1.3);
    for(const d of [-1, 1]) eye(d * 9, -108, { side:d, rx:6.6, ry:7.8, lid:.46, blink:bl, look:[f * .6, 1.5], lidCol:'#E0AE2A', w:2.6 });
    brow(-9, -119, 0, 11, 3.6); brow(9, -120.5, -0.14, 11, 3.6);
    L(3); g.beginPath(); g.moveTo(-6, -95); g.lineTo(6, -95); g.stroke();
    // the keys: one gets pressed now and then
    const pk = Math.floor(T * 1.6) % 16;
    for(let r = 0; r < 4; r++) for(let c = 0; c < 4; c++){ const i = r * 4 + c, x = -19 + c * 10, y = -88 + r * 10; rr(x, y + (i === pk ? 1 : 0), 8, 7, 2); fill(i === pk ? '#FFF3B0' : c === 3 ? '#E2483D' : '#E0A82A'); ink(1.6); }
    // hands on hips: nothing bothers Jon
    if(walk) swingArms(24, -82); else for(const d of [-1, 1]){ L(5.5); g.beginPath(); g.moveTo(d * 24, -80); g.lineTo(d * 35, -66); g.lineTo(d * 24, -54); g.stroke(); ell(d * 24, -54, 4, 4); fill(INK); }
    const gl = (T % 2.8) / 2.8; if(gl < .25) twinkle(16, -146, 4 + Math.sin(gl / .25 * Math.PI) * 4, '#FFF8D6');
    L(4, 'rgba(255,255,255,.55)'); g.beginPath(); g.moveTo(-20, -60); g.lineTo(-20, -48); g.stroke();
    g.restore(); } };

  /* ---------- CP04 Rish's Chipped Tooth (Collector): sore and hurt ---------- */
  C.CP04 = { name:"Rish's Chipped Tooth", rarity:'Collector', mood:'Sore and hurt', draw(f, walk){
    shadow(24); const shiver = walk ? 0 : Math.sin(T * 40) * 0.35 * (Math.sin(T * 1.7) > .6 ? 1 : 0);
    g.save(); g.translate(shiver, walk ? -Math.abs(wave(11)) * 2.5 : 0);
    // roots are the legs
    const body = new Path2D('M-26 -100 Q-28 -128 -12 -128 Q-4 -128 0 -120 Q4 -128 12 -127 L17 -124 L13 -116 L21 -113 L26 -104 Q28 -80 22 -60 Q20 -40 16 -10 Q14 -2 9 -2 Q4 -2 4 -12 L2 -40 Q0 -46 -2 -40 L-4 -12 Q-4 -2 -9 -2 Q-14 -2 -16 -10 Q-20 -40 -22 -60 Q-28 -80 -26 -100 Z');
    const st = walk ? wave(11) * 2 : 0; g.save(); g.translate(0, 0); tone(body, '#FFFDF5', '#E3DCCB', 7); g.restore();
    L(2); g.beginPath(); g.moveTo(17, -116); g.lineTo(13, -106); g.lineTo(16, -98); g.lineTo(12, -90); g.stroke();
    // a plaster on the cheek
    g.save(); g.translate(-14, -84); g.rotate(-0.5); rr(-9, -4, 18, 8, 3); fill('#F7C9A8'); ink(2); rr(-3, -3, 6, 6, 1.5); fill('#EDB592'); g.restore();
    // face: worried brows, watery eyes, a tear, a wobbly frown
    const bl = blinkAt(3, 0.4);
    for(const d of [-1, 1]){ eye(d * 9.5, -104, { side:d, rx:7.6, ry:9.4, lid:.2, slant:-3.2, blink:bl, look:[0, 1.5], prx:4.6, pry:5.4, shine2:true, lidCol:'#EFE8D6', tears:true }); brow(d * 9.5, -118, d * 0.42, 12, 4); }
    const tp = (T % 2.4) / 2.4; g.fillStyle = 'rgba(127,208,255,.95)'; ell(-14, -94 + tp * 22, 2.4, 3.4); g.fill(); L(1.4); g.stroke();
    wobble(0, -84, 8, -3, 1.2);
    // the sore spot throbs
    const th = Math.max(0, Math.sin(T * 5)); L(2.6, `rgba(226,72,61,${.3 + th * .7})`); g.beginPath();
    for(const [a, b, c, d] of [[22, -130, 27, -136], [26, -122, 33, -124], [18, -134, 19, -141]]){ g.moveTo(a, b); g.lineTo(a + (c - a) * (1 + th * .4), b + (d - b) * (1 + th * .4)); } g.stroke();
    // one hand holding the chipped side, one hanging
    if(walk) swingArms(24, -76); else { arm(-25, -78, -32, -64, -27, -54); arm(25, -80, 34, -98, 24, -112, '#FFFDF5'); }
    g.restore(); } };

  /* ---------- CP06 Heyden's iPad (Rare): overused and sweaty ---------- */
  C.CP06 = { name:"Heyden's iPad", rarity:'Legendary', mood:'Overused and sweaty', draw(f, walk){
    shadow(30); const shake = walk ? 0 : Math.sin(T * 32) * 0.5;
    // the charging lead trailing behind
    L(4); g.beginPath(); g.moveTo(0, -38); g.bezierCurveTo(-f * 10, -18, -f * 30, -4, -f * 44, -2); g.stroke(); L(2, '#E9EEF2'); g.stroke(); rr(-f * 44 - 5, -6, 10, 6, 1.5); fill('#E9EEF2'); ink(2);
    legs([-12, 12], -40, '#5B6773', { walk });
    g.save(); g.translate(shake, walk ? -Math.abs(wave(11)) * 2.5 : 0);
    const body = new Path2D(); body.roundRect(-27, -152, 54, 114, 8); tone(body, '#4A5464', '#2B3240', 6);
    const scr = new Path2D(); scr.roundRect(-22, -145, 44, 98, 4); const gr = g.createLinearGradient(0, -145, 0, -47); gr.addColorStop(0, '#9FDCFF'); gr.addColorStop(1, '#4A8FD9'); g.fillStyle = gr; g.fill(scr); L(2.4); g.stroke(scr);
    L(1.6, 'rgba(255,255,255,.9)'); g.beginPath(); g.moveTo(22, -140); g.lineTo(13, -132); g.lineTo(16, -126); g.lineTo(8, -118); g.moveTo(13, -132); g.lineTo(20, -126); g.stroke();
    // battery: 3 %, flashing red
    const on = (T % 0.8) < 0.45; rr(-17, -141, 13, 6, 1.5); fill('#fff'); ink(1.4); if(on){ g.fillStyle = '#E2483D'; g.fillRect(-16, -140, 1.6, 4); }
    g.font = "900 6px Menlo,Consolas,monospace"; g.textAlign = 'left'; g.fillStyle = on ? '#E2483D' : '#2B3240'; g.fillText('3%', -2, -136);
    // face on the screen: bloodshot, strained, panting
    const bl = blinkAt(2.2, .3); const j = Math.sin(T * 23) * .6;
    for(const d of [-1, 1]){ eye(d * 10, -112, { side:d, rx:8, ry:9.6, lid:.3, slant:-2.6, blink:bl, look:[j, 1], prx:3, pry:3.6, veins:true, lidCol:'#7FBFEA', bags:'rgba(60,40,90,.6)' }); brow(d * 10, -126, d * 0.38, 11, 3.8); }
    const pant = (Math.sin(T * 9) + 1) / 2; smile(0, -92, 7, 3 + pant * 3, true, true);
    // sweat flying off
    for(let i = 0; i < 3; i++){ const p = ((T * 0.9 + i / 3) % 1), d = i % 2 ? 1 : -1; g.fillStyle = `rgba(127,208,255,${1 - p})`; ell(d * (28 + p * 14), -140 + i * 22 + p * 12, 2.6, 3.6); g.fill(); L(1.3, `rgba(74,44,34,${1 - p})`); g.stroke(); }
    // heat haze over the top
    L(1.8, 'rgba(255,255,255,.6)'); g.beginPath(); for(const x of [-10, 0, 10]){ const o = wave(6, x); g.moveTo(x, -156); g.quadraticCurveTo(x + 3 + o, -161, x, -166); g.quadraticCurveTo(x - 3 - o, -170, x, -175); } g.stroke();
    if(walk) swingArms(27, -86); else { arm(-27, -88, -34, -74, -31, -60); arm(27, -88, 34, -74, 31, -60); }
    g.restore(); } };

  /* ---------- CP07 Oli's Skateboard (Collector): cool, does kickflips ---------- */
  C.CP07 = { name:"Oli's Skateboard", rarity:'Collector', mood:'Cool, and does kickflips', draw(f, walk){
    const cyc = 5, p = (T % cyc) / cyc, trick = !walk && p > .66 && p < .9, q = trick ? (p - .66) / .24 : 0;
    const hop = trick ? Math.sin(q * Math.PI) * 46 : 0, spin = trick ? Math.cos(q * Math.PI * 2) : 1, roll = trick ? Math.sin(q * Math.PI * 2) * 0.25 : 0;
    g.save(); g.fillStyle = 'rgba(0,0,0,.2)'; ell(0, 0, 26 * (1 - hop / 90), 6 * (1 - hop / 90)); g.fill(); g.restore();
    if(!trick) legs([-8, 8], -32, null, { walk, shoe:'sneaker', col:'#2B3240' });
    if(trick && q > .92 || p > .9 && p < .93){ L(2, 'rgba(255,255,255,.7)'); g.beginPath(); for(const d of [-1, 1]){ g.moveTo(d * 16, -4); g.lineTo(d * 28, -10); g.moveTo(d * 18, -1); g.lineTo(d * 30, 0); } g.stroke(); }
    g.save(); g.translate(0, -hop + (walk ? -Math.abs(wave(11)) * 2.5 : 0));
    if(trick){ L(7); g.beginPath(); for(const d of [-1, 1]){ g.moveTo(d * 7, -30); g.lineTo(d * 12, -18); g.lineTo(d * 7, -10); } g.stroke(); L(3.4, '#2B3240'); g.stroke(); for(const d of [-1, 1]){ rr(d * 7 - 9, -14, 18, 9, 4); fill('#fff'); ink(2.6); } }
    g.translate(0, -90); g.rotate(roll + (walk ? 0 : wave(1.4) * 0.03)); g.scale(Math.abs(spin) < .08 ? .08 : spin, 1); g.translate(0, 90);
    const back = spin < 0;
    // wheels and trucks peep out at the sides
    for(const y of [-134, -50]){ rr(-20, y - 3, 40, 6, 2); fill('#B8C2CC'); ink(2.4); for(const d of [-1, 1]){ ell(d * 21, y, 5, 7); fill('#F5C431'); ink(2.6); } }
    const deck = new Path2D(); deck.roundRect(-17, -154, 34, 128, 17);
    if(back){ tone(deck, '#2F3338', '#1E2124', 4); g.save(); g.clip(deck); g.fillStyle = 'rgba(255,255,255,.12)'; for(let i = 0; i < 70; i++){ const x = ((i * 37) % 30) - 15, y = -150 + ((i * 53) % 120); g.fillRect(x, y, 1.4, 1.4); } g.restore(); }
    else {
      tone(deck, '#FF8A1F', '#D9690A', 7);
      g.save(); g.clip(deck); for(const [y, c] of [[-88, '#fff'], [-77, '#1E2433'], [-66, '#fff']]){ g.beginPath(); g.moveTo(-17, y + 8); g.lineTo(0, y - 2); g.lineTo(17, y + 8); g.lineTo(17, y + 14); g.lineTo(0, y + 4); g.lineTo(-17, y + 14); g.closePath(); fill(c); L(1.4); g.stroke(); }
      // street graffiti on the tail: a hot-pink sprayed patch with drips, OLI in fat bubble letters
      g.fillStyle = '#FF4FA3'; g.beginPath(); g.moveTo(-17, -58); g.quadraticCurveTo(-4, -63, 17, -57); g.lineTo(17, -26); g.lineTo(-17, -26); g.closePath(); g.fill();
      for(const [x, h] of [[-9, 7], [3, 11], [11, 5]]){ rr(x - 1.4, -59, 2.8, h + 2, 1.4); g.fill(); ell(x, -57 + h, 2.2, 2.4); g.fill(); }
      g.save(); g.translate(0, -40); g.rotate(-0.14); g.font = "400 15px 'Lilita One','Arial Black',sans-serif"; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
      g.lineWidth = 6.5; g.strokeStyle = '#1A1A1E'; g.strokeText('OLI', 0, 0); g.lineWidth = 2.2; g.strokeStyle = '#fff'; g.strokeText('OLI', 0, 0); g.fillStyle = '#fff'; g.fillText('OLI', 0, 0);
      L(1.6, '#FF4FA3'); g.beginPath(); g.moveTo(-10, -4); g.quadraticCurveTo(-9, -6, -7, -6); g.moveTo(-1, -4); g.lineTo(0.5, -5.5); g.moveTo(7, -4); g.lineTo(8, -5.5); g.stroke();
      g.restore(); g.restore();
      // sunglasses pushed up, half-lid side-eye, one brow up, a smirk
      const bl = blinkAt(4, 2);
      for(const d of [-1, 1]) eye(d * 7.5, -114, { side:d, rx:6.4, ry:7.6, lid:.42, blink:bl, look:[f * 2.2, 1.5], lidCol:'#FF8A1F', w:2.6 });
      brow(-7.5, -125, 0.1, 10, 3.4); brow(7.5, -127.5, -0.3, 10, 3.4);
      for(const d of [-1, 1]){ rr(d * 8 - 7, -142, 14, 9, 4); fill('#1E2433'); ink(2.4); g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(d * 8 - 4, -140, 4, 2); } L(2.4); g.beginPath(); g.moveTo(-1, -138); g.lineTo(1, -138); g.stroke();
      L(3); g.beginPath(); g.moveTo(-6, -99); g.quadraticCurveTo(0, -97, 7, -102); g.stroke();
      ink(4); g.stroke(deck);
    }
    g.restore();
    // arms: one hand in a "hang loose", one easy at the side (in the air: both out for balance)
    g.save(); g.translate(0, -hop);
    if(trick){ arm(-16, -96, -28, -104, -36, -112); arm(16, -96, 28, -104, 36, -112); }
    else if(walk) swingArms(17, -94);
    else { arm(-17, -94, -24, -80, -21, -68); const w = wave(4) * 0.2; g.save(); g.translate(17, -96); g.rotate(w); arm(0, 0, 10, -6, 14, -18); L(2.6); g.beginPath(); g.moveTo(14, -18); g.lineTo(11, -24); g.moveTo(14, -18); g.lineTo(19, -21); g.stroke(); g.restore(); }
    g.restore(); } };

  /* ---------- CP08 Cathy's Golf Bag (Legendary): happy and bubbly ---------- */
  C.CP08 = { name:"Cathy's Golf Bag", rarity:'Legendary', mood:'Happy and bubbly', draw(f, walk){
    const hp = (T % 1.6) / 1.6, hop = walk ? Math.abs(wave(11)) * 3 : Math.max(0, Math.sin(hp * Math.PI * 2)) * 7, sq = 1 + (hop < 1 && !walk ? .04 : 0);
    shadow(26); legs([-12, 12], -30, '#D94A92', { walk, col:'#8A2A5E' });
    g.save(); g.translate(0, -hop); g.scale(1 / sq, sq);
    // clubs poking out of the top: a driver, an iron and a putter, jiggling as she bounces
    const jig = Math.sin(hp * Math.PI * 4) * 0.08;
    const shaft = (len) => { L(4.2); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -len); g.stroke(); L(2, '#E9EEF2'); g.stroke(); };
    // driver: a big round wooden head with a face insert
    g.save(); g.translate(-11, -128); g.rotate(-0.22 + jig); shaft(26);
    const dh = new Path2D('M-2 -24 Q-14 -24 -15 -32 Q-15 -42 -3 -42 Q6 -42 6 -33 Q6 -26 -2 -24 Z'); tone(dh, '#2B3240', '#1E2433', 3, 2.8);
    g.fillStyle = 'rgba(255,255,255,.35)'; ell(-8, -37, 4, 1.8, -.3); g.fill(); L(1.6, '#F5C431'); g.beginPath(); g.moveTo(5, -40); g.lineTo(5, -27); g.stroke(); g.restore();
    // iron: a flat silver blade with grooves
    g.save(); g.translate(1, -128); g.rotate(0.05 - jig); shaft(32);
    const ih = new Path2D('M-1 -30 L12 -33 Q15 -34 15 -38 L14 -41 Q13 -43 10 -42 L-1 -38 Z'); tone(ih, '#D3D8DE', '#A7AEB8', 2, 2.6);
    L(1, 'rgba(74,44,34,.55)'); g.beginPath(); for(const k of [0, 2.2, 4.4]){ g.moveTo(1, -36 + k * .3 - 1); g.lineTo(12, -39 + k * .3 + 1); } g.stroke(); g.restore();
    // putter: a mallet head
    g.save(); g.translate(12, -128); g.rotate(0.28 + jig); shaft(22);
    rr(-9, -30, 18, 9, 4); g.fillStyle = '#8FA3B6'; g.fill(); ink(2.6); g.fillStyle = '#F5C431'; g.fillRect(-1, -28, 2, 5); g.restore();
    const body = new Path2D(); body.roundRect(-22, -130, 44, 100, 10); tone(body, '#FF6FB5', '#D94A92', 8);
    rr(-23, -133, 46, 10, 4); fill('#fff'); ink(3);
    rr(-15, -60, 30, 22, 6); fill('#E75AA3'); ink(2.6); L(2, '#fff'); g.beginPath(); g.moveTo(-10, -53); g.lineTo(10, -53); g.stroke();
    L(5); g.beginPath(); g.moveTo(-f * 22, -118); g.quadraticCurveTo(-f * 36, -86, -f * 22, -52); g.stroke(); L(2.6, '#fff'); g.stroke();
    // face: big sparkly eyes, a wide open smile, rosy cheeks
    const bl = blinkAt(3.2, .8);
    for(const d of [-1, 1]){ eye(d * 9.5, -104, { side:d, rx:8, ry:10, blink:bl, look:[f, -1.5], prx:5.6, pry:6.6, star:true, shine2:true, lidCol:'#FF6FB5' }); L(3); g.beginPath(); g.arc(d * 9.5, -114, 7, -Math.PI * .85, -Math.PI * .15); g.stroke(); }
    smile(0, -88, 10, 6, true, true); cheeks(0, -88, 15, .55);
    if(walk) swingArms(22, -96); else { const wv = wave(8) * 0.35; for(const d of [-1, 1]){ g.save(); g.translate(d * 22, -98); g.rotate(d * (-0.8 + (d > 0 ? wv : -wv))); arm(0, 0, d * 8, -6, d * 10, -20); g.restore(); } }
    g.restore();
    // bubbles drifting up and popping
    for(let i = 0; i < 5; i++){ const p = (T * 0.35 + i / 5) % 1, x = Math.sin(i * 2.1 + T) * 6 + (i % 2 ? 26 : -28), y = -60 - p * 110, r = 3 + (i % 3) * 1.5;
      g.save(); g.globalAlpha = p < .9 ? .9 : (1 - p) * 9; ell(x, y, r, r); fill('rgba(190,240,255,.35)'); L(1.6, 'rgba(255,255,255,.95)'); g.stroke(); ell(x - r * .35, y - r * .35, r * .25, r * .25); fill('#fff'); g.restore(); }
  } };

  /* a round body (balls, coins) with stick legs and arms */
  function ballBody(r, cy, main, shade, inner){
    const b = new Path2D(); b.ellipse(0, cy, r, r, 0, 0, Math.PI * 2); g.fillStyle = shade; g.fill(b);
    g.save(); g.clip(b); g.translate(0, -r * 0.18); g.fillStyle = main; g.fill(b); if(inner) inner(); g.restore();
    L(4); g.stroke(b); return b;
  }
  /* ---------- CP09 Hadleigh's Cricket Ball (Rare): happy ---------- */
  C.CP09 = { name:"Hadleigh's Cricket Ball", rarity:'Rare', mood:'Happy', draw(f, walk){
    const bp = (T % 1.3) / 1.3, b = walk ? Math.abs(wave(11)) * 3 : Math.abs(Math.sin(bp * Math.PI)) * 10, squash = !walk && b < 1.5 ? 0.94 : 1;
    shadow(24 - b * .6); legs([-11, 11], -26, '#A42720', { walk, col:'#7A1C17' });
    g.save(); g.translate(0, -b); g.translate(0, -64); g.scale(1 / squash, squash); g.translate(0, 64);
    const sx = Math.sin(T * 1.8) * 4;
    ballBody(38, -64, '#D63A2F', '#A42720', () => {
      L(3, '#F3E2C0'); g.beginPath(); g.moveTo(sx - 4, -102); g.bezierCurveTo(sx - 12, -80, sx - 12, -48, sx - 4, -26); g.moveTo(sx + 4, -102); g.bezierCurveTo(sx - 4, -80, sx - 4, -48, sx + 4, -26); g.stroke();
      L(1.6, '#FFF3D6'); g.beginPath(); for(let y = -98; y < -30; y += 5){ const k = (y + 64) / 38, off = -Math.cos(Math.asin(Math.max(-1, Math.min(1, k)))) * 8; g.moveTo(sx + off - 7, y); g.lineTo(sx + off - 4, y + 2); g.moveTo(sx + off + 4, y); g.lineTo(sx + off + 1, y + 2); } g.stroke();
    });
    L(5, 'rgba(255,255,255,.55)'); g.beginPath(); g.arc(0, -64, 31, -2.5, -1.9); g.stroke();
    const bl = blinkAt(3.4, .5);
    for(const d of [-1, 1]) eye(d * 14 + 2, -74, { side:d, rx:7.6, ry:9.4, lower:.22, blink:bl, look:[f * 1.2, 1], lidCol:'#D63A2F' });
    smile(2, -56, 10, 6, true, true); cheeks(2, -58, 18, .5);
    g.restore();
    if(walk) swingArms(36, -66 - b, 18); else for(const d of [-1, 1]){ arm(d * 36, -66 - b, d * 48, -76 - b, d * 50, -92 - b + Math.sin(T * 6 + d) * 3); }
  } };

  /* ---------- CP10 Teearsha's Microphone (Rare): powerful ---------- */
  C.CP10 = { name:"Teearsha's Microphone", rarity:'Rare', mood:'Powerful', draw(f, walk){
    shadow(24); legs([-7, 7], -36, '#2B3240', { walk, col:'#1E2433' });
    const beat = Math.abs(Math.sin(T * 3.4)), lean = walk ? 0 : -f * beat * 0.08;
    g.save(); g.rotate(lean); g.translate(0, walk ? -Math.abs(wave(11)) * 2.5 : 0);
    const h = new Path2D('M-11 -94 L11 -94 L7 -36 L-7 -36 Z'); tone(h, '#4A5464', '#2B3240', 4);
    rr(-13, -98, 26, 7, 3); fill('#F5C431'); ink(2.6);
    L(1.6, 'rgba(255,255,255,.35)'); g.beginPath(); g.moveTo(6, -88); g.lineTo(3, -42); g.stroke();
    const head = new Path2D(); head.ellipse(0, -122, 27, 27, 0, 0, Math.PI * 2); tone(head, '#D7DEE5', '#AEB8C3', 5);
    g.save(); g.clip(head); L(1.2, 'rgba(74,44,34,.25)'); g.beginPath(); for(let k = -30; k <= 30; k += 6){ g.moveTo(-30, -122 + k - 20); g.lineTo(30, -122 + k + 20); g.moveTo(-30, -122 + k + 20); g.lineTo(30, -122 + k - 20); } g.stroke(); g.restore();
    L(4); g.stroke(head);
    // fierce, confident eyes and brows; belting a big note
    const bl = blinkAt(3.6, 1);
    for(const d of [-1, 1]){ eye(d * 10, -128, { side:d, rx:7.4, ry:9.2, lid:.24, slant:2.2, blink:bl, look:[0, 1.5], lidCol:'#C3CCD5' }); brow(d * 10, -141, d * -0.32, 13, 4.4); }
    oMouth(0, -108, 6 + beat * 2, 4.5 + beat * 3.5);
    g.save(); ell(0, -105 + beat * 2, 4, 2.2); fill('#FF7A93'); g.restore();
    g.restore();
    // sound waves and notes
    for(let i = 0; i < 3; i++){ const p = (T * 0.9 + i / 3) % 1; L(2.6, `rgba(255,227,107,${1 - p})`); for(const d of [-1, 1]){ g.beginPath(); g.arc(d * 22, -112, 8 + p * 26, d > 0 ? -0.7 : Math.PI - 0.7 * -1, d > 0 ? 0.7 : Math.PI + 0.7); g.stroke(); } }
    for(let i = 0; i < 2; i++){ const p = (T * 0.45 + i / 2) % 1, x = (i ? 1 : -1) * (30 + p * 6), y = -140 - p * 40; g.save(); g.globalAlpha = 1 - p; g.fillStyle = INK; ell(x, y, 3.6, 2.8, -0.4); g.fill(); L(2); g.beginPath(); g.moveTo(x + 3.2, y - 1); g.lineTo(x + 3.2, y - 13); g.lineTo(x + 8, y - 10); g.stroke(); g.restore(); }
    // a fist punched up high, the other hand on her hip
    if(walk) swingArms(11, -80); else { const up = beat * 6; arm(10, -80, 24, -92, 22, -112 - up); ell(22, -112 - up, 5.2, 5.2); fill(INK); L(5.5); g.beginPath(); g.moveTo(-10, -80); g.lineTo(-22, -68); g.lineTo(-9, -58); g.stroke(); }
    twinkle(-28, -150, 4 + beat * 3);
  } };

  /* ---------- CP11 Toebee's Squash Racket (Rare): excited and undefeated ---------- */
  C.CP11 = { name:"Toebee's Squash Racket", rarity:'Rare', mood:'Excited and undefeated', draw(f, walk){
    const jp = (T % 0.9) / 0.9, jump = walk ? Math.abs(wave(11)) * 3 : Math.max(0, Math.sin(jp * Math.PI * 2)) * 9;
    shadow(24 - jump * .5); legs([-7, 7], -34, '#E2483D', { walk, shoe:'sneaker', col:'#2B3240' });
    g.save(); g.translate(0, -jump);
    // handle and throat
    rr(-6, -72, 12, 38, 4); fill('#1E2433'); ink(3); L(1.4, '#5B6773'); g.beginPath(); for(let y = -68; y < -36; y += 5){ g.moveTo(-5, y); g.lineTo(5, y + 3); } g.stroke();
    L(7); g.beginPath(); g.moveTo(-5, -72); g.lineTo(-14, -92); g.moveTo(5, -72); g.lineTo(14, -92); g.stroke(); L(3.6, '#E2483D'); g.stroke();
    // the head: red frame, strings, a sweatband
    const head = new Path2D(); head.ellipse(0, -122, 25, 31, 0, 0, Math.PI * 2);
    g.fillStyle = '#F4F7FA'; g.fill(head); g.save(); g.clip(head); L(1.1, 'rgba(120,130,145,.55)'); g.beginPath(); for(let k = -24; k <= 24; k += 6){ g.moveTo(k, -156); g.lineTo(k, -88); g.moveTo(-28, -122 + k); g.lineTo(28, -122 + k); } g.stroke(); g.restore();
    L(10); g.stroke(head); L(6, '#E2483D'); g.stroke(head); L(1.6, 'rgba(255,255,255,.7)'); g.beginPath(); g.ellipse(0, -122, 25, 31, 0, -2.4, -1.6); g.stroke();
    g.save(); g.clip(head); g.fillStyle = '#fff'; g.fillRect(-30, -149, 60, 9); g.fillStyle = '#E2483D'; g.fillRect(-30, -146, 60, 3); g.restore();
    // face: starry eyes, brows way up, a huge grin
    const bl = blinkAt(3, .9);
    for(const d of [-1, 1]){ eye(d * 9.5, -124, { side:d, rx:7.6, ry:9.6, blink:bl, look:[0, -.5], prx:5.4, pry:6.2, star:true, lidCol:'#F4F7FA' }); L(3.2); g.beginPath(); g.arc(d * 9.5, -134, 6, -Math.PI * .9, -Math.PI * .1); g.stroke(); }
    smile(0, -110, 11, 6.5, true, true);
    // the champion's medal
    L(2.4, '#3A86FF'); g.beginPath(); g.moveTo(-6, -86); g.lineTo(0, -74); g.lineTo(6, -86); g.stroke();
    const ms = wave(5) * 0.2; g.save(); g.translate(0, -72); g.rotate(ms); ell(0, 5, 6, 6); fill('#F5C431'); ink(2.4); g.save(); g.translate(0, 5); star(3.4, '#FFF3B0'); g.restore(); g.restore();
    // fists pumping in turn
    if(walk) swingArms(7, -80); else { const a = Math.sin(T * 7); for(const d of [-1, 1]){ const up = Math.max(0, d * a) * 14; arm(d * 6, -80, d * 22, -86 - up * .3, d * 22, -96 - up); ell(d * 22, -96 - up, 5, 5); fill(INK); } }
    g.restore();
    // a squash ball bouncing alongside
    const bp = (T % 0.75) / 0.75, by = -Math.abs(Math.sin(bp * Math.PI)) * 44; ell(f * 34, -5 + by, 5, 5); fill('#1E2433'); ell(f * 34 - 1, -6 + by, 1.6, 1.6); fill('#F5C431');
  } };

  /* ---------- CP12 Marc's Handball (Rare): tired ---------- */
  C.CP12 = { name:"Marc's Handball", rarity:'Rare', mood:'Tired', draw(f, walk){
    // a slow, tired bounce: up, down, squash on the floor
    const bp = (T % 1.5) / 1.5, b = walk ? 0 : Math.abs(Math.sin(bp * Math.PI)) * 14, br = walk ? 1 : b < 2 ? 0.9 : 1 + Math.sin(T * 1.3) * 0.03;
    shadow(22 - b * .5); g.save(); g.translate(0, -b);
    legs([-9, 9], -22, '#2489BD', { walk, col:'#17668F' });
    g.save(); g.translate(0, -22); g.scale(1 / br, br); g.translate(0, 22); if(walk) g.translate(0, -Math.abs(wave(11)) * 2.5);
    ballBody(33, -54, '#3BB2E8', '#2489BD', () => { L(5, '#fff'); g.beginPath(); g.arc(-40, -40, 44, -0.9, 0.35); g.stroke(); });
    L(4, 'rgba(255,255,255,.5)'); g.beginPath(); g.arc(0, -54, 27, -2.4, -1.9); g.stroke();
    // dozing: the lids sink, shut for a moment, then jolt open
    const cyc = (T % 5) / 5, doze = cyc < .55 ? cyc / .55 * .45 : cyc < .8 ? 1 : 0.15;
    for(const d of [-1, 1]) eye(d * 11, -60, { side:d, rx:7, ry:8.4, lid:.5 + doze * .5, slant:-1.5, look:[f * .8, 3], lidCol:'#3BB2E8', bags:'rgba(30,60,110,.55)', w:2.6 });
    if(cyc > .55 && cyc < .8) oMouth(0, -42, 3, 2.2); else wobble(0, -43, 5, 1, .6);
    g.restore();
    // z z z
    for(let i = 0; i < 3; i++){ const p = (T * 0.4 + i / 3) % 1; g.save(); g.globalAlpha = p < .15 ? p / .15 : 1 - p; g.font = `900 ${8 + p * 8}px 'Lilita One',Menlo,sans-serif`; g.textAlign = 'center'; g.fillStyle = '#fff'; g.strokeStyle = INK; g.lineWidth = 3; g.strokeText('z', f * (24 + p * 14), -86 - p * 34); g.fillText('z', f * (24 + p * 14), -86 - p * 34); g.restore(); }
    if(walk) swingArms(32, -56, 16); else { const fl = b > 4 ? 6 : 0; arm(-32, -56, -40, -44 - fl, -36, -32 - fl); arm(32, -56, 40, -44 - fl, 36, -32 - fl); }
    g.restore();
  } };

  /* ---------- CP13 Alix's Laptop (Collector): green code eyes, busy working ---------- */
  C.CP13 = { name:"Alix's Laptop", rarity:'Collector', mood:'Busy working (eyes written in green code)', draw(f, walk){
    shadow(32); legs([-12, 12], -42, '#5B6773', { walk });
    g.save(); g.translate(0, walk ? -Math.abs(wave(11)) * 2.5 : 0);
    // keyboard base (the body)
    const base = new Path2D('M-32 -62 L32 -62 L36 -44 L-36 -44 Z'); tone(base, '#C9D3DA', '#9AA8B6', 4);
    const kp = Math.floor(T * 10) % 18;
    for(let r = 0; r < 2; r++) for(let c = 0; c < 9; c++){ const i = r * 9 + c; rr(-28 + c * 6.3 + r * 1.5, -59 + r * 6, 5, 4, 1); fill(i === kp ? '#5CF29B' : '#3A4350'); }
    // the screen (the head)
    const lid = new Path2D(); lid.roundRect(-33, -142, 66, 82, 7); tone(lid, '#4A5464', '#2B3240', 5);
    const scr = new Path2D(); scr.roundRect(-28, -137, 56, 70, 4); g.fillStyle = '#07140C'; g.fill(scr);
    g.save(); g.clip(scr);
    // code scrolling behind the face
    const lines = ['if(sum>9){', 'let x=7*8;', '0110 1001', 'for(i=0;i<n', 'return ans;', 'x²+3x-4=0', 'while(busy)', 'ok=true;}', 'π≈3.14159'], sc = (T * 14) % 9;
    g.font = "700 5.6px Menlo,Consolas,monospace"; g.textAlign = 'left'; g.fillStyle = 'rgba(92,242,155,.28)';
    for(let i = 0; i < 14; i++){ const y = -133 + i * 6 - (sc % 1) * 6; g.fillText(lines[(i + Math.floor(sc)) % lines.length], -26, y); }
    // eyes made of green code characters; they blink to a line of dashes
    const bl = blinkAt(3.2, .4, 0.08), glow = '#5CF29B';
    g.font = "900 6px Menlo,Consolas,monospace"; g.textAlign = 'center'; g.fillStyle = glow; g.shadowColor = glow; g.shadowBlur = 4;
    for(const d of [-1, 1]){
      const ex = d * 12, ey = -110;
      if(bl > .5){ g.fillText('- - - -', ex, ey + 2); continue; }
      for(let a = 0; a < 14; a++){ const ang = a / 14 * Math.PI * 2; g.fillText('01{}<>;=10#*/+'[a], ex + Math.cos(ang) * 8.5, ey + Math.sin(ang) * 10 + 2); }
      const px = ex + Math.sin(T * 2.4) * 2.5 * d; g.font = "900 9px Menlo,Consolas,monospace"; g.fillText('@', px, ey + 5); g.font = "900 6px Menlo,Consolas,monospace";
      g.fillText(d < 0 ? '\\\\' : '//', ex, ey - 13);   // focused brows
    }
    g.fillText('~ _ _ ~', 0, -88);
    // progress bar
    const pr = (T * 0.22) % 1; g.shadowBlur = 0; g.strokeStyle = glow; g.lineWidth = 1; g.strokeRect(-20, -78, 40, 5); g.fillRect(-19, -77, 38 * pr, 3);
    g.font = "700 4.4px Menlo,Consolas,monospace"; g.fillText('WORKING ' + Math.floor(pr * 100) + '%', 0, -70);
    g.restore(); L(2.4); g.stroke(scr);
    ell(0, -139.5, 1.2, 1.2); fill('#5CF29B');
    // hands typing away
    if(walk) swingArms(33, -56, 18); else for(const d of [-1, 1]){ const tap = Math.max(0, Math.sin(T * 18 + (d > 0 ? Math.PI : 0))) * 3; arm(d * 33, -56, d * 30, -44, d * 14, -58 - tap); }
    g.restore();
    // a little steam: it has been working hard
    L(1.6, 'rgba(255,255,255,.5)'); g.beginPath(); for(const x of [-8, 6]){ const o = wave(5, x); g.moveTo(x, -146); g.quadraticCurveTo(x + 3 + o, -152, x, -158); } g.stroke();
  } };

  /* ---------- CP14 Makenzy's Drama Mask: cute and happy ---------- */
  C.CP14 = { name:"Makenzy's Drama Mask", rarity:'Rare', mood:'Cute and happy', draw(f, walk){
    const hp = (T % 1.4) / 1.4, hop = walk ? Math.abs(wave(11)) * 3 : Math.max(0, Math.sin(hp * Math.PI * 2)) * 5;
    shadow(24); legs([-8, 8], -54, '#C8951A', { walk, col:'#8A6416' });
    g.save(); g.translate(0, -hop); const tilt = wave(1.4) * 0.07; g.translate(0, -100); g.rotate(tilt); g.translate(0, 100);
    // ribbons flutter out of each side
    for(const d of [-1, 1]){ const fl = wave(5, d) * 4; L(4.5); g.beginPath(); g.moveTo(d * 29, -120); g.bezierCurveTo(d * 42, -116 + fl, d * 40, -98 - fl, d * 50, -90 + fl); g.stroke(); L(2.6, '#7A4FCC'); g.stroke();
      L(4.5); g.beginPath(); g.moveTo(d * 29, -120); g.bezierCurveTo(d * 40, -128 - fl, d * 48, -122 + fl, d * 54, -126 - fl); g.stroke(); L(2.6, '#B48CFF'); g.stroke(); }
    const m = new Path2D('M-30 -140 Q0 -154 30 -140 Q35 -100 22 -72 Q10 -52 0 -52 Q-10 -52 -22 -72 Q-35 -100 -30 -140 Z'); tone(m, '#FFF3D6', '#F0D9A8', 6);
    L(2.4, '#F5C431'); g.save(); g.clip(m); g.beginPath(); g.moveTo(-30, -140); g.quadraticCurveTo(0, -152, 30, -140); g.stroke(); g.restore();
    // eye holes (happy crescents, painted dark) with big cute eyes inside
    const bl = blinkAt(3.4, .3);
    for(const d of [-1, 1]){ g.save(); g.translate(d * 12, -112); g.beginPath(); g.ellipse(0, 0, 11, 9, 0, 0, Math.PI * 2); fill('#3B2350'); g.restore();
      eye(d * 12, -112, { side:d, rx:8.4, ry:9.6, lower:.18, blink:bl, look:[f * .8, -.5], prx:5.6, pry:6.6, shine2:true, lidCol:'#3B2350', w:2.8 });
      L(3, '#F5C431'); g.beginPath(); g.arc(d * 12, -122, 9, -Math.PI * .85, -Math.PI * .15); g.stroke(); }
    // the comedy grin (a wide upturned crescent)
    const g1 = new Path2D('M-17 -84 Q0 -78 17 -84 Q12 -64 0 -64 Q-12 -64 -17 -84 Z'); g.fillStyle = '#7A1F2B'; g.fill(g1); g.save(); g.clip(g1); ell(0, -64, 9, 6); fill('#FF7A93'); g.restore(); L(3); g.stroke(g1);
    cheeks(0, -88, 21, .6);
    g.restore();
    if(walk) swingArms(26, -84); else { const wv = wave(7) * 0.3; arm(-24, -84, -34, -96, -36 + wv * 4, -110); arm(24, -84, 32, -74, 30, -64); }
    for(let i = 0; i < 3; i++){ const p = (T * 0.6 + i / 3) % 1; g.save(); g.globalAlpha = 1 - p; twinkle((i - 1) * 28, -150 - p * 20, 3 + (1 - p) * 3, ['#FFE36B', '#FF8AE0', '#7FE3FF'][i]); g.restore(); }
  } };

  /* ---------- CP15 Tilly's Art Book: happy and hippy ---------- */
  C.CP15 = { name:"Tilly's Art Book", rarity:'Legendary', mood:'Happy and hippy', draw(f, walk){
    shadow(28); legs([-10, 10], -40, null, { walk, shoe:'sandal', col:'#8A5A2B' });
    const groove = walk ? 0 : wave(2.2) * 0.07; g.save(); g.rotate(groove); g.translate(0, walk ? -Math.abs(wave(11)) * 2.5 : 0);
    // the pages' edges, the cover, the spiral binding
    rr(-24, -144, 52, 104, 6); fill('#FFF8EE'); ink(3); L(1, 'rgba(74,44,34,.35)'); g.beginPath(); for(let i = 0; i < 4; i++){ g.moveTo(27 - i * 1.4, -140); g.lineTo(27 - i * 1.4, -44); } g.stroke();
    const cov = new Path2D(); cov.roundRect(-27, -146, 52, 104, 6); tone(cov, '#7FD3C4', '#4FB3A2', 7);
    g.save(); g.clip(cov);
    for(const [x, y, r, c] of [[-16, -60, 8, '#FF6FB5'], [14, -54, 6, '#F5C431'], [-6, -50, 4, '#FF8A3D'], [18, -76, 4, '#7A4FCC']]){ ell(x, y, r, r * .8); fill(c); ell(x + r, y + r * .3, r * .35, r * .3); fill(c); }
    L(2.2, '#fff'); g.beginPath(); g.arc(-12, -72, 7, 0, Math.PI * 2); g.moveTo(-12, -79); g.lineTo(-12, -65); g.moveTo(-12, -72); g.lineTo(-17, -67); g.moveTo(-12, -72); g.lineTo(-7, -67); g.stroke();
    g.restore();
    for(let i = 0; i < 7; i++){ ell(-21 + i * 7, -147, 2.6, 4.2); L(2, '#9AA8B6'); g.stroke(); }
    // a daisy chain on top
    for(let i = 0; i < 4; i++){ const x = -18 + i * 12, y = -152 + Math.sin(T * 3 + i) * 1.4; for(let k = 0; k < 6; k++){ const a = k / 6 * Math.PI * 2; ell(x + Math.cos(a) * 3.4, y + Math.sin(a) * 3.4, 2.4, 2.4); fill('#fff'); L(1, INK); g.stroke(); } ell(x, y, 2, 2); fill('#F5C431'); }
    // round tinted glasses, happy squinting eyes, a big smile
    const bl = blinkAt(3.6, 1.1);
    for(const d of [-1, 1]){ eye(d * 10 - 1, -118, { side:d, rx:7.2, ry:8.6, lower:.3, blink:bl, look:[f, 0], lidCol:'#7FD3C4', w:2.6 }); ell(d * 10 - 1, -118, 10, 10); fill('rgba(180,140,255,.28)'); L(2.6); g.stroke(); }
    L(2.4); g.beginPath(); g.moveTo(-1.5, -119); g.quadraticCurveTo(-1, -122, -0.5, -119); g.stroke();
    smile(-1, -100, 10, 5.5, true, true); cheeks(-1, -101, 17, .5);
    g.restore();
    // a peace sign, waving
    if(walk) swingArms(26, -88); else { arm(-26, -88, -33, -74, -30, -62); const w = wave(5) * 0.18; g.save(); g.translate(26, -90); g.rotate(w); arm(0, 0, 10, -4, 12, -18, INK); L(2.6); g.beginPath(); g.moveTo(12, -18); g.lineTo(9, -26); g.moveTo(12, -18); g.lineTo(16, -25); g.stroke(); g.restore(); }
    // little flowers drifting
    for(let i = 0; i < 2; i++){ const p = (T * 0.3 + i / 2) % 1; g.save(); g.globalAlpha = 1 - p; g.translate((i ? 34 : -36) + Math.sin(p * 6) * 4, -120 - p * 40); g.rotate(p * 4); for(let k = 0; k < 5; k++){ const a = k / 5 * Math.PI * 2; ell(Math.cos(a) * 3, Math.sin(a) * 3, 2, 2); fill(i ? '#FF8AE0' : '#FFE36B'); } ell(0, 0, 1.6, 1.6); fill('#fff'); g.restore(); }
  } };

  /* ---------- CP16 Gab's Golden Coin (Rare): funny, an R on it ---------- */
  C.CP16 = { name:"Gab's Golden Coin", rarity:'Legendary', mood:'Funny', draw(f, walk){
    const cyc = (T % 6) / 6, spinning = !walk && cyc > .8, sp = spinning ? Math.cos((cyc - .8) / .2 * Math.PI * 4) : 1, wob = walk ? 0 : wave(2.5) * 0.08;
    shadow(24); legs([-10, 10], -28, '#C8951A', { walk, col:'#8A6416' });
    g.save(); g.translate(0, -64); g.rotate(wob); g.scale(Math.abs(sp) < .1 ? .1 : sp, 1); g.translate(0, 64); if(walk) g.translate(0, -Math.abs(wave(11)) * 2.5);
    if(Math.abs(sp) < .25){ rr(-4, -106, 8, 80, 3); fill('#E0A82A'); ink(3); L(1.2); g.beginPath(); for(let y = -96; y < -30; y += 4){ g.moveTo(-3, y); g.lineTo(3, y); } g.stroke(); }
    else {
      ballBody(40, -66, '#F5C431', '#C8951A');
      ell(0, -66, 33, 33); L(2, 'rgba(160,110,20,.7)'); g.stroke();
      for(let i = 0; i < 36; i++){ const a = i / 36 * Math.PI * 2; g.fillStyle = 'rgba(160,110,20,.6)'; g.fillRect(Math.cos(a) * 37 - .8, -66 + Math.sin(a) * 37 - .8, 1.6, 1.6); }
      // the R, stamped in
      g.font = "900 19px Georgia,'Times New Roman',serif"; g.textAlign = 'center'; g.fillStyle = '#B07F14'; g.fillText('R', 1.2, -55.8); g.fillStyle = '#FFE38A'; g.fillText('R', 0, -57); L(1); g.strokeStyle = 'rgba(120,80,10,.6)'; g.strokeText('R', 0, -57);
      // a goofy face: one big eye, one small, crossed pupils, a wink, tongue out
      const wink = (T % 4.2) / 4.2 > .86 ? 1 : 0, bl = blinkAt(3.1, .2);
      eye(-12, -83, { side:-1, rx:8.6, ry:10.4, blink:bl, look:[3, 1.5], lidCol:'#E0AE2A', w:2.8 });
      eye(12, -85, { side:1, rx:6, ry:7, blink:Math.max(bl, wink), look:[-2.4, 1], lidCol:'#E0AE2A', w:2.6 });
      brow(-12, -98, 0.3, 11, 3.6); brow(12, -97, 0.28, 10, 3.6);
      L(3); g.beginPath(); g.moveTo(-14, -48); g.quadraticCurveTo(0, -40, 15, -50); g.stroke();
      const tw = wave(7) * 2; g.save(); g.translate(6, -45); g.rotate(0.2 + tw * .03); rr(-4, -2, 8, 9 + Math.abs(tw), 4); fill('#FF7A93'); ink(2.4); L(1.4); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 5); g.stroke(); g.restore();
      L(5, 'rgba(255,255,255,.6)'); g.beginPath(); g.arc(0, -66, 34, -2.5, -2.0); g.stroke();
    }
    g.restore();
    if(walk) swingArms(35, -66, 18); else { arm(-35, -66, -44, -56, -40, -44); const w = wave(6) * 4; arm(35, -66, 46, -76, 48, -88 + w); }
  } };

  /* ---------- CP17 Lilli's Netball (Rare): happy ---------- */
  C.CP17 = { name:"Lilli's Netball", rarity:'Rare', mood:'Happy', draw(f, walk){
    const bp = (T % 1.1) / 1.1, b = walk ? Math.abs(wave(11)) * 3 : Math.abs(Math.sin(bp * Math.PI)) * 12, squash = !walk && b < 1.5 ? 0.92 : 1;
    shadow(26 - b * .6); legs([-11, 11], -24, '#C9D3DA', { walk, col:'#8FA3B6' });
    g.save(); g.translate(0, -b); g.translate(0, -62); g.scale(1 / squash, squash); g.translate(0, 62);
    ballBody(38, -62, '#FFF8EE', '#E3DCCB', () => {
      g.fillStyle = '#FF6FB5'; g.beginPath(); g.moveTo(-40, -90); g.bezierCurveTo(-10, -84, -10, -40, -40, -34); g.closePath(); g.fill();
      g.fillStyle = '#3A86FF'; g.beginPath(); g.moveTo(40, -90); g.bezierCurveTo(10, -84, 10, -40, 40, -34); g.closePath(); g.fill();
      L(2.2); g.beginPath(); g.moveTo(-40, -90); g.bezierCurveTo(-10, -84, -10, -40, -40, -34); g.moveTo(40, -90); g.bezierCurveTo(10, -84, 10, -40, 40, -34); g.moveTo(-38, -62); g.lineTo(38, -62); g.stroke();
    });
    L(5, 'rgba(255,255,255,.7)'); g.beginPath(); g.arc(0, -62, 31, -2.5, -1.9); g.stroke();
    const bl = blinkAt(3.5, .9);
    for(const d of [-1, 1]) eye(d * 12, -72, { side:d, rx:7.6, ry:9.4, lower:.24, blink:bl, look:[f, 0], lidCol:'#F3EBDD' });
    smile(0, -54, 11, 6, true, true); cheeks(0, -56, 19, .55);
    g.restore();
    if(walk) swingArms(36, -64 - b, 18); else { const c = Math.sin(T * 5); for(const d of [-1, 1]) arm(d * 36, -64 - b, d * 46, -84 - b, d * 44 + c * d * 2, -102 - b); }
  } };

  /* ---------- CP18 Chappy's Chicken Handbag (Common, 2000 coins: a meme): scared ---------- */
  C.CP18 = { name:"Chappy's Chicken Handbag", rarity:'Common', price:2000, mood:'Scared', draw(f, walk){
    const jit = walk ? 0 : Math.sin(T * 38) * 0.8, eek = (T % 4) / 4, jump = !walk && eek > .82 && eek < .92 ? Math.sin((eek - .82) / .1 * Math.PI) * 10 : 0;
    shadow(32);
    // knocking knees
    const kn = walk ? 0 : Math.sin(T * 26) * 2.5;
    for(const d of [-1, 1]){ const lift = walk ? Math.max(0, d * wave(11)) * 6 : 0; g.save(); g.translate(0, -lift - jump);
      L(7); g.beginPath(); g.moveTo(d * 13, -38); g.lineTo(d * 5 + (d < 0 ? kn : -kn), -20); g.lineTo(d * 12, -8); g.stroke(); L(3.4, '#5B6773'); g.stroke();
      ell(d * 14, -6, 11, 7); fill('#8A94A0'); ink(3); g.restore(); }
    g.save(); g.translate(jit, -jump + (walk ? -Math.abs(wave(11)) * 2.5 : 0));
    // the black shoulder strap
    L(9); g.beginPath(); g.moveTo(-30, -110); g.bezierCurveTo(-46, -150, 46, -150, 30, -110); g.stroke(); L(5, '#2B3240'); g.stroke();
    const bag = new Path2D('M-28 -152 Q-30 -152 -30 -148 L-34 -42 Q-34 -38 -30 -38 L30 -38 Q34 -38 34 -42 L30 -148 Q30 -152 28 -152 Z');
    // clear plastic with the roast chicken inside
    g.fillStyle = 'rgba(214,236,246,.95)'; g.fill(bag);
    g.save(); g.clip(bag);
    const ck = Math.sin(T * 38) * .4;
    g.save(); g.translate(ck, 0);
    const chick = new Path2D('M-24 -60 Q-28 -90 -4 -94 Q18 -98 24 -82 Q30 -70 22 -60 Q0 -52 -24 -60 Z'); tone(chick, '#D98A3A', '#B0632A', 4, 3);
    for(const [x, y] of [[24, -86], [27, -66]]){ L(6); g.beginPath(); g.moveTo(x - 6, y + 2); g.lineTo(x + 4, y - 2); g.stroke(); L(3, '#E9A35A'); g.stroke(); ell(x + 5, y - 2.5, 3.4, 3.4); fill('#F3E2C0'); ink(1.8); }
    g.fillStyle = 'rgba(255,255,255,.35)'; ell(-8, -84, 9, 3.4, -.2); g.fill();
    g.fillStyle = 'rgba(120,60,20,.35)'; for(let i = 0; i < 14; i++){ g.fillRect(-18 + (i * 13) % 36, -88 + (i * 7) % 26, 1.4, 1.4); }
    g.restore();
    // yellow band with the handle cut-out; brown band at the bottom
    g.fillStyle = '#F5C431'; g.fillRect(-36, -156, 72, 56); g.fillStyle = '#C8951A'; g.fillRect(-36, -104, 72, 4);
    g.fillStyle = '#5A3A22'; g.fillRect(-36, -52, 72, 16);
    g.font = "900 6px Menlo,Consolas,monospace"; g.textAlign = 'center'; g.fillStyle = '#F5C431'; g.fillText('HOT FOOD', 0, -42);
    // plastic shine
    L(2.6, 'rgba(255,255,255,.8)'); g.beginPath(); g.moveTo(-24, -96); g.lineTo(-27, -62); g.moveTo(25, -96); g.lineTo(26, -80); g.stroke();
    g.restore();
    L(4); g.stroke(bag);
    rr(-12, -147, 24, 9, 4.5); fill('#2B3240'); ink(2.6);
    // a little "JUICY" sticker
    g.save(); g.translate(22, -96); g.rotate(.3); ell(0, 0, 8, 8); fill('#FFE36B'); ink(2); g.font = "900 3.6px Menlo,Consolas,monospace"; g.fillStyle = '#5A3A22'; g.textAlign = 'center'; g.fillText('JUICY', 0, 1.4); g.restore();
    // face on the yellow band: wide terrified eyes, tiny darting pupils, brows up, a wobbly open mouth
    const dart = Math.sin(T * 7) > 0 ? 1 : -1, bl = blinkAt(5, .2, 0.04);
    for(const d of [-1, 1]){ eye(d * 11, -123, { side:d, rx:8.2, ry:10.4, blink:bl, look:[dart * 2.2 + jit * .5, 0], prx:2.6, pry:3.2, lidCol:'#F5C431' }); brow(d * 11, -137, d * 0.5, 11, 3.8); }
    const mo = new Path2D('M-8 -106 Q-4 -110 0 -106 Q4 -110 8 -106 Q8 -100 0 -100 Q-8 -100 -8 -106 Z'); g.fillStyle = '#7A1F2B'; g.fill(mo); L(2.6); g.stroke(mo);
    L(1.6); g.beginPath(); g.moveTo(-6, -106); g.lineTo(-4, -104); g.lineTo(-2, -106); g.lineTo(0, -104); g.lineTo(2, -106); g.lineTo(4, -104); g.lineTo(6, -106); g.stroke();
    // sweat and steam
    for(let i = 0; i < 2; i++){ const p = (T * 1.2 + i / 2) % 1, d = i ? 1 : -1; g.fillStyle = `rgba(127,208,255,${1 - p})`; ell(d * (34 + p * 8), -136 + p * 22, 2.4, 3.4); g.fill(); L(1.2, `rgba(74,44,34,${1 - p})`); g.stroke(); }
    L(1.8, 'rgba(255,255,255,.6)'); g.beginPath(); for(const x of [-14, 14]){ const o = wave(6, x); g.moveTo(x, -158); g.quadraticCurveTo(x + 3 + o, -163, x, -168); } g.stroke();
    // hands up in a panic
    if(walk) swingArms(32, -94); else for(const d of [-1, 1]){ const sh = Math.sin(T * 30 + d) * 1.5; arm(d * 32, -94, d * 44, -104, d * 44 + sh, -122); }
    g.restore();
    if(eek > .8 && eek < .95){ g.save(); g.font = "900 14px 'Lilita One',sans-serif"; g.textAlign = 'center'; g.lineWidth = 4; g.strokeStyle = INK; g.fillStyle = '#fff'; g.strokeText('!!', f * 40, -150); g.fillText('!!', f * 40, -150); g.restore(); }
  } };

  /* ---------- CP19 ElJay's Basketball (Rare): happy and unphased ---------- */
  C.CP19 = { name:"ElJay's Basketball", rarity:'Rare', mood:'Happy and unphased', draw(f, walk){
    const bp = (T % 2.2) / 2.2, b = walk ? Math.abs(wave(11)) * 3 : Math.abs(Math.sin(bp * Math.PI)) * 5, sway = walk ? 0 : wave(1.1) * 0.05;
    shadow(26 - b * .5); legs([-11, 11], -26, '#E07B1E', { walk, shoe:'sneaker', col:'#2B3240' });
    g.save(); g.translate(0, -b); g.rotate(sway);
    // hands behind the head: elbows out, very relaxed
    if(!walk) for(const d of [-1, 1]){ L(5.5); g.beginPath(); g.moveTo(d * 34, -76); g.lineTo(d * 46, -98); g.lineTo(d * 22, -100); g.stroke(); }
    ballBody(38, -64, '#F28A2E', '#C9631A', () => {
      L(2.6); g.beginPath(); g.moveTo(-38, -50); g.quadraticCurveTo(0, -38, 38, -50); g.moveTo(0, -104); g.lineTo(0, -24);
      g.moveTo(-26, -100); g.quadraticCurveTo(-8, -64, -26, -28); g.moveTo(26, -100); g.quadraticCurveTo(8, -64, 26, -28); g.stroke();
      g.fillStyle = 'rgba(120,50,10,.25)'; for(let i = 0; i < 40; i++){ const a = i * 2.4, r = 6 + (i * 7) % 30; g.fillRect(Math.cos(a) * r - .6, -64 + Math.sin(a) * r - .6, 1.2, 1.2); }
    });
    L(5, 'rgba(255,255,255,.5)'); g.beginPath(); g.arc(0, -64, 31, -2.5, -1.9); g.stroke();
    // face: easy half-lids, a calm look to the side, one brow slightly up, a relaxed smile
    const bl = blinkAt(4.4, .6);
    for(const d of [-1, 1]) eye(d * 12, -74, { side:d, rx:7.6, ry:9.2, lid:.4, lower:.12, blink:bl, look:[f * 1.8, 1.5], lidCol:'#E07B1E' });
    brow(-12, -86, 0.05, 11, 3.6); brow(12, -87.5, -0.16, 11, 3.6);
    smile(1, -55, 9, 5, false); L(2.4); g.beginPath(); g.moveTo(9.5, -56); g.lineTo(11.5, -58); g.stroke();
    g.restore();
    if(walk) swingArms(36, -66 - b, 18);
  } };

  /* ===================== batch 2 (22 Oct 2026) ===================== */
  function lashes(x, y, rx, ry, side){ L(2); g.beginPath(); for(let k = 0; k < 3; k++){ const a = -Math.PI / 2 + side * (0.45 + k * 0.32), sx = x + Math.cos(a) * rx, sy = y + Math.sin(a) * ry; g.moveTo(sx, sy); g.lineTo(sx + Math.cos(a) * 4.5, sy + Math.sin(a) * 4.5); } g.stroke(); }
  function note(x, y, a, c){ g.save(); g.globalAlpha = Math.max(0, a); ell(x, y, 4.2, 3.2, -0.4); fill(c || INK); L(1.4); g.stroke(); L(2.2, c || INK); g.beginPath(); g.moveTo(x + 3.6, y - 1); g.lineTo(x + 3.6, y - 15); g.lineTo(x + 9, y - 11); g.stroke(); g.restore(); }
  function heart(x, y, s, c){ g.save(); g.translate(x, y); g.scale(s / 10, s / 10); g.beginPath(); g.moveTo(0, 5); g.bezierCurveTo(-11, -3, -7, -13, 0, -6); g.bezierCurveTo(7, -13, 11, -3, 0, 5); g.closePath(); g.fillStyle = c; g.fill(); g.restore(); }
  function puffs(x, y, n, sp, c){ for(let i = 0; i < n; i++){ const p = (T * sp + i / n) % 1; g.fillStyle = c ? c(1 - p) : `rgba(255,255,255,${.8 * (1 - p)})`; for(const d of [-1, 1]){ ell(x + d * (6 + p * 9), y - p * 22, 4 + p * 4, 3 + p * 3); g.fill(); } } }

  /* ---------- CP05 Karla's Cats (Collector): two cats, cute and attentive ---------- */
  /* a chicken katsu sushi roll piece: sesame rice, a nori ring, golden crumbed chicken, cucumber, avocado (r 13, centred) */
  function sushiPiece(){
            ell(0, 0, 13, 13); fill('#FBFAF4'); ink(2.6);
      g.fillStyle = INK; for(let i = 0; i < 22; i++){ const a = i * 2.39, r = 9.5 + (i % 3) * 1.1; ell(Math.cos(a) * r, Math.sin(a) * r, .9, .6, a); g.fill(); }
      g.fillStyle = '#E9E2C8'; for(let i = 0; i < 10; i++){ const a = i * 1.7 + .5, r = 10.5; ell(Math.cos(a) * r, Math.sin(a) * r, .8, .55, a); g.fill(); }
      ell(0, 0, 7.6, 7.6); fill('#1F2A22'); ell(0, 0, 6, 6); fill('#FBFAF4');
      g.save(); ell(0, 0, 6, 6); g.clip();
      rr(-5.5, -4.6, 7.4, 6.4, 1.6); fill('#D98A2B'); g.fillStyle = '#F2B24E'; for(const [x, y] of [[-4, -3], [-2, -1.5], [0, -3.4], [-3.5, .5], [.6, -.2]]){ ell(x, y, .9, .7); g.fill(); }
      L(.8, '#8A4E12'); rr(-5.5, -4.6, 7.4, 6.4, 1.6); g.stroke();
      ell(3.4, -1.2, 2.6, 2.2); fill('#7BC043'); ell(3.4, -1.2, 1.2, 1); fill('#CDEB9A');
      ell(-0.6, 3.4, 3.4, 1.9, -.3); fill('#A9D45A');
      g.restore();
      L(1.4); ell(0, 0, 7.6, 7.6); g.stroke();
        }
  function kitty(o, f, walk){
    const T0 = T; T += o.ph || 0;
    const sw = wave(o.tail || 2.6) * 0.6; g.save(); g.translate(-f * 22, -18); g.rotate(-f * 0.3 + sw * 0.4);
    L(11); g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(-f * 18, -10, -f * 20, -40, -f * 8 + sw * 8, -52); g.stroke(); L(6.5, o.main); g.stroke(); g.restore();
    const hp = (T % 2.2) / 2.2, hop = !walk && o.hop && hp > .7 ? Math.sin((hp - .7) / .3 * Math.PI) * 9 : 0;
    const bob = walk ? -Math.abs(wave(11)) * 3 : -hop; g.save(); g.translate(0, bob);
    const body = new Path2D(); body.ellipse(0, -46, 28, 40, 0, 0, Math.PI * 2); tone(body, o.main, o.shade, 6);
    ell(0, -36, 15, 24); fill(o.belly);
    for(const d of [-1, 1]){ const lift = walk ? Math.max(0, d * wave(11)) * 5 : 0; ell(d * 9, -6 - lift, 8, 6); fill(o.belly); ink(3); L(1.6); g.beginPath(); g.moveTo(d * 9 - 2, -2 - lift); g.lineTo(d * 9 - 2, -6 - lift); g.moveTo(d * 9 + 2, -2 - lift); g.lineTo(d * 9 + 2, -6 - lift); g.stroke(); }
    const tilt = Math.sin(T * 0.9) > .55 ? Math.sin(T * 3) * 0.12 + 0.12 * f : 0;
    g.save(); g.translate(0, -100); g.rotate(tilt);
    const tw = (T % 3.3) < .2 ? Math.sin((T % 3.3) / .2 * Math.PI) * .25 : 0;
    for(const d of [-1, 1]){ g.save(); g.translate(d * 16, -22); g.rotate(d * (0.25 + (d > 0 ? tw : 0))); const e = new Path2D('M-10 6 L0 -16 L10 6 Z'); tone(e, o.main, o.shade, 3, 3.4); const ei = new Path2D('M-5 3 L0 -8 L5 3 Z'); g.fillStyle = '#FFB3C4'; g.fill(ei); g.restore(); }
    const head = new Path2D(); head.ellipse(0, 0, 30, 25, 0, 0, Math.PI * 2); tone(head, o.main, o.shade, 5);
    if(o.muzzle){ g.save(); g.clip(head); ell(0, 12, 15, 11); fill(o.muzzle); g.beginPath(); g.moveTo(-5, -26); g.lineTo(0, 6); g.lineTo(5, -26); g.closePath(); fill(o.muzzle); g.restore(); L(4); g.stroke(head); }
    if(o.stripe){ L(3, o.stripe); g.beginPath(); for(const x of [-6, 0, 6]){ g.moveTo(x, -24); g.lineTo(x * 0.7, -15); } g.stroke(); }
    const bl = blinkAt(3.8, .2);
    for(const d of [-1, 1]) eye(d * 11.5, -1, { side:d, rx:9, ry:10.5, blink:bl, look:[f * 1.5, -1.5], prx:6.4, pry:7.6, iris:o.iris, shine2:true, lidCol:o.main });
    if(o.blep){ rr(-2.6, 15, 5.2, 6, 2.6); fill('#FF7A93'); ink(1.4); }
    g.beginPath(); g.moveTo(-2.5, 10); g.lineTo(2.5, 10); g.lineTo(0, 13); g.closePath(); fill('#FF7A93'); ink(1.6);
    L(2.4); g.beginPath(); g.moveTo(-5, 15); g.quadraticCurveTo(-2.5, 18, 0, 14.5); g.quadraticCurveTo(2.5, 18, 5, 15); g.stroke();
    L(1.4, o.whisk || INK); g.beginPath(); for(const d of [-1, 1]) for(const k of [-1, 1]){ g.moveTo(d * 13, 11 + k * 2); g.lineTo(d * 28, 9 + k * 5); } g.stroke();
    cheeks(0, 10, 17, .5);
    g.restore();
    rr(-16, -78, 32, 6, 3); fill(o.collar); ink(2.4);
    if(o.charm != null){   // a key-chain charm hanging off the collar: ring, little chain, the sushi piece, swinging
      g.save(); g.translate(0, -73); g.rotate(o.charm);
      L(2.4, '#C9D2DB'); ell(0, 2, 3.2, 3.2); g.stroke(); L(1.2); ell(0, 2, 4.4, 4.4); g.stroke();
      L(2, '#C9D2DB'); g.beginPath(); for(let i = 0; i < 4; i++){ ell(0, 8 + i * 4, 1.5, 2.2); } g.stroke();
      g.translate(0, 36); g.scale(1.15, 1.15); sushiPiece(); g.restore();
    } else { const bs = wave(3) * 0.15; g.save(); g.translate(0, -72); g.rotate(bs); ell(0, 5, 5.5, 5.5); fill('#F5C431'); ink(2.2); L(1.6); g.beginPath(); g.moveTo(-3, 6); g.lineTo(3, 6); g.stroke(); g.restore(); }
    if(o.paw){   // reaching out to bat at something
      const p = o.paw; L(11); g.beginPath(); g.moveTo(f * 14, -52); g.quadraticCurveTo(f * (24 + p * 20), -66 - p * 10, f * (20 + p * 46), -58 - p * 6); g.stroke(); L(7, o.main); g.stroke();
      ell(f * (20 + p * 46), -58 - p * 6, 7, 6); fill(o.belly); ink(2.6); }
    g.restore(); T = T0;
  }
  C.CP05 = { name:"Karla's Cats", rarity:'Collector', mood:'Cute and attentive', draw(f, walk){
    shadow(52);
    // playful: the ginger cat behind keeps batting at the sushi charm swinging from the black-and-white cat's collar
    const cyc = (T % 2.6) / 2.6, swipe = !walk && cyc < .28 ? Math.sin(cyc / .28 * Math.PI) : 0;
    const k = cyc > .14 ? Math.max(0, 1 - (cyc - .14) / .6) : 0, charm = wave(3.2) * 0.12 + Math.sin((cyc - .14) * 22) * 0.45 * k * (cyc > .14 ? 1 : 0);
    g.save(); g.translate(-f * 30, -6); g.scale(.74, .74);
    kitty({ main:'#F2A65A', shade:'#D4813A', belly:'#FCE3C6', stripe:'#C46A2A', iris:'#3DBE6E', collar:'#E2483D', ph:1.7, tail:4, hop:true }, f, walk); g.restore();
    g.save(); g.translate(f * 18, 0); g.scale(.9, .9);
    kitty({ main:'#30303A', shade:'#1C1C24', belly:'#F7F7F2', muzzle:'#F7F7F2', iris:'#F5C431', whisk:'#E8E8E8', collar:'#2EC4C0', charm, ph:0, tail:3.4, hop:true, blep:(T % 5) > 3.6 }, f, walk); g.restore();
    // the ginger paw comes out in front for the swipe
    if(swipe > 0){ g.save(); g.translate(-f * 30, -6); g.scale(.74, .74); g.translate(0, 0);
      const p = swipe; L(11); g.beginPath(); g.moveTo(f * 16, -54); g.quadraticCurveTo(f * (30 + p * 20), -70 - p * 8, f * (24 + p * 44), -62 - p * 4); g.stroke(); L(7, '#F2A65A'); g.stroke();
      ell(f * (24 + p * 44), -62 - p * 4, 7.5, 6.5); fill('#FCE3C6'); ink(2.6); L(1.4); g.beginPath(); for(const q of [-2.5, 0, 2.5]){ g.moveTo(f * (24 + p * 44) + f * 5, -62 - p * 4 + q); g.lineTo(f * (24 + p * 44) + f * 7.5, -62 - p * 4 + q); } g.stroke(); g.restore(); }
  } };

  /* ---------- CP20 Eev's Baker's Hat (Rare): relieved ---------- */
  C.CP20 = { name:"Eev's Baker's Hat", rarity:'Rare', mood:'Relieved', draw(f, walk){
    shadow(30); legs([-12, 12], -26, '#7E52C4', { walk, col:'#5B3E99' });
    const sp = (T % 5) / 5, sg = sp > .68 && sp < .92 ? Math.sin((sp - .68) / .24 * Math.PI) : 0;
    g.save(); g.translate(0, (walk ? -Math.abs(wave(11)) * 2.5 : 0) + sg * 3);
    // one whole chef's hat: the puffy top and the pleated band
    const hat = new Path2D('M-30 -27 L-30 -76 C-47 -82 -51 -114 -31 -120 C-32 -144 -4 -154 4 -137 C14 -154 47 -144 39 -120 C55 -112 49 -82 30 -76 L30 -27 Q30 -22 25 -22 L-25 -22 Q-30 -22 -30 -27 Z');
    tone(hat, '#DDF0FF', '#A9D2F2', 7);
    g.save(); g.clip(hat);
    g.fillStyle = '#A97FE8'; g.fillRect(-34, -33, 68, 12);                       // purple trim at the bottom
    L(2.6, '#8157C9'); g.beginPath(); for(const x of [-22, -11, 0, 11, 22]){ g.moveTo(x, -78); g.lineTo(x, -68); } g.stroke();   // pleats
    g.restore();
    L(3.4); g.beginPath(); g.moveTo(-31, -78); g.quadraticCurveTo(0, -72, 31, -78); g.stroke();   // where the puff meets the band
    L(2.4, 'rgba(129,87,201,.55)'); g.beginPath(); g.moveTo(-13, -84); g.quadraticCurveTo(-20, -106, -12, -126); g.moveTo(11, -84); g.quadraticCurveTo(17, -106, 12, -130); g.stroke();
    L(4); g.stroke(hat);
    // relieved: eyes softly shut, brows lifted in the middle, a "phew" now and then
    for(const d of [-1, 1]){ L(3.6); g.beginPath(); g.moveTo(d * 12 - 8.5, -62); g.quadraticCurveTo(d * 12, -54, d * 12 + 8.5, -62); g.stroke(); brow(d * 12, -71 - sg * 2, d * 0.3, 13, 4.2); }
    cheeks(0, -52, 20, .55);
    if(sg > .35) oMouth(0, -46, 4.4, 4); else smile(0, -48, 8, 4.5, false);
    if(sg > 0){ g.fillStyle = `rgba(255,255,255,${sg * .85})`; [[0, 5], [1, 4], [2, 3]].forEach(([k, r]) => { ell(f * (10 + sg * 12 + k * 7), -52 - k * 4 - sg * 4, r + sg * 2, r * .8 + sg * 1.5); g.fill(); }); }
    const dp = (T % 5) / 5; if(dp < .6){ const a = 1 - dp / .6; g.fillStyle = `rgba(127,208,255,${a})`; ell(-f * 25, -70 + dp * 26, 2.8, 3.8); g.fill(); L(1.4, `rgba(74,44,34,${a})`); g.stroke(); }
    // the mixing bowl in front: one hand holds it, the other stirs with a wooden spoon
    const bx = f * 22, by = -16, sa = T * 5, tx = bx + Math.cos(sa) * 8, ty = by - 7 + Math.sin(sa) * 1.6;
    ell(bx, by - 8, 18, 5.5); fill('#F7E1A8'); ink(2.6);
    L(6.5); g.beginPath(); g.moveTo(tx + f * 16, ty - 26); g.lineTo(tx, ty); g.stroke(); L(3.6, '#C8924F'); g.stroke(); ell(tx, ty, 4.2, 3); fill('#C8924F'); ink(1.8);
    const bowl = new Path2D(`M${bx - 19} ${by - 8} Q${bx - 18} ${by + 13} ${bx} ${by + 13} Q${bx + 18} ${by + 13} ${bx + 19} ${by - 8} Z`);
    g.fillStyle = '#F4F7FB'; g.fill(bowl); g.save(); g.clip(bowl); g.fillStyle = '#A97FE8'; g.fillRect(bx - 22, by - 1, 44, 4); g.restore(); L(3); g.stroke(bowl);
    arm(-f * 30, -38, -f * 18, -8, bx - f * 12, by + 10);           // holding the bowl from underneath
    arm(f * 30, -44, f * 48, -50, tx + f * 16, ty - 26);              // stirring
    g.restore(); } };

  /* ---------- CP21 Tendeye's Gaming Keyboard (Collector): determined, RGB keys, gaming headset ---------- */
  C.CP21 = { name:"Tendeye's Gaming Keyboard", rarity:'Collector', mood:'Determined', draw(f, walk){
    shadow(46); legs([-20, 20], -34, '#3B4250', { walk, col:'#3B4250' });
    const hue = T * 140;
    g.fillStyle = `hsla(${hue % 360},95%,60%,.4)`; ell(0, -30, 50, 6); g.fill();
    g.save(); g.translate(0, walk ? -Math.abs(wave(11)) * 2.5 : Math.sin(T * 2) * 0.8);
    const pump = (T % 3) < .5 ? Math.sin((T % 3) / .5 * Math.PI) : 0;
    if(walk) swingArms(46, -64, 20); else for(const d of [-1, 1]){ const pu = d === f ? pump : 0; arm(d * 46, -66, d * 56, -56 - pu * 14, d * 52, -44 - pu * 26); ell(d * 52, -44 - pu * 26, 5.5, 5.5); fill(INK); }
    const body = new Path2D(); body.roundRect(-48, -120, 96, 84, 10); tone(body, '#4A5263', '#2E3440', 5);
    // every key runs through the rainbow
    for(let r = 0; r < 4; r++) for(let c = 0; c < 9; c++){
      if(r === 3 && c > 2 && c <= 6) continue;
      const kx = -42 + c * 9.4, ky = -79 + r * 9.6, kw = r === 3 && c === 2 ? 9.4 * 5 - 2 : 7.4;
      rr(kx, ky, kw, 7.4, 1.8); g.fillStyle = `hsl(${(hue + c * 28 + r * 18) % 360},92%,62%)`; g.fill(); L(1.2, '#141820'); g.stroke(); }
    // determined: narrowed eyes, brows down, teeth gritted
    const bl = blinkAt(3.6, .4);
    for(const d of [-1, 1]){ eye(d * 13, -102, { side:d, rx:7.6, ry:8.4, lid:.38, slant:3.4, blink:bl, look:[f * 1.2, 1.5], prx:3.6, pry:4.2, lidCol:'#4A5263' }); brow(d * 13, -113, -d * 0.42, 13, 4.2); }
    rr(-8, -91, 16, 6, 2); fill('#fff'); ink(2); L(1.3); g.beginPath(); g.moveTo(-8, -88); g.lineTo(8, -88); for(const x of [-3, 3]){ g.moveTo(x, -91); g.lineTo(x, -85); } g.stroke();
    // the gaming headset
    L(9); g.beginPath(); g.moveTo(-50, -104); g.quadraticCurveTo(-52, -152, 0, -152); g.quadraticCurveTo(52, -152, 50, -104); g.stroke(); L(4.5, '#2A2E37'); g.stroke();
    for(const d of [-1, 1]){ ell(d * 52, -102, 9, 15); fill('#23272F'); ink(3); L(2.6, `hsl(${(hue + d * 90 + 360) % 360},95%,62%)`); ell(d * 52, -102, 5.5, 10); g.stroke(); }
    L(5); g.beginPath(); g.moveTo(f * 54, -92); g.quadraticCurveTo(f * 46, -78, f * 17, -82); g.stroke(); L(2.4, '#23272F'); g.stroke(); ell(f * 16, -82, 4, 3.4); fill('#23272F'); ink(2);
    g.restore(); } };

  /* ---------- CP22 Hepzee's Hockey Stick (Rare): angry, maroon on the pink side ---------- */
  C.CP22 = { name:"Hepzee's Hockey Stick", rarity:'Rare', mood:'Angry', draw(f, walk){
    const sp = (T % 2.4) / 2.4, stomp = !walk && sp > .8 ? Math.sin((sp - .8) / .2 * Math.PI) : 0;
    shadow(34);
    if(!walk && sp < .1){ L(2, 'rgba(255,255,255,.7)'); g.beginPath(); for(const d of [-1, 1]){ g.moveTo(d * 24, -4); g.lineTo(d * 38, -10); g.moveTo(d * 26, 0); g.lineTo(d * 40, 0); } g.stroke(); }
    g.save(); g.scale(f, 1);
    // little legs: one stomps
    legs([-6, 20], -36, '#962F52', { walk, col:'#7A2443', tap:stomp * .5 });
    g.save(); g.translate(walk ? 0 : Math.sin(T * 38) * 0.8, walk ? -Math.abs(wave(11)) * 2.5 : -stomp * 3);
    const sm = (T % 1.6) / 1.6; if(sm < .5){ const q = sm / .5; g.fillStyle = `rgba(255,255,255,${(1 - q) * .85})`; for(const d of [-1, 1]){ ell(d * (8 + q * 6), -156 - q * 22, 4 + q * 5, 4 + q * 5); g.fill(); } }
    // a field hockey stick: black grip, a slim maroon-pink shaft, a black band, and a curled wooden hook
    const st = new Path2D('M-17 -158 L17 -158 L17 -70 Q17 -54 30 -54 Q39 -54 40 -62 Q41 -73 51 -73 Q61 -73 61 -60 Q61 -34 30 -34 Q-17 -34 -17 -62 Z');
    tone(st, '#C2476E', '#962F52', 6);
    g.save(); g.clip(st);
    g.fillStyle = '#C88A4E'; g.fillRect(-24, -64, 100, 36); g.fillRect(24, -80, 50, 20); g.fillStyle = '#A86A34'; g.fillRect(-24, -42, 100, 12);
    L(1.4, 'rgba(110,60,20,.55)'); g.beginPath(); for(const k of [0, 1, 2, 3]){ g.moveTo(-17, -60 + k * 6); g.quadraticCurveTo(24, -50 + k * 4, 44 + k * 3, -68 + k * 8); } g.stroke();
    g.fillStyle = '#1E2124'; g.fillRect(-24, -71, 48, 7);
    g.fillStyle = '#1E2124'; g.fillRect(-24, -162, 48, 22); L(1.6, '#3E434C'); g.beginPath(); for(let y = -158; y < -140; y += 5){ g.moveTo(-24, y + 6); g.lineTo(24, y); } g.stroke();
    g.fillStyle = 'rgba(255,255,255,.45)'; for(let i = 0; i < 14; i++){ ell(-10 + (i % 4) * 3.4 + (i % 2) * 1.7, -84 + Math.floor(i / 4) * 3.4, .9, .9); g.fill(); }
    L(1.8, 'rgba(255,255,255,.5)'); g.beginPath(); g.moveTo(-13, -88); g.lineTo(-13, -76); g.stroke();
    g.restore(); L(4); g.stroke(st);
    L(2.6, 'rgba(255,255,255,.7)'); g.beginPath(); g.moveTo(11, -96); g.lineTo(9, -80); g.moveTo(14, -98); g.lineTo(12, -82); g.stroke();
    // angry: brows slammed down, red in the face, teeth gritted
    g.fillStyle = `rgba(255,40,40,${.1 + Math.abs(Math.sin(T * 3)) * .12})`; ell(0, -110, 15, 20); g.fill();
    const bl = blinkAt(3.4, .6);
    for(const d of [-1, 1]){ eye(d * 8.6, -118, { side:d, rx:7, ry:8.6, lid:.42, slant:4, blink:bl, look:[2.2, 2.4], prx:3.8, pry:4.6, lidCol:'#C2476E' }); brow(d * 8.6, -131, -d * 0.45, 12, 4.4); }
    const my = -100, mw = 10.5; rr(-mw, my - 4, mw * 2, 9, 3); fill('#fff'); ink(2.6); L(1.6); g.beginPath(); g.moveTo(-mw, my + .5); g.lineTo(mw, my + .5); for(const x of [-5.5, 0, 5.5]){ g.moveTo(x, my - 4); g.lineTo(x, my + 5); } g.stroke();
    if(walk) swingArms(18, -96); else { arm(-18, -96, -30, -84, -28, -72); const sh = Math.sin(T * 20) * 3; arm(18, -98, 32, -108, 30 + sh * .3, -122 + sh); ell(30 + sh * .3, -122 + sh, 5.5, 5.5); fill(INK); }
    g.restore(); g.restore(); } };

  /* ---------- CP23 Nirika's Queen (Rare): powerful, white with a yellow tinge ---------- */
  C.CP23 = { name:"Nirika's Queen", rarity:'Rare', mood:'Powerful', draw(f, walk){
    g.save(); g.scale(.88, .88);
    const pp = (T % 4) / 4, M = '#FFEFB8', S = '#E8C873';
    const gl = .5 + Math.sin(T * 2.4) * .2, gr = g.createRadialGradient(0, -110, 6, 0, -110, 85); gr.addColorStop(0, `rgba(255,222,110,${.6 * gl})`); gr.addColorStop(1, 'rgba(255,222,110,0)'); g.fillStyle = gr; g.fillRect(-95, -200, 190, 196);
    if(pp < .35){ const r = 20 + pp / .35 * 70; L(3, `rgba(255,210,80,${1 - pp / .35})`); ell(0, -162, r, r * .45); g.stroke(); }
    shadow(30); legs([-13, 13], -26, '#C9A24A', { walk, col:'#B08A3A' });
    g.save(); g.translate(0, (walk ? -Math.abs(wave(11)) * 3 : wave(2) * .6) - 22);
    const body = new Path2D('M-36 -2 L36 -2 Q38 -16 27 -19 L27 -24 Q31 -30 22 -32 C18 -62 18 -88 18 -104 L-18 -104 C-18 -88 -18 -62 -22 -32 Q-31 -30 -27 -24 L-27 -19 Q-38 -16 -36 -2 Z');
    tone(body, M, S, 6);
    L(2.4); g.beginPath(); g.moveTo(-27, -19); g.lineTo(27, -19); g.moveTo(-26, -25); g.lineTo(26, -25); g.stroke();
    L(2.6, 'rgba(255,255,255,.8)'); g.beginPath(); g.moveTo(10, -60); g.lineTo(7, -46); g.moveTo(14, -62); g.lineTo(11, -48); g.stroke();
    const crown = new Path2D('M-20 -108 L-28 -136 L-13 -122 L0 -142 L13 -122 L28 -136 L20 -108 Z'); tone(crown, M, S, 4, 3.4);
    for(const [x, y] of [[-28, -136], [0, -142], [28, -136]]){ ell(x, y - 3, 4.4, 4.4); fill('#FFD84A'); ink(2.2); }
    ell(0, -152, 6.5, 6.5); fill(M); ink(3);
    const col = new Path2D(); col.ellipse(0, -106, 24, 6, 0, 0, Math.PI * 2); tone(col, M, S, 2, 3.2);
    // powerful: steady eyes, one brow up, a knowing smile
    const bl = blinkAt(4.2, .9);
    for(const d of [-1, 1]) eye(d * 9.5, -80, { side:d, rx:7.4, ry:9, lid:.32, slant:1.6, blink:bl, look:[f * 1.6, 2], prx:3.8, pry:4.6, iris:'#E0A800', lidCol:M });
    brow(-9.5, -93, 0.22, 12, 4.2); brow(9.5, -96, -0.14, 12, 4.2);
    smile(1, -64, 8, 3.5, false); L(2.4); g.beginPath(); g.moveTo(9, -64.5); g.lineTo(11, -67); g.stroke();
    if(walk) swingArms(20, -72); else { arm(-20, -72, -36, -62, -24, -46); const up = pp < .35 ? 1 : .6 + Math.sin(T * 2) * .1; arm(20, -74, 33, -84, 31, -96 - up * 14); ell(31, -96 - up * 14, 5.5, 5.5); fill(INK); twinkle(38, -117 - up * 10, 6 + Math.sin(T * 6) * 2, '#FFE27A'); }
    g.restore(); g.restore(); } };

  /* ---------- CP24 Locklan's Guitar (Legendary): a cool orange rock guitar ---------- */
  C.CP24 = { name:"Locklan's Guitar", rarity:'Legendary', mood:'Cool', draw(f, walk){
    g.save(); g.scale(.86, .86);
    shadow(34); legs([-12, 12], -24, '#2B2F3A', { walk, col:'#2B2F3A', shoe:'sneaker' });
    const rock = walk ? 0 : Math.sin(T * 6) * 0.05, bob = walk ? -Math.abs(wave(11)) * 2.5 : -Math.abs(Math.sin(T * 6)) * 2;
    for(let i = 0; i < 3; i++){ const p = (T * .45 + i / 3) % 1; note(-f * (22 + p * 30) + Math.sin(p * 9 + i) * 5, -110 - p * 50, 1 - p, i % 2 ? '#FFB13D' : '#fff'); }
    g.save(); g.translate(0, bob); g.translate(0, -60); g.rotate(rock); g.translate(0, 60);
    rr(-6, -152, 12, 86, 3); fill('#6B3E1E'); ink(3); L(1.4, '#D9C7A0'); g.beginPath(); for(let y = -146; y < -76; y += 9){ g.moveTo(-5, y); g.lineTo(5, y); } g.stroke();
    const hd = new Path2D('M-7 -150 L-12 -168 L6 -178 L14 -170 L7 -150 Z'); tone(hd, '#FF7A1A', '#D95A00', 3, 3.2);
    for(const y of [-166, -159]){ ell(-14, y, 3, 2.4); fill('#C9D2DB'); ink(1.6); }
    const body = new Path2D('M0 -24 C-30 -24 -42 -38 -38 -54 C-36 -64 -46 -74 -40 -86 C-34 -94 -22 -84 -12 -78 L12 -78 C22 -88 36 -98 42 -88 C46 -78 36 -66 38 -54 C42 -36 30 -24 0 -24 Z');
    tone(body, '#FF7A1A', '#D95A00', 7);
    const pg = new Path2D('M10 -32 C26 -32 34 -42 32 -54 C30 -62 20 -60 16 -50 C12 -42 6 -38 10 -32 Z'); g.fillStyle = '#1E2124'; g.fill(pg); L(2); g.stroke(pg);
    for(const y of [-50, -41]){ rr(-11, y, 22, 6, 2); fill('#1E2124'); ink(1.8); }
    rr(-9, -33, 18, 4, 1.5); fill('#C9D2DB'); ink(1.6);
    for(const [x, y] of [[-26, -36], [-20, -30]]){ ell(x, y, 3.2, 3.2); fill('#F5C431'); ink(1.6); }
    const strum = walk ? 0 : Math.max(0, Math.sin(T * 6)); L(1, '#F4F4F4'); g.beginPath(); for(const x of [-3, -1, 1, 3]){ g.moveTo(x, -31); g.quadraticCurveTo(x + Math.sin(T * 60 + x) * strum * 1.6, -90, x * .8, -150); } g.stroke();
    // face: shades on, one brow up, a cool half-smile
    for(const d of [-1, 1]){ rr(d * 13 - 10, -75, 20, 11, 4); fill('#1E2433'); ink(2.4); g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(d * 13 - 7, -73, 5, 2.2); }
    L(2.6); g.beginPath(); g.moveTo(-3, -71); g.lineTo(3, -71); g.stroke();
    brow(-13, -80, 0.08, 12, 3.6); brow(13, -82.5, -0.2, 12, 3.6);
    L(3); g.beginPath(); g.moveTo(-8, -60); g.quadraticCurveTo(0, -57, 9, -63); g.stroke();
    if(walk) swingArms(38, -56, 20); else { const sy = -40 + Math.sin(T * 12) * 6 * (strum > .1 ? 1 : .2); arm(f * 38, -58, f * 30, -40, f * 8, sy); arm(-f * 40, -66, -f * 30, -98, -f * 6, -114); }
    g.restore(); g.restore(); } };

  /* ---------- CP25 Divyeah's Dance Shoes (Rare): pretty and sassy, turquoise and maroon ---------- */
  function heelShoe(o){   // drawn facing +x, standing on its own little legs
    legs([-36, 22], -22, '#7A1F3D', { walk:o.walk, col:'#5E1730', tap:o.tap || 0 });
    g.save(); g.translate(0, (o.walk ? -Math.abs(wave(9)) * 2 : 0) - 20);
    const s = new Path2D('M-42 -36 L-42 -72 Q-42 -82 -32 -80 Q-12 -64 10 -46 Q30 -36 42 -30 Q54 -22 50 -8 Q48 0 36 0 L-2 0 Q-22 -2 -32 -30 Z');
    rr(-45, -38, 11, 38, 3); fill('#7A1F3D'); ink(3);
    tone(s, '#34CFCB', '#1F9E9A', 6);
    L(5, '#7A1F3D'); g.beginPath(); g.moveTo(-31, -77); g.quadraticCurveTo(-12, -61, 9, -45); g.stroke();
    L(3.6, '#7A1F3D'); g.beginPath(); g.moveTo(-40, -68); g.quadraticCurveTo(-20, -90, 4, -68); g.stroke();
    L(3, '#7A1F3D'); g.beginPath(); g.moveTo(-2, -1.5); g.lineTo(38, -1.5); g.stroke();
    g.save(); g.translate(32, -30); g.fillStyle = '#7A1F3D'; g.beginPath(); g.moveTo(0, 0); g.lineTo(-7, -5); g.lineTo(-7, 5); g.closePath(); g.moveTo(0, 0); g.lineTo(7, -5); g.lineTo(7, 5); g.closePath(); g.fill(); L(1.6); g.stroke(); ell(0, 0, 2.4, 2.4); fill('#7A1F3D'); ink(1.4); g.restore();
    L(2.4, 'rgba(255,255,255,.75)'); g.beginPath(); g.moveTo(-36, -60); g.lineTo(-38, -46); g.stroke();
    // a big face on the side of the shoe, with lashes
    const bl = blinkAt(3.4, .7), wk = o.wink && (T % 3) < .4 ? 1 : 0;
    for(const [d, x, y] of [[-1, -17, -32], [1, 1, -29]]){
      eye(x, y, { side:d, rx:6.8, ry:8.2, lid:o.sass ? .4 : .12, blink:o.wink ? (d === 1 ? wk : 0) : bl, look:[2, 1.5], prx:3.6, pry:4.2, lidCol:'#34CFCB', w:2.6 });
      lashes(x, y, 6.8, 8.2, d);
    }
    cheeks(-8, -17, 13, .55);
    if(o.sass){ brow(-17, -44, 0.12, 10, 3.6); brow(1, -43, -0.42, 10, 3.6); L(2.8); g.beginPath(); g.moveTo(-12, -14); g.quadraticCurveTo(-4, -11, 3, -17); g.stroke(); }
    else { brow(-17, -44, -0.1, 10, 3.6); brow(1, -41, 0.1, 10, 3.6); smile(-6, -15, 6, 3.5, false); }
    // arms: the sassy one has a hand on its hip and waves a finger; the other blows a kiss
    if(o.walk) swingArms(30, -30, 18);
    else if(o.sass){ arm(-40, -40, -54, -30, -40, -22); const w = Math.sin(T * 8) * .25; g.save(); g.translate(26, -36); g.rotate(w); arm(0, 0, 16, -4, 18, -22); L(2.6); g.beginPath(); g.moveTo(18, -22); g.lineTo(18, -30); g.stroke(); g.restore(); }
    else { arm(-40, -44, -52, -36, -50, -26); const k = (T % 3) / 3; arm(20, -34, 30, -40, 24 + Math.sin(k * Math.PI) * 4, -46); if(k > .4 && k < .9) heart(34 + (k - .4) * 40, -56 - (k - .4) * 30, 6, `rgba(255,110,150,${1 - (k - .4) * 2})`); }
    g.restore();
  }
  C.CP25 = { name:"Divyeah's Dance Shoes", rarity:'Rare', mood:'Pretty and sassy', draw(f, walk){
    g.save(); g.scale(.92, .92); shadow(70);
    const tap = (T % 1.6) / 1.6, tp = !walk && tap < .3 ? Math.sin(tap / .3 * Math.PI) : 0;
    g.save(); g.scale(f, 1);
    g.save(); g.translate(-48, 0); g.scale(.82, .82); heelShoe({ sass:true, walk, tap:tp * .4 }); g.restore();   // toe to toe, chatting
    g.save(); g.translate(48, 0); g.scale(-.82, .82); heelShoe({ wink:true, walk }); g.restore();
    for(let i = 0; i < 3; i++){ const p = (T * .6 + i / 3) % 1, a = Math.sin(p * Math.PI); if(a > .2) twinkle(-50 + i * 50, -96 - p * 18 + i * 6, 3 + a * 3.5, '#FFF3B0'); }
    g.restore(); g.restore(); } };

  /* ---------- CP26 Gorje's Movie Reel (Legendary): munching popcorn ---------- */
  C.CP26 = { name:"Gorje's Movie Reel", rarity:'Legendary', mood:'Happy, munching popcorn', draw(f, walk){
    shadow(40);
    L(12); g.beginPath(); g.moveTo(-f * 22, -42); g.bezierCurveTo(-f * 46, -30, -f * 40, -5, -f * 68, -5); g.stroke(); L(8, '#3A3F4A'); g.stroke();
    L(2, '#E9EEF2'); g.setLineDash([2, 4]); g.beginPath(); g.moveTo(-f * 22, -42); g.bezierCurveTo(-f * 46, -30, -f * 40, -5, -f * 68, -5); g.stroke(); g.setLineDash([]);
    legs([-12, 12], -30, '#5B6773', { walk, col:'#5B6773' });
    const ep = (T % 2.6) / 2.6;
    g.save(); g.translate(0, walk ? -Math.abs(wave(11)) * 2.5 : 0);
    const rim = new Path2D(); rim.ellipse(0, -76, 46, 46, 0, 0, Math.PI * 2); tone(rim, '#CDD6DF', '#98A4B0', 6);
    L(2, 'rgba(74,44,34,.35)'); ell(0, -76, 40, 40); g.stroke();
    for(const [x, y] of [[-24, -100], [24, -100], [-25, -51], [25, -51]]){ ell(x, y, 7.5, 7.5); fill('#2B3240'); ink(2.6); }
    const chew = ep > .5 && ep < .92, bl = blinkAt(3.6, .5);
    for(const d of [-1, 1]) eye(d * 11, -82, { side:d, rx:7.4, ry:9, blink:bl, lower:chew ? .35 : .1, look:[f * 1.2, ep > .3 && ep < .5 ? 3 : 1.5], lidCol:'#CDD6DF' });
    cheeks(0, -66, 20, .55);
    if(chew){ const o = (Math.sin(T * 18) + 1) / 2; ell(0, -60, 7, 1.5 + o * 3); fill('#7A1F2B'); ink(2.6); ell(f * 12, -63, 5, 4); fill('#CDD6DF'); ink(2);
      for(let i = 0; i < 2; i++){ const p = (T * 2 + i * .5) % 1; g.fillStyle = `rgba(255,243,196,${1 - p})`; ell(f * (4 + i * 4), -54 + p * 24, 1.8, 1.8); g.fill(); } }
    else if(ep > .3) oMouth(0, -60, 6, 5.5); else smile(0, -62, 9, 5, true, true);
    // the popcorn tub
    const tx = f * 50, ty = -46;
    for(const [dx, dy, r] of [[-9, -22, 6], [0, -25, 6.5], [9, -22, 6], [-5, -28, 5.5], [5, -29, 5.5], [0, -33, 5]]){ ell(tx + dx, ty + dy, r, r * .9); fill('#FFF3C4'); ink(1.8); }
    const tub = new Path2D(`M${tx - 15} ${ty - 20} L${tx + 15} ${ty - 20} L${tx + 11} ${ty + 10} L${tx - 11} ${ty + 10} Z`);
    g.fillStyle = '#fff'; g.fill(tub); g.save(); g.clip(tub); g.fillStyle = '#E2483D'; for(const k of [-10, 0, 10]) g.fillRect(tx + k - 2.5, ty - 22, 5, 34); g.restore(); L(3); g.stroke(tub);
    arm(f * 40, -58, f * 40, -44, tx - f * 8, ty + 8);
    // the other hand: into the tub, up to the mouth, back again
    let hx, hy; const top = [tx, ty - 30], mouth = [f * 6, -60], rest = [f * 58, -94];
    if(ep < .3){ const k = ep / .3; hx = rest[0] + (top[0] - rest[0]) * k; hy = rest[1] + (top[1] - rest[1]) * k; }
    else if(ep < .48){ const k = (ep - .3) / .18; hx = top[0] + (mouth[0] - top[0]) * k; hy = top[1] + (mouth[1] - top[1]) * k - Math.sin(k * Math.PI) * 16; }
    else { const k = Math.min(1, (ep - .48) / .4); hx = mouth[0] + (rest[0] - mouth[0]) * k; hy = mouth[1] + (rest[1] - mouth[1]) * k; }
    arm(f * 34, -106, f * 62, -114, hx, hy);
    if(ep > .26 && ep < .48){ ell(hx, hy - 4, 4.5, 4); fill('#FFF3C4'); ink(1.6); }
    g.restore(); } };

  /* ---------- CP27 Sara's Book (Rare): happy and cute, flicking through its pages ---------- */
  C.CP27 = { name:"Sara's Book", rarity:'Rare', mood:'Happy and cute', draw(f, walk){
    const bp = (T % 1.1) / 1.1, b = walk ? Math.abs(wave(11)) * 3 : Math.abs(Math.sin(bp * Math.PI)) * 3;
    shadow(36); legs([-14, 14], -36, '#E06A92', { walk, col:'#B8456E' });
    g.save(); g.translate(0, -b);
    for(let i = 0; i < 2; i++){ const p = (T * .4 + i * .5) % 1; heart(-f * (46 + p * 8) + Math.sin(p * 8) * 4, -136 - p * 26, 6 + p * 3, `rgba(255,110,150,${1 - p})`); }
    // the open book: pink cover behind, two pages, a ribbon
    const cv = new Path2D(); cv.roundRect(-54, -134, 108, 98, 9); tone(cv, '#FF9EC0', '#E06A92', 6);
    g.save(); g.translate(f * 24, -134); g.rotate(Math.sin(T * 2) * .12); star(8, '#F5C431'); L(1.8); g.stroke(); g.restore();
    const pg = d => new Path2D(`M0 -124 Q${d * 24} -132 ${d * 48} -126 L${d * 48} -44 Q${d * 24} -50 0 -42 Z`);
    for(const d of [-1, 1]){ const p = pg(d); g.fillStyle = '#FFF8EE'; g.fill(p); L(3); g.stroke(p);
      L(1.6, 'rgba(74,44,34,.28)'); g.beginPath(); for(let y = -80; y < -54; y += 6){ g.moveTo(d * 8, y); g.lineTo(d * 40, y - 1); } g.stroke(); }
    L(3); g.beginPath(); g.moveTo(0, -124); g.lineTo(0, -42); g.stroke();
    const sw = Math.sin(T * 3) * 3; L(5); g.beginPath(); g.moveTo(4, -42); g.quadraticCurveTo(5 + sw, -32, 3 + sw, -24); g.stroke(); L(3, '#7E52C4'); g.stroke();
    // flicking through: three pages flip over quickly, then a pause
    const fc = (T % 3) / 3;
    if(fc < .45){ const n = fc / .15, p = n % 1, dir = f > 0 ? 1 : -1, X = 48 * Math.cos(Math.PI * p) * dir, lift = Math.sin(Math.PI * p) * 10;
      const fp = new Path2D(`M0 -124 Q${X / 2} ${-132 - lift} ${X} ${-126 - lift} L${X} ${-44 - lift * .6} Q${X / 2} ${-50 - lift * .6} 0 -42 Z`);
      g.fillStyle = Math.cos(Math.PI * p) > 0 ? '#FFF8EE' : '#F3E6CF'; g.fill(fp); L(2.6); g.stroke(fp);
      L(2, 'rgba(255,255,255,.7)'); g.beginPath(); g.moveTo(X * 1.1, -110 - lift); g.lineTo(X * 1.25, -104 - lift); g.stroke(); }
    // a happy little face over the pages
    const bl = blinkAt(3.2, .3), reading = fc < .45;
    for(const d of [-1, 1]) eye(d * 21, -101, { side:d, rx:8.6, ry:10.5, blink:bl, look:reading ? [-(f > 0 ? 1 : -1) * 3 * Math.cos(Math.PI * ((fc / .15) % 1)), 1.5] : [f * 1, 2], prx:5.2, pry:6.2, star:true, shine2:true, lidCol:'#FFF8EE' });
    cheeks(0, -86, 23, .6); smile(0, -84, 8, 5, true, true);
    // hands holding the covers open
    if(walk) swingArms(54, -80, 18); else for(const d of [-1, 1]){ arm(d * 54, -86, d * 66, -74, d * 56, -62); }
    g.restore(); } };

  /* ---------- CP28 Noargh's Basketball Boots (Legendary): dribbling, on little legs ---------- */
  function hiTop(o){   // drawn facing +x, standing on its own little legs
    legs([-18, 32], -22, '#2B3240', { walk:o.walk, col:'#2B3240' });
    g.save(); g.translate(0, -20 + (o.walk ? -Math.abs(wave(10)) * 2 : 0));
    const s = new Path2D('M-30 -98 L8 -98 Q10 -74 16 -58 Q42 -50 52 -32 Q58 -20 52 -12 L-34 -12 Q-38 -44 -30 -98 Z');
    tone(s, '#F4F6F8', '#CDD5DE', 6);
    g.save(); g.clip(s); g.fillStyle = '#2F6BFF'; g.fillRect(-40, -104, 52, 14); g.fillRect(-40, -40, 12, 30); g.restore(); L(4); g.stroke(s);
    L(2.2); g.beginPath(); for(let i = 0; i < 4; i++){ const y = -86 + i * 7.5, x = 10 + i * 1.8; g.moveTo(x - 4, y); g.lineTo(x + 4, y + 4); g.moveTo(x + 4, y); g.lineTo(x - 4, y + 4); } g.stroke();
    g.beginPath(); g.moveTo(36, -46); g.lineTo(23, -29); g.lineTo(31, -29); g.lineTo(25, -16); g.lineTo(42, -34); g.lineTo(33, -34); g.lineTo(40, -46); g.closePath(); fill('#F5C431'); ink(2);
    rr(-38, -14, 94, 14, 6); fill('#E9EEF2'); ink(3); L(2, '#2F6BFF'); g.beginPath(); g.moveTo(-32, -7); g.lineTo(50, -7); g.stroke();
    L(2.6, 'rgba(255,255,255,.9)'); g.beginPath(); g.moveTo(-26, -60); g.lineTo(-27, -46); g.stroke();
    const bl = blinkAt(o.face ? 4 : 4.6, o.face ? .2 : 1.1);
    for(const [d, x] of [[-1, -19], [1, -2]]) eye(x, -72, { side:d, rx:7.2, ry:8.8, lid:o.face ? .3 : .15, lower:o.face ? .1 : 0, blink:bl, look:o.look || [2.4, 2.4], prx:3.6, pry:4.4, lidCol:'#F4F6F8' });
    if(o.face){ brow(-19, -85, 0.05, 11, 3.8); brow(-2, -87, -0.2, 11, 3.8); L(3); g.beginPath(); g.moveTo(-18, -55); g.quadraticCurveTo(-10, -51, -1, -57); g.stroke(); }
    else { brow(-19, -85, -0.12, 11, 3.8); brow(-2, -85, 0.12, 11, 3.8); smile(-10, -56, 6, 3.5, true); }
    if(o.arms) o.arms();
    g.restore();
  }
  C.CP28 = { name:"Noargh's Basketball Boots", rarity:'Legendary', mood:'Smooth and confident', draw(f, walk){
    g.save(); g.scale(.86, .86); shadow(60);
    const dp = (T % .8) / .8, ballY = -12 - 72 * Math.abs(Math.cos(dp * Math.PI)), hy = Math.max(-104, Math.min(-82, ballY - 13)) + 20;
    g.save(); g.scale(f, 1);
    g.save(); g.translate(-40, -4); g.scale(.8, .8); hiTop({ walk, look:[3, 1], arms:() => { const w = Math.sin(T * 5) * .3; g.save(); g.translate(-30, -64); g.rotate(-w); arm(0, 0, -14, -6, -16, -22); g.restore(); } }); g.restore();
    g.save(); g.translate(2, 0); hiTop({ face:true, walk, arms:() => { arm(-32, -60, -44, -46, -38, -36); arm(12, -66, 44, -80, 66, hy); } }); g.restore();
    const sq = ballY > -14 ? .86 : 1;
    g.fillStyle = 'rgba(0,0,0,.18)'; ell(68, 0, 10 + ballY / 14, 2.6); g.fill();
    g.save(); g.translate(68, ballY); g.scale(1 / sq, sq);
    ell(0, 0, 12, 12); fill('#F28A2E'); L(1.8); g.beginPath(); g.moveTo(-12, 0); g.lineTo(12, 0); g.moveTo(0, -12); g.lineTo(0, 12); g.moveTo(-8, -9); g.quadraticCurveTo(-3, 0, -8, 9); g.moveTo(8, -9); g.quadraticCurveTo(3, 0, 8, 9); g.stroke(); ell(0, 0, 12, 12); ink(3);
    g.restore();
    g.restore(); g.restore(); } };

  /* ---------- CP29 Henree's Golf Driver (Rare): angry, orange with a black club face ---------- */
  C.CP29 = { name:"Henree's Golf Driver", rarity:'Rare', mood:'Angry', draw(f, walk){
    shadow(44); legs([-16, 14], -12, '#1E1E24', { walk, col:'#1E1E24' });
    const sh = walk ? 0 : Math.sin(T * 36);
    g.save(); g.translate(sh, walk ? -Math.abs(wave(11)) * 2.5 : 0); g.scale(f, 1);
    rr(-17, -114, 6, 60, 2); fill('#B8C2CC'); ink(2.4);
    const gp = new Path2D(); gp.roundRect(-21, -154, 14, 44, 5); g.fillStyle = '#1E1E24'; g.fill(gp);
    g.save(); g.clip(gp); g.fillStyle = '#FF7A1A'; for(let y = -150; y < -108; y += 10){ g.beginPath(); g.moveTo(-22, y); g.lineTo(-6, y - 5); g.lineTo(-6, y); g.lineTo(-22, y + 5); g.closePath(); g.fill(); } g.restore(); L(3); g.stroke(gp);
    puffs(14, -66, 2, .9);
    const hd = new Path2D('M-40 -36 C-42 -58 -10 -66 16 -60 C40 -54 50 -40 46 -24 C42 -10 22 -6 -6 -8 C-30 -10 -40 -20 -40 -36 Z');
    tone(hd, '#FF7A1A', '#D95A00', 7);
    g.save(); g.clip(hd); g.fillStyle = '#1E1E24'; g.beginPath(); g.moveTo(34, -62); g.quadraticCurveTo(28, -34, 32, -4); g.lineTo(60, -4); g.lineTo(60, -62); g.closePath(); g.fill();
    L(1.4, '#5B6773'); g.beginPath(); for(let y = -48; y < -12; y += 7){ g.moveTo(34, y); g.lineTo(50, y); } g.stroke(); g.restore(); L(4); g.stroke(hd);
    rr(-20, -64, 12, 12, 3); fill('#1E1E24'); ink(2.4);
    g.fillStyle = `rgba(255,40,40,${.1 + Math.abs(Math.sin(T * 3)) * .12})`; ell(-3, -34, 22, 16); g.fill();
    for(const [d, x] of [[-1, -12], [1, 6]]){ eye(x, -40, { side:d, rx:6.6, ry:7.6, lid:.38, slant:3.6, look:[1.6, 1.5], prx:3, pry:3.6, lidCol:'#FF7A1A', w:2.6 }); brow(x, -50, -d * 0.5, 11, 4.2); }
    rr(-12, -26, 18, 7, 2); fill('#fff'); ink(2); L(1.3); g.beginPath(); g.moveTo(-12, -22.5); g.lineTo(6, -22.5); for(const x of [-7.5, -3, 1.5]){ g.moveTo(x, -26); g.lineTo(x, -19); } g.stroke();
    if(walk) swingArms(40, -34, 18); else { arm(-40, -38, -52, -50, -50, -64); ell(-50, -64 + sh * 2, 5.5, 5.5); fill(INK); arm(44, -30, 56, -20, 52, -10); }
    g.restore(); } };

  /* ---------- CP30 Aron's MTB (Legendary): a mountain bike with legs that pedal, unphased ---------- */
  C.CP30 = { name:"Aron's MTB", rarity:'Legendary', mood:'Unphased', draw(f, walk){
    g.save(); g.scale(1.12, 1.12); shadow(62);
    g.save(); g.scale(f, 1);
    if(walk){ L(3, 'rgba(255,255,255,.6)'); g.beginPath(); for(const y of [-64, -44, -24]){ const o = (T * 120 + y * 3) % 30; g.moveTo(-66 - o, y); g.lineTo(-82 - o, y); } g.stroke(); }
    const spin = walk ? T * 14 : 0, BB = [-2, -32], RW = [-38, -24], FW = [42, -24], R = 22;
    // knobbly wheels
    for(const [x, y] of [RW, FW]){
      g.save(); g.translate(x, y); g.rotate(spin);
      ell(0, 0, R, R); fill('#23272F'); ink(3.4);
      g.fillStyle = INK; for(let k = 0; k < 16; k++){ const a = k * Math.PI / 8; g.save(); g.rotate(a); g.fillRect(-2, -R - 2.5, 4, 3.5); g.restore(); }
      ell(0, 0, R - 6, R - 6); fill('#3A3F4A'); L(2, '#C9D2DB'); ell(0, 0, R - 7, R - 7); g.stroke();
      L(1.2, '#C9D2DB'); g.beginPath(); for(let k = 0; k < 8; k++){ const a = k * Math.PI / 4; g.moveTo(0, 0); g.lineTo(Math.cos(a) * (R - 7), Math.sin(a) * (R - 7)); } g.stroke();
      ell(0, 0, 3.4, 3.4); fill('#C9D2DB'); ink(1.8); g.restore();
    }
    // the far leg (behind the frame)
    const pedal = a => [BB[0] + Math.cos(a) * 11, BB[1] + Math.sin(a) * 11];
    const legTo = (fx, fy, col) => { L(7); g.beginPath(); g.moveTo(BB[0], BB[1]); g.lineTo(fx, fy - 4); g.stroke(); L(3.4, col); g.stroke(); rr(fx - 9, fy - 8, 18, 9, 4.5); fill('#fff'); ink(2.6); };
    const a0 = T * 10, f1 = walk ? pedal(a0 + Math.PI) : [BB[0] - 9, 0], f2 = walk ? pedal(a0) : [BB[0] + 10, 0];
    legTo(f1[0], f1[1], '#1F48B8');
    // the frame: chunky tubes in electric blue, a suspension fork
    const tube = (x0, y0, x1, y1, w) => { L(w + 4); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); L(w, '#2F6BFF'); g.stroke(); };
    tube(RW[0], RW[1], BB[0], BB[1], 5); tube(RW[0], RW[1], -14, -72, 4.5);
    L(11); g.beginPath(); g.moveTo(36, -62); g.lineTo(FW[0], FW[1]); g.stroke(); L(7, '#C9D2DB'); g.stroke(); L(7, '#1E2124'); g.beginPath(); g.moveTo(36, -62); g.lineTo(38.5, -48); g.stroke();
    const fr = new Path2D('M-2 -36 L-16 -76 L-10 -80 L34 -80 L40 -60 Z'); tone(fr, '#2F6BFF', '#1F48B8', 4, 3.4);
    g.save(); g.clip(fr); g.fillStyle = '#1E2433'; g.beginPath(); g.moveTo(4, -46); g.lineTo(-8, -72); g.lineTo(26, -72); g.lineTo(31, -58); g.closePath(); g.fill(); g.restore();
    L(3.4); g.beginPath(); g.moveTo(4, -46); g.lineTo(-8, -72); g.lineTo(26, -72); g.lineTo(31, -58); g.closePath(); g.stroke();
    L(2.6, 'rgba(255,255,255,.7)'); g.beginPath(); g.moveTo(-6, -77); g.lineTo(28, -77); g.stroke();
    // saddle, chainring
    L(4); g.beginPath(); g.moveTo(-14, -78); g.lineTo(-16, -86); g.stroke(); ell(-17, -88, 13, 4.2, -0.06); fill('#1E2124'); ink(2.6);
    ell(BB[0], BB[1], 8, 8); fill('#C9D2DB'); ink(2.6); L(1.4); g.beginPath(); g.moveTo(RW[0], RW[1] - 4); g.lineTo(BB[0], BB[1] - 8); g.moveTo(RW[0], RW[1] + 4); g.lineTo(BB[0], BB[1] + 8); g.stroke();
    // the near leg, pedalling (or standing)
    legTo(f2[0], f2[1], '#2F6BFF');
    // stem, bars and the race plate it wears as a face
    L(6); g.beginPath(); g.moveTo(37, -80); g.lineTo(37, -90); g.lineTo(46, -92); g.stroke(); L(2.6, '#5B6773'); g.stroke();
    const plate = new Path2D(); plate.roundRect(20, -136, 50, 46, 10); tone(plate, '#FFFFFF', '#DDE3EA', 4, 3.4);
    g.save(); g.clip(plate); g.fillStyle = '#2F6BFF'; g.fillRect(18, -140, 54, 9); g.restore(); L(3.4); g.stroke(plate);
    const bl = blinkAt(4.8, .4), cx = 45;
    for(const d of [-1, 1]) eye(cx + d * 10.5, -114, { side:d, rx:7.6, ry:9, lid:.48, lower:.08, blink:bl, look:[2, 1], prx:3.2, pry:3.8, lidCol:'#FFFFFF', w:2.6 });
    brow(cx - 10.5, -126, 0.04, 11, 3.8); brow(cx + 10.5, -128.5, -0.18, 11, 3.8);
    L(3); g.beginPath(); g.moveTo(cx - 7, -100); g.quadraticCurveTo(cx + 1, -97.5, cx + 8, -102); g.stroke();
    // arms from the top tube to the grips: one rests easy, one gives a lazy wave now and then
    const wv = (T % 4) < 1 ? Math.sin((T % 4) * Math.PI) : 0;
    g.save(); g.translate(70, -108); g.rotate(-wv * .9); arm(0, 0, 10, 6, 10, 18); g.restore();
    arm(20, -106, 10, -100, 8, -90);
    g.restore(); g.restore(); } };

  const COMPANION = {
    list:C, ids:Object.keys(C), COMP_H,
    draw(ctx, id, cx, feet, u, o){
      o = o || {}; const c = C[id]; if(!c) return;
      g = ctx; T = o.still ? 1.2 : (o.t || 0);
      const k = u * COMP_H / 150;
      g.save(); g.translate(cx, feet); g.scale(k, k); g.lineJoin = 'round'; g.lineCap = 'round';
      try{ c.draw(o.facing || -1, o.state === 'walk'); } finally{ g.restore(); }
    },
  };
  root.MC_COMPANIONS = COMPANION;
})(typeof window !== 'undefined' ? window : globalThis);
/*END-COMPANION-DESIGNS*/
function drawCompanion(g, id, cx, feet, u, o){
  o = o || {}; const C = (typeof window !== 'undefined' ? window : globalThis).MC_COMPANIONS; if(!C || !C.list[id]) return;
  C.draw(g, id, cx, feet, u, { t:(o.t || 0) + (o.seed || 0), facing:o.facing || -1, state:o.state, still:o.still });
}

const mounts = new Set();
let raf = 0;
function loop(){
  raf = 0;
  const now = performance.now() / 1000;
  let any = false;
  // companion cards (shop, locker) repaint about 24 times a second: a whole page of them stays smooth on an iPad
  mounts.forEach(m => { if(m.animated() && m.onscreen){ any = true; if(m.opts.only === 'companion'){ if(now - (m.last || 0) < 0.041) return; m.last = now; } m.paint(now); } });
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
