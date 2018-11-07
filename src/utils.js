/** # Utilities

*/

utils.assess = function assess(cbPlayer, options) {
	var opponents = options.opponents || 
			options.opponent ? [options.opponent] : new ludorum.players.RandomPlayer(),
		game = options.game || cbPlayer.game,
		evaluation = iterable(opponents).map(function (player) {
			return [player.name, iterable(game.players).map(function (p) {
					return [p, [0,0,0]];
				}).toObject()];
			}).toObject(),
		assessCount = options && +options.assessCount || 300,
		finishedMatchesCount = 0,
		intervalId = 0,
		logger = options.logger;
	if (logger) {
		intervalId = setInterval(function () {
			logger.info("Assessment finished "+ finishedMatchesCount +" matches.");
		}, options.logTime || 30000);
	}
	return base.Future.sequence(base.Iterable.range(assessCount).product(opponents), function (tuple) {
		var player = tuple[1],
			matchPlayers = base.Iterable.repeat(player, game.players.length).toArray(),
			playerIndex = tuple[0] % game.players.length,
			playerRole = game.players[playerIndex];
		matchPlayers[playerIndex] = cbPlayer;
		var match = new ludorum.Match(game, matchPlayers);
		return match.run().then(function () {
			var r = match.result()[playerRole];
			evaluation[player.name][playerRole][r > 0 ? 0 : r < 0 ? 2 : 1]++;
			finishedMatchesCount++;
		});
	}).then(function () {
		clearInterval(intervalId);
		if (logger) {
			logger.info("Assessment finished "+ finishedMatchesCount +" matches.");
		}
		return evaluation;
	});
};

utils.populateAndAssess = function populateAndAssess(player, options) {
	var name = options.name || player.name,
		logger = options.logger,
		game = options.game || player.game;
	if (logger) {
		logger.info("Assessing "+ game.name +" with "+ name +".");
	}
	return player.populate({ 
		n: options.populateCount || 1000,
		trainer: options.trainer || new ludorum.players.RandomPlayer(),
		logger: logger 
	}).then(function () {
		logger.info("Evaluating player for "+ game.name +" trained with "+ name +".");
		return base.Future.sequence(options.opponents || [new ludorum.players.RandomPlayer()], function (opponent) {
			return utils.assess(player, {
					opponent: opponent,
					assessCount: options.assessCount || 800, 
					logger: logger 
				}).then(function (evaluation) {
					logger.info("Against "+ opponent.name +": "+ JSON.stringify(evaluation));
				});
		});
	});
};
