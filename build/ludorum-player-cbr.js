(function (init) { "use strict";
			if (typeof define === 'function' && define.amd) {
				define(["creatartis-base","sermat","ludorum"], init); // AMD module.
			} else if (typeof exports === 'object' && module.exports) {
				module.exports = init(require("creatartis-base"),require("sermat"),require("ludorum")); // CommonJS module.
			} else {
				this["ludorum-player-cbr"] = init(this.base,this.Sermat,this.ludorum); // Browser.
			}
		}).call(this,/** Package wrapper and layout.
*/
function __init__(base, Sermat, ludorum) { "use strict";
// Import synonyms. ////////////////////////////////////////////////////////////////////////////////
	var declare = base.declare,
		raise = base.raise,
		raiseIf = base.raiseIf,
		Randomness = base.Randomness,
		Iterable = base.Iterable,
		iterable = base.iterable,
		Future = base.Future;

// Library layout. /////////////////////////////////////////////////////////////////////////////////
	var exports = {
		__package__: 'ludorum-player-cbr',
		__name__: 'ludorum_player_cbr',
		__init__: __init__,
		__dependencies__: [base, Sermat, ludorum],
		__SERMAT__: { include: [base, ludorum] }
	};


/** # CBRDatabase 

*/
var CBRDatabase = exports.CBRDatabase = declare({
	constructor: function CBRDatabase(params) {
		var cdb = this;
		this.cases = params && params.cases || [];
		this.index = params && params.index || iterable(this.cases).map(function (_case, i) {
			return [cdb.___caseKey__(_case), i];
		}).toObject();
		this.featureFunction = params && params.featureFunction;
		this.maxDistance = params && params.maxDistance || Infinity;
		this.totalCount = iterable(this.cases).map(function (_case) {
				return _case.count |0;
			}).sum();
	},

	___caseKey__: function ___caseKey__(_case) {
		return _case.join(' ');
	},

	features: function features(game, moves) {
		return this.featureFunction(game, moves);
	},

	// Case building //////////////////////////////////////////////////////////////////////////////

	addCase: function addCase(_case, results) {
		var caseKey = this.___caseKey__(_case),
			caseIndex = this.index[caseKey];
		if (typeof caseIndex === 'undefined') {
			_case = _case.slice(); // Shallow copy.
			this.index[caseKey] = this.cases.length;
			this.cases.push(_case);
			_case.result = iterable(results).mapApply(function (p, r) {
				return [p, [0, 0, 0]];
			}).toObject();
		} else {
			_case = this.cases[caseIndex];
		}
		_case.count = (_case.count || 0) + 1;
		for (var p in results) {
			if (results[p] > 0) {
				_case.result[p][0]++;
			} else if (results[p] < 0) {
				_case.result[p][2]++;
			} else { 
				_case.result[p][1]++;
			}	
		}
		this.totalCount++;
		return _case.count;
	},

	addMatch: function addMatch(match) {
		var cdb = this,
			history = [];
		match.events.on('move', function (g, ms) {
			var fs = cdb.features(g, ms);
			history.push(fs);
		});
		return match.run().then(function () {
			var r = match.result(),
				count = 0;
			history.forEach(function (fs) {
				count += cdb.addCase(fs, r);
			});
			return count;
		});
	},

	addMatches: function addMatches(matches) {
		var cdb = this;
		return base.Future.sequence(matches, function (match) {
			return cdb.addMatch(match);
		});
	},

	addRandomMatches: function addRandomMatches(n, game) {
		return this.addMatches(base.Iterable.range(n).map(function () {
			return ludorum.players.RandomPlayer.playTo(game);
		}));
	},

	addMatchesBetween: function addMatchesBetween(n, game, players) {
		var matchups = Iterable.product.apply(Iterable, 
				Iterable.repeat(players, game.players.length).toArray()
			).toArray();
		n = Math.ceil(n / matchups.length);
		return this.addMatches(Iterable.range(n).product(matchups).mapApply(function (i, players) {
			return new ludorum.Match(game, players);
		}));
	},

	// Database use ///////////////////////////////////////////////////////////////////////////////

	distance: function distance(gameFeatures, caseFeatures) {
		return base.iterable(gameFeatures).zip(caseFeatures).mapApply(function (gf, cf) {
			return Math.abs(gf - cf);
		}).sum();
	},

	knn: function knn(n, game) {
		var cdb = this,
			fs = this.features(game),
			cs = this.cases.map(function (_case) {
				return [_case, cdb.distance(fs, _case)]; 
			});
		cs.sort(function (c1, c2) {
			return c1[1] - c2[1];
		});
		return cs.slice(0, +n);
	},

	// Utilities //////////////////////////////////////////////////////////////////////////////////

	'static __SERMAT__': {
		identifier: 'CBRDatabase',
		serializer: function serialize_CBRDatabase(obj) {
			return [{
				cases: obj.cases,
				featureFunction: obj.featureFunction,
				maxDistance: obj.maxDistance
			}];
		}
	},
}); // declare CBRDatabase

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

// See __prologue__.js
	return exports;
}
);
//# sourceMappingURL=ludorum-player-cbr.js.map