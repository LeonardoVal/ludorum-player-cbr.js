/** # CBR Player 

*/
var CBRPlayer = exports.CBRPlayer = declare(ludorum.Player, {
	constructor: function CBRPlayer(params) {
		ludorum.Player.call(this, params);
		this.caseDB = params && params.caseDB;
		this.caseN = params && params.caseN || 100;
	},

	evaluatedMoves: function evaluatedMoves(game, role) {
		var caseDB = this.caseDB,
			gameFeatures = this.caseDB.features(game),
			r = base.iterable(this.movesFor(game, role)).map(function (move) {
				return [move +'', [move, 0]];
			}).toObject();
		base.iterable(caseDB.knn(this.caseN, game, role)).mapApply(function (_case, d) {
			var caseMove = _case[_case.length - 1],
				em = r[caseMove +''];
			if (em) {
				em[1] += (_case.result[role][0] - _case.result[role][2]) / _case.count / 
					caseDB.totalCount; // / (1 + d);
			}
		});
		return Object.values(r);
	},

	decision: function decision(game, role) {
		var evaluatedMoves = this.evaluatedMoves(game, role);
		var bestMoves = iterable(evaluatedMoves).greater(function (t) {
			return t[1];
		}).map(function (t) {
			return t[0];
		});
		raiseIf(!bestMoves || !bestMoves.length, 
			"No moves where selected at ", game, " for player ", role, "!");
		return bestMoves.length === 1 ? bestMoves[0] : Randomness.DEFAULT.choice(bestMoves);
	},

	assess: function assess(game, player, n) { //FIXME game.players.length !== 2
		var cbrPlayer = this,
			evaluation = iterable(game.players).map(function (p) {
				return [p, [0,0,0]];
			}).toObject();
		n = +n || 100;
		return Future.sequence(Iterable.range(n / 2), function (i) {
			var match = new ludorum.Match(game, [player, cbrPlayer]);
			return match.run().then(function () {
				var r = match.result()[game.players[0]];
				evaluation[game.players[0]][r > 0 ? 0 : r < 0 ? 2 : 1]++;
			}).then(function () {
				var match = new ludorum.Match(game, [player, cbrPlayer]);
				return match.run().then(function () {
					var r =  match.result()[game.players[1]];
					evaluation[game.players[1]][r > 0 ? 0 : r < 0 ? 2 : 1]++;
				});
			});
		}).then(function () {
			return evaluation;
		});
	}
}); // declare CBRPlayer