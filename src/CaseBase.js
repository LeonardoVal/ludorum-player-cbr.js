/** # CaseBase 

A `CaseBase` holds all cases for a game.
*/
var CaseBase = exports.CaseBase = base.declare({
	constructor: function CaseBase(params) {
		this.game = params && params.game;
		if (params && typeof params.encoding === 'function') {
			this.encoding = params.encoding;
		}
		if (params && typeof params.distance === 'function') {
			this.distance = params.distance;
		}
		this.random = params && params.random || Randomness.DEFAULT;
	},

	/** The `encoding` of a case takes a `game` state and the `moves` performed and returns an 
	objects with the following data:
	
	+ `features`: An array of integer values that identify with the game state,

	+ `actions`: An array with one value per player, an integer identifying an action if the player
	is active, or `null` if the player has not moved.
	*/
	encoding: unimplemented('CaseBase', 'encoding(game, moves, ply)'),

	/** ## Distances ########################################################################### */

	/** The default `distance` is a form of Manhattan distance, which does not count `null` or 
	`NaN` features.
	*/
	distance: function distance(features1, features2) {
		return base.Iterable.zip(features1, features2).mapApply(function (f1, f2) {
			if (f1 !== null && !isNaN(f1) && f2 !== null && !isNaN(f2)) {
				return Math.abs(f1 - f2);
			} else {
				return 0;
			}
		}).sum();
	},

	/** ## Case acquisition #################################################################### */

	/** Adding a case to the database is not implemented by default.
	*/
	addCase: unimplemented('CaseBase', 'addCase(_case)'),

	/** The `addMatch` method runs the given `match` and adds all its game states as cases in the
	database. It returns a promise.
	*/
	addMatch: function addMatch(match, options) {
		//TODO options.
		var cdb = this;
		return match.run().then(function () {
			var result = match.result(),
				history = match.history,
				entry, _case;
			cdb.game.players.forEach(function (p) {
				result[p] = [
					result[p] > 0 ? 1 : 0,
					result[p] === 0 ? 1 : 0,
					result[p] < 0 ? 1 : 0,
				];
			});
			for (var i = history.length - 1; i >= 0; i--) {
				entry = history[i];
				if (entry.moves) {
					_case = cdb.encoding(entry.state, entry.moves, i);
					_case.result = result;
					cdb.addCase(_case);
					if (+options.retainThreshold > cdb.nn(1, entry.state)[0][1]) {
						break;
					}
				}
			}
			return match;
		});
	},

	/** The `addMatches` method takes a sequence of `matches`, runs each in order and adds all 
	resulting game states to the database. It returns a promise.
	*/
	addMatches: function addMatches(matches, options) {
		var cdb = this,
			matchCount = 0,
			intervalId = 0;
		if (options.logger) {
			intervalId = setInterval(function () {
				options.logger.info("Added "+ matchCount +" matches.");
			}, options.logTime || 30000);
		}
		return Future.sequence(matches, function (match) {
			matchCount++;
			return cdb.addMatch(match, options);
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

	+ `trainer`: The player to use agains the opponents. A random player is used by default.

	+ `players`: The trainer's opponents to use to play the matches. The trainer is used by default.

	Other options are passed to the `addMatches` method. The result is a promise.
	*/
	populate: function populate(options) {
		options = options || {};
		var cdb = this,
			game = options.game || this.game,
			n = isNaN(options.n) ? 100 : +options.n,
			trainer = options.trainer || new ludorum.players.RandomPlayer({ name: 'RandomPlayer' }),
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

	/** ## Database use ######################################################################## */

	/** The `cases` method returns the sequence of all cases in the database. Case order is not
	defined.
	*/
	cases: unimplemented('CaseBase', 'cases(filters)'),

	/** The `nn` method returns the `k` neareast neighbours of the given game state. 
	*/
	nn: function nn(k, game) {
		var cb = this,
			gameCase = this.encoding(game),
			cs = iterable(this.cases()).map(function (_case) {
				return [_case, cb.distance(_case.features, gameCase.features)];
			}).sorted(function (c1, c2) {
				return c1[1] - c2[1];
			}).toArray();
		return cs.slice(0, +k);
	},

	/**TODO
	*/
	actionEvaluations: function actionEvaluations(game, role, options) {
		var cb = this,
			k = options && +options.k || 10,
			roleIndex = game.players.indexOf(role),
			r = base.iterable(game.moves()[role]).map(function (move) {
				return [JSON.stringify(move), [move, 0]];
			}).toObject(),
			knn = cb.nn(k, game);
		iterable(knn).forEachApply(function (_case, distance) {
			var m = r[JSON.stringify(_case.actions[roleIndex])],
				result = _case.result[role],
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

	/**TODO
	*/
	gameEvaluation: function gameEvaluation(game, role, options) { //FIXME
		var cb = this,
			k = options && +options.k || 10,
			r = base.iterable(game.moves()[role]).map(function (move) {
				return [JSON.stringify(move), [move, 0]];
			}).toObject(),
			knn = cb.nn(k, game, role);
		return iterable(knn).map(function (_case, distance) {
			return (_case.result[role][0] - _case.result[role][2]) / (1 + distance);
		}).sum();
	},

	/** ## Utilities ########################################################################### */

	'static __SERMAT__': {
		identifier: 'CaseBase',
		serializer: function serialize_CaseBase(obj) { //FIXME
			return [{
				game: obj.game,
				encoding: obj.hasOwnProperty('encoding') ? obj.encoding : null
			}];
		}
	},
}); // declare CaseBase