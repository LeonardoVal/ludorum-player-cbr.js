/**
 
*/
games.TicTacToe = (function () {
	function directFeatures(game) {
		var board = typeof game === 'string' ? game : game.board;
		return board.split('').map(function (chr) {
			return chr === 'X' ? (+1) : chr === 'O' ? (-1) : 0; 
		});
	}

	var MAPPINGS = [
		[0,1,2,3,4,5,6,7,8], // original
		[2,1,0,5,4,3,8,7,6], // vertical axis symmetry
		[6,7,8,3,4,5,0,1,2], // horizontal axis symmetry
		[6,3,0,7,4,1,8,5,2], // 90 clockwise rotation
		[2,5,8,1,4,7,0,3,6], // 90 counter-clockwise rotation 
		[8,7,6,5,4,3,2,1,0], // central symmetry
		[8,5,2,7,4,1,6,3,0], // 90 counter-clockwise rotation + vertical axis symmetry
		[0,3,6,1,4,7,2,5,8]  // 90 clockwise rotation + vertical axis symmetry
	];

	function equivalent(game) {
		var board = typeof game === 'string' ? game : game.board,
			maps = MAPPINGS.map(function (mapping) {
				return mapping.map(function (i) {
					return board.charAt(i);
				}).join('');
			});
		maps.sort();
		return maps;
	}

	return {
		directFeatures: directFeatures,

		/**
		*/
		DirectCase: declare(Case, {
			'static fromGame': function fromGame(game, ply, moves) {
				var _case = new this({
						ply: +ply,
						features: directFeatures(game),
						actions: Case.actionsFromMoves(game.players, moves),
						results: Case.emptyResults(game.players)
					});
				return [_case];
			}
		}),

		equivalent: equivalent,

		/**
		*/
		EquivalenciesCase: declare(Case, {
			'static fromGame': function fromGame(game, ply, moves) {
				var board = game.board.split(''),
					activePlayer = game.activePlayer();
				if (moves) {
					board[moves[activePlayer]] = '!';
				}
				var boards = equivalent(board.join('')).map(function (b) {
					var m = b.indexOf('!');
					return b.replace('!', '_') + m;
				});
				boards.sort();
				board = boards[0];
				if (moves) {
					moves[activePlayer] = +(board.substr(9));
				}
				var _case = new this({
						ply: +ply,
						features: directFeatures(board.substr(0,9)),
						actions: Case.actionsFromMoves(game.players, moves),
						results: Case.emptyResults(game.players)
					});
				return [_case];
			}
		})
	};
})(); // declare TicTacToe.DirectCase