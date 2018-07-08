/** # CBR Player 

*/
exports.CBRPlayer = base.declare(ludorum.Player, {
	constructor: function CBRPlayer(params) {
		ludorum.Player.call(this, params);
		this.caseBase = params && params.caseBase;
		this.k = params && params.k || 20;
	},

	decision: function decision(game, role) {
		var actions = this.caseBase.actionEvaluations(game, role, { k: this.k }),
			positiveActions = actions.filter(function (t) {
				return t[1] > 0;
			}),
			negativeActions = actions.filter(function (t) {
				return t[1] < 0;
			}).map(function (t) {
				return [t[0], -t[1]];
			});
		if (positiveActions.length < 1) {
			if (negativeActions.length < 1) {
				return this.random.choice(this.movesFor(game, role));
			} else if (negativeActions.length === 1) {
				return negativeActions[0][0];
			} else {
				return this.random.weightedChoice(this.random.normalizeWeights(negativeActions));
			}
		} else if (positiveActions.length === 1) {
			return positiveActions[0][0];
		} else {
			return this.random.weightedChoice(this.random.normalizeWeights(positiveActions));
		}
	},

	// Utilities. /////////////////////////////////////////////////////////////////////////////////

	assess: function assess(game, player, n) {
		var cbrPlayer = this,
			evaluation = base.iterable(game.players).map(function (p) {
				return [p, [0,0,0]];
			}).toObject(),
			players = base.Iterable.repeat(player, game.players.length).toArray();
		n = +n || 100;
		return base.Future.sequence(base.Iterable.range(n), function (i) {
			var matchPlayers = players.slice(),
				playerIndex = i % game.players.length,
				playerRole = game.players[playerIndex];
			matchPlayers[playerIndex] = cbrPlayer;
			var match = new ludorum.Match(game, matchPlayers);
			return match.run().then(function () {
				//console.log("Match #"+ i +":\n\t"+ match.history.map((g) => g.board).join("\n\t"));//FIXME
				var r = match.result()[playerRole];
				evaluation[playerRole][r > 0 ? 0 : r < 0 ? 2 : 1]++;
			});
		}).then(function () {
			return evaluation;
		});
	}
}); // declare CBRPlayer