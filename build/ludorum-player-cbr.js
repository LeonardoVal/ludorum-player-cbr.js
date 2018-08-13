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
			games: { /* Namespace for functions and definitions for supporting games. */ }
		},
		dbs = exports.dbs,
		games = exports.games
	;


/** # Case

TODO
*/
var Case = exports.Case = declare({
	/** The `props` argument must have:
	
	+ `count`: the amount of times this case has been seen,
	+ `ply`: a number with the average ply where this case happens,
	+ `features`: an array of numbers representing the relevant information of the case,
	+ `actions`: an object mapping players to actions,
	+ `results`: an object mapping players to a 3 number array with the counts for: victories, 
	draws and defeats.
	*/
	constructor: function Case(props) {
		this.count = +props.count || 1;
		this.ply = +props.ply;
		this.features = props.features;
		this.actions = props.actions;
		this.results = props.results;
	},

	/** TODO 
	*/
	'static fromGame': base.objects.unimplemented('Case', 'fromGame(game, ply, moves)'),

	/** TODO 
	*/
	addResult: function addResult(result) {
		var r;
		for (var p in result) {
			r = result[p];
			if (Array.isArray(r) && r.length === 3) { // case results
				this.results[p][0] += result[p][0];
				this.results[p][1] += result[p][1];
				this.results[p][2] += result[p][2];
			} else if (typeof r === 'number') {
				this.results[p][r > 0 ? 0 : r === 0 ? 1 : 2]++;
			} else {
				raise('Invalid result (', r, ')!');
			}
		}
		this.count = (this.count || 0) + 1; 
	},

	/** TODO 
	*/
	merge: function merge(_case) {
		this.ply = (this.ply * this.count + _case.ply * _case.count) / (this.count + _case.count);
		this.count += _case.count;
		this.addResult(_case.result);
	},

	/** TODO
	*/
	identifier: function identifier() {
		return this.features.join(',') + JSON.stringify(this.actions);
	},

	/** Return a database record for this case.
	*/
	record: function record(obj) {
		obj = obj || {};
		var p;
		obj.id = this.identifier();
		obj.ply = this.ply;
		obj.count = this.count;
		this.features.forEach(function (f, i) {
			obj['f'+ i] = f;
		});
		for (p in this.actions) {
			obj['a_'+ p] = JSON.stringify(this.actions[p]);
		}
		for (p in this.results) {
			obj['won_'+ p] = this.results[p][0];
			obj['tied_'+ p] = this.results[p][1];
			obj['lost_'+ p] = this.results[p][2];
		}
		return obj;
	},

	/** TODO
	*/
	'static fromRecord': function fromRecord(record) {
		var features = [],
			actions = {},
			results = {};
		for (var k in record) {
			if (k[0] === 'f') {
				features[+k.substr(1)] = record[k];
			} else if (k.substr(0, 2) === 'a_') {
				actions[k.substr(2)] = JSON.parse(record[k]);
			}
		}
		for (var p in results) {
			results[p] = [record['won_'+ p], record['tied_'+ p], record['lost_'+ p]];
		}
		return new this({ 
			count: record.count,
			ply: record.ply,
			features: features,
			actions: actions,
			results: results
		});
	},

	// Utilities //////////////////////////////////////////////////////////////////////////////////

	'static emptyResults': function emptyResults(players) {
		return iterable(players).map(function (p) {
			return [p, [0, 0, 0]];
		}).toObject();
	},

	'static actionsFromMoves': function getActions(players, moves) {
		return iterable(players).map(function (p) {
			return [p, moves && moves.hasOwnProperty(p) ? moves[p] : null];
		}).toObject();
	},

	/** Serialization and materialization using Sermat.
	*/
	'static __SERMAT__': {
		identifier: 'Case',
		serializer: function serialize_Case(obj) {
			return [{
				count: obj.count,
				ply: obj.ply,
				features: obj.features,
				actions: obj.actions,
				results: obj.results
			}];
		}
	}
}); // declare Case

