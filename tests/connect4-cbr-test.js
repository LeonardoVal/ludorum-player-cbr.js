/** # Connect 4 CBR test

CBR based player test. Populates a case base (SQLite3 database) and assesses the resulting player
against other players. 
*/
var ludorumCBR = require('../build/ludorum-player-cbr'),
	connect4 = require('@creatartis/ludorum-game-connect4'),
	ludorum = require('ludorum'),
	base = require('creatartis-base');

// Connect 4 encoding //////////////////////////////////////////////////////////////////////////////

function encoding_connect4(game, moves, ply) {
	return {
		ply: ply,
		features: game.board.string.split('').map(function (sq) {
			return sq === '.' ? 0 : sq === '0' ? -1 : +1;
		}),
		actions: !moves ? null : game.players.map(function (p) {
			return moves.hasOwnProperty(p) ? moves[p] : null;
		})
	};
}

// Main ////////////////////////////////////////////////////////////////////////////////////////////

var GAME = new connect4.ConnectFour(),
	LOGGER = base.Logger.ROOT,
	RANDOM = new ludorum.players.RandomPlayer({ name: 'RANDOM' }),
	MCTS10 = new ludorum.players.MonteCarloPlayer({ name: 'MCTS10', simulationCount: 10 }),
	MCTS50 = new ludorum.players.MonteCarloPlayer({ name: 'MCTS50', simulationCount: 50 }),
	UCT10 = new ludorum.players.UCTPlayer({ name: 'UCT10', simulationCount: 10 }),
	UCT50 = new ludorum.players.UCTPlayer({ name: 'UCT50', simulationCount: 50 }),
	
	CDB = new ludorumCBR.dbs.SQLiteCaseBase({ 
		game: GAME,
		encoding: encoding_connect4,
		db: 'dbs/'+ GAME.name.toLowerCase() +'-cbr.sqlite',
		tableName: 'CB_'+ GAME.name
	}),
	CBR10 = new ludorumCBR.CBRPlayer({ name: 'CBR10', caseBase: CDB, k: 10 }),
	CBR20 = new ludorumCBR.CBRPlayer({ name: 'CBR20', caseBase: CDB, k: 20 }),
	CBR30 = new ludorumCBR.CBRPlayer({ name: 'CBR30', caseBase: CDB, k: 30 });
LOGGER.appendToConsole();
LOGGER.appendToFile(base.Text.formatDate(new Date(), '"logs/connect4-cbr-test-"yyyymmdd-hhnnss".log"'));

// Case base stuffing //////////////////////////////////////////////////////////////////////////////

var PLAYERS = [RANDOM, CBR10, CBR20, CBR30],
	OPPONENTS = [RANDOM, MCTS10, MCTS50];

LOGGER.info("Populating case base for "+ GAME.name +" with: "+ PLAYERS.map(function (p) {
	return p.name;
}).join(', ') +".");
return CDB.populate({ 
	n: 5000,
	trainer: CBR30,
	players: PLAYERS,
	logger: LOGGER 
}).then(function () {
	LOGGER.info("Evaluating CBRPlayer for "+ GAME.name +".");
	return CBR10.assess(OPPONENTS, { n: 600, logger: LOGGER }).then(function (evaluation) {
		LOGGER.info("Assessment CBR10: "+ JSON.stringify(evaluation));
	}).then(function () {
		return CBR20.assess(OPPONENTS, { n: 600, logger: LOGGER }).then(function (evaluation) {
			LOGGER.info("Assessment CBR20: "+ JSON.stringify(evaluation));
		});
	}).then(function () {
		return CBR30.assess(OPPONENTS, { n: 600, logger: LOGGER }).then(function (evaluation) {
			LOGGER.info("Assessment CBR30: "+ JSON.stringify(evaluation));
		});
	});
}).then(process.exit);