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