(function (init) { "use strict";
			this["ludorum-player-cbr"] = init(this.base,this.Sermat,this.ludorum);
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
var CBRDatabase = base.declare({
	constructor: function CBRDatabase(params) {
		var cdb = this;
		this.game = params.game;
		this.__encoding__ = params.encoding;
		this.maxDistance = params.maxDistance || Infinity;
		this.minCount = params.minCount || 2;
		this.random = params.random || base.Randomness.DEFAULT;
		this.__setupDatabase__(this.game);
	},

	__setupDatabase__: function __setupDatabase__(game) {
		this.__db__ = new Database('./'+ game.name.toLowerCase() +'-cbr.db');
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
				}).toArray();
		var sql = 'CREATE TABLE IF NOT EXISTS Cases (count INTEGER, '+
			featureColumns.concat(actionColumns).concat(resultColumns).map(function (colName) {
				return colName +' INTEGER';
			}).join(', ') +',\n'+
			'UNIQUE ('+ featureColumns.concat(actionColumns).join(', ') +')'+
			')';
		this.__db__.prepare(sql).run();
		this.__db__.register({ name: 'distance', deterministic: true, varargs: true },
			this.distance);
	},

	encoding: function encoding(game, moves) {
		return this.__encoding__(game, moves);
	},

	distance: function distance() {
		var r = 0,
			middle = (arguments.length / 2) |0,
			n1, n2;
		for (var i = 0; i < middle; i++) {
			n1 = arguments[i];
			n2 = arguments[middle + i];
			if (n1 !== null && !isNaN(n1) && n2 !== null && !isNaN(n2)) {
				r += Math.abs(n1 - n2);
			}
		}
		return r;
	},

	// Case building //////////////////////////////////////////////////////////////////////////////

	addCase: function addCase(features, actions, result) {
		var players = this.game.players,
			sqlWhere = ' WHERE '+ 
				features.map(function (f, i) {
					return 'f'+ i +(f === null ? ' IS NULL' : ' ='+ f);
				}).join(' AND ') +' AND '+
				actions.map(function (a, i) {
					return 'a'+ i +(a === null ? ' IS NULL' : ' ='+ a);
				}).join(' AND '),
			sql;
		sql = 'SELECT 1 FROM Cases '+ sqlWhere;
		if (!this.__db__.prepare(sql).get()) {
			sql = 'INSERT INTO Cases VALUES (0,'+ // count
				features.map(JSON.stringify).join(',') +', '+
				actions.map(JSON.stringify).join(', ') +', '+
				base.Iterable.repeat(0, players.length * 3).join(',') + // result values
				')';
			this.__db__.prepare(sql).run();
		}
		sql = 'UPDATE Cases SET count = count + 1, '+
			players.map(function (p) {
				var r = result[p],
					column = (r > 0 ? 'won' : r < 0 ? 'lost' : 'tied') + players.indexOf(p);
				return column +'='+ column +'+1';
			}).join(', ') +' WHERE '+ 
			features.map(function (f, i) {
				return 'f'+ i +(f === null ? ' IS NULL' : ' ='+ f);
			}).join(' AND ') +' AND '+
			actions.map(function (a, i) {
				return 'a'+ i +(a === null ? ' IS NULL' : ' ='+ a);
			}).join(' AND ');
		this.__db__.prepare(sql).run();
	},

	addMatch: function addMatch(match, randomAdvance) {
		var cdb = this,
			history = [],
			game;
		// Random advance
		if (+randomAdvance > 0) {
			for (var randomPly = this.random.randomInt(randomAdvance + 1); randomPly > 0; randomPly--) {
				game = match.state(); 
				while (game.isContingent) {
					match.__advanceContingents__(random);
					game = match.state();
				}
				moves = game.moves();
				if (moves) {
					move = {};
					game.activePlayers.forEach(function (activePlayer) {
						move[activePlayer] = cdb.random.choice(moves[activePlayer]);
					});
					match.__advance__(game, move);
					history.push(cdb.encoding(game, move));
				}
			}
		}
		match.events.on('move', function (g, ms) {
			var data = cdb.encoding(g, ms);
			history.push(data);
		});
		return match.run().then(function () {
			var result = match.result(),
				count = 0;
			history.forEach(function (data) {
				count += cdb.addCase(data.features, data.actions, result);
			});
			return match;
		});
	},

	addMatches: function addMatches(matches, randomAdvance) {
		var cdb = this,
			i = 0;
		return base.Future.sequence(matches, function (match) {
			if ((++i) % 10 === 0) console.log('Training reached '+ i +' matches. '+ (new Date())); //FIXME
			return cdb.addMatch(match, randomAdvance);
		});
	},

	populate: function populate(options) {
		options = options || {};
		var cdb = this,
			game = options.game || this.game,
			n = options.n || 100,
			players = options.players || [new ludorum.players.RandomPlayer()],
			matchups = base.Iterable.product.apply(base.Iterable, 
				base.Iterable.repeat(players, game.players.length).toArray()
			).toArray();
		return this.addMatches(base.Iterable.range(Math.ceil(n / matchups.length))
			.product(matchups)
			.mapApply(function (i, players) {
				return new ludorum.Match(game, players);
			}), options.maxPly);
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
var CBRPlayer = base.declare(ludorum.Player, {
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

// See __prologue__.js
	return exports;
}
);
//# sourceMappingURL=ludorum-player-cbr-tag.js.map