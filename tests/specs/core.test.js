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
		var game = new ludorum.games.TicTacToe();

		it("encoding", function () {
			var _case0 = ludorumCBR.utils.encodings.TicTacToe(game);
			expect(Array.isArray(_case0.features)).toBe(true);
			expect(_case0.features.join('|')).toBe('0|0|0|0|0|0|0|0|0');
			var game1 = game.next({ Xs: 4 }),
				_case1 = ludorumCBR.utils.encodings.TicTacToe(game1);
			expect(Array.isArray(_case1.features)).toBe(true);
			expect(_case1.features.join('|')).toBe('0|0|0|0|1|0|0|0|0');
			var game2 = game1.next({ Os: 0 }),
				_case2 = ludorumCBR.utils.encodings.TicTacToe(game2);
			expect(Array.isArray(_case2.features)).toBe(true);
			expect(_case2.features.join('|')).toBe('-1|0|0|0|1|0|0|0|0');
		});

		it("populate MemoryCaseBase", function (done) {
			var memCB = new ludorumCBR.dbs.MemoryCaseBase({ 
				game: game, 
				encoding: ludorumCBR.utils.encodings.TicTacToe 
			});
			expect(memCB.cases().toArray().length).toBe(0);
			memCB.populate({ n: 1 }).then(function () {
				expect(memCB.cases().toArray().length).toBeGreaterThan(0);
				done();
			});
		});

		it("playing CBRPlayer with empty case base", function (done) {
			var memCB = new ludorumCBR.dbs.MemoryCaseBase({ 
					game: game, 
					encoding: ludorumCBR.utils.encodings.TicTacToe 
				}),
				cbrPlayer = new ludorumCBR.CBRPlayer({ caseBase: memCB, k: 10 }),
				match = new ludorum.Match(game, [cbrPlayer, cbrPlayer]);
			match.run().then(function () {
				expect(match.history.length).toBeGreaterThan(4);
				done();
			});
		});

		it("playing CBRPlayer with populated case base", function (done) {
			var memCB = new ludorumCBR.dbs.MemoryCaseBase({ 
					game: game, 
					encoding: ludorumCBR.utils.encodings.TicTacToe 
				});
			memCB.populate({ n: 5 }).then(function () {
				var cbrPlayer = new ludorumCBR.CBRPlayer({ caseBase: memCB, k: 5 }),
					match = new ludorum.Match(game, [cbrPlayer, cbrPlayer]);
				match.run().then(function () {
					expect(match.history.length).toBeGreaterThan(4);
					done();
				});
			});
		});
	}); // Case bases with TicTacToe.

}); // define.
