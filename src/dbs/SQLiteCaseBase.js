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
		this.__db__.pragma('journal_mode = OFF'); // Disable transactions.
		this.__db__.pragma('cache_size = -128000'); // Increase default cache size.
		this.__db__.pragma('encoding = "UTF-8"'); // Increase default cache size.

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
		var sql = 'CREATE TABLE IF NOT EXISTS '+ this.__tableName__ +
				'(key TEXT PRIMARY KEY, count INTEGER, ply REAL, '+
				this.__actionColumns__.map(function (colName) {
					return colName +' TEXT';
				}).join(', ') +', '+
				this.__resultColumns__.concat(this.__featureColumns__).map(function (colName) {
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
			caseKey = this.__key__(_case),
			sql = 'INSERT OR IGNORE INTO '+ this.__tableName__ +' VALUES ('+ 
				Iterable.repeat('?', 3 + this.__actionColumns__.length + 
					this.__resultColumns__.length + this.__featureColumns__.length).join(',') +')',
			sqlStmt = this.__db__.prepare(sql),
			isNew = sqlStmt.run.apply(sqlStmt, [caseKey, 1, _case.ply]
				.concat(_case.actions.map(function (action) {
					return action === null ? null : JSON.stringify(action);
				}))
				.concat(Iterable.chain.apply(Iterable, players.map(function (p) {
					return _case.result[p];
				})).toArray())
				.concat(_case.features)
			).changes > 0;
		if (!isNew) { // Insert was ignored because the case is already stored.
			sql = 'UPDATE '+ this.__tableName__ +' '+
				'SET count = count + 1, ply = (ply * count + '+ (_case.ply || 0) +') / (count + 1), '+
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
				}).join(', ') +' WHERE key = \''+ caseKey +'\'';
			this.__db__.prepare(sql).run();
		}
	},

	__row2case__: function __row2case__(row) {
		return {
			ply: row.ply,
			features: this.__featureColumns__.map(function (col) {
				return row[col];
			}),
			actions: this.__actionColumns__.map(function (col) {
				return JSON.parse(row[col]);
			}),
			result: iterable(this.game.players).map(function (player, i) {
				return [player, [row['won'+ i], row['tied'+ i], row['lost'+ i]]];
			}).toObject()
		};
	},

	cases: function cases(filters) {
		var sql = 'SELECT * FROM '+ this.__tableName__; //TODO Filters
		return this.__db__.prepare(sql).all().map(this.__row2case__.bind(this));
	},

	__nn_sql__: function __nn_sql__(k, game) {
		var gameCase = this.encoding(game);
		return 'SELECT *, ('+ 
			Iterable.zip(this.__featureColumns__, gameCase.features).mapApply(function (v1, v2) {
				return v2 !== null && !isNaN(v2) ? 'abs(ifnull('+ v1 +'-('+ v2 +'),0))' : '0';
			}).join('+') +') AS distance '+
			'FROM '+ this.__tableName__ +' '+
			'ORDER BY distance ASC LIMIT '+ k;
	},

	nn: function nn(k, game) {
		var cb = this,
			sql = this.__nn_sql__(k, game);
		return this.__db__.prepare(sql).all().map(function (row) {
			return [cb.__row2case__(row), row.distance];
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

