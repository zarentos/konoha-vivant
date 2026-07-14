/* Konoha Vivant — META-COMBAT.
   Les data/<perso>.js disent a quoi ressemble une technique.
   Ce fichier dit ce qu'elle FAIT.

   t   melee | dash | proj | buff
   r   [distance min, max] de declenchement (px monde)
   d   degats          cd  recharge (ms)        ck  cout en chakra
   rc  allonge de la hitbox (melee/dash)        ds  impulsion avant (dash)
   ps  vitesse du projectile   pr  rayon du projectile
   kb  recul (negatif = attire vers le lanceur)
   h   light | heavy | launch | stun
   w   poids dans le tirage de l'IA
   --- optionnels ---
   heal n     soigne (soi ou l'allie cible)     ally:1  = se lance sur un allie
   atk n / def n / dur ms  = buff temporaire     inv ms = invincible
   tp:1  teleporte derriere la cible             sage:1 = passe en mode ermite
   need:"sage"  utilisable seulement en ermite   lowhp .5 = seulement sous 50% PV
*/
window.KV_MOVES = {

naruto:{ hp:130, aggr:.85, combo:[[0,3],[4,6],[7,10],[11,13]], moves:[
  {a:"rasengan",        t:"dash", r:[40,190], d:16, cd:5200,  ck:18, rc:76,  ds:420, kb:300, h:"heavy",  w:3.0},
  {a:"oodama_rasengan", t:"dash", r:[40,200], d:26, cd:13000, ck:32, rc:92,  ds:440, kb:430, h:"launch", w:1.2},
  {a:"rising_rasengan", t:"melee",r:[0,115],  d:18, cd:8000,  ck:20, rc:70,  kb:180, h:"launch", w:1.9},
  {a:"rising_oodama",   t:"melee",r:[0,95],   d:26, cd:15000, ck:34, rc:74,  kb:220, h:"launch", w:0.8},
  {a:"kage_bunshin",    t:"melee",r:[0,150],  d:10, cd:9000,  ck:16, rc:120, kb:150, h:"light",  w:1.4},
  {a:"ryujinki",        t:"melee",r:[0,150],  d:14, cd:9000,  ck:18, rc:115, kb:240, h:"heavy",  w:1.5},
  {a:"rasen_shuriken",  t:"proj", r:[170,700],d:24, cd:12000, ck:30, ps:640, pr:42, kb:300, h:"heavy",  w:2.6},
  {a:"ryujin_rasengan", t:"proj", r:[160,700],d:20, cd:11000, ck:28, ps:560, pr:46, kb:280, h:"heavy",  w:1.4},
  {a:"kyuubi_4t",       t:"proj", r:[130,800],d:28, cd:20000, ck:38, ps:700, pr:54, kb:520, h:"launch", w:1.4},
  {a:"kyuubi_3t",       t:"buff", atk:1.35, dur:9000, cd:22000, ck:25, w:1.2}
]},

sasuke:{ hp:120, aggr:.80, moves:[
  {a:"chidori",        t:"dash", r:[40,200], d:18, cd:6000,  ck:20, rc:80, ds:470, kb:300, h:"heavy",  w:3.0},
  {a:"chidori_eiso",   t:"melee",r:[90,250], d:16, cd:8500,  ck:22, rc:230, kb:220, h:"heavy",  w:1.8},
  {a:"katon_curse",    t:"melee",r:[90,260], d:17, cd:9500,  ck:24, rc:240, kb:200, h:"heavy",  w:1.4},
  {a:"kirin",          t:"melee",r:[110,330],d:32, cd:21000, ck:44, rc:320, kb:400, h:"launch", w:1.1},
  {a:"curse_fly",      t:"dash", r:[150,420],d:13, cd:9000,  ck:16, rc:70, ds:640, kb:220, h:"heavy",  w:1.3},
  {a:"katon_goukakyu", t:"proj", r:[150,650],d:15, cd:6500,  ck:18, ps:520, pr:44, kb:200, h:"heavy",  w:2.6},
  {a:"curse",          t:"buff", atk:1.3, def:.85, dur:11000, cd:24000, ck:22, w:1.2}
]},

itachi:{ hp:115, aggr:.55, moves:[
  {a:"katon_goukakyu", t:"proj", r:[150,650],d:16, cd:6000,  ck:18, ps:530, pr:44, kb:200, h:"heavy", w:2.6},
  {a:"crow_shuriken",  t:"melee",r:[100,300],d:10, cd:5000,  ck:10, rc:270, kb:130, h:"light", w:2.2},
  {a:"crow_swarm",     t:"melee",r:[60,230], d:13, cd:8000,  ck:16, rc:210, kb:180, h:"heavy", w:1.6},
  {a:"crow_clones",    t:"melee",r:[0,170],  d:11, cd:8000,  ck:14, rc:145, kb:160, h:"light", w:1.2},
  {a:"tsukuyomi",      t:"melee",r:[0,150],  d:16, cd:16000, ck:30, rc:135, kb:0,   h:"stun",  w:1.4},
  {a:"amaterasu",      t:"melee",r:[120,350],d:26, cd:18000, ck:38, rc:330, kb:240, h:"heavy", w:1.3},
  {a:"crow_scatter",   t:"buff", inv:1300, cd:11000, ck:8, w:1.2},
  {a:"sharingan",      t:"buff", def:.75, dur:9000, cd:18000, ck:12, w:0.9},
  {a:"susanoo",        t:"buff", atk:1.4, def:.6, dur:11000, cd:26000, ck:40, w:1.1}
]},

sakura:{ hp:110, aggr:.70, healer:1, moves:[
  {a:"shosen",           t:"buff", heal:45, ally:1, cd:9000,  ck:22, w:3.0},
  {a:"cherry_impact",    t:"melee",r:[0,125], d:21, cd:7000,  ck:16, rc:115, kb:340, h:"launch", w:2.2},
  {a:"cherry_impact2",   t:"melee",r:[0,115], d:16, cd:5500,  ck:12, rc:105, kb:260, h:"heavy",  w:1.8},
  {a:"force_surhumaine", t:"melee",r:[0,105], d:24, cd:9000,  ck:18, rc:95,  kb:400, h:"launch", w:1.6},
  {a:"sceau_explosif",   t:"melee",r:[0,140], d:15, cd:8000,  ck:14, rc:130, kb:260, h:"heavy",  w:1.1},
  {a:"kunai_explosif",   t:"melee",r:[130,350],d:12,cd:6000,  ck:10, rc:320, kb:170, h:"heavy",  w:1.6},
  {a:"byakugo",          t:"buff", heal:30, atk:1.25, dur:11000, cd:22000, ck:26, lowhp:.6, w:2.5}
]},

kakashi:{ hp:115, aggr:.70, moves:[
  {a:"raikiri",         t:"dash", r:[40,190], d:19, cd:6000,  ck:20, rc:78, ds:470, kb:310, h:"heavy",  w:3.0},
  {a:"raikiri_montant", t:"melee",r:[0,95],   d:17, cd:8000,  ck:18, rc:70,  kb:200, h:"launch", w:1.6},
  {a:"multi_clonage",   t:"melee",r:[0,160],  d:10, cd:9000,  ck:14, rc:135, kb:150, h:"light",  w:1.4},
  {a:"sennen_goroshi",  t:"melee",r:[0,75],   d:13, cd:11000, ck:6,  rc:62,  kb:380, h:"launch", w:0.7},
  {a:"kamui",           t:"buff", inv:1500, tp:1, cd:13000, ck:24, w:1.4}
]},

jiraiya:{ hp:125, aggr:.60, moves:[
  {a:"rasengan",           t:"dash", r:[40,180], d:17, cd:6000,  ck:18, rc:74, ds:400, kb:290, h:"heavy", w:2.4},
  {a:"jutsu_hair",         t:"melee",r:[60,230], d:12, cd:6000,  ck:12, rc:210, kb:170, h:"heavy", w:1.6},
  {a:"jutsu_hair2",        t:"melee",r:[60,250], d:15, cd:8000,  ck:16, rc:230, kb:200, h:"heavy", w:1.3},
  {a:"huile_crapaud",      t:"melee",r:[100,290],d:10, cd:7000,  ck:12, rc:270, kb:120, h:"light", w:1.3},
  {a:"multi_clonage",      t:"melee",r:[0,160],  d:10, cd:9000,  ck:14, rc:135, kb:150, h:"light", w:1.1},
  {a:"endan",              t:"proj", r:[140,600],d:13, cd:5000,  ck:14, ps:560, pr:40, kb:190, h:"heavy", w:2.6},
  {a:"senpu",              t:"proj", r:[170,650],d:19, cd:9500,  ck:26, ps:600, pr:54, kb:300, h:"heavy", w:1.8},
  {a:"hari_jizo",          t:"buff", def:.45, dur:4500, cd:12000, ck:14, w:1.3},
  {a:"conversion_crapaud", t:"buff", sage:1, atk:1.3, dur:14000, cd:28000, ck:30, w:1.4},
  {a:"sage_2", need:"sage", t:"melee",r:[0,110], d:17, cd:5000, ck:12, rc:100, kb:300, h:"heavy",  w:2.0},
  {a:"sage_4", need:"sage", t:"melee",r:[70,230],d:15, cd:6000, ck:14, rc:215, kb:220, h:"heavy",  w:1.6},
  {a:"sage_5", need:"sage", t:"melee",r:[0,130], d:19, cd:7000, ck:16, rc:120, kb:280, h:"heavy",  w:1.6},
  {a:"sage_7", need:"sage", t:"melee",r:[0,110], d:22, cd:9000, ck:20, rc:95,  kb:380, h:"launch", w:1.8}
]},

orochimaru:{ hp:125, aggr:.65, moves:[
  {a:"kusanagi",        t:"melee",r:[0,155],  d:16, cd:4800,  ck:10, rc:145, kb:220, h:"heavy",  w:2.6},
  {a:"seneijashu",      t:"melee",r:[80,290], d:14, cd:6000,  ck:14, rc:270, kb:180, h:"heavy",  w:2.2},
  {a:"lance_serpent",   t:"melee",r:[120,370],d:15, cd:7000,  ck:16, rc:350, kb:200, h:"heavy",  w:1.8},
  {a:"main_serpent",    t:"melee",r:[60,250], d:12, cd:5500,  ck:10, rc:230, kb:150, h:"light",  w:1.5},
  {a:"assaut_serpents", t:"dash", r:[80,300], d:17, cd:8000,  ck:20, rc:120, ds:520, kb:280, h:"heavy",  w:1.5},
  {a:"serpent_blanc",   t:"melee",r:[0,210],  d:20, cd:11000, ck:26, rc:190, kb:340, h:"launch", w:1.3},
  {a:"jutsu_serpent1",  t:"melee",r:[40,200], d:12, cd:5500,  ck:10, rc:180, kb:160, h:"heavy",  w:1.2},
  {a:"jutsu_serpent3",  t:"melee",r:[60,260], d:13, cd:6500,  ck:12, rc:240, kb:180, h:"heavy",  w:1.1},
  {a:"jutsu_serpent5",  t:"melee",r:[0,180],  d:14, cd:7000,  ck:12, rc:165, kb:200, h:"heavy",  w:1.1}
]},

pain:{ hp:135, aggr:.50, moves:[
  {a:"shinra_tensei",  t:"melee",r:[0,290],  d:19, cd:9500,  ck:26, rc:285, kb:700, h:"launch", w:2.8},
  {a:"banshotenin",    t:"melee",r:[130,430],d:8,  cd:8000,  ck:14, rc:420, kb:-450,h:"light",  w:1.8},
  {a:"missiles",       t:"melee",r:[150,500],d:12, cd:6000,  ck:14, rc:490, kb:170, h:"heavy",  w:2.2},
  {a:"missiles2",      t:"melee",r:[150,500],d:15, cd:7500,  ck:18, rc:490, kb:200, h:"heavy",  w:1.8},
  {a:"aiguille",       t:"melee",r:[80,290], d:10, cd:5000,  ck:8,  rc:270, kb:120, h:"light",  w:1.6},
  {a:"chibaku_tensei", t:"melee",r:[100,620],d:34, cd:26000, ck:50, rc:610, kb:300, h:"launch", w:1.0},
  {a:"voies_de_pain",  t:"buff", atk:1.35, dur:10000, cd:21000, ck:24, w:1.2}
]},

deidara:{ hp:105, aggr:.50, moves:[
  {a:"c1",               t:"proj", r:[150,620],d:14, cd:5000,  ck:12, ps:520, pr:40, kb:200, h:"heavy",  w:2.8},
  {a:"clone_argile",     t:"proj", r:[120,520],d:17, cd:9000,  ck:20, ps:480, pr:48, kb:260, h:"heavy",  w:1.6},
  {a:"c2",               t:"proj", r:[180,680],d:24, cd:13000, ck:34, ps:430, pr:62, kb:420, h:"launch", w:1.5},
  {a:"faucon_c1",        t:"melee",r:[140,380],d:14, cd:6500,  ck:12, rc:360, kb:200, h:"heavy",  w:1.6},
  {a:"aigle_c1",         t:"melee",r:[140,400],d:16, cd:8000,  ck:16, rc:380, kb:230, h:"heavy",  w:1.4},
  {a:"araignee_c1",      t:"melee",r:[60,240], d:12, cd:6000,  ck:10, rc:225, kb:180, h:"heavy",  w:1.4},
  {a:"faucon_plongeant", t:"dash", r:[120,380],d:18, cd:9000,  ck:20, rc:110, ds:560, kb:300, h:"heavy",  w:1.2},
  {a:"katsu",            t:"melee",r:[0,520],  d:11, cd:10000, ck:14, rc:500, kb:250, h:"heavy",  w:1.0}
]},

konan:{ hp:105, aggr:.50, combo:[[0,3],[4,7]], moves:[
  {a:"lance_papier",        t:"melee",r:[120,400],d:13, cd:5000,  ck:10, rc:385, kb:170, h:"heavy",  w:2.4},
  {a:"kami_shuriken",       t:"melee",r:[130,430],d:14, cd:6000,  ck:12, rc:410, kb:190, h:"heavy",  w:2.2},
  {a:"kami_rasen_shuriken", t:"melee",r:[150,480],d:22, cd:13000, ck:30, rc:465, kb:340, h:"launch", w:1.3},
  {a:"shikigami",           t:"melee",r:[60,250], d:12, cd:5500,  ck:10, rc:230, kb:170, h:"heavy",  w:1.6},
  {a:"shikigami2",          t:"melee",r:[60,260], d:14, cd:7000,  ck:14, rc:240, kb:190, h:"heavy",  w:1.4},
  {a:"broyage_papier",      t:"melee",r:[0,170],  d:19, cd:9500,  ck:22, rc:160, kb:300, h:"launch", w:1.3},
  {a:"jutsu_papier1",       t:"melee",r:[0,200],  d:11, cd:5000,  ck:8,  rc:185, kb:150, h:"light",  w:1.3},
  {a:"jutsu_papier4",       t:"melee",r:[60,280], d:13, cd:6500,  ck:12, rc:260, kb:180, h:"heavy",  w:1.2},
  {a:"jutsu_papier6",       t:"melee",r:[0,220],  d:12, cd:6000,  ck:10, rc:205, kb:160, h:"heavy",  w:1.1},
  {a:"ailes_ange",          t:"buff", atk:1.25, dur:10000, cd:20000, ck:20, w:1.1},
  {a:"danse",               t:"buff", inv:1200, cd:10000, ck:8, w:1.1}
]},

sai:{ hp:100, aggr:.55, moves:[
  {a:"souris_encre",     t:"proj", r:[140,540],d:11, cd:4500,  ck:8,  ps:520, pr:36, kb:140, h:"light",  w:2.2},
  {a:"faucon_encre",     t:"proj", r:[160,580],d:13, cd:5500,  ck:12, ps:560, pr:40, kb:190, h:"heavy",  w:2.2},
  {a:"serpent_encre",    t:"proj", r:[120,500],d:12, cd:5000,  ck:10, ps:480, pr:40, kb:170, h:"heavy",  w:2.0},
  {a:"faucon_plongeant", t:"proj", r:[180,620],d:16, cd:7000,  ck:16, ps:620, pr:44, kb:240, h:"heavy",  w:1.6},
  {a:"lion_encre",       t:"proj", r:[150,620],d:21, cd:10500, ck:26, ps:500, pr:58, kb:340, h:"launch", w:1.3}
]},

shikamaru:{ hp:100, aggr:.45, combo:[[0,4],[5,10],[11,16]], moves:[
  {a:"kagemane",            t:"melee",r:[80,330],d:5,  cd:9000,  ck:16, rc:320, kb:0,   h:"stun",   w:2.8},
  {a:"kage_nui",            t:"melee",r:[60,270],d:15, cd:6000,  ck:14, rc:250, kb:190, h:"heavy",  w:2.2},
  {a:"kage_kubishibari",    t:"melee",r:[60,250],d:17, cd:8000,  ck:18, rc:230, kb:260, h:"launch", w:1.6},
  {a:"kage_mane_shuriken",  t:"melee",r:[120,410],d:12,cd:6000,  ck:12, rc:395, kb:160, h:"heavy",  w:1.8},
  {a:"kage_mane_shuriken2", t:"melee",r:[120,430],d:14,cd:7500,  ck:14, rc:415, kb:180, h:"heavy",  w:1.4},
  {a:"tranchee_chakra",     t:"melee",r:[0,145], d:15, cd:6000,  ck:12, rc:135, kb:200, h:"heavy",  w:1.5},
  {a:"kage_yose",           t:"melee",r:[100,350],d:9, cd:7000,  ck:12, rc:335, kb:-380,h:"light",  w:1.4},
  {a:"shadow_jutsu1",       t:"melee",r:[40,220],d:12, cd:5500,  ck:10, rc:205, kb:170, h:"heavy",  w:1.2},
  {a:"shadow_jutsu2",       t:"melee",r:[60,270],d:13, cd:6500,  ck:12, rc:250, kb:180, h:"heavy",  w:1.1},
  {a:"shadow_jutsu3",       t:"melee",r:[0,190], d:14, cd:7000,  ck:12, rc:175, kb:200, h:"heavy",  w:1.1}
]},

suigetsu:{ hp:115, aggr:.85, moves:[
  {a:"kubikiri1",       t:"melee",r:[0,145], d:13, cd:3200, ck:6,  rc:135, kb:200, h:"heavy",  w:2.4},
  {a:"kubikiri2",       t:"melee",r:[0,150], d:14, cd:3600, ck:6,  rc:140, kb:210, h:"heavy",  w:2.2},
  {a:"kubikiri4",       t:"melee",r:[0,140], d:13, cd:3400, ck:6,  rc:130, kb:200, h:"heavy",  w:2.0},
  {a:"kubikiri9",       t:"melee",r:[0,155], d:15, cd:4200, ck:8,  rc:145, kb:230, h:"heavy",  w:1.8},
  {a:"kubikiri12",      t:"melee",r:[0,160], d:16, cd:4800, ck:8,  rc:150, kb:250, h:"heavy",  w:1.6},
  {a:"triple_tranche",  t:"melee",r:[0,155], d:19, cd:7000, ck:14, rc:145, kb:300, h:"heavy",  w:1.6},
  {a:"tranche_eau",     t:"melee",r:[0,185], d:17, cd:6000, ck:12, rc:175, kb:270, h:"heavy",  w:1.6},
  {a:"suiton_goukakyu", t:"melee",r:[120,410],d:14,cd:6000, ck:14, rc:390, kb:190, h:"heavy",  w:1.6},
  {a:"shuriken_hydrate",t:"melee",r:[130,430],d:11,cd:5000, ck:8,  rc:410, kb:150, h:"light",  w:1.4},
  {a:"suiko",           t:"melee",r:[0,170], d:10, cd:11000,ck:20, rc:160, kb:0,   h:"stun",   w:1.3}
]},

karin:{ hp:95, aggr:.90, moves:[
  {a:"baffe",          t:"melee",r:[0,85],  d:10, cd:3000,  ck:4,  rc:75,  kb:180, h:"light",  w:2.6},
  {a:"coup_de_boule",  t:"melee",r:[0,80],  d:14, cd:4000,  ck:6,  rc:70,  kb:260, h:"heavy",  w:2.2},
  {a:"combo_rage",     t:"melee",r:[0,115], d:18, cd:6000,  ck:12, rc:105, kb:290, h:"heavy",  w:2.2},
  {a:"assaut_enrage",  t:"dash", r:[60,250],d:16, cd:6000,  ck:14, rc:85, ds:520, kb:280, h:"heavy",  w:2.0},
  {a:"magura_shindan", t:"melee",r:[0,125], d:21, cd:9000,  ck:18, rc:115, kb:350, h:"launch", w:1.5},
  {a:"detection",      t:"buff", heal:28, atk:1.2, dur:8000, cd:15000, ck:12, w:1.6}
]},

jugo:{ hp:150, aggr:.95, moves:[
  {a:"coup_transforme",   t:"melee",r:[0,115], d:16, cd:4000,  ck:6,  rc:105, kb:250, h:"heavy",  w:2.6},
  {a:"frappe_violente",   t:"melee",r:[0,125], d:18, cd:5000,  ck:8,  rc:115, kb:290, h:"heavy",  w:2.2},
  {a:"hache_violente",    t:"melee",r:[0,135], d:20, cd:6000,  ck:10, rc:125, kb:340, h:"launch", w:2.0},
  {a:"hache_violente2",   t:"melee",r:[0,135], d:22, cd:7000,  ck:12, rc:125, kb:360, h:"launch", w:1.6},
  {a:"explosion_violente",t:"melee",r:[0,190], d:25, cd:10500, ck:22, rc:180, kb:450, h:"launch", w:1.5},
  {a:"pics",              t:"melee",r:[60,270],d:14, cd:6000,  ck:12, rc:255, kb:200, h:"heavy",  w:1.6},
  {a:"entrave",           t:"melee",r:[0,150], d:11, cd:9000,  ck:16, rc:140, kb:0,   h:"stun",   w:1.3},
  {a:"entrave2",          t:"melee",r:[0,145], d:12, cd:9500,  ck:16, rc:135, kb:0,   h:"stun",   w:1.1},
  {a:"surpuissance",      t:"buff", atk:1.4, dur:9000,  cd:18000, ck:16, w:1.4},
  {a:"transformation",    t:"buff", atk:1.3, def:.8, dur:13000, cd:21000, ck:20, w:1.6}
]}

};
