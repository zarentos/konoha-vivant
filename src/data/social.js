/* Konoha Vivant — COUCHE SOCIALE.
   Qui connait qui, qui deteste qui, qui va soigner qui, qui va venger qui.
   rel : -100 (haine) .. +100 (lien fort). Oriente : rel(a->b) peut differer de rel(b->a).
   traits : social (envie de parler) · loyal (vient aider / venger) · calme (evite la bagarre)
*/
window.KV_SOCIAL = (function(){

  var CAMP = {
    naruto:"konoha", sakura:"konoha", kakashi:"konoha", sai:"konoha",
    shikamaru:"konoha", jiraiya:"konoha",
    sasuke:"taka", suigetsu:"taka", karin:"taka", jugo:"taka",
    itachi:"akatsuki", pain:"akatsuki", konan:"akatsuki", deidara:"akatsuki",
    orochimaru:"solo"
  };

  // relation par defaut entre deux camps
  var CAMP_REL = {
    "konoha|konoha":55, "taka|taka":50, "akatsuki|akatsuki":45, "solo|solo":0,
    "konoha|akatsuki":-75, "konoha|taka":-25, "konoha|solo":-55,
    "taka|akatsuki":-30,   "taka|solo":-15,   "akatsuki|solo":-40
  };

  // liens explicites (ecrasent le camp). "a>b" = ce que A ressent pour B.
  var REL = {
    "naruto>sasuke":75,  "sasuke>naruto":45,
    "naruto>sakura":80,  "sakura>naruto":65,
    "naruto>kakashi":75, "kakashi>naruto":80,
    "naruto>jiraiya":95, "jiraiya>naruto":92,
    "naruto>sai":55,     "sai>naruto":60,
    "naruto>shikamaru":70,"shikamaru>naruto":72,
    "naruto>pain":-70,   "pain>naruto":-35,
    "naruto>orochimaru":-60,

    "sakura>sasuke":92,  "sasuke>sakura":40,
    "sakura>kakashi":72, "kakashi>sakura":74,
    "sakura>karin":-40,  "karin>sakura":-45,
    "sakura>sai":50,     "sai>sakura":45,

    "sasuke>itachi":-100,"itachi>sasuke":88,
    "sasuke>orochimaru":-35,"orochimaru>sasuke":72,
    "sasuke>karin":20,   "karin>sasuke":98,
    "sasuke>suigetsu":40,"suigetsu>sasuke":58,
    "sasuke>jugo":48,    "jugo>sasuke":75,
    "sasuke>deidara":-60,"deidara>sasuke":-90,
    "sasuke>kakashi":30, "kakashi>sasuke":68,

    "kakashi>orochimaru":-65,
    "jiraiya>orochimaru":-50,"orochimaru>jiraiya":-40,
    "jiraiya>pain":-88,  "pain>jiraiya":-55,
    "jiraiya>sakura":45,

    "konan>pain":98,     "pain>konan":92,
    "itachi>deidara":-20,"deidara>itachi":-85,
    "konan>itachi":30,   "itachi>konan":30,
    "deidara>konan":25,  "konan>deidara":25,

    "suigetsu>karin":-55,"karin>suigetsu":-60,
    "suigetsu>jugo":25,  "jugo>suigetsu":20,
    "karin>jugo":12,     "jugo>karin":18,

    "shikamaru>deidara":-70, "shikamaru>orochimaru":-60,
    "orochimaru>itachi":-45, "itachi>orochimaru":-50
  };

  // paires qui peuvent en venir aux mains meme en bons termes (rivalite / entrainement)
  var SPARK = {
    "naruto|sasuke":.55, "suigetsu|karin":.45, "naruto|kakashi":.15,
    "naruto|jiraiya":.15, "suigetsu|jugo":.10, "sakura|naruto":.08,
    "naruto|shikamaru":.10, "sasuke|suigetsu":.12
  };

  var TRAITS = {
    naruto:    {social:.95, loyal:1.00, calme:.15},
    sasuke:    {social:.20, loyal:.55, calme:.35},
    itachi:    {social:.25, loyal:.70, calme:.90},
    sakura:    {social:.80, loyal:.95, calme:.35},
    kakashi:   {social:.60, loyal:.90, calme:.80},
    jiraiya:   {social:.85, loyal:.90, calme:.55},
    orochimaru:{
      ennui:["Rien d'intéressant.","Autant expérimenter.","Kukuku… je m'ennuie."],
      fatigue:["Ce corps est usé.","Je dois me régénérer.","Fatigue… détestable."],
      faim:["Ce corps réclame.","Une faiblesse humaine.","Kukuku… je mangerai."],social:.35, loyal:.10, calme:.60},
    pain:      {social:.20, loyal:.60, calme:.85},
    deidara:   {social:.55, loyal:.35, calme:.20},
    konan:     {social:.30, loyal:1.00, calme:.75},
    sai:       {social:.65, loyal:.60, calme:.90},
    shikamaru: {social:.70, loyal:.85, calme:.90},
    suigetsu:  {social:.75, loyal:.45, calme:.25},
    karin:     {social:.70, loyal:.75, calme:.10},
    jugo:      {social:.35, loyal:.80, calme:.55}
  };

  // Le filet de securite : ce qu'ils disent quand le LLM n'a rien en reserve.
  //   seul    = il marche tout seul, il pense a voix haute
  //   detendu = il parle a quelqu'un qu'il aime bien
  //   tendu   = il parle a quelqu'un qu'il n'aime pas
  //   blesse  = il a peu de PV
  //   content = il vient de gagner / d'etre soigne
  var LINES = {
    naruto:{
      ennui:["Y'a rien à faire ici.","Quelqu'un veut se battre ?","J'm'ennuie à mourir.","Bon, je m'entraîne."],
      fatigue:["Chuis crevé…","Cinq minutes. Juste cinq.","Zzz…","J'dors debout, là."],
      faim:["J'AI FAIM !","Des ramen. Tout de suite.","Mon ventre parle tout seul.","Ichiraku me manque."],
      seul:["J'ai la dalle.","Un jour, Hokage. Croyez-moi.","Ero-sennin m'a encore planté.",
            "Ça sent le ramen quelque part.","J'suis pas fatigué. Pas du tout.",
            "Personne me regarde ? Bon.","Faut que je m'entraîne.","Dattebayo !",
            "J'ai encore rien mangé aujourd'hui.","Sasuke ferait moins le malin, là."],
      detendu:["On mange des ramen ?","T'as vu ma nouvelle technique ?","J'abandonne jamais, moi.",
               "Tu me prêtes des sous ? Pour les ramen.","T'as l'air en forme !",
               "Je sens que ça va être une bonne journée.","On s'entraîne ensemble ?"],
      tendu:["Recule.","Je vais te ramener de force.","Tu vas le regretter.",
             "T'as fini de parler ?","J'ai pas peur de toi."],
      blesse:["Ça… ça va.","J'suis pas encore à terre.","Faut que je tienne."],
      content:["OUAIS !","Je vous l'avais dit !","Ramen pour tout le monde !"]},
    sasuke:{
      ennui:["Perte de temps.","Je m'entraîne.","Rien ne se passe ici."],
      fatigue:["Je devrais dormir.","...","Fatigué. Peu importe."],
      faim:["Des tomates feraient l'affaire.","J'ai faim. Tant pis.","Hn."],
      seul:["Hn.","Perte de temps.","Je ne suis pas assez fort.","...",
            "Il me faut plus de puissance.","Tsss.","Ce village m'insupporte.",
            "Encore du bruit.","Je le tuerai."],
      detendu:["Hn.","Ne me ralentis pas.","Fais ce que tu veux.","...",
               "Tu as progressé. Un peu.","Pas le temps.","Si tu insistes."],
      tendu:["Dégage.","Tu me gênes.","Je n'ai plus de camarades.","Ferme-la.","Tu vas mourir."],
      blesse:["Ce n'est rien.","Je tiens encore debout.","Pas comme ça."],
      content:["Évidemment.","C'était prévisible.","Suivant."]},
    itachi:{
      ennui:["Le silence me convient.","Rien à faire.","Je vais m'exercer."],
      fatigue:["Mon corps me lâche.","Je dois me reposer.","..."],
      faim:["Des dango.","Je devrais manger.","Peu importe."],
      seul:["Le monde est vaste.","Tu es encore faible, Sasuke.","Mes yeux me font mal.",
            "Il ne reste plus beaucoup de temps.","...","Les corbeaux sont fidèles.",
            "Je n'attends aucun pardon."],
      detendu:["Assieds-toi.","Ne me juge pas trop vite.","Le vrai courage, c'est autre chose.",
               "Tu comprendras un jour.","Reste en vie."],
      tendu:["Tu ne comprends rien.","Inutile.","Tu ne me toucheras pas."],
      blesse:["Ce n'est pas toi qui m'abats.","Mon corps me lâche.","Peu importe."],
      content:["C'était nécessaire.","Rien de plus.","Relève-toi."]},
    sakura:{
      ennui:["Je m'ennuie.","Autant m'entraîner.","Il ne se passe rien."],
      fatigue:["Épuisée…","Je vais faire une pause.","Mes jambes lâchent."],
      faim:["Je meurs de faim.","Un anmitsu, ce serait parfait.","J'ai sauté le repas."],
      seul:["Shannaro !","J'ai encore progressé, je le sens.","Sasuke-kun…",
            "Faut que je révise mes soins.","Naruto va encore faire une bêtise.",
            "Mes cheveux, quelle galère.","Tsunade-sama serait fière."],
      detendu:["Tu as l'air fatigué, viens voir.","J'ai fini mon entraînement !",
               "Naruto, sois sérieux deux minutes.","Tu veux que je te soigne ?",
               "On va boire un truc ?","Fais attention à toi."],
      tendu:["Recule.","Tu vas le regretter.","Ne me sous-estime pas.","J'ai pas que ça à faire."],
      blesse:["Ça… c'est rien.","Je peux encore me soigner.","Tenir. Juste tenir."],
      content:["SHANNARO !","Je vous l'avais dit !","Facile."]},
    kakashi:{
      ennui:["Mon bouquin m'attend.","Je vais m'entraîner un peu.","Rien à signaler."],
      fatigue:["Une sieste s'impose.","Je vais m'allonger.","Zzz."],
      faim:["Un thé et je repars.","J'ai un petit creux.","On mange ?"],
      seul:["Désolé, je me suis perdu sur le chemin de la vie.","Ce bouquin est excellent.",
            "Ils progressent, ces gamins.","Encore en retard. Tant pis.",
            "Obito…","Un thé serait pas de refus.","Mon œil me fatigue."],
      detendu:["Yo.","Vous progressez.","J'ai un bon bouquin, tu veux voir ?",
               "Ne te surmène pas.","Tu me rappelles quelqu'un.","On prend le temps."],
      tendu:["Pas un pas de plus.","Je vais devoir sévir.","Ne fais pas ça."],
      blesse:["J'ai connu pire.","Ça va aller.","Je vieillis."],
      content:["Bon travail.","Vous voyez ?","Rentrons."]},
    jiraiya:{
      ennui:["Il me faut de l'inspiration.","Bon. À l'entraînement.","Rien ne bouge ici."],
      fatigue:["Le vieux corps réclame.","Une sieste, et je repars.","Je me repose."],
      faim:["Un bon repas et de la compagnie !","J'ai une faim de crapaud.","À table !"],
      seul:["L'ermite des crapauds !","J'écris un roman, tu sais.","Il me faut de l'inspiration.",
            "Ce gamin ira loin.","Une source thermale, ce serait bien.",
            "Le talent, ça se travaille.","Nagato…"],
      detendu:["Note bien ça, gamin.","Le talent, ça se travaille.","T'as du potentiel.",
               "Je t'offre un verre ?","Tiens, lis mon dernier chapitre.","Regarde et apprends."],
      tendu:["Tu as trahi tout ce qu'on était.","Arrête-toi là.","Tu me déçois."],
      blesse:["J'ai la peau dure.","Un vieux, ça résiste.","Pas encore."],
      content:["Voilà le travail !","Le maître reste le maître.","Bien joué, gamin."]},
    orochimaru:{
      seul:["Kukuku…","Un corps prometteur…","Le temps m'appartient.",
            "L'immortalité approche.","Ces expériences avancent bien.","Intéressant.",
            "Je déteste ce village."],
      detendu:["Kukuku…","Tu m'intéresses.","Viens avec moi.","Je peux te rendre puissant.",
               "Ne sois pas timide."],
      tendu:["Tu vas me servir.","Meurs proprement.","Quelle déception."],
      blesse:["Ce corps est usé.","J'en changerai.","Pathétique."],
      content:["Kukuku… évidemment.","Comme prévu.","Suivant."]},
    pain:{
      ennui:["Le monde attend.","Rien ne change.","..."],
      fatigue:["Nagato est fatigué.","Repos.","..."],
      faim:["Ce corps a des besoins.","Je mangerai.","..."],
      seul:["La douleur t'apprendra.","Ce monde doit changer.","Je suis un dieu.",
            "Nagato voit tout.","La paix passe par la souffrance.","Konan…","Ils ne comprennent pas."],
      detendu:["Tu comprends, toi.","Reste près de moi.","Le monde changera.","..."],
      tendu:["Shinra Tensei.","Ta souffrance sera brève.","Tu ne connais rien à la douleur."],
      blesse:["Cette enveloppe est fragile.","Je reviendrai.","La douleur… je la connais."],
      content:["Voilà la douleur.","Tu comprends maintenant ?","Le monde apprendra."]},
    deidara:{
      ennui:["Il me faut du public, hm.","Je vais faire péter un truc.","On s'ennuie ici."],
      fatigue:["Crevé, hm…","Je pionce.","L'art peut attendre."],
      faim:["J'ai la dalle, hm.","Un truc à manger, vite.","Mon art attendra."],
      seul:["L'art est une explosion, hm !","Katsu…","Il me faut plus d'argile.",
            "L'art est éphémère, hm.","Cet Itachi me sort par les yeux.","Personne ne comprend l'art."],
      detendu:["L'art est une explosion, hm !","Regarde bien, hm.","Tu vas adorer.",
               "L'art est éphémère.","Tu comprends l'art, toi ?"],
      tendu:["Ton art me dégoûte.","Tu vas exploser, hm.","Un vrai artiste te méprise."],
      blesse:["Ça pique, hm…","Pas fini.","Je vais exploser… littéralement."],
      content:["KATSU !","L'art a gagné, hm !","Voilà ce qu'est l'art."]},
    konan:{
      ennui:["Rien ne se passe.","...","J'attends."],
      fatigue:["Je vais me reposer.","...","Le papier aussi se fatigue."],
      faim:["Je devrais manger.","...","Un repas rapide."],
      seul:["Nagato a raison.","Le papier ne ment pas.","...",
            "Yahiko me manque.","La pluie tombe encore.","Il faut protéger Nagato."],
      detendu:["Reste près de moi.","Le papier ne ment pas.","...","Fais attention."],
      tendu:["Tu ne le toucheras pas.","Je te broierai.","Recule."],
      blesse:["Le papier se déchire.","Ça ira.","Nagato…"],
      content:["C'est terminé.","Nagato sera fier.","..."]},
    sai:{
      ennui:["Je vais dessiner.","Rien à faire. Je m'entraîne.","L'ennui. J'ai lu que c'était normal."],
      fatigue:["Mon corps réclame du sommeil.","Je vais m'allonger.","Fatigue. Intéressant."],
      faim:["Mon corps réclame du carburant.","J'ai lu qu'il fallait manger. Je mange.","Faim. Voilà."],
      seul:["J'ai lu que sourire créait du lien. Je sourirai.","Je dessine.",
            "Les émotions, c'est compliqué.","Mon frère aimait dessiner.",
            "J'ai lu un livre sur l'amitié. Je n'ai rien compris.","Bonjour, moi-même."],
      detendu:["Bonjour… petite bite ?","J'ai lu que ça créait du lien.","Tu es laid, non ?",
               "Je te dessinerai.","Mes livres disent qu'il faut sourire. Je souris.",
               "Tu es mon ami ? J'ai lu qu'il fallait demander."],
      tendu:["Ordre reçu.","Je dois t'éliminer.","Rien de personnel."],
      blesse:["Ma peinture coule.","Ce n'est pas grave.","Intéressant, la douleur."],
      content:["J'ai gagné. Dois-je sourire ?","C'était logique.","Je vais le dessiner."]},
    shikamaru:{
      ennui:["Galère…","Bon. J'm'entraîne. À contrecœur.","Les nuages, au moins, bougent."],
      fatigue:["Je vais dormir. Enfin.","Une sieste. Enfin une bonne idée.","Zzz…"],
      faim:["J'ai faim. Galère.","Un truc rapide.","Manger, c'est du boulot."],
      seul:["Galère…","Les nuages sont mieux que vous.","Trop chiant.",
            "J'ai 200 coups d'avance. Et j'm'ennuie.","Une clope serait pas de refus.",
            "Asuma-sensei…","Pourquoi je me lève le matin, déjà ?","Réfléchir, c'est fatigant."],
      detendu:["Galère…","Les nuages sont mieux que vous.","Tu veux jouer au shogi ?",
               "Trop chiant, mais bon.","T'as raison. Enfin, à moitié."],
      tendu:["Tu es déjà pris au piège.","Bouge encore, pour voir.","Quelle galère, toi."],
      blesse:["Aïe. Galère.","J'avais prévu ça. Pas comme ça, mais bon.","Trop chiant."],
      content:["Voilà. Galère.","J'avais 200 coups d'avance.","On peut aller dormir ?"]},
    suigetsu:{
      ennui:["Quelqu'un veut se battre ?","J'm'ennuie ferme.","Bwahaha… non, rien."],
      fatigue:["Crevé.","Je me liquéfie de fatigue.","Une sieste, et je reviens."],
      faim:["J'AI SOIF. Et faim.","De l'eau. Beaucoup d'eau.","On bouffe ?"],
      seul:["Bwahaha !","J'ai soif.","Ça coupe bien, ce truc.",
            "Karin me tape sur le système.","Faut que je retrouve les 7 épées.",
            "Zabuza aurait aimé ça.","J'me liquéfie d'ennui."],
      detendu:["Bwahaha !","Ça coupe bien, hein ?","T'as de l'eau ?",
               "On se fait un duel, pour rire ?","J'aime bien ta tête."],
      tendu:["Je vais te découper.","Zabuza aurait fait mieux.","Karin, ferme-la."],
      blesse:["Je me reconstitue, t'inquiète.","De l'eau… vite.","Ça pique."],
      content:["BWAHAHA !","Facile !","Encore un pour la collection."]},
    karin:{
      ennui:["Il ne se passe RIEN.","Sasuke, où t'es ?","Je m'ennuie."],
      fatigue:["Je suis crevée.","Personne me demande si ça va.","Je vais dormir. Enfin."],
      faim:["J'ai FAIM, quelqu'un m'écoute ?","Personne pour me nourrir ?","Je meurs de faim."],
      seul:["SASUKEEE !","Suigetsu me sort par les yeux.","Je sens tout le monde à 3 km.",
            "Personne me remercie jamais.","Sasuke m'a regardée. Enfin je crois.",
            "J'ai encore mal au bras.","Pourquoi je reste avec ces débiles ?"],
      detendu:["SASUKE ! Euh… salut.","Je te sens à 3 km, tu sais.","Mords-moi si tu veux guérir.",
               "T'as intérêt à me remercier.","Bon, ça va, tu m'agaces pas trop."],
      tendu:["Je vais te crever.","T'es qu'un déchet.","T'approche pas."],
      blesse:["Aïe ! Ça fait MAL !","Quelqu'un ? Non ? Super.","Sasuke, aide-moi !"],
      content:["ÉVIDEMMENT !","Tu m'as vue, Sasuke ?","Facile, franchement."]},
    jugo:{
      ennui:["Les oiseaux sont partis.","...","Ça monte quand je m'ennuie."],
      fatigue:["Je vais dormir. Ça me calme.","...","Fatigué."],
      faim:["J'ai faim.","...","Il faut que je mange."],
      seul:["...","Je ne veux blesser personne.","Ça monte…",
            "Kimimaro…","Les oiseaux me parlent.","Restez loin de moi.","Je dois me contrôler."],
      detendu:["...","Je ne veux blesser personne.","Tu n'as pas peur de moi ?",
               "Reste. Ça me calme.","Les oiseaux t'aiment bien."],
      tendu:["Ça monte. Cours.","Je ne me contrôle plus.","Pars. Maintenant."],
      blesse:["ÇA MONTE !","Je… je ne me contrôle plus…","Aidez-moi."],
      content:["C'est fini ?","Je n'ai pas voulu…","Ça redescend."]}
  };

  function key(a,b){ return a<b ? a+"|"+b : b+"|"+a; }

  // "canon"  : les liens du manga, en dur
  // "tiedes" : le canon divise par 2,5 + du hasard -> tout peut evoluer  [defaut]
  // "neutres": tout le monde part de zero, rien n'est ecrit
  // "neutres" par defaut : PERSONNE ne se connait au depart. Tout se construit en jouant,
  // et deux parties ne se ressemblent pas.
  var DEPART = "neutres";

  return {
    CAMP:CAMP, TRAITS:TRAITS, LINES:LINES, SPARK:SPARK,
    camp:function(k){ return CAMP[k]||"solo"; },
    spark:function(a,b){ return SPARK[key(a,b)]||0; },
    depart:function(v){ if(v) DEPART = v; return DEPART; },
    // relation de depart de A envers B
    rel:function(a,b){
      if(a===b) return 100;
      var v=REL[a+">"+b];
      if(v==null){
        var ca=CAMP[a]||"solo", cb=CAMP[b]||"solo";
        var k = ca<cb ? ca+"|"+cb : cb+"|"+ca;
        v = CAMP_REL[k]!=null ? CAMP_REL[k] : -20;
      }
      if(DEPART === "canon")   return v;
      if(DEPART === "neutres") return Math.round((Math.random()-0.5)*16);
      // tiedes : personne n'est verrouille, tout se construit en jouant
      return Math.round(v/2.5 + (Math.random()-0.5)*30);
    },
    // categorie : seul | detendu | tendu | blesse | content
    line:function(k, cat){
      var L = LINES[k]; if(!L) return "...";
      var p = L[cat] || L.detendu || L.seul;
      if(!p || !p.length) return "...";
      return p[Math.floor(Math.random()*p.length)];
    },
    cats:function(){ return ["seul","detendu","tendu","blesse","content"]; }
  };
})();
