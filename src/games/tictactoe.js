/**
 
*/
games.TicTacToe = {
	DirectCase: declare(Case, {
		/**
		 
		*/
		'static fromGame': function fromGame(game, ply, moves) {
			var features = game.board.split('').map(function (chr) {
					return chr === 'X' ? (+1) : chr === 'O' ? (-1) : 0; 
				}),
				actions = iterable(game.players).map(function (p) {
					return [p, moves && moves.hasOwnProperty(p) ? moves[p] : null];
				}).toObject(),
				results = iterable(game.players).map(function (p) {
					return [p, [0, 0, 0]];
				}).toObject(),
				_case = new this({
					ply: +ply,
					features: features,
					actions: actions,
					results: results
				});
			return [_case];
		}

	})
}; // declare TicTacToe.DirectCase