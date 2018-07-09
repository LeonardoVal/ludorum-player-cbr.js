(function (init) { "use strict";
			this["ludorum-player-cbr"] = init(this.base,this.Sermat,this.ludorum);
		}).call(this,/** Package wrapper and layout.
*/
function __init__(base, Sermat, ludorum) { "use strict";
// Import synonyms. ////////////////////////////////////////////////////////////////////////////////
	var declare = base.declare,
		unimplemented = base.objects.unimplemented,
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
		__SERMAT__: { include: [base, ludorum] },

		dbs: { /* Namespace for different types of case bases. */ },
		utils: { /* Namespace for different utility functions and definitions. */ }
	};


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
				i = 0;
			cdb.game.players.forEach(function (p) {
				result[p] = [
					result[p] > 0 ? 1 : 0,
					result[p] === 0 ? 1 : 0,
					result[p] < 0 ? 1 : 0,
				];
			});
			match.history.forEach(function (entry) {
				if (entry.moves) {
					var _case = cdb.encoding(entry.state, entry.moves, i);
					i++;
					_case.result = result;
					cdb.addCase(_case);
				}
			});
			return match;
		});
	},

	/** The `addMatches` method takes a sequence of `matches`, runs each in order and adds all 
	resulting game states to the database. It returns a promise.
	*/
	addMatches: function addMatches(matches, options) {
		var cdb = this,
			i = 0;
		return Future.sequence(matches, function (match) {
			i++;
			if (options.logger && i % 10 === 0) {
				options.logger.info('Training reached '+ i +' matches.');
			}
			return cdb.addMatch(match, options);
		});
	},

	/** The `populate` method adds cases to the database by running several matches and adding the
	resulting game states. The `options` argument may include the following:

	+ `game`: The game state from which to start the matches. The database's `game` is used by 
	default.

	+ `n`: The number of matches to run; 100 by default.

	+ `players`: The players to use to play the matches. A random player is used by default.

	The result is a promise.
	*/
	populate: function populate(options) {
		options = options || {};
		var cdb = this,
			game = options.game || this.game,
			n = options.n || 100,
			players = options.players || [new ludorum.players.RandomPlayer()],
			matchups = Iterable.product.apply(Iterable, 
				Iterable.repeat(players, game.players.length).toArray()
			).toArray();
		return this.addMatches(Iterable.range(Math.ceil(n / matchups.length))
			.product(matchups)
			.mapApply(function (i, players) {
				return new ludorum.Match(game, players);
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
				return [move +'', [move, 0]];
			}).toObject(),
			knn = cb.nn(k, game);
		iterable(knn).forEachApply(function (_case, distance) {
			var m = r[_case.actions[roleIndex]];
			if (m) {
				m[1] += (_case.result[role][0] - _case.result[role][2]) / (1 + distance);
			}
		});
		return Object.values(r);
	},

	/**TODO
	*/
	gameEvaluation: function gameEvaluation(game, role, options) {
		var cb = this,
			k = options && +options.k || 10,
			r = base.iterable(game.moves()[role]).map(function (move) {
				return [move +'', [move, 0]];
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

/** # CBR Player 

*/
exports.CBRPlayer = base.declare(ludorum.Player, {
	/** 
	*/
	constructor: function CBRPlayer(params) {
		ludorum.Player.call(this, params);
		this.caseBase = params && params.caseBase;
		this.k = params && params.k || 20;
	},

	/** A `CBRPlayer` takes the action evaluations from the case base, and splits them into actions
	with possitive evaluations and the ones with evaluations less than or equal to zero. If there
	are possitively evaluated actions, one of these is chosen randomly with a probability 
	proportional to the evaluation. If all actions have non possitive evaluations, one of these is
	chosen with a probability inversely proportional to the evaluation.   
	*/
	decision: function decision(game, role) {
		var actions = iterable(this.movesFor(game, role)).map(function (action) {
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

	assess: function assess(player, options) {
		var cbrPlayer = this,
			game = this.caseBase.game,
			evaluation = base.iterable(game.players).map(function (p) {
				return [p, [0,0,0]];
			}).toObject(),
			players = base.Iterable.repeat(player, game.players.length).toArray(),
			n = options && +options.n || 150;
		return base.Future.sequence(base.Iterable.range(n), function (i) {
			var matchPlayers = players.slice(),
				playerIndex = i % game.players.length,
				playerRole = game.players[playerIndex];
			matchPlayers[playerIndex] = cbrPlayer;
			var match = new ludorum.Match(game, matchPlayers);
			return match.run().then(function () {
				if (options.logger && i % 10 === 0) {
					options.logger.info("Assessment ran "+ i +" matches.");
				}
				var r = match.result()[playerRole];
				evaluation[playerRole][r > 0 ? 0 : r < 0 ? 2 : 1]++;
			});
		}).then(function () {
			return evaluation;
		});
	}
}); // declare CBRPlayer

/** # MemoryCaseBase

A memory implementation of a `CaseBase`.
*/
var MemoryCaseBase = exports.dbs.MemoryCaseBase = declare(CaseBase, {
	constructor: function MemoryCaseBase(params) {
		CaseBase.call(this, params);
		this.__cases__ = [];
	},

	cases: function cases() {
		return base.iterable(this.__cases__);
	},
	
	addCase: function addCase(_case) {
		//TODO Check `_case` properties.
		var entry = {
			features: Sermat.clone(_case.features || null),
			actions: Sermat.clone(_case.actions || null),
			result: Sermat.clone(_case.result || null)
		};
		return this.__cases__.push(entry);
	},

	/** ## Utilities ########################################################################### */

	'static __SERMAT__': {
		identifier: 'MemoryCaseBase',
		serializer: function serialize_MemoryCaseBase(obj) {
			return CaseBase.__SERMAT__.serialize_CaseBase(obj);
		}
	},
}); // declare MemoryCaseBase

/** # SQLiteCaseBase

An implementation of a `CaseBase` using SQLite3 through `better-sqlite3`.
*/
exports.dbs.SQLiteCaseBase = base.declare(CaseBase, {
	/** 
	*/
	constructor: function SQLiteCaseBase(params) {
		CaseBase.call(this, params);
		this.__setupDatabase__(params);
	},

	/** ## Database setup ###################################################################### */

	/**
	*/
	__setupDatabase__: function __setupDatabase__(params) {
		var game = this.game,
			Database = this.Database || require('better-sqlite3');
		this.__db__ = new Database(params.dbpath || './'+ game.name.toLowerCase() +'-cbr.sqlite');
		this.__tableName__ = params.tableName || 'CB_'+ game.name;
		var encoding = this.encoding(game, game.moves());
		this.__featureColumns__ = encoding.features.map(function (_, i) {
			return 'f'+ i;
		});
		this.__actionColumns__ = game.players.map(function (_, i) {
			return 'a'+ i;
		});
		this.__resultColumns__ = base.Iterable.range(game.players.length)
			.product(['won', 'tied', 'lost'])
			.mapApply(function (p, rt) { // result columns
				return rt + p;
			}).toArray();
		var columns = this.__featureColumns__
				.concat(this.__actionColumns__)
				.concat(this.__resultColumns__),
			sql = 'CREATE TABLE IF NOT EXISTS '+ this.__tableName__ +
				'(key TEXT PRIMARY KEY, count INTEGER, '+
				columns.map(function (colName) {
					return colName +' INTEGER';
				}).join(', ') +')';
		try {
			this.__db__.prepare(sql).run();
		} catch (err) {
			throw new Error("Error while creating table. SQL: `"+ sql +"`!");
		}
		this.__db__.register({ name: 'distance', deterministic: true, varargs: true },
			this.__distanceFunction__(this.distance));
	},

	/** The distance function of the case base is used in many SQL statements sent to the database.
	Since SQLite functions cannot handle arrays, a variadic form that takes both feature arrays in
	a chain is built.
	*/
	__distanceFunction__: function __distanceFunction__(df) {
		df = df || this.distance;
		var features1 = [], 
			features2 = [];
		return function () {
			var middle = (arguments.length / 2) |0;
			for (var i = 0; i < middle; i++) {
				features1.push(arguments[i]);
				features2.push(arguments[middle + i]);
			}
			return df(features1, features2);
		};
	}, 

	/** ## Cases ############################################################################### */

	/** The cases table's primary key is a string that identifies the case. By default, the 
	concatenation of feature values and actions values is used.
	*/
	__key__: function __key__(_case) {
		var features = _case.features,
			actions = _case.actions || this.game.players.map(function () {
				return null;
			});
		return features.join(',') +':'+ actions.join(',');
	},

	addCase: function addCase(_case) {
		var players = this.game.players,
			caseKey = '\''+ this.__key__(_case) +'\'',
			sql = 'INSERT OR IGNORE INTO '+ this.__tableName__ +' VALUES ('+ [caseKey, 0]
				.concat(_case.features.map(JSON.stringify))
				.concat(_case.actions.map(JSON.stringify))
				.concat(base.Iterable.repeat(0, players.length * 3).toArray())
				.join(',') +')';
		this.__db__.prepare(sql).run();
		sql = 'UPDATE '+ this.__tableName__ +' SET count = count + 1, '+
			players.map(function (p) {
				var r = _case.result[p],
					pi = players.indexOf(p),
					sets = [];
				if (r[0]) {
					sets.push('won'+ pi +' = won'+ pi +' + '+ r[0]);
				}
				if (r[1]) {
					sets.push('tied'+ pi +' = tied'+ pi +' + '+ r[1]);
				}
				if (r[2]) {
					sets.push('lost'+ pi +' = lost'+ pi +' + '+ r[2]);
				}
				return sets.join(', ');
			}).join(', ') +' WHERE key = '+ caseKey;
		this.__db__.prepare(sql).run();
	},

	cases: function cases(filters) {
		var cb = this,
			sql = 'SELECT * FROM '+ this.__tableName__; //TODO Filters
		return this.__db__.prepare(sql).all().map(function (record) {
			return {
				features: cb.__featureColumns__.map(function (col) {
					return record[col];
				}),
				actions: cb.__actionColumns__.map(function (col) {
					return record[col];
				}),
				result: iterable(cb.game.players).map(function (player, i) {
					return [player, [record['won'+ i], record['tied'+ i], record['lost'+ i]]];
				}).toObject()
			};
		});
	},

	/* TODO SQL for evaluated actions

select a0, sum((won0-lost0)/(1.0+distance)) as eval1, sum(won0-lost0) as eval2
from (select *, abs(f0-0.5)+abs(f1-0.5)+abs(f2-0.5)+abs(f3-0.5)+abs(f4-0.5)+abs(f5-0.5)+abs(f6-0.5)+abs(f7-0.5)+abs(f8-0.5) as distance
 from Cases 
 where a0 is not null and distance <= 1
 order by distance limit 100)
group by a0
	
select coalesce(a0, a1), sum((case a0 when null then won1-lost1 else won0-lost0 end)/(1.0+distance)) as eval1, sum(won0-lost0) as eval2
from (select *, abs(f0-0.5)+abs(f1-0.5)+abs(f2-0.5)+abs(f3-0.5)+abs(f4-0.5)+abs(f5-0.5)+abs(f6-0.5)+abs(f7-0.5)+abs(f8-0.5) as distance
 from Cases 
 --where a0 is not null and distance <= 1
 order by distance limit 50)
group by coalesce(a0, a1)

	*/

	// Utilities //////////////////////////////////////////////////////////////////////////////////

	'static __SERMAT__': {
		identifier: 'SQLiteCaseBase',
		serializer: function serialize_SQLiteCaseBase(obj) {
			return CaseBase.__SERMAT__.serialize_CaseBase(obj);
		}
	},
}); // declare SQLiteCaseBase



/** # Utilities

*/

/** This library provides some `encodings` for simple games in Ludorum for testing purposes.
*/
exports.utils.encodings = {
	/** The `TicTacToe` encoding has 9 features, one per square in the board. Each feature has the
	value of 0 if it is marked with an X, 1 if it is marked with an O, or 0.5 otherwise.

	TicTacToe's actions are numbers, hence no transformation or encoding is required.
	*/
	TicTacToe: function encodingTicTacToe(game, moves) {
		return {
			features: game.board.split('').map(function (chr) {
				return chr === 'X' ? 0 : chr === 'O' ? 1 : 0.5; 
			}),
			actions: !moves ? null : game.players.map(function (p) {
				return moves.hasOwnProperty(p) ? moves[p] : null;
			})
		};
	}
};

// See __prologue__.js
	return exports;
}
);
//# sourceMappingURL=ludorum-player-cbr-tag.js.map