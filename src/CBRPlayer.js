/** # CBR Player 

*/
var CBRPlayer = exports.CBRPlayer = base.declare(ludorum.Player, {
	/** 
	*/
	constructor: function CBRPlayer(params) {
		ludorum.Player.call(this, params);
		this.caseBase = params && params.caseBase;
		this.k = params && params.k || 20;
	},

	/** 
	*/
	checkMoves: function checkMoves(game, role) {
		var r = [[], []];
		this.movesFor(game, role).forEach(function (move) {
			var game2 = game.perform(move, role),
				result = game2.result();
			if (!result) {
				r[1].push(move); // Not a losing move.
			} else if (result[role] > 0) {
				r[0].push(move); // Winning move.
			}
		});
		return r;
	},

	/** A `CBRPlayer` takes the action evaluations from the case base, and splits them into actions
	with possitive evaluations and the ones with evaluations less than or equal to zero. If there
	are possitively evaluated actions, one of these is chosen randomly with a probability 
	proportional to the evaluation. If all actions have non possitive evaluations, one of these is
	chosen with a probability inversely proportional to the evaluation.   
	*/
	decision: function decision(game, role) {
		var checkMoves = this.checkMoves(game, role);
		if (checkMoves[0].length > 0) {
			return this.random.choice(checkMoves[0]);
		} else if (checkMoves[1].length < 2) {
			if (checkMoves[1].length === 1) {
				return checkMoves[1][0];
			} else { // if (checkMoves[1].length < 1)
				return this.random.choice(this.movesFor(game, role));
			}
		}
		var actions = iterable(checkMoves[1]).map(function (action) {
				return [action +'', [action, 0]];
			}).toObject();
		this.caseBase.actionEvaluations(game, role, { k: this.k }).forEach(function (t) {
			var entry = actions[t[0] +''];
			if (entry) {
				entry[1] += t[1];
			}
		});
		var minEval = +Infinity,
			positiveActions = Object.values(actions).filter(function (t) {
				minEval = Math.min(minEval, t[1]);
				return t[1] > 0;
			}),
			negativeActions = Object.values(actions).filter(function (t) {
				return t[1] <= 0;
			}).map(function (t) {
				return [t[0], t[1] - minEval];
			}),
			result;
		if (positiveActions.length > 1) {
			result = this.random.weightedChoice(this.random.normalizeWeights(positiveActions));
		} else if (positiveActions.length === 1) {
			result = positiveActions[0][0];
		} else {
			result = this.random.weightedChoice(this.random.normalizeWeights(negativeActions));
		}
		return result;
	},

	// Utilities. /////////////////////////////////////////////////////////////////////////////////

	assess: function assess(players, options) {
		if (!Array.isArray(players)) {
			players = [players];
		}
		var cbrPlayer = this,
			game = this.caseBase.game,
			evaluation = iterable(players).map(function (player) {
				return [player.name, iterable(game.players).map(function (p) {
						return [p, [0,0,0]];
					}).toObject()];
				}).toObject(),
			n = options && +options.n || 300,
			finishedMatchesCount = 0,
			intervalId = 0;
		if (options.logger) {
			intervalId = setInterval(function () {
				options.logger.info("Assessment finished "+ finishedMatchesCount +" matches.");
			}, options.logTime || 30000);
		}
		return base.Future.sequence(base.Iterable.range(n).product(players), function (tuple) {
			var player = tuple[1],
				matchPlayers = base.Iterable.repeat(player, game.players.length).toArray(),
				playerIndex = tuple[0] % game.players.length,
				playerRole = game.players[playerIndex];
			matchPlayers[playerIndex] = cbrPlayer;
			var match = new ludorum.Match(game, matchPlayers);
			return match.run().then(function () {
				var r = match.result()[playerRole];
				evaluation[player.name][playerRole][r > 0 ? 0 : r < 0 ? 2 : 1]++;
				finishedMatchesCount++;
			});
		}).then(function () {
			clearInterval(intervalId);
			if (options.logger) {
				options.logger.info("Assessment finished "+ finishedMatchesCount +" matches.");
			}
			return evaluation;
		});
	}
}); // declare CBRPlayer