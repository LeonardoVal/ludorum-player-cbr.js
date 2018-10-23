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

	/** Adding a case to the database is not implemented by default.
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