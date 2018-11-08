/** # Training

Functions and definitions related to populate or curate case bases.
*/

/** The `populate` function adds cases to the database by running several matches and adding the
resulting game states. The `options` argument may include the following:

+ `game`: The game state from which to start the matches. The database's `game` is used by 
default.

+ `n`: The number of matches to run; 100 by default.

+ `trainer`: The player to use agains the opponents. This player is used by default.

+ `opponents`: The trainer's opponents to use to play the matches. The trainer is used by default.

Other options are passed to the `addMatches` method. The result is a promise.
*/
training.populate = function populate(cbPlayer, options) {
	options = options || {};
	var game = options.game || cbPlayer.game,
		n = isNaN(options.n) ? 100 : +options.n,
		trainer = options.trainer || cbPlayer,
		opponents = options.opponents || [trainer];
	if (!Array.isArray(opponents)) {
		opponents = [opponents];
	}
	var tournament = new ludorum.tournaments.Measurement(game, trainer, opponents, 1),
		matchups = tournament.__matches__().toArray();
	return cbPlayer
		.addMatches(Iterable.range(Math.ceil(n / matchups.length))
		.product(matchups)
		.mapApply(function (i, match) {
			return new ludorum.Match(game, match.players);
		}), options);
};