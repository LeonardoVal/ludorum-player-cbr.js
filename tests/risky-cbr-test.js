var ludorumCBR = require('../build/ludorum-player-cbr'),
	Database = require('better-sqlite3'),
    ludorum = require('ludorum'),
	base = require('creatartis-base');

var DATABASE = new Database('./tests/dbs/tictactoe-cbr.sqlite'),
	LOGGER = base.Logger.ROOT;
	LOGGER.appendToConsole();

base.Future.sequence(base.iterable({
	RANDOM: new ludorum.players.RandomPlayer({ name: 'RANDOM' })
}), function (tuple) {
	var name = tuple[0],
		trainer = tuple[1];
	return ludorumCBR.utils.populateAndAssess(
		new ludorumCBR.games.Risk.DirectCBPlayer({
			name: 'DirectCBPlayer',
			k: 30,
			caseBase: new ludorumCBR.dbs.SQLiteCaseBase({
				db: DATABASE,
				tableName: 'CB_Risk_'+ name 
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