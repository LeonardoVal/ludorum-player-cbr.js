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
			caseKey = '\''+ this.__key__(_case) +'\'',
			sql = 'INSERT OR IGNORE INTO Cases VALUES ('+ [caseKey, 0]
				.concat(_case.features.map(JSON.stringify))
				.concat(_case.actions.map(JSON.stringify))
				.concat(base.Iterable.repeat(0, players.length * 3).toArray())
				.join(',') +')';
		this.__db__.prepare(sql).run();
		sql = 'UPDATE Cases SET count = count + 1, '+
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

	// Utilities //////////////////////////////////////////////////////////////////////////////////

	'static __SERMAT__': {
		identifier: 'SQLiteCaseBase',
		serializer: function serialize_SQLiteCaseBase(obj) {
			return CaseBase.__SERMAT__.serialize_CaseBase(obj);
		}
	},
}); // declare SQLiteCaseBase

