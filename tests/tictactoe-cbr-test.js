var ludorumCBR = require('../build/ludorum-player-cbr'),
	ludorum = require('ludorum'),
	base = require('creatartis-base');

function assessCBR(trainer, name) {
	LOGGER.info("Assessing TicTacToe with "+ name +".");
	var cbPlayer = new ludorumCBR.games.TicTacToe.DirectCBPlayer({
			name: 'DirectCBPlayer',
			k: 30,
			caseBase: new ludorumCBR.dbs.SQLiteCaseBase({
				db: './tictactoe-cbr.sqlite',
				tableName: 'CB_TicTacToe_'+ name 
			})
		});
	return cbPlayer.populate({ 
		n: 1000,
		trainer: trainer, 
		logger: LOGGER 
	}).then(function () {
		LOGGER.info("Evaluating CBRPlayer for TicTacToe trained with "+ name +".");
		return cbPlayer.assess(new ludorum.players.RandomPlayer(), { n: 800, logger: LOGGER })
			.then(function (evaluation) {
				LOGGER.info("Against RANDOM: "+ JSON.stringify(evaluation));
			});
	});
}

// Main ////////////////////////////////////////////////////////////////////////////////////////////

var LOGGER = base.Logger.ROOT;
LOGGER.appendToConsole();
assessCBR(new ludorum.players.RandomPlayer(), 'RANDOM')
.then(assessCBR.bind(null, new ludorum.players.AlphaBetaPlayer({ horizon: 2 }), 'MMAB2'))
.then(assessCBR.bind(null, new ludorum.players.AlphaBetaPlayer({ horizon: 4 }), 'MMAB4'))
.then(assessCBR.bind(null, new ludorum.players.AlphaBetaPlayer({ horizon: 6 }), 'MMAB6'))
.then(process.exit);