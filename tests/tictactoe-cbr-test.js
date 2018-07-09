var ludorumCBR = require('../build/ludorum-player-cbr'),
	ludorum = require('ludorum'),
	base = require('creatartis-base');

function assessCBR(game, trainer, name) {
	LOGGER.info("Assessing "+ game.name +" with "+ name +".");
	var CDB = new ludorumCBR.dbs.SQLiteCaseBase({ 
		game: game,
		encoding: ludorumCBR.utils.encodings.TicTacToe,
		tableName: 'CB_'+ game.name +'_'+ name 
	});
	return CDB.populate({ 
		n: 100,
		players: [trainer], 
		logger: LOGGER 
	}).then(function () {
		LOGGER.info("Evaluating CBRPlayer for "+ game.name +" trained with "+ name +".");
		var player = new ludorumCBR.CBRPlayer({
				caseBase: CDB, 
				k: 30
			});
		return player.assess(new ludorum.players.RandomPlayer(), { n: 300, logger: LOGGER })
			.then(function (evaluation) {
				LOGGER.info("Against RANDOM: "+ JSON.stringify(evaluation));
			});
	});
}

// Main ////////////////////////////////////////////////////////////////////////////////////////////

var GAME = new ludorum.games.TicTacToe(),
	LOGGER = base.Logger.ROOT;
LOGGER.appendToConsole();
assessCBR(GAME, new ludorum.players.RandomPlayer(), 'RANDOM')
.then(assessCBR.bind(null, GAME, new ludorum.players.AlphaBetaPlayer({ horizon: 2 }), 'MMAB2'))
.then(assessCBR.bind(null, GAME, new ludorum.players.AlphaBetaPlayer({ horizon: 4 }), 'MMAB4'))
.then(assessCBR.bind(null, GAME, new ludorum.players.AlphaBetaPlayer({ horizon: 6 }), 'MMAB6'))
.then(process.exit);