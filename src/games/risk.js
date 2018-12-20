/**
 */
games.Risk = (function () {  
  
  var DirectCBPlayer = declare(CaseBasedPlayer, {
    constructor: function DirectCBPlayer(params){
      CaseBasedPlayer.call(this, params);
    },

    game: new ludorum_risky.Risk({
      boardMap: ludorum_risky.maps.test01,
      armies: {
        WhiteCountry:  ['White', 6],
        YellowCountry: ['Yellow', 6],
        RedCountry:    ['Red', 6],
        GreenCountry:  ['Green', 6],
        BlueCountry:   ['Blue', 6],
        BlackCountry:  ['Black', 6],
      }
     }),

  });

  return {
    DirectCBPlayer
  };
})();
