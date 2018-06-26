var player_cbr = require('../build/ludorum-player-cbr'),
	mancala = require('@creatartis/ludorum-game-mancala'),
	ludorum = require('ludorum');

var GAME = new mancala.Mancala(),
	EVAL_MATCH_COUNT = 60,
	CDB = new player_cbr.CBRDatabase({ 
		featureFunction: function features(game, moves) {
			var activePlayer = game.activePlayer(),
				r = game.board.slice();
			r.unshift(game.players.indexOf(activePlayer));
			if (moves) {
				r.push(moves[activePlayer]);
			}
			return r;
		}
	});
CDB.addMatchesBetween(10, GAME, [
	new ludorum.players.RandomPlayer(),
	new ludorum.players.AlphaBetaPlayer({ horizon: 2 }),
	//new ludorum.players.AlphaBetaPlayer({ horizon: 4 }),
	new ludorum.players.MonteCarloPlayer({ simulationCount: 60 }),
	//new ludorum.players.MonteCarloPlayer({ simulationCount: 240 }),
]).then(function () {
	console.log("CDB has "+ CDB.cases.length +" cases that applied to "+ CDB.totalCount +" times.");
	CDB.cases.forEach(function (_case) { //FIXME
		if (_case.join('').startsWith('044444404444440')) {
			console.log(_case.join(' ') +' '+ JSON.stringify(_case.result) +' #'+ _case.count);
		}
	});
	var cbrPlayer = new player_cbr.CBRPlayer({ caseDB: CDB });
	cbrPlayer.assess(GAME, new ludorum.players.RandomPlayer(), EVAL_MATCH_COUNT).then(function (evaluation) {
		console.log("Evaluation: "+ JSON.stringify(evaluation) +" on "+ EVAL_MATCH_COUNT +" matches.");
	});
});