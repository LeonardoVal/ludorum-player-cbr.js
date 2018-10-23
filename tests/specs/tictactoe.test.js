/* 
*/
define(['creatartis-base', 'ludorum', 'ludorum-player-cbr'], function (base, ludorum, ludorumCBR) {

	describe("TicTacToe's implementations", function () { /////////////////////////////////
		function testGameEncoding(cases, expectedCases) {
			expect(Array.isArray(cases)).toBe(true);
			expect(cases.length).toBe(expectedCases.length);
			var expectedStrs = new Set(expectedCases.map(function (expectedCase) {
				return expectedCase.join('|');	
			}));
			cases.forEach(function (_case) {
				expect(Array.isArray(_case.features)).toBe(true);
				expect(expectedStrs.has(_case.features.join('|'))).toBe(true);	
			});
		}

		it("DirectCBPlayer features", function () {
			var cbrPlayer = new ludorumCBR.games.TicTacToe.DirectCBPlayer(),
				game = cbrPlayer.game;

			function testGameEncoding(game, expectedFeatures) {
				var features = cbrPlayer.features(game);
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

		it("DirectCase casesFromGame", function () {
			var cbrPlayer = new ludorumCBR.games.TicTacToe.DirectCBPlayer(),
				game = cbrPlayer.game;

			testGameEncoding(cbrPlayer.casesFromGame(game), [[0,0,0,0,0,0,0,0,0]]);
			var game1 = game.next({ Xs: 4 });
			testGameEncoding(cbrPlayer.casesFromGame(game1), [[0,0,0,0,1,0,0,0,0]]);
			var game2 = game1.next({ Os: 0 });
			testGameEncoding(cbrPlayer.casesFromGame(game2), [[-1,0,0,0,1,0,0,0,0]]);
		});

		it("EquivalenceCBPlayer casesFromGame", function () {
			var cbrPlayer = new ludorumCBR.games.TicTacToe.EquivalenceCBPlayer(),
				game = cbrPlayer.game;

			testGameEncoding(cbrPlayer.casesFromGame(game), [[0,0,0,0,0,0,0,0,0]]);
			var game1 = game.next({ Xs: 4 });
			testGameEncoding(cbrPlayer.casesFromGame(game1), [[0,0,0,0,1,0,0,0,0]]);
			var game2 = game1.next({ Os: 0 });
			testGameEncoding(cbrPlayer.casesFromGame(game2), [
				[-1,0,0,0,1,0,0,0,0], [0,0,-1,0,1,0,0,0,0],
				[0,0,0,0,1,0,-1,0,0], [0,0,0,0,1,0,0,0,-1]
			]);
		});

	}); // TicTacToe's.

}); // define.
