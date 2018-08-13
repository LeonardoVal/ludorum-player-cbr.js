/** # MemoryCaseBase

A memory implementation of a `CaseBase`.
*/
var MemoryCaseBase = dbs.MemoryCaseBase = declare(CaseBase, {
	constructor: function MemoryCaseBase(params) {
		CaseBase.call(this, params);
		this.__cases__ = [];
		this.__index__ = {};
	},

	cases: function cases() {
		return base.iterable(this.__cases__);
	},
	
	addCase: function addCase(_case) {
		var id = _case.identifier();
		if (this.__index__[id]) {
			var storedCase = this.__cases__[this.__index__[id]];
			storedCase.merge(_case);
		} else {
			var i = this.__cases__.push(_case) - 1;
			this.__index__[id] = i;
		}
	}
}); // declare MemoryCaseBase