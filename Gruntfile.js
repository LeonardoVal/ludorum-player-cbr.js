﻿/** Gruntfile for [ludorum-player-cbr.js](http://github.com/LeonardoVal/ludorum-player-cbr.js).
*/
module.exports = function (grunt) {
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
	});

	require('@creatartis/creatartis-grunt').config(grunt, {
		sourceNames: ['__prologue__',
			'Case', 'CaseBase', 'CaseBasedPlayer',
			'dbs/MemoryCaseBase', 'dbs/SQLiteCaseBase',
			'games/tictactoe',
			'games/risk',
			'training',
			'utils',
			'__epilogue__'],
		deps: [
			{ id: 'creatartis-base', name: 'base' },
			{
				id: 'sermat', name: 'Sermat',
				path: 'node_modules/sermat/build/sermat-umd.js'
			},
			{ id: 'ludorum' },
			{ id: '@creatartis/ludorum-risky', name: 'ludorum_risky' }
		],
		targets: {
			build_umd: {
				fileName: 'build/ludorum-player-cbr',
				wrapper: 'umd'
			},
			build_raw: {
				fileName: 'build/ludorum-player-cbr-tag',
				wrapper: 'tag'
			}
		}
	});

	grunt.registerTask('default', ['build']);
};
