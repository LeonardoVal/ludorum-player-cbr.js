/**
 */
games.Risk = (function () {
  return {
    /** The "Risk" encoding has 83 features , 42 to define the number of troops in a territory,
     *  42 to define to which player that territory corresponds based on its turn,
     *  being 0 the corresponding player with the current turn,
     *  1 the next and so successively and 1 that determines the stage of the game  */

    Turn: function turn(game, otherPlayer) {
      var active = game.players.indexOf(active);
      var other = game.players.indexOf(otherPlayer);
      if (other > active) {
        return other - active;
      } else {
        return 6 - (active - other);
      }
    },

    Risk: function encodingRisk(game, moves, ply) {
      return {
        ply: ply,
        features: game.boardMap.territories
          .map(t => turn(game, s[t][0])).concat(s[t][1]).concat(stage), // For each territory , assign colour and number of troops , change colour based on turn.
        actions: !moves ? null : game.players.map(function (p) {
          return moves.hasOwnProperty(p) ? moves[p] : null;
        })
      };
    }
  };
})();
