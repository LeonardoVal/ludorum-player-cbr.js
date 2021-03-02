/** Package wrapper and layout.
*/
function __init__(base, Sermat, ludorum, ludorum_risky) { "use strict";
// Import synonyms. ////////////////////////////////////////////////////////////////////////////////
	var declare = base.declare,
		unimplemented = base.objects.unimplemented,
		raise = base.raise,
		raiseIf = base.raiseIf,
		Randomness = base.Randomness,
		Iterable = base.Iterable,
		iterable = base.iterable,
		Future = base.Future;

// Library layout. /////////////////////////////////////////////////////////////////////////////////
	var exports = {
			__package__: 'ludorum-player-cbr',
			__name__: 'ludorum_player_cbr',
			__init__: __init__,
			__dependencies__: [base, Sermat, ludorum, ludorum_risky],
			__SERMAT__: { include: [base, ludorum, ludorum_risky] },

			dbs: { /* Namespace for different types of case bases. */ },
			games: { /* Namespace for functions and definitions for supporting games. */ },
			training: { /* Namespace for functions and definitions related to populate or curate case bases. */ },
			utils: { /* Namespace for utility functions. */ }
		},
		dbs = exports.dbs,
		games = exports.games,
		training = exports.training,
		utils = exports.utils
	;
