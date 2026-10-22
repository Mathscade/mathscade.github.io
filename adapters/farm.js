/* Fruit Farm <-> Mathcade online.
   Each student runs their own farm; the score is the money made from fruit they sold (fruit still growing,
   or picked but not sold, doesn't count). A class game uses the teacher's time, topic and difficulty, shows the
   class leaderboard and saves the result when the market closes. */
(function(){
  const F = window.mcFarm; if(!F) return;
  const { Game, Farm } = F;
  let inClass = false, saved = false;
  const variant = () => Math.round(Game.dur / 60) + ' min';
  window.onFarmEnd = function(){
    if(saved && inClass) return;
    saved = true;
    const sold = Object.values(Farm.stats.soldBy).reduce((a, b) => a + b, 0);
    MC.result({ score:Math.round(Farm.sold), correct:Farm.stats.correct, answered:Farm.stats.answered, seconds:Math.round(Game.dur), variant:variant(),
                details:{ fruitSold:sold, soldBy:Farm.stats.soldBy, picked:Farm.stats.picked, moneyLeft:Math.round(Farm.cash), bigField:F.BLOCKS[1].owned } });
    if(inClass){ inClass = false; MC.leaveSession && MC.leaveSession(); }
  };
  // practice rounds after the class one: each "Start farming" is a new round to save
  document.getElementById('play').addEventListener('click', () => { if(!inClass) saved = false; });
  if(window.MC && MC.register) MC.register({
    game:'farm',
    start(ctx){
      const s = ctx.settings || {};
      if(['easy','medium','hard'].includes(s.difficulty)) window.mcFarmSetDiff && mcFarmSetDiff(s.difficulty, s.topic);
      inClass = true; saved = false; Game.mode = 'class';
      document.getElementById('hubback').style.display = 'none'; document.getElementById('again').style.display = 'none';
      F.me.look = window.Brick && MC.user ? Brick.lookOf(MC.user) : null;
      F.begin(Math.max(30, Math.round(ctx.remainingSeconds || (+s.minutes || 10) * 60)));
      if(MC.classBoard) MC.classBoard({ score:() => Game.state === 'play' || Game.state === 'over' ? Farm.sold : null, lower:false,
        fmt:v => '$' + Math.round(v).toLocaleString(), label:'Class leaderboard', pos:{ top:'96px', right:'12px' } });
    },
    live(){ return { score:Math.round(Farm.sold), correct:Farm.stats.correct, answered:Farm.stats.answered,
                     status:'$' + Math.round(Farm.sold).toLocaleString() + ' sold', finished:Game.state === 'over' }; },
  });
  MC.onUser && MC.onUser(u => { if(u && Game.state !== 'play') F.me.look = window.Brick ? Brick.lookOf(u) : null; });
})();
