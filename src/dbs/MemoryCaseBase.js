/** # MemoryCaseBase

A memory implementation of a `CaseBase`.
*/
var MemoryCaseBase = exports.dbs.MemoryCaseBase = declare(CaseBase, {
	constructor: function MemoryCaseBase(params) {
		CaseBase.call(this, params);
		this.__cases__ = [];
		this.__index__ = {};
	},

	cases: function cases() {
		return base.iterable(this.__cases__);
	},
	
	addCase: function addCase(_case) {
		//TODO Check `_case` properties.
		var entry = {
			count: _case.count || 0,
			ply: _case.ply,
			features: Sermat.clone(_case.features || null),
			actions: Sermat.clone(_case.actions || null),
			result: Sermat.clone(_case.result || null)
		};
		return this.__cases__.push(entry);
	},

	/** ## Utilities ########################################################################### */

	'static __SERMAT__': {
		identifier: 'MemoryCaseBase',
		serializer: function serialize_MemoryCaseBase(obj) {
			return CaseBase.__SERMAT__.serialize_CaseBase(obj);
		}
	},
}); // declare MemoryCaseBase