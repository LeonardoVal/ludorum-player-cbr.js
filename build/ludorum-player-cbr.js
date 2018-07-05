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
		__SERMAT__: { include: [base, ludorum] }
	};


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
//# sourceMappingURL=ludorum-player-cbr.js.map