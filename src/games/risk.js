/**
 */
games.Risk = (function () {  

  var directFeatures = (game) => {	
    /**
     * armies is an object, with a property for each territoy
     * the value of each key is an array
     * with the player name in the first position
     * and the number of armies in the second position
     * For each territory, if the owner is the active player,
     * I count the number of armies as positive, otherwise, as negative
     */	
    let armies = game.uncompressGameState(game.armies);
    return Object.values(armies).map((territoryInfo) => {
      var [player, numberOfArmies] = territoryInfo;
      return (player === game.activePlayer[0] ? 
        numberOfArmies 
        : -numberOfArmies);
    });
  };

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

     features: directFeatures,

     casesFromGame: function casesFromGame(game, ply, moves){
       var _case = this.newCase(game, ply, moves, {
         features: this.features(game)
       });
       return [_case];
     }

  });

  return {
    DirectCBPlayer
  };
})();
