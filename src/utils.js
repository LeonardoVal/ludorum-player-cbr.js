/** # Utilities

*/<<<<< Updated upstream
*/
=======
*/

/** This library provides some `encodings` for simple games in Ludorum for testing purposes.
*/
exports.utils.encodings = {
	/** The `TicTacToe` encoding has 9 features, one per square in the board. Each feature has the
	value of 0 if it is marked with an X, 1 if it is marked with an O, or 0.5 otherwise.

	TicTacToe's actions are numbers, hence no transformation or encoding is required.
	*/
	TicTacToe: function encodingTicTacToe(game, moves, ply) {
		return {
			ply: ply,
			features: game.board.split('').map(function (chr) {
				return chr === 'X' ? 1 : chr === 'O' ? -1 : 0; 
			}),
			actions: !moves ? null : game.players.map(function (p) {
				return moves.hasOwnProperty(p) ? moves[p] : null;
			})
		};
	},

	/** The "Risk" encoding has 83 features , 42 to define the number of troops in a territory, 
	 *  42 to define to which player that territory corresponds based on its turn,
	 *  being 0 the corresponding player with the current turn,
	 *  1 the next and so successively and 1 that determines the stage of the game  */

	 Turn: function turn(game,otherPlayer){
		var active = game.players.indexOf(active);
		var other = game.players.indexOf(otherPlayer);
		if(other > active) {
			return (other - active);
		} else { 
			return (6 - (active - other));
		}
	 },

	Risk: function encodingRisk(game, moves, ply) {
		return {
			ply : ply,
			features : game.boardMap.territories.map((t) => turn(game,s[t][0])).concat(s[t][1]).concat(stage), // For each territory , assign colour and number of troops , change colour based on turn.
			actions: !moves ? null : game.players.map(function (p) {
				return moves.hasOwnProperty(p) ? moves[p] : null;
			})
		};

	}
		


};
>>>>>>> Stashed changes
