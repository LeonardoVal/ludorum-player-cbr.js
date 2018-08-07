var posibleLines = [ [0,3,6], [0,4,8], [0,1,2], [1,4,7], [2,4,6], [2,5,8], [3,4,5], [8,7,6] ];
var adyacents = [ [1,4,3], [0,3,4,5,2], [1,4,5], [0,1,4,7,6], [0,1,2,3,5,6,7,8], [1,2,4,7,8], [3,4,7], [6,3,4,5,8], [7,4,5] ];

var getFreeAdyacentsCountPerCell = function(board, index){
	board = board.split('');
	if(board[index] === '_'){
		return adyacents[index].map((cellIndex) => board[cellIndex] === '_' ? 1 : 0).reduce((acumulator,current) => acumulator+current);
	}
	else{
		return 0;
	}
}

var totalFreeAdyacentCount = function(board){
	var adyacentsCountPerCell = [...Array(9).keys()].map((i) => getFreeAdyacentsCountPerCell(board, i));
	var totalAdyacentCount = [...Array(9).keys()];
	totalAdyacentCount = totalAdyacentCount.map((x) => adyacentsCountPerCell.filter((adyacentCount) => adyacentCount == x ? true : false).length );	
	return totalAdyacentCount;
}

var lineLength = function(board,player,line){
	return line.reduce( (acumulator,current) => (board[acumulator]==-1) ? -1 : (board[current]===player) ? acumulator = acumulator + 1 : (board[current] === '_') ? acumulator : -1 , 0);
}

var getLinesLengthCount = function(board,player){
	var linesLenght = posibleLines.map( (line) => lineLength(board,player,line));
	
	var linesOfEachLenght = [-1,0,1,2,3];
	linesOfEachLenght = linesOfEachLenght.map((x) => linesLenght.filter((lineLength) => lineLength == x).length );	

	return linesOfEachLenght;
}

var getFeature = function(board,player){
	return { 
		totalFreeAdyacentCount : totalFreeAdyacentCount(board), //Array from 0 to 8 indicating how many cells have i free adyacents
		linesLenghtcount : getLinesLengthCount(board,player) //Array from 0 to 4, indicating 0: lines bloqued, 1: lines with all cell free, 2: lines with 1 own, 3: lines with 2 own, 4: lines with 3 own
	}
}

var posibleLinesWithCell = function(cellIndex){
	return posibleLines.filter((line) => line.reduce((acumulator,current) =>  acumulator = acumulator || current===cellIndex, false) );
}

var concreteActionToAbstractAction = function(board, player, concreteAction){
	var hipoteticalBoard = board.split('');
	hipoteticalBoard[concreteAction] = player;
	hipoteticalBoard = hipoteticalBoard.join('');

	//La idea es que la action es como si fuera una feature, le digo "estabas asa? ahora quedate asi"
	//El problema que tengo que verificar es que no se si esta funcion es biyectiva, no se cumple que siempre que tengo un estado asa, lo puedo llevar a un estado asi,
	return {
		totalFreeAdyacentCount : totalFreeAdyacentCount(hipoteticalBoard), 
		linesLenghtcount : getLinesLengthCount(hipoteticalBoard,player) 
	}
}

var getFreeCells = function(board){
	board = board.split('');
	return board.map((cell,i) => ({index:i, content: cell})).filter((cell) => cell.content==='_').map((cell) => cell.index)
}

var abstractActionToConcreteAction = function(board, player, abstractAction){
	//Ahora es horrible, porque me estoy dando cuenta que tengo que ver todas mis concrete actions y ver cual es como mi abstractAction	
	var hipoteticalAbstractActionsForFreeCells = getFreeCells(board).map((hipoteticalConcreteAction) => ({concrete: hipoteticalConcreteAction, abstract : concreteActionToAbstractAction(board,player,hipoteticalConcreteAction) }));

	hipoteticalAbstractActionsForFreeCells = hipoteticalAbstractActionsForFreeCells.filter((hipoteticalAbstractAction) => sameAbstractActions(hipoteticalAbstractAction.abstract,abstractAction));
	console.log(hipoteticalAbstractActionsForFreeCells);
	return hipoteticalAbstractActionsForFreeCells[0].concrete;
}

var sameAbstractActions = (a,b) => JSON.stringify(a) === JSON.stringify(b);

var playerConverter = (player) => player.substring(0,1);

var encodingTicTacToeAbstract = function(game,moves,ply){
	//The game uses Xs and Os for players, we need them to match the simbols in the board
	var player = playerConverter(ply);
	var feature = getFeature(game.board,player);

	return{
		ply: ply,
		features: feature.totalFreeAdyacentCount.concat(feature.linesLenghtcount),
		actions: moves.map((concreteAction) => concreteActionToAbstractAction(game.board,player,concreteAction)),
	}
}

module.exports = encodingTicTacToeAbstract;