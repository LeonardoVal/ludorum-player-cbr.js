/* 
*/
define(['creatartis-base', 'ludorum', 'ludorum-player-cbr'], function (base, ludorum, ludorumCBR) {

	describe("TicTacToe's", function () { /////////////////////////////////
		/*
		*/
		var game = new ludorum.games.TicTacToe();

		it("directFeatures function", function () {
			function testGameEncoding(game, expectedFeatures) {
				var features = ludorumCBR.games.TicTacToe.directFeatures(game);
				expect(features.join('|')).toBe(expectedFeatures.join('|'));
			}

			testGameEncoding(game, [0,0,0,0,0,0,0,0,0]);
			testGameEncoding(game.board, [0,0,0,0,0,0,0,0,0]);
			var game1 = game.next({ Xs: 4 });
			testGameEncoding(game1, [0,0,0,0,1,0,0,0,0]);
			testGameEncoding(game1.board, [0,0,0,0,1,0,0,0,0]);
			var game2 = game1.next({ Os: 0 });
			testGameEncoding(game2, [-1,0,0,0,1,0,0,0,0]);
			testGameEncoding(game2.board, [-1,0,0,0,1,0,0,0,0]);
		});

		it("DirectCase encoding", function () {
			function testGameEncoding(game, features) {
				var cases = ludorumCBR.games.TicTacToe.DirectCase.fromGame(game);
				expect(Array.isArray(cases)).toBe(true);
				expect(cases.length).toBe(1);
				var _case = cases[0];
				expect(Array.isArray(_case.features)).toBe(true);
				expect(_case.features.join('|')).toBe(features.join('|'));
			}

			testGameEncoding(game, [0,0,0,0,0,0,0,0,0]);
			var game1 = game.next({ Xs: 4 });
			testGameEncoding(game1, [0,0,0,0,1,0,0,0,0]);
			var game2 = game1.next({ Os: 0 });
			testGameEncoding(game2, [-1,0,0,0,1,0,0,0,0]);
		});

		//TODO equivalent
		//TODO EquivalenceCase encoding
	}); // TicTacToe's.

}); // define.
