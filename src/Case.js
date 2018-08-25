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

	/** The static method `fromGame` creates a case from a game state, ply number and moves
	performed.
	*/
	'static fromGame': base.objects.unimplemented('Case', 'fromGame(game, ply, moves)'),

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
	},

	/** Merging `this` case with another case updates the properties `ply`, `count` and `results`.
	*/
	merge: function merge(_case) {
		this.ply = (this.ply * this.count + _case.ply * _case.count) / (this.count + _case.count);
		this.count += _case.count;
		this.addResult(_case.result);
	},

	/** Cases' features and actions can result from transformations and apply to several different
	game states. The `getMove` method allows a case to adapt its action to a given game state. 
	*/
	getMove: function getMove(game, role) {
		return this.actions[role];
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

	// ## Utilities ################################################################################

	/** `emptyResults` creates an object that maps every player to an array with 3 zeros.
	*/
	'static emptyResults': function emptyResults(players) {
		return iterable(players).map(function (p) {
			return [p, [0, 0, 0]];
		}).toObject();
	},

	/** This method adds null actions to a copy of the `moves` object.
	*/
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