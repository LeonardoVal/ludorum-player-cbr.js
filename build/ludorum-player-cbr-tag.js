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
		this.id = props.id || this.identifier();
	},

	/** Adding a result to a case updates the `results` property to acount for the given `result`. 
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
		return this;
	},

	/** Merging `this` case with another case updates the properties `ply`, `count` and `results`.
	*/
	merge: function merge(_case) {
		this.ply = (this.ply * this.count + _case.ply * _case.count) / (this.count + _case.count);
		this.count += _case.count;
		this.addResult(_case.result);
	},

	// ## Databases ################################################################################

	/** An `identifier` for a case is a string that can be used as a primary key of a case base.
	*/
	identifier: function identifier() {
		return this.features.join(',') + JSON.stringify(this.actions);
	},

	/** Return a database record for this case.
	*/
	record: function record(obj) {
		obj = obj || {};
		var p;
		obj.id = record.id;
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

	/** The static method `fromRecord` creates a case from a database record.
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
			} else if (k.substr(0, 4) === 'won_') {
				var p = k.substr(4);
				results[p] = [record['won_'+ p], record['tied_'+ p], record['lost_'+ p]];
			}
		}
		return new this({ 
			count: record.count,
			ply: record.ply,
			features: features,
			actions: actions,
			results: results
		});
	},

	// ## Utilities ################################################################################

	/** This method adds null actions to a copy of the `moves` object.
	*/
	'static actionsFromMoves': function getActions(players, moves) {
		return iterable(players).map(function (p) {
			return [p, moves && moves.hasOwnProperty(p) ? moves[p] : null];
		}).toObject();
	},

	/** `emptyResults` creates an object that maps every player to an array with 3 zeros.
	*/
	'static emptyResults': function emptyResults(players) {
		return iterable(players).map(function (p) {
			return [p, [0, 0, 0]];
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
		this.random = params && params.random || Randomness.DEFAULT;
	},

	/** ## Abstract methods ##################################################################### */

	/** Depending on its implementation, a case base may require information about the game and the
	player that uses it in order to work. 
	*/
	init: unimplemented('CaseBase', 'init(game, player)'),

	/** Adding a case (or cases) to the database is not implemented by default.
	*/
	addCase: unimplemented('CaseBase', 'addCase(_case)'),

	/** The `cases` method returns the sequence of all cases in the database. Case order is not
	defined.
	*/
	cases: unimplemented('CaseBase', 'cases(filters)'),

	/** ## Case retrieval ####################################################################### */

	/** The default `distance` is a form of Manhattan distance, which does not count `null` or `NaN`
	features.
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

	/** The `nn` method returns the `k` neareast neighbours of the given cases. 
	*/
	nn: function nn(k, cases) {
		var cb = this;
		cases = iterable(cases);
		return iterable(this.cases()).map(function (_case) {
				var d = cases.map(function (c) {
					return cb.distance(_case.features, c.features);
				}).min();
				return [_case, d];
			}).sorted(function (c1, c2) {
				return c1[1] - c2[1];
			}).take(+k).toArray();
	}
}); // declare CaseBase

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
	},

	// Utilities. /////////////////////////////////////////////////////////////////////////////////

	assess: function assess(players, options) { //FIXME
		if (!Array.isArray(players)) {
			players = [players];
		}
		var cbrPlayer = this,
			game = this.game,
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
		if (params && params.__cases__) {
			params.__cases__.forEach(this.addCase.bind(this));
		}
	},

	init: function init(game, player) {
		// No initialization required.
	},

	cases: function cases() {
		return base.iterable(this.__cases__);
	},
	
	addCase: function addCase(_case) {
		if (_case instanceof Case) {
			var id = _case.identifier();
			if (this.__index__.hasOwnProperty(id)) {
				var storedCase = this.__cases__[this.__index__[id]];
				storedCase.merge(_case);
			} else {
				var i = this.__cases__.push(_case) - 1;
				this.__index__[id] = i;
			}
		} else {
			iterable(_case).forEach(this.addCase.bind(this));
		}
	},

	/** ## Utilities ############################################################################ */

	'static __SERMAT__': {
		identifier: 'MemoryCaseBase',
		serializer: function serialize_MemoryCaseBase(obj) {
			return [{
				__cases__: obj.__cases__
			}];
		}
	},
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

	/** ## Database setup and management ######################################################## */

	/**
	*/
	__setupDatabase__: function __setupDatabase__(params) {
		var Database = this.Database || require('better-sqlite3');
		if (params.db instanceof Database) {
			this.__db__ = params.db;
		} else {
			var dbName = typeof params.db === 'string' ? params.db : './cbr-test.sqlite';
			this.__db__ = new Database(dbName);
			this.__db__.pragma('journal_mode = OFF'); // Disable transactions.
			this.__db__.pragma('cache_size = -128000'); // Increase default cache size.
			this.__db__.pragma('encoding = "UTF-8"'); // Increase default cache size.
		}
		this.__tableName__ = params.tableName;
	},

	__createTable__: function __createTable__(tableName, reference) {
		var actionColumns = Object.keys(reference.actions).map(function (p) {
				return 'a_'+ p +' TEXT';
			}).join(', '),
			resultColumns = Object.keys(reference.results).map(function (p) {
				return 'won_'+ p +' INTEGER, tied_'+ p +' INTEGER, lost_'+ p +' INTEGER';
			}).join(', '),
			featureColumns = reference.features.map(function (_, i) {
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

	init: function init(game, player) {
		this.__tableName__ = this.__tableName__ || 'CB_'+ game.name;
		var reference = player.casesFromGame(game, 0, game.moves())[0];
		this.__createTable__(this.__tableName__, reference);
	},
	
	addCase: function addCase(_case) {
		if (_case instanceof Case) {
			var record = _case.record(),
				fields = Object.keys(record),
				sql = 'INSERT OR IGNORE INTO '+ this.__tableName__ +' ('+ fields.join(',') +
					') VALUES ('+ Iterable.repeat('?', fields.length).join(',') +')',
				isNew = this.__runSQL__(sql, fields.map(function (f) {
						return record[f];
					})).changes > 0;
			if (!isNew) { // Insert was ignored because the case is already stored.
				this.__runSQL__('UPDATE '+ this.__tableName__ +' '+
					'SET count = count + 1, ply = (ply * count + '+ (_case.ply || 0) +') / (count + 1), '+
					Object.keys(record).filter(function (k) {
						return /^(won_|tied_|lost_)/.test(k);
					}).map(function (k) {
						return k +' = '+ k +' + '+ record[k];
					}).join(', ') +' WHERE id = \''+ record.id +'\''
				);
			}
		} else {
			iterable(_case).forEach(this.addCase.bind(this));
		}
	},

	cases: function cases() {
		return this.__getSQL__('SELECT * FROM '+ this.__tableName__)
			.map(Case.fromRecord.bind(Case));
	},

	/*FIXME
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
	*/
}); // declare SQLiteCaseBase



/** # TicTacToe CBR
 
*/
games.TicTacToe = (function () {
	/** ## Features direct from the board ####################################################### */
	
	var directFeatures = function features(game) {
		var board = typeof game === 'string' ? game : game.board;
		return board.split('').map(function (chr) {
			return chr === 'X' ? (+1) : chr === 'O' ? (-1) : 0; 
		});
	};

	var DirectCBPlayer = declare(CaseBasedPlayer, {
		constructor: function DirectCBPlayer(params) {
			CaseBasedPlayer.call(this, params);
		}, 

		game: new ludorum.games.TicTacToe(),

		features: directFeatures,
		
		casesFromGame: function casesFromGame(game, ply, moves) {
			return [
				this.newCase(game, ply, moves, { features: this.features(game) })
			];
		}
	}); // declare TicTacToe.DirectCBPlayer

	/** ## Equivalence based on board symmetries and rotations. ################################# */

	/** `MAPPINGS` is a list of square indexes that define transformations between equivalent
	Tictactoe boards.
	*/
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

	var equivalent = function equivalent(game) {
		var board = typeof game === 'string' ? game : game.board,
			maps = MAPPINGS.map(function (mapping) {
				return mapping.map(function (i) {
					return board.charAt(i);
				}).join('');
			});
		maps = Array.from(new Set(maps)); // Remove duplicates.
		maps.sort();
		return maps;
	};

	var EquivalenceCBPlayer = declare(CaseBasedPlayer, {
		constructor: function EquivalenceCBPlayer(params) {
			CaseBasedPlayer.call(this, params);
		}, 

		game: new ludorum.games.TicTacToe(),

		features: directFeatures,

		MAPPINGS: MAPPINGS,

		/** 
		*/
		casesFromGame: function fromGame(game, ply, moves) {
			var cbrPlayer = this,
				board = game.board.split(''),
				activePlayer = game.activePlayer();
			if (moves) {
				board[moves[activePlayer]] = '!';
			}
			var boards = equivalent(board.join('')).map(function (b) {
				var m = b.indexOf('!');
				return b.replace('!', '_') + m;
			});
			return boards.map(function  (board) {
				if (moves) {
					moves[activePlayer] = +(board.substr(9));
				}
				return cbrPlayer.newCase(game, ply, moves, 
					{ features: cbrPlayer.features(board.substr(0,9)) }
				);
			});
		}
	}); // declare TicTacToe.EquivalenceCBPlayer

	return {
		directFeatures: directFeatures,
		DirectCBPlayer: DirectCBPlayer,

		MAPPINGS: MAPPINGS,
		equivalent: equivalent,
		EquivalenceCBPlayer: EquivalenceCBPlayer
	};
})();

/** # Utilities

*/


// See __prologue__.js
	return exports;
}
);
//# sourceMappingURL=ludorum-player-cbr-tag.js.map