/** # CaseBase 

A `CaseBase` holds all cases for a game.
*/
var CaseBase = exports.CaseBase = declare({
	constructor: function CaseBase(params) {
		this.game = params && params.game;
		if (params && typeof params.Case === 'function') {
			this.Case = params.Case;
		}
		this.random = params && params.random || Randomness.DEFAULT;
	},

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
		var cdb = this,
			retainThreshold = +options.retainThreshold || 0;
		return match.run().then(function () {
			var result = match.result(),
				history = match.history,
				entry, _case, breakStoring;
			for (var i = history.length - 1; i >= 0; i--) {
				entry = history[i];
				if (entry.moves) {
					cdb.Case.fromGame(entry.state, i, entry.moves).forEach(function (_case) {
						_case.addResult(result);
						cdb.addCase(_case);
					});
					//FIXME
					// breakStoring = retainThreshold !== 0 && retainThreshold > cdb.closestDistance(entry.state);
					// cdb.addCase(_case);
					// if (breakStoring) {
					//	break;
					// }
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
			cases = iterable(this.Case.fromGame(game)),
			cs = iterable(this.cases()).map(function (_case) {
				var d = cases.map(function (c) {
					return cb.distance(_case.features, c.features);
				}).min();
				return [_case, d];
			}).sorted(function (c1, c2) {
				return c1[1] - c2[1];
			}).toArray();
		return cs.slice(0, +k);
	},

	/** The `closestDistance` method returns the distance to the closest case in the case base from
	the given game state.
	*/
	closestDistance: function closestDistance(game) {
		var closest = this.nn(1, game);
		return closest.length === 0 ? Infinity : closest[0][1];
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
			return (_case.results[role][0] - _case.results[role][2]) / (1 + distance);
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

/** # MemoryCaseBase

A memory implementation of a `CaseBase`.
*/
var MemoryCaseBase = dbs.MemoryCaseBase = declare(CaseBase, {
	constructor: function MemoryCaseBase(params) {
		CaseBase.call(this, params);
		this.__cases__ = [];
		this.__index__ = {};
	},

	cases: function cases() {
		return base.iterable(this.__cases__);
	},
	
	addCase: function addCase(_case) {
		var id = _case.identifier();
		if (this.__index__[id]) {
			var storedCase = this.__cases__[this.__index__[id]];
			storedCase.merge(_case);
		} else {
			var i = this.__cases__.push(_case) - 1;
			this.__index__[id] = i;
		}
	}
}); // declare MemoryCaseBase

/** # SQLiteCaseBase

An implementation of a `CaseBase` using SQLite3 through `better-sqlite3`.
*/
dbs.SQLiteCaseBase = declare(CaseBase, {
	/** 
	*/
	constructor: function SQLiteCaseBase(params) {
		CaseBase.call(this, params);
		this.__setupDatabase__(params);
	},

	/** ## Database setup and management ####################################################### */

	/**
	*/
	__setupDatabase__: function __setupDatabase__(params) {
		var game = this.game,
			Database = this.Database || require('better-sqlite3');
		if (params.db instanceof Database) {
			this.__db__ = params.db;
		} else {
			this.__db__ = new Database(typeof params.db === 'string' ? params.db : 
				'./'+ game.name.toLowerCase() +'-cbr.sqlite');
			this.__db__.pragma('journal_mode = OFF'); // Disable transactions.
			this.__db__.pragma('cache_size = -128000'); // Increase default cache size.
			this.__db__.pragma('encoding = "UTF-8"'); // Increase default cache size.
		}
		
		this.__tableName__ = params.tableName || 'CB_'+ game.name;
		this.__createTable__();
	},

	__createTable__: function __createTable__(tableName, game) {
		tableName = tableName || this.__tableName__;
		game = game || this.game;
		var _case = this.Case.fromGame(game)[0],
			actionColumns = game.players.map(function (p) {
				return 'a_'+ p +' TEXT';
			}).join(', '),
			resultColumns = game.players.map(function (p) {
				return 'won_'+ p +' INTEGER, tied_'+ p +' INTEGER, lost_'+ p +' INTEGER';
			}).join(', '),
			featureColumns = _case.features.map(function (_, i) {
				return 'f'+ i +' INTEGER';
			}).join(', ');
		return this.__runSQL__('CREATE TABLE IF NOT EXISTS '+ tableName +
			'(id TEXT PRIMARY KEY, count INTEGER, ply REAL, '+
			actionColumns +', '+ resultColumns +', '+ featureColumns +')');
	},

	__runSQL__: function __runSQL__(sql) {
		var args = Array.prototype.slice.call(arguments, 1);
		try {
			var stmt = this.__db__.prepare(sql);
			return stmt.run.apply(stmt, args);
		} catch (err) {
			throw new Error("Error executing `"+ sql +"` "+ JSON.stringify(args) +"!");
		}
	},

	__getSQL__: function __getSQL__(sql) {
		var args = Array.prototype.slice.call(arguments, 1);
		try {
			var stmt = this.__db__.prepare(sql);
			return stmt.all.apply(stmt, args);
		} catch (err) {
			throw new Error("Error querying `"+ sql +"` "+ JSON.stringify(args) +"!");
		}
	},

	/** ## Cases ############################################################################### */

	addCase: function addCase(_case) {
		var players = this.game.players,
			record = _case.record(),
			fields = Object.keys(record),
			sql = 'INSERT OR IGNORE INTO '+ this.__tableName__ +' ('+ fields.join(',') +
				') VALUES ('+ Iterable.repeat('?', fields.length).join(',') +')',
			isNew = this.__runSQL__(sql, fields.map(function (f) {
					return record[f];
				})).changes > 0;
		if (!isNew) { // Insert was ignored because the case is already stored.
			this.__runSQL__('UPDATE '+ this.__tableName__ +' '+
				'SET count = count + 1, ply = (ply * count + '+ (_case.ply || 0) +') / (count + 1), '+
				players.map(function (p) {
					var r = _case.results[p],
						sets = [];
					if (r[0]) {
						sets.push('won_'+ p +' = won_'+ p +' + '+ r[0]);
					}
					if (r[1]) {
						sets.push('tied_'+ p +' = tied_'+ p +' + '+ r[1]);
					}
					if (r[2]) {
						sets.push('lost_'+ p +' = lost_'+ p +' + '+ r[2]);
					}
					return sets.join(', ');
				}).join(', ') +' WHERE id = \''+ record.id +'\''
			);
		}
	},

	cases: function cases() {
		return this.__getSQL__('SELECT * FROM '+ this.__tableName__)
			.map(this.Case.fromRecord.bind(this.Case));
	},

	__nn_sql__: function __nn_sql__(k, game) {
		var cases = this.Case.fromGame(game);
		return 'SELECT *, min('+ cases.map(function (_case) {
				return _case.features.map(function (v, i) {
					return v !== null && !isNaN(v) ? 'abs(ifnull(f'+ i +'-('+ v +'),0))' : '0';
				}).join('+');
			}).join(', ') +') AS distance '+
			'FROM '+ this.__tableName__ +' '+
			'ORDER BY distance ASC LIMIT '+ k;
	},

	nn: function nn(k, game) {
		var cb = this,
			sql = this.__nn_sql__(k, game);
		return this.__db__.prepare(sql).all().map(function (row) {
			return [cb.Case.fromRecord(row), row.distance];
		});
	}
}); // declare SQLiteCaseBase



/**
 
*/
games.TicTacToe = (function () {
	function directFeatures(game) {
		var board = typeof game === 'string' ? game : game.board;
		return board.split('').map(function (chr) {
			return chr === 'X' ? (+1) : chr === 'O' ? (-1) : 0; 
		});
	}

	var MAPPINGS = [
		[0,1,2,3,4,5,6,7,8], // original
		[2,1,0,5,4,3,8,7,6], // vertical axis symmetry
		[6,7,8,3,4,5,0,1,2], // horizontal axis symmetry
		[6,3,0,7,4,1,8,5,2], // 90 clockwise rotation
		[2,5,8,1,4,7,0,3,6], // 90 counter-clockwise rotation 
		[8,7,6,5,4,3,2,1,0], // central symmetry
		[8,5,2,7,4,1,6,3,0], // 90 counter-clockwise rotation + vertical axis symmetry
		[0,3,6,1,4,7,2,5,8]  // 90 clockwise rotation + vertical axis symmetry
	];

	function equivalent(game) {
		var board = typeof game === 'string' ? game : game.board,
			maps = MAPPINGS.map(function (mapping) {
				return mapping.map(function (i) {
					return board.charAt(i);
				}).join('');
			});
		maps.sort();
		return maps;
	}

	return {
		directFeatures: directFeatures,

		/**
		*/
		DirectCase: declare(Case, {
			'static fromGame': function fromGame(game, ply, moves) {
				var _case = new this({
						ply: +ply,
						features: directFeatures(game),
						actions: Case.actionsFromMoves(game.players, moves),
						results: Case.emptyResults(game.players)
					});
				return [_case];
			}
		}),

		equivalent: equivalent,

		/**
		*/
		EquivalenciesCase: declare(Case, {
			'static fromGame': function fromGame(game, ply, moves) {
				var board = game.board.split(''),
					activePlayer = game.activePlayer();
				if (moves) {
					board[moves[activePlayer]] = '!';
				}
				var boards = equivalent(board.join('')).map(function (b) {
					var m = b.indexOf('!');
					return b.replace('!', '_') + m;
				});
				boards.sort();
				board = boards[0];
				if (moves) {
					moves[activePlayer] = +(board.substr(9));
				}
				var _case = new this({
						ply: +ply,
						features: directFeatures(board.substr(0,9)),
						actions: Case.actionsFromMoves(game.players, moves),
						results: Case.emptyResults(game.players)
					});
				return [_case];
			}
		})
	};
})(); // declare TicTacToe.DirectCase

/** # Utilities

*/

// See __prologue__.js
	return exports;
}
);
//# sourceMappingURL=ludorum-player-cbr.js.map