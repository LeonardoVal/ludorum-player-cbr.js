/** # MemoryCaseBase

A memory implementation of a `CaseBase`.
*/
var MemoryCaseBase = dbs.MemoryCaseBase = declare(CaseBase, {
	constructor: function MemoryCaseBase(params) {
		CaseBase.call(this, params);
		this.__cases__ = [];
		this.__index__ = {};
		if (params && params.__cases__) {
			params.__cases__.forEach(this.addCase.bind(this));
		}
	},

	cases: function cases() {
		return base.iterable(this.__cases__);
	},
	
	addCase: function addCase(_case) {
		var id = _case.identifier();
		if (this.__index__.hasOwnProperty(id)) {
			var storedCase = this.__cases__[this.__index__[id]];
			storedCase.merge(_case);
		} else {
			var i = this.__cases__.push(_case) - 1;
			this.__index__[id] = i;
		}
	},

	/** ## Utilities ############################################################################ */

	'static __SERMAT__': {
		identifier: 'MemoryCaseBase',
		serializer: function serialize_MemoryCaseBase(obj) {
			return [{
				__cases__: obj.__cases__
			}];
		}
	},
}); // declare MemoryCaseBase