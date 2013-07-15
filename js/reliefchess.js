/**
 * @package Relief Chess Prototype
 * @author  Savr Goryaev <me@savreen.com>
 * @license http://opensource.org/licenses/gpl-license GPL
 */


if (window.jQuery) {
(function($) {


// Constants
var oCss = {
    'board': 'chess-board',
    'sqrid': 'sqrId',
    'relief': 'relief',
    'piece': 'piece'
};
var nReliefLimit = 32;
var nReliefItems = 9;
var aReliefItems = [
    'relief-bishop-pos',
    'relief-bishop-way',
    'relief-bishop-spd',
    'relief-rook-pos',
    'relief-rook-way',
    'relief-rook-spd',
    'relief-queen-pos',
    'relief-queen-way',
    'relief-queen-spd'
];
var aPieceItems = [
    'pawn-black',
    'knight-black',
    'bishop-black',
    'rook-black',
    'queen-black',
    'king-black',
    'pawn-white',
    'knight-white',
    'bishop-white',
    'rook-white',
    'queen-white',
    'king-white',
];
var aPieceInitPos = [
    3, 1, 2, 4, 5, 2, 1, 3
];
var aCastlingSrc = [0, 7, 56, 63];
var aCastlingTrg = [3, 5, 59, 61];
var aKingDeltas = [-9, -8, -7, -1, 1, 7, 8, 9];
var aKingDeltasExc = [0, 3, 5,  2, 4, 7,  0, 1, 2,  5, 6, 7];
var aPawnDeltas = [7, 8, 9, -9, -8, -7];

// Variables
var oOptions = {
    'nSize': 512,
    'nIntReliefAlloc': 300,
    'aReliefDistrib': [2, 1, 3, 2, 1, 3, 3, 2, 4],
    'bReliefMoveBased': false,
    'bReliefOnCapture': false,
    'bRelief4Knight': false,
    'bViewAutoChange': false,
    'nMovesMax': 128,
    'fnOnUpdate': null,
    'fnOnSquare': null
};
var oState = {
    'nReliefAlloc': 0,
    'bReliefAllocMode': false,
    'iView': 0,
    'iMove': 0,
    'bMoveValid': 0,
    'bCheck': 0,
    'bMate': 0,
    'bStalemate': 0
};
var aSqrElems = 0;
var aSeedReliefs = 0;
var aGameReliefs = 0;
var aGamePieces = 0;
var aGameKingMoves = [0,0];
var aGamePawnMoves = [0,0,  0,0];
var aGameEvents = [0,0,0, 0,0,0];
var iGameMove = 0;
var iSqrSel = -1;
var nIdTimer = 0;
var aTmpPieces = 0;


$.fn.reliefchess= function(v) {
    if (!v || typeof v == 'object') {
        setOptions(v);
        if (!aSqrElems) {
            createBoard(this); newGame();
        }
        return;
    }
    if (typeof v != 'string') return;
    switch (v) {
        case 'newgame': // 
            newGame();
            break;
        case 'history.back': // 
            history(0);
            break;
        case 'history.forward': // 
            history(true);
            break;
        case 'view.white': // set view
            setView(0);
            break;
        case 'view.black': // set view
            setView(1);
            break;
        case 'relief.alloc': // 
            toggleReliefAlloc();
            break;
        default:
    }
};

function setOptions(obj) {
    if (typeof obj != 'object') return;
    if (!validateReliefDistrib(obj.aReliefDistrib))
        delete obj.aReliefDistrib;
    if (typeof obj.fnOnSquare != 'function')
        delete obj.fnOnSquare;
    if (typeof obj.fnOnUpdate != 'function')
        delete obj.fnOnUpdate;
    if (obj.nMovesMax && obj.nMovesMax >= 200)
        delete obj.nMovesMax;
    $.extend(oOptions, obj);
}

function validateReliefDistrib(aDistrib) {
    if (!(aDistrib && aDistrib.length)) return false;
    var s = 0;
    for (var i in aDistrib) {
        if (aDistrib[i] < 0) return false;
        else s += aDistrib[i];
    }
    return s <= nReliefLimit;
}

function createBoard(oPlace) {
    if (!oPlace.length || typeof oOptions.nSize != 'number') return;
    var nSize = oOptions.nSize- oOptions.nSize% 8;
    var oTd = $('<td>').append(
        $('<div>').append('<div>').append('<div>')
    );
    var oTr = $('<tr>');
    for (var i = 0; i < 8; i++)
        oTr.append(oTd.clone());
    var oTbl = $('<table>').addClass(oCss.board)
    .css({
        'width': nSize+'px', 'height': nSize+'px'
    });
    for (i = 0; i < 8; i++)
        oTbl.append(oTr.clone());
    aSqrElems = oTbl.find('td');
    var aCls = ['white', 'black'];
    aSqrElems.each(function(i) {
        var k = (Math.floor(i/ 8)+ i% 8)% 2;
        $(this).addClass(aCls[k]).data(oCss.sqrid, i);
    })
    .click(clickSquare)
    .hover(hoverSquareIn, hoverSquareOut);
    oPlace.eq(0).append(oTbl);
}

function newGame() {
    prepareGame();
}

function prepareGame() {
    oState.iMove = iGameMove = 0;
    oState.iView = 0;
    oState.nReliefAlloc = 64;
    oState.bReliefAllocMode = oState.bCheck = oState.bMate = oState.bStalemate = false;
    aSeedReliefs = generateRelief();
    aGameReliefs = [];
    aGamePieces = [];
    resetSquareWrappers();
    resetSquares();
    callUpdate();
}

function initGame() {
    aGamePieces = generatePieces();
    resetSquareWrappers();
    outRelief();
    outPieces();
    callUpdate();
}

function setView(iView) {
    iView = iView? 1:0;
    if (iView == oState.iView) return;
    oState.iView = iView;
    resetSquareWrappers();
    outRelief();
    outPieces();
    showSelectedSquare();
}

function generateRelief() {
    var aRet = [];
    var aInds= [];
    var i, j, l;
    for (i= 0; i < 64; i++) aRet[i]= -1;
    for (l= 0; l < nReliefItems; l++) {
        var cnt= oOptions.aReliefDistrib[l];
        for (j= 0; j < cnt; j++) {
            do i= Math.floor(Math.random()*64); while (aInds.indexOf(i) >= 0);
            aInds.push(i);
            aRet[i]= l;
        }
    }
    return aRet;
}

function generatePieces() {
    var aRet = [];
    var i, j;
    for (i= 0; i < 64; i++) aRet[i]= -1;
    for (j= 0; j < 8; j++) {
        aRet[j]= aPieceInitPos[j];
        aRet[j+ 56]= aPieceInitPos[j]+ 6;
        aRet[j+ 8]= 0;
        aRet[j+ 48]= 6;
    }
    return aRet;
}

function resetSquareWrappers() {
    var n = aSqrElems.children().attr('class', '').length;
}

function resetSquares() {
    var n = aSqrElems.children().children().attr('class', '').length;
}

function outRelief() {
    if (typeof aSqrElems != 'object' || typeof aGameReliefs != 'object') return;
    for (var i = 0; i < 64; i++) {
        var iRlf = aGameReliefs[i];
        var s = iRlf >= 0? oCss.relief+ ' '+ aReliefItems[iRlf] : '';
        aSqrElems.eq(convertSquareId(i))
        .children().eq(0).children().eq(0).attr('class', s);
    }
}

function outPieces() {
    if (typeof aSqrElems != 'object' || typeof aGamePieces != 'object') return;
    for (var i = 0; i < 64; i++) {
        var iPiece = getSqrPiece(i);
        var s = iPiece >= 0? oCss.piece+ ' '+ aPieceItems[iPiece] : '';
        aSqrElems.eq(convertSquareId(i))
        .children().eq(0).children().eq(1).attr('class', s);
    }
}

function toggleReliefAlloc() {
    if (oState.bReliefAllocMode = !oState.bReliefAllocMode)
        iterateReliefAlloc();
    else
        stopReliefAlloc();
    callUpdate();
}

function iterateReliefAlloc() {
    stopReliefAlloc();
    while (!markSquare(Math.floor(Math.random()*64)));
    if (!oState.nReliefAlloc) return;
    nIdTimer= setTimeout(iterateReliefAlloc, oOptions.nIntReliefAlloc);
}

function stopReliefAlloc() {
    if (!nIdTimer) return;
    clearTimeout(nIdTimer);
}

function clickSquare() {
    var id = convertSquareId(getSquareId(this));
    if (oState.nReliefAlloc) {
        markSquare(id); return;
    }
    if (oState.bMate || oState.bStalemate || iGameMove >= oOptions.nMovesMax) return;
    if (iSqrSel < 0) {
        selectSquare(id); return;
    }
    if (id == iSqrSel) return;
    var iSel = iSqrSel;
    copyPieces();
    var ret = validateMove(iSqrSel, id);
    unselectSquare();
    if (!ret) return;
    iGameMove++;
    var arr = [iSel, id];
    if (ret.length == 2) arr = arr.concat(ret);
    doMove(arr);
    copyPieces();
    var iCrSelf = iGameMove% 2, iCrEnemy = (iGameMove+ 1)% 2;
    if (checkThreat(iCrSelf)) {
        aGamePieces.length = iGameMove* 64;
        iGameMove--;
        return;
    }
    for (var i0 = iCrEnemy* 3, i = 0; i < 3; i++)
        if (aGameEvents[i0+ i] >= iGameMove) aGameEvents[i0+ i] = 0;
    if (ret = checkMate(iCrEnemy, id)) {
        aGameEvents[i0+ ret-1] = iGameMove;
    }
    updateState();
    outPieces();
    callUpdate();
}

function updateState() {
    oState.iMove = iGameMove;
    var iCr = (iGameMove+ 1)% 2, i0 = iCr* 3;
    oState.bCheck = iGameMove > 0 && aGameEvents[i0] == iGameMove;
    oState.bMate = iGameMove > 0 && aGameEvents[i0+ 1] == iGameMove;
    oState.bStalemate = iGameMove > 0 && aGameEvents[i0+ 2] == iGameMove;
    if (oOptions.bViewAutoChange) {
        oState.iView = iGameMove% 2;
        outRelief();
    }
}

function markSquare(id) {
    var oSqr = aSqrElems.eq(convertSquareId(id)).children();
    if (oSqr.hasClass('square-marked')) return false;
    aGameReliefs[id] = aSeedReliefs[--oState.nReliefAlloc];
    oSqr.addClass('square-marked');
    if (!oState.nReliefAlloc) initGame();
    return true;
}

function hoverSquareIn() {
    if (oState.nReliefAlloc) return;
    var id = convertSquareId(getSquareId(this));
    callUpdateSquare(true, id% 8, Math.floor(id/ 8), aGameReliefs[id]);
}

function hoverSquareOut() {
    if (oState.nReliefAlloc) return;
    callUpdateSquare(false);
}

function history(bDir) {
    var iDelta = bDir? 1: -1, iMove = iGameMove+ iDelta, n = aGamePieces.length;
    if (iMove < 0 || iMove* 64- n >= 0) return;
    iGameMove = iMove;
    updateState();
    resetSquareWrappers();
    outPieces();
    callUpdate();
}

function selectSquare(id) {
    var iPc = getSqrPiece(id);
    if (!(iPc >= 0 && Math.floor(iPc/ 6) == (iGameMove+ 1)% 2)) return;
    iSqrSel = id;
    showSelectedSquare();
}

function showSelectedSquare() {
    if (iSqrSel < 0) return;
    aSqrElems.eq(convertSquareId(iSqrSel)).children().eq(0).addClass('selected');
}

function unselectSquare() {
    if (iSqrSel < 0) return;
    aSqrElems.eq(convertSquareId(iSqrSel)).children().eq(0).removeClass('selected');
    iSqrSel = -1;
}

function convertSquareId(i) {
    return oState.iView? 63- i : i;
}

function getSquareId(obj) {
    return parseInt($(obj).data(oCss.sqrid));
}

function checkThreat(iColor) {
    return checkCapture(iColor, getKingSquare(iColor));
}

function checkMate(iColor, iSqrSrc) {
    var iSqrKing = getKingSquare(iColor), iPcKing = aTmpPieces[iSqrKing];
    if (!checkCapture(iColor, iSqrKing)) {
        return checkKingLocked(iColor, iSqrKing) && checkPawnsLocked(iColor)? 3 : false;
    }
    if (!checkKingLocked(iColor, iSqrKing)) return 1;
    if (checkCapture((iColor+1)% 2, iSqrSrc, iSqrKing+1)) return 1;
    if (!validateMove(iSqrKing, iSqrSrc)) return 1;
    aTmpPieces[iSqrSrc] = iPcKing;
    aTmpPieces[iSqrKing] = -1;
    return 1+ Number(checkCapture(iColor, iSqrSrc));
}

function checkCapture(iColor, iSqr, iSqrExc) {
    iSqrExc = iSqrExc? iSqrExc- 1: -1;
    for (var i = 0; i < 64; i++) {
        if (i == iSqrExc) continue;
        var iPc = aTmpPieces[i], iCr = Math.floor(iPc/6);
        if (iPc < 0 || iCr == iColor) continue;
        if (validateMove(i, iSqr)) return true;
    }
    return false;
}

function checkKingLocked(iColor, iSqrKing) {
    var aDeltas = aKingDeltas.slice(0), iPcKing = aTmpPieces[iSqrKing];
    var x = iSqrKing% 8, y = Math.floor(iSqrKing/ 8);
    var aFlags = [x <= 0, x >= 7, y <= 0, y >= 7];
    for (var i = 0; i < 4; i++) {
        if (!aFlags[i]) continue;
        for (var j = 0; j < 3; j++)
            aDeltas[aKingDeltasExc[i* 3+ j]] = 0;
    }
    for (i = aDeltas.length- 1; i >= 0; i--) {
        var iSqr = iSqrKing+ aDeltas[i];
        if (!aDeltas[i] || aTmpPieces[iSqr] >= 0) continue;
        copyPieces();
        aTmpPieces[iSqr] = iPcKing;
        aTmpPieces[iSqrKing] = -1;
        if (!checkCapture(iColor, iSqr)) break;
    }
    copyPieces();
    return i < 0;
}

function checkPawnsLocked(iColor) {
    for (var i = 0; i < 64; i++) {
        var iPc = aTmpPieces[i], iCr = Math.floor(iPc/6);
        if (iPc < 0 || iCr != iColor) continue;
        if (iPc% 6 > 0) return false;
        var aDeltas = aPawnDeltas.slice(iCr* 3);
        for (var j = aDeltas.length- 1; j >= 0 && validateMove(i, j); j--) ;
        if (j >= 0) return false;
    }
    return true;
}

function validateMove(iSrc, iTrg) {
    var xSrc = iSrc% 8, ySrc = Math.floor(iSrc/ 8), iPcSrc = aTmpPieces[iSrc];
    var xTrg = iTrg% 8, yTrg = Math.floor(iTrg/ 8), iPcTrg = aTmpPieces[iTrg];
    var iRlf = aGameReliefs[iTrg];
    var iCrSrc = Math.floor(iPcSrc/ 6), iCrTrg = Math.floor(iPcTrg/ 6), iPcSign = iCrSrc? -1 : 1;
    var dx = xTrg- xSrc, dy = yTrg- ySrc;
    var dxr = dx* iPcSign, dyr = dy* iPcSign;
    var iPc = iPcSrc% 6;
    if (iPcSrc >= 0 && iPcTrg >= 0 && !(iCrSrc ^ iCrTrg)) return false;
    switch (iPc) {
        case 0: // pawn
            yTrg = iCrSrc? 7- yTrg : yTrg;
            var bDiag = dxr* dxr == 1 && dyr == 1;
            var b = false, b2 = false;
            if (iPcTrg >= 0)
                b = bDiag;
            else if (dxr == 0)
                b = dyr == 1 ||
                    (b2 = dyr == 2 && yTrg == 3 && aTmpPieces[iSrc+ sign(dy)* 8] < 0);
            if (b2) {
                aGamePawnMoves[iCrSrc* 2] = iGameMove+ 1;
                aGamePawnMoves[iCrSrc* 2+ 1] = iTrg;
            }
            if (b)
                return yTrg == 7? [iTrg, -4*iCrSrc] : true;
            var j0, iEnemy;
            b = bDiag && yTrg == 5 &&
                aGamePawnMoves[j0 = (iCrSrc+1)% 2* 2] == iGameMove &&
                Math.abs((iEnemy = aGamePawnMoves[j0+ 1])- iSrc) == 1;
            return b? [iEnemy, -1] : false;
            break;
        case 1: // knight
            return dx* dx+ dy* dy == 5 && (!oOptions.bRelief4Knight || iRlf != 0);
            break;
        case 2: // bishop
            return dx* dx == dy* dy && validateMovePath(iSrc, dx, dy, iPc);
            break;
        case 3: // rook
            return dx* dy == 0 && validateMovePath(iSrc, dx, dy, iPc);
            break;
        case 4: // queen
            return (dx* dx == dy* dy || dx* dy == 0) && validateMovePath(iSrc, dx, dy, iPc);
            break;
        case 5: // king
            var ret = false;
            if (xSrc == 4 && dx* dx == 4 && dy == 0)
                ret = !aGameKingMoves[iCrSrc] || aGameKingMoves[iCrSrc] > iGameMove?
                    validateCastling(iSrc, dx, iCrSrc) : false;
            else
                ret = dx* dx <= 1 && dy* dy <= 1;
            if (ret)
                aGameKingMoves[iCrSrc] = iGameMove+ 1;
            return ret;
            break;
        default:
    }
    return true;
}

function validateMovePath(iSrc, dx, dy, iPc) {
    if (!(iPc >= 2 && iPc <= 4)) return true;
    iPc -= 2;
    var di = sign(dx)+ sign(dy)* 8;
    var n = Math.max(Math.abs(dx), Math.abs(dy));
    for (var i = 1; i < n; i++) {
        var iSq= iSrc+ i* di;
        if (aTmpPieces[iSq] >= 0) return false;
        var iRlf = aGameReliefs[iSq];
        if (iRlf < 0) continue;
        var iRlfPc = Math.floor(iRlf/ 3), iRlfObj = iRlf% 3;
        if (iRlfObj > 0 && checkReliefSubject(iRlfPc, iPc, dx, dy)) return false;
    }
    iSq = iSrc+ n* di; iRlf = aGameReliefs[iSq];
    if (iRlf >= 0 && (aTmpPieces[iSq] < 0 || oOptions.bReliefOnCapture)) {
        iRlfPc = Math.floor(iRlf/ 3); iRlfObj = iRlf% 3;
        if (iRlfObj < 2 && checkReliefSubject(iRlfPc, iPc, dx, dy)) return false;
    }
    return true;
}

function validateCastling(iSqrKing, dx, iColor) {
    var k = iColor* 2+ (dx > 0? 1: 0);
    var iRkSrc = aCastlingSrc[k], iRkTrg = aCastlingTrg[k];
    if (!validateMove(iRkSrc, iRkTrg)) return false;
    var b = aGameEvents[iColor*3] != iGameMove &&
        !checkCapture(iColor, iSqrKing+ sign(dx)) &&
        !checkCapture(iColor, iSqrKing+ 2* sign(dx));
    return b? [iRkSrc, iRkTrg] : false;
}

function checkReliefSubject(iRlfPc, iPc, dx, dy) {
    if (!oOptions.bReliefMoveBased)
        return iRlfPc == iPc;
    return iRlfPc == 2 || iRlfPc == iPc || iPc == 2 && iRlfPc ^ dx* dy != 0;
}

function getKingSquare(iColor) {
    var i0 = iGameMove* 64, iL = i0+ 64, iPc = iColor? 11 : 5;
    for (var i = i0; i < iL && aGamePieces[i] != iPc; i++) ;
    return i- i0;
}

function getSqrPiece(id) {
    return aGamePieces[iGameMove* 64+ id];
}

function doMove(aMoves) {
    if (aMoves.length < 2) return;
    var i0 = iGameMove* 64, iL = i0+ 64;
    aGamePieces.length = iL;
    for (var i = i0; i < iL; i++)
        aGamePieces[i] = aGamePieces[i- 64];
    var k = Math.floor(aMoves.length/ 2)- aMoves.length% 2;
    for (var j= 0; j < k; j++) {
        var iSrc = aMoves[j*2], iTrg = aMoves[j*2+ 1];
        if (iTrg >= 0)
            aGamePieces[i0+ iTrg] = iSrc >= 0? getSqrPiece(iSrc) : -iSrc;
        aGamePieces[i0+ iSrc] = -1;
    }
}

function copyPieces() {
    aTmpPieces = aGamePieces.slice(iGameMove* 64, iGameMove* 64+ 64);
}

function callUpdate() {
    if (!oOptions.fnOnUpdate) return;
    oOptions.fnOnUpdate.call(null, oState);
}

function callUpdateSquare(bIn, x, y, iRelief) {
    if (!oOptions.fnOnSquare) return;
    oOptions.fnOnSquare.call(null,
        bIn? {'x': x, 'y': y, 'relief': iRelief} : 0
    );
}

function sign(x) {
    return x == 0? 0 : (x > 0? 1 : -1);
}


})(jQuery);
}