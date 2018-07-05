/* 
*/
define(['creatartis-base', 'ludorum', 'ludorum-player-cbr'], function (base, ludorum, ludorumCBR) {

	describe("Library", function () { /////////////////////////////////////////////////////////////
		it("layout", function () {
			expect(typeof ludorumCBR.CaseBase).toBe('function');
			expect(typeof ludorumCBR.CBRPlayer).toBe('function');
			expect(typeof ludorumCBR.dbs).toBe('object');
		});
	}); // layout

	describe("Case bases with TicTacToe", function () { ///////////////////////////////////////////
		/*
		*/
		function encodingTicTacToe(game, moves) {
			return {
				features: game.board.split('').map(function (chr) {
					return chr === 'X' ? 0 : chr === 'O' ? 1 : 0.5; 
				}),
				actions: !moves ? null : game.players.map(function (p) {
					return moves.hasOwnProperty(p) ? moves[p] : null;
				})
			};
		}

		var game = new ludorum.games.TicTacToe(),
			memCB = new ludorumCBR.dbs.MemoryCaseBase({ 
				game: game, 
				encoding: encodingTicTacToe 
			});

		it("encoding", function () {
			var _case0 = memCB.encoding(game);
			expect(Array.isArray(_case0.features)).toBe(true);
			expect(_case0.features.join('|')).toBe('0.5|0.5|0.5|0.5|0.5|0.5|0.5|0.5|0.5');
		});

	}); // Case bases with TicTacToe.

}); // define.
