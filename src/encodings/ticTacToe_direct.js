/** # TicTacToe direct encoding

The `TicTacToe` encoding has 9 features, one per square in the board. Each feature has the value of 
0 if it is marked with an X, 1 if it is marked with an O, or 0.5 otherwise.

TicTacToe's actions are numbers, hence no transformation or encoding is required.
*/
exports.encodings.TicTacToe.direct = function encodingTicTacToe(game, moves, ply) {
	return {
		ply: ply,
		
		features: game.board.split('').map(function (chr) {
			return chr === 'X' ? (+1) : chr === 'O' ? (-1) : 0; 
		}),

		actions: !moves ? null : game.players.map(function (p) {
			return moves.hasOwnProperty(p) ? moves[p] : null;
		})
	};
};