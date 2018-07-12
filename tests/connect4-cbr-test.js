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

function assessCBR(game, trainer, name) {
	LOGGER.info("Assessing "+ game.name +" with "+ name +".");
	var CDB = new ludorumCBR.dbs.SQLiteCaseBase({ 
		game: game,
		encoding: encoding_connect4,
		tableName: 'CB_'+ game.name +'_'+ name 
	});
	return CDB.populate({ 
		n: 250,
		players: [trainer], 
		logger: LOGGER 
	}).then(function () {
		LOGGER.info("Evaluating CBRPlayer for "+ game.name +" trained with "+ name +".");
		var player = new ludorumCBR.CBRPlayer({
				caseBase: CDB, 
				k: 30
			});
		return player.assess(new ludorum.players.RandomPlayer(), { n: 600, logger: LOGGER })
			.then(function (evaluation) {
				LOGGER.info("Against RANDOM: "+ JSON.stringify(evaluation));
			});
	});
}

// Main ////////////////////////////////////////////////////////////////////////////////////////////

var GAME = new connect4.ConnectFour(),
	LOGGER = base.Logger.ROOT;
LOGGER.appendToConsole();
LOGGER.appendToFile(base.Text.formatDate(new Date(), '"logs/connect4-cbr-test-"yyyymmdd-hhnnss".log"'));
assessCBR(GAME, new ludorum.players.RandomPlayer(), 'RANDOM')
.then(assessCBR.bind(null, GAME, new ludorum.players.MonteCarloPlayer({ simulationCount: 10 }), 'MCTS10'))
.then(assessCBR.bind(null, GAME, new ludorum.players.MonteCarloPlayer({ simulationCount: 50 }), 'MCTS50'))
//.then(assessCBR.bind(null, GAME, new ludorum.players.UCTPlayer({ simulationCount: 10 }), 'UCT10'))
//.then(assessCBR.bind(null, GAME, new ludorum.players.UCTPlayer({ simulationCount: 50 }), 'UCT50'))
.then(process.exit);