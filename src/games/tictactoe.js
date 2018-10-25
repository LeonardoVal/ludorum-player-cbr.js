/** # TicTacToe CBR
 
*/
games.TicTacToe = (function () {
	/** ## Features direct from the board ####################################################### */
	
	var directFeatures = function features(game) {
		var board = typeof game === 'string' ? game : game.board;
		return board.split('').map(function (chr) {
			return chr === 'X' ? (+1) : chr === 'O' ? (-1) : 0; 
		});
	};

	var DirectCBPlayer = declare(CaseBasedPlayer, {
		constructor: function DirectCBPlayer(params) {
			CaseBasedPlayer.call(this, params);
		}, 

		game: new ludorum.games.TicTacToe(),

		features: directFeatures,
		
		casesFromGame: function casesFromGame(game, ply, moves) {
			return [
				this.newCase(game, ply, moves, { features: this.features(game) })
			];
		}
	}); // declare TicTacToe.DirectCBPlayer

	/** ## Equivalence based on board symmetries and rotations. ################################# */

	/** `MAPPINGS` is a list of square indexes that define transformations between equivalent
	Tictactoe boards.
	*/
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

	var equivalent = function equivalent(game) {
		var board = typeof game === 'string' ? game : game.board,
			maps = MAPPINGS.map(function (mapping) {
				return mapping.map(function (i) {
					return board.charAt(i);
				}).join('');
			});
		maps = Array.from(new Set(maps)); // Remove duplicates.
		maps.sort();
		return maps;
	};

	var EquivalenceCBPlayer = declare(CaseBasedPlayer, {
		constructor: function EquivalenceCBPlayer(params) {
			CaseBasedPlayer.call(this, params);
		}, 

		game: new ludorum.games.TicTacToe(),

		features: directFeatures,

		MAPPINGS: MAPPINGS,

		/** 
		*/
		casesFromGame: function fromGame(game, ply, moves) {
			var cbrPlayer = this,
				board = game.board.split(''),
				activePlayer = game.activePlayer();
			if (moves) {
				board[moves[activePlayer]] = '!';
			}
			var boards = equivalent(board.join('')).map(function (b) {
				var m = b.indexOf('!');
				return b.replace('!', '_') + m;
			});
			return boards.map(function  (board) {
				if (moves) {
					moves[activePlayer] = +(board.substr(9));
				}
				return cbrPlayer.newCase(game, ply, moves, 
					{ features: cbrPlayer.features(board.substr(0,9)) }
				);
			});
		}
	}); // declare TicTacToe.EquivalenceCBPlayer

	return {
		directFeatures: directFeatures,
		DirectCBPlayer: DirectCBPlayer,

		MAPPINGS: MAPPINGS,
		equivalent: equivalent,
		EquivalenceCBPlayer: EquivalenceCBPlayer
	};
})();