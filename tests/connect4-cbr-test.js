var ludorumCBR = require('../build/ludorum-player-cbr'),
	connect4 = require('@creatartis/ludorum-game-connect4'),
	ludorum = require('ludorum'),
	base = require('creatartis-base');

function encoding_connect4(game, moves, ply) {
	return {
		ply: ply,
		features: game.board.string.split('').map(function (sq) {
			return sq === '.' ? 0 : +sq + 1;
		}),
		actions: !moves ? null : game.players.map(function (p) {
			return moves.hasOwnProperty(p) ? moves[p] : null;
		})
	};
}

function assessCBR(game, players, opponents) {
	if (!Array.isArray(players)) {
		players = [players];
	}
	LOGGER.info("Populating case base for "+ game.name +" with: "+ players.map(function (trainer) {
		return trainer.name;
	}).join(', ') +".");
	var CDB = new ludorumCBR.dbs.SQLiteCaseBase({ 
		game: game,
		encoding: encoding_connect4,
		dbpath: 'dbs/'+ game.name.toLowerCase() +'-cbr.sqlite',
		tableName: 'CB_'+ game.name //+'_'+ trainer.name 
	});
	return CDB.populate({ 
		n: 2500,
		trainer: new ludorumCBR.CBRPlayer({ name: 'CBRPlayer', caseBase: CDB, k: 30 }),
		players: players, 
		logger: LOGGER 
	}).then(function () {
		LOGGER.info("Evaluating CBRPlayer for "+ game.name +".");
		var player = new ludorumCBR.CBRPlayer({ caseBase: CDB, k: 30 });
		return player.assess(opponents, { n: 600, logger: LOGGER }).then(function (evaluation) {
				LOGGER.info("Assessment: "+ JSON.stringify(evaluation));
			});
	});
}

// Main ////////////////////////////////////////////////////////////////////////////////////////////

var GAME = new connect4.ConnectFour(),
	LOGGER = base.Logger.ROOT,
	RANDOM = new ludorum.players.RandomPlayer({ name: 'RANDOM' }),
	MCTS10 = new ludorum.players.MonteCarloPlayer({ name: 'MCTS10', simulationCount: 10 }),
	MCTS50 = new ludorum.players.MonteCarloPlayer({ name: 'MCTS50', simulationCount: 50 }),
	UCT10 = new ludorum.players.UCTPlayer({ name: 'UCT10', simulationCount: 10 }),
	UCT50 = new ludorum.players.UCTPlayer({ name: 'UCT50', simulationCount: 50 });
LOGGER.appendToConsole();
LOGGER.appendToFile(base.Text.formatDate(new Date(), '"logs/connect4-cbr-test-"yyyymmdd-hhnnss".log"'));
assessCBR(GAME, MCTS50, [RANDOM, MCTS10, MCTS50])
//.then(assessCBR.bind(null, GAME, MCTS10, [RANDOM, MCTS10, MCTS50]))
//.then(assessCBR.bind(null, GAME, MCTS50, [RANDOM, MCTS10, MCTS50]))
//.then(assessCBR.bind(null, GAME, new ludorum.players.UCTPlayer({ simulationCount: 10 }), 'UCT10'))
//.then(assessCBR.bind(null, GAME, new ludorum.players.UCTPlayer({ simulationCount: 50 }), 'UCT50'))
.then(process.exit);