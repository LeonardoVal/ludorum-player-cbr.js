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

	/* TODO Make actionEvaluations and gameEvaluation with SQL

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

