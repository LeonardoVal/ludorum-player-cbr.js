/** # CaseBasedPlayer 

*/
var CaseBasedPlayer = exports.CaseBasedPlayer = base.declare(ludorum.Player, {
	/** 
	*/
	constructor: function CaseBasedPlayer(params) {
		ludorum.Player.call(this, params);
		this.k = params && params.k || 20;
		this.caseBase = params && params.caseBase || new MemoryCaseBase();
		this.caseBase.init(this.game, this);
	},

	/** The method `casesFromGame` takes a `game` state and returns a case. This object includes
	the game state's features, ply, actions and results.
	*/
	casesFromGame: base.objects.unimplemented('CaseBasedPlayer', 'casesFromGame(game, ply, moves)'),

	/**
	*/
	newCase: function newCase(game, ply, moves, _case) {
		_case = _case || {};
		if (!_case.hasOwnProperty('ply')) {
			_case.ply = +ply;
		}
		if (!_case.hasOwnProperty('actions')) {
			_case.actions = Case.actionsFromMoves(game.players, moves);
		}
		if (!_case.hasOwnProperty('results')) {
			_case.results = Case.emptyResults(game.players);
		}
		return new Case(_case);
	},

	/** ## Database building #################################################################### */

	/** The `addMatch` method runs the given `match` and adds all its game states as cases in the
	player's database. It returns a promise.
	*/
	addMatch: function addMatch(match, options) {
		var cbrPlayer = this,
			retainThreshold = +options.retainThreshold || 0;
		return match.run().then(function () {
			var result = match.result(),
				cases = iterable(match.history).filter(function (entry) {
					return !entry.moves;
				}, function (entry, i) {
					return cbrPlayer.casesFromGame(entry.state, i, entry.moves);  
				}).flatten().map(function (_case) {
					return _case.addResult(result);
				});
			cbrPlayer.caseBase.addCase(cases);
			return match;
		});
	},

	/** The `addMatches` method takes a sequence of `matches`, runs each in order and adds all 
	resulting game states to the database. It returns a promise.
	*/
	addMatches: function addMatches(matches, options) {
		var cbrPlayer = this,
			matchCount = 0,
			intervalId = 0;
		if (options.logger) {
			intervalId = setInterval(function () {
				options.logger.info("Added "+ matchCount +" matches.");
			}, options.logTime || 30000);
		}
		return Future.sequence(matches, function (match) {
			matchCount++;
			return cbrPlayer.addMatch(match, options);
		}).then(function (r) {
			if (options.logger) {
				options.logger.info("Added "+ matchCount +" matches.");
			}
			clearInterval(intervalId);
			return r;
		});
	},

	/** The `populate` method adds cases to the database by running several matches and adding the
	resulting game states. The `options` argument may include the following:

	+ `game`: The game state from which to start the matches. The database's `game` is used by 
	default.

	+ `n`: The number of matches to run; 100 by default.

	+ `trainer`: The player to use agains the opponents. This player is used by default.

	+ `players`: The trainer's opponents to use to play the matches. The trainer is used by default.

	Other options are passed to the `addMatches` method. The result is a promise.
	*/
	populate: function populate(options) {
		options = options || {};
		var game = options.game || this.game,
			n = isNaN(options.n) ? 100 : +options.n,
			trainer = options.trainer || this,
			players = options.players || [trainer];
		if (!Array.isArray(players)) {
			players = [players];
		}
		var tournament = new ludorum.tournaments.Measurement(game, trainer, players, 1),
			matchups = tournament.__matches__().toArray();
		return this.addMatches(Iterable.range(Math.ceil(n / matchups.length))
			.product(matchups)
			.mapApply(function (i, match) {
				return new ludorum.Match(game, match.players);
			}), options);
	},

	/** ## Playing ############################################################################## */

	/** `actionEvaluations` assigns a number to every action available to the given `role` at the
	given `game` state. It uses the case base to retrieve the _k_ most similar cases. 
	*/
	actionEvaluations: function actionEvaluations(game, role, options) { //FIXME
		var k = options && +options.k || this.k,
			r = base.iterable(game.moves()[role]).map(function (move) {
				return [JSON.stringify(move), [move, 0]];
			}).toObject(),
			knn = this.caseBase.nn(k, this.casesFromGame(game));
		iterable(knn).forEachApply(function (_case, distance) {
			var m = r[JSON.stringify(_case.actions[role])],
				result = _case.results[role],
				ev, support, ratio;
			if (m) {
				support = _case.count / (10 + _case.count);
				ratio = (result[0] + result[2] && 
					((result[0] - result[2]) / (result[0] + result[2])));
				ev = support * ratio * (1 / (1 + distance));
				if (isNaN(ev)) {
					raise("Action evaluation is NaN for case: ", JSON.stringify(_case),
						" (distance= ", distance, ")!");
				}
				m[1] += ev;
			}
		});
		return Object.values(r);
	},

	/** `gameEvaluation` assigns a number to the given `game` state. It uses the case base to
	retrieve the _k_ most similar cases, and aggregates their results. It is suitable for an 
	heuristic player. 
	*/
	gameEvaluation: function gameEvaluation(game, role, options) { //FIXME
		var k = options && +options.k || this.k,
			r = base.iterable(game.moves()[role]).map(function (move) {
				return [JSON.stringify(move), [move, 0]];
			}).toObject(),
			knn = cb.nn(k, game, role);
		return iterable(knn).map(function (_case, distance) {
			return (_case.results[role][0] - _case.results[role][2]) / (1 + distance);
		}).sum();
	},

	/** `checkMoves` classifies all moves available to the given `role` at the given `game` state.
	The result is an array of two arrays of moves. The first array has all the winning moves, while
	the second array has all the moves that do not finish the game. Losing and drawing moves are
	discarded.  
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

	/** A `CaseBasedPlayer` takes the action evaluations from the case base, and splits them into
	actions with possitive evaluations and the ones with evaluations less than or equal to zero. If 
	there are possitively evaluated actions, one of these is chosen randomly with a probability 
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
		this.actionEvaluations(game, role, { k: this.k }).forEach(function (t) {
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
	}
}); // declare CBRPlayer