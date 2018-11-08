/* 
*/
define(['creatartis-base', 'ludorum', 'ludorum-player-cbr'], function (base, ludorum, ludorumCBR) {

	describe("Library", function () { /////////////////////////////////////////////////////////////
		it("layout", function () {
			expect(typeof ludorumCBR.Case).toBe('function');
			expect(typeof ludorumCBR.CaseBase).toBe('function');
			expect(typeof ludorumCBR.CaseBasedPlayer).toBe('function');
			expect(typeof ludorumCBR.dbs).toBe('object');
			expect(typeof ludorumCBR.dbs.MemoryCaseBase).toBe('function');
		});
	}); // layout

	describe("Case bases with TicTacToe", function () { ///////////////////////////////////////////
		var training = ludorumCBR.training;

		it("populate MemoryCaseBase", function (done) {
			var cbrPlayer = new ludorumCBR.games.TicTacToe.DirectCBPlayer();
			expect(cbrPlayer.caseBase instanceof ludorumCBR.dbs.MemoryCaseBase).toBe(true);
			var db = cbrPlayer.caseBase;
			expect(db.cases().toArray().length).toBe(0);
			training.populate(cbrPlayer, { n: 1 }).then(function () {
				expect(db.cases().toArray().length).toBeGreaterThan(0);
				done();
			});
		});

		it("playing CBRPlayer with empty case base", function (done) {
			var cbrPlayer = new ludorumCBR.games.TicTacToe.DirectCBPlayer({ k: 10 }),
				match = new ludorum.Match(cbrPlayer.game, [cbrPlayer, cbrPlayer]);
			match.run().then(function () {
				expect(match.history.length).toBeGreaterThan(4);
				done();
			});
		});

		it("playing CBRPlayer with populated case base", function (done) {
			var cbrPlayer = new ludorumCBR.games.TicTacToe.DirectCBPlayer({ k: 10 });
			training.populate(cbrPlayer, { n: 5 }).then(function () {
				var match = new ludorum.Match(cbrPlayer.game, [cbrPlayer, cbrPlayer]);
				match.run().then(function () {
					expect(match.history.length).toBeGreaterThan(4);
					done();
				});
			});
		});
	}); // Case bases with TicTacToe.

}); // define.
