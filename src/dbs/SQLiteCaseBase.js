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
	},

	// Utilities //////////////////////////////////////////////////////////////////////////////////

	'static __SERMAT__': {
		identifier: 'SQLiteCaseBase',
		serializer: function serialize_SQLiteCaseBase(obj) {
			return CaseBase.__SERMAT__.serialize_CaseBase(obj);
		}
	},
}); // declare SQLiteCaseBase

