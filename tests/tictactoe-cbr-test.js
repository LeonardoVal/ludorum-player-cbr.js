var ludorumCBR = require('../build/ludorum-player-cbr'),
	ludorum = require('ludorum'),
	base = require('creatartis-base');

var LOGGER = base.Logger.ROOT;
	LOGGER.appendToConsole();

base.Future.sequence(base.iterable({
	RANDOM: new ludorum.players.RandomPlayer({ name: 'RANDOM' }),
	MMAB2: new ludorum.players.AlphaBetaPlayer({ name: 'MMAB2', horizon: 2 }),
	MMAB4: new ludorum.players.AlphaBetaPlayer({ name: 'MMAB4', horizon: 4 }),
	MMAB6: new ludorum.players.AlphaBetaPlayer({ name: 'MMAB6', horizon: 6 })
}), function (tuple) {
	var name = tuple[0],
		trainer = tuple[1];
	return ludorumCBR.utils.populateAndAssess(
		new ludorumCBR.games.TicTacToe.DirectCBPlayer({
			name: 'DirectCBPlayer',
			k: 30,
			caseBase: new ludorumCBR.dbs.SQLiteCaseBase({
				db: './tests/dbs/tictactoe-cbr.sqlite',
				tableName: 'CB_TicTacToe_'+ name 
			})
		}), {
			trainer: trainer,
			populateCount: 1000,
			assessCount: 800,
			logger: LOGGER
		});
}).then(function () {
	process.exit();
});