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

		dbs: { /* Namespace for different types of case bases. */ }
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
			if (n1 !== null && !isNaN(n1) && n2 !== null && !isNaN(n2)) {
				return Math.abs(n1 - n2);
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
			//TODO Use options.logger // if ((++i) % 10 === 0) console.log('Training reached '+ i +' matches. '+ (new Date())); //FIXME
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
	cases: unimplemented('CaseBase', 'cases()'),

	/** The `nn` method returns the `k` neareast neighbours of the given game state. 
	*/
	nn: function nn(k, game) {
		var cb = this,
			gameCase = this.encoding(game),
			cs = this.cases().map(function (_case, gameCase) {
				return [_case, cb.distance(_case.features, gameCase.features)];
			}).sorted(function (c1, c2) {
				return c1[1] - c2[1];
			});
		return cs.slice(0, +k);
	},

	/** ## Utilities ########################################################################### */

	'static __SERMAT__': {
		identifier: 'CaseBase',
		serializer: function serialize_CaseBase(obj) {
			return [{
				game: obj.game,
				encoding: obj.hasOwnProperty('encoding') ? obj.encoding : null
			}];
		}
	},
}); // declare CaseBase

/** # CBR Player 

*/
var CBRPlayer = exports.CBRPlayer = base.declare(ludorum.Player, {
	constructor: function CBRPlayer(params) {
		ludorum.Player.call(this, params);
		this.caseDB = params && params.caseDB;
		this.caseN = params && params.caseN || 20;
	},

	evaluatedMoves: function evaluatedMoves(game, role) {
		var caseDB = this.caseDB,
			r = base.iterable(this.movesFor(game, role)).map(function (move) {
				return [move +'', [move, 0]];
			}).toObject();
		base.iterable(caseDB.knn(this.caseN, game, role)).forEach(function (_case) {
			var m = r[_case.actions[role]];
			if (m) {
				m[1] += (_case.result[role][0] - _case.result[role][2]) / 
					_case.count; // / (_case.distance + 1);
			}
		});
		return Object.values(r);
	},

	decision: function decision(game, role) {
		var evaluatedMoves = this.evaluatedMoves(game, role),
			bestEval;
		//console.log("evaluatedMoves "+ JSON.stringify(evaluatedMoves)); //FIXME
		var bestMoves = base.iterable(evaluatedMoves).greater(function (t) {
			return t[1];
		}).map(function (t) {
			bestEval = t[1];
			return t[0];
		});
		//console.log("\t"+ bestMoves +"\t"+ bestEval);//FIXME
		base.raiseIf(!bestMoves || !bestMoves.length, 
			"No moves where selected at ", game, " for player ", role, "!");
		return bestMoves.length === 1 ? bestMoves[0] : base.Randomness.DEFAULT.choice(bestMoves);
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
	constructor: function SQLiteCaseBase(params) {
		CaseBase.call(this, params);
		this.__setupDatabase__(params);
	},

	__setupDatabase__: function __setupDatabase__(params) {
		var game = this.game,
			Database = this.Database || require('better-sqlite3');
		this.__db__ = new Database(params.dbpath || './'+ game.name.toLowerCase() +'-cbr.sqlite');
		var encoding = this.encoding(game, game.moves()),
			featureColumns = encoding.features.map(function (_, i) {
				return 'f'+ i;
			}),
			actionColumns = game.players.map(function (_, i) {
				return 'a'+ i;
			}),
			resultColumns = base.Iterable.range(game.players.length)
				.product(['won', 'tied', 'lost'])
				.mapApply(function (p, rt) { // result columns
					return rt + p;
				}).toArray(),
			columns = featureColumns.concat(actionColumns).concat(resultColumns);
		var sql = 'CREATE TABLE IF NOT EXISTS Cases (key TEXT PRIMARY KEY, count INTEGER, '+
			columns.map(function (colName) {
				return colName +' INTEGER';
			}).join(', ') +')';
		this.__db__.prepare(sql).run();
		this.__db__.register({ name: 'distance', deterministic: true, varargs: true },
			this.__distanceFunction__(this.distance));
	},

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

	__key__: function __key__(_case) {
		var features = _case.features,
			actions = _case.actions || this.game.players.map(function () {
				return null;
			});
		return features.join(',') +':'+ actions.join(',');
	},

	addCase: function addCase(_case) {
		var players = this.game.players,
			caseKey = this.__key__(_case),
			sql = 'INSERT OR IGNORE INTO Cases VALUES ('+ ['\''+ caseKey +'\'', 0]
				.concat(_case.features.map(JSON.stringify))
				.concat(_case.actions.map(JSON.stringify))
				.concat(base.Iterable.repeat(0, players.length * 3).toArray())
				.join(',') +')';
		this.__db__.prepare(sql).run();
		sql = 'UPDATE Cases SET count = count + 1, '+
			players.map(function (p) {
				var r = _case.result[p],
					pi = players.indexOf(p);
				return 'won'+ pi +' = won'+ pi +' + '+ r[0] +', '+
					'tied'+ pi +' = tied'+ pi +' + '+ r[1] +', '+
					'lost'+ pi +' = lost'+ pi +' + '+ r[2];
			}).join(', ');
		this.__db__.prepare(sql).run();
	},

	// Database use ///////////////////////////////////////////////////////////////////////////////

	knn: function knn(n, game, role) {
		var cdb = this,
			roleIndex = game.players.indexOf(role),
			data = this.encoding(game);
		var resultSet = this.__db__.prepare('SELECT *, distance('+ 
			data.features.map(function (_, i) {
				return 'f'+ i;
			}).join(', ') +', '+ data.features.join(', ') +') AS d '+
			'FROM Cases WHERE a'+ roleIndex +' IS NOT NULL ORDER BY d LIMIT '+ n).all();
		return resultSet.map(function (record) {
			return {
				count: record.count,
				features: data.features.map(function (_, i) {
					return record['f'+ i]; 
				}),
				actions: base.iterable(game.players).map(function (p, i) {
					return [p, record['a'+ i]];
				}).toObject(),
				result: base.iterable(game.players).map(function (p, i) {
					return [p, [record['won'+ i], record['tied'+ i], record['lost'+ i]]];
				}).toObject(),
				distance: record.d
			};
		});
	},

	// Utilities //////////////////////////////////////////////////////////////////////////////////

	'static __SERMAT__': {
		identifier: 'SQLiteCaseBase',
		serializer: function serialize_SQLiteCaseBase(obj) {
			return CaseBase.__SERMAT__.serialize_CaseBase(obj);
		}
	},
}); // declare SQLiteCaseBase

//FIXME For testing, please remove.

exports.encodingTicTacToe = function encodingTicTacToe(game, moves) {
	return {
		features: game.board.split('').map(function (chr) {
			return chr === 'X' ? 0 : chr === 'O' ? 1 : 0.5; 
		}),
		actions: !moves ? null : game.players.map(function (p) {
			return moves.hasOwnProperty(p) ? moves[p] : null;
		})
	};
};

// See __prologue__.js
	return exports;
}
);
//# sourceMappingURL=ludorum-player-cbr-tag.js.map