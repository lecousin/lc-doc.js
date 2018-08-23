module.exports = {
		
	name: "foreach",

	execute: function(ctx, templates, args) {
		var that = this;
		return new Promise(function(success, error) {
			var sep = args.indexOf(' ');
			if (sep < 0) {
				error("Invalid $foreach arguments: <array> <elementVariable>");
				return;
			}
			var array;
			try { array = ctx.ignore ? [] : templates.evaluate(args.substring(0, sep), ctx.model); }
			catch (e) { error("Invalid $foreach array " + args.substring(0, sep) + ": " + e); return; }
			var prevEnd = ctx.expectedEnd;
			ctx.expectedEnd = "endforeach";
			if (array && array.length > 0) {
				var loopVariable = args.substring(sep + 1).trim();
				var newModel = {};
				for (var name in ctx.model) newModel[name] = ctx.model[name];
				var prevModel = ctx.model;
				ctx.model = newModel;
				that.iterate(array, 0, loopVariable, ctx, templates).then(function() {
					ctx.model = prevModel;
					ctx.expectedEnd = prevEnd;
					success(ctx);
				}, error);
			} else {
				var prevIgnore = ctx.ignore;
				ctx.ignore = true;
				templates.process(ctx).then(function() {
					ctx.ignore = prevIgnore;
					ctx.expectedEnd = prevEnd;
					success(ctx);
				}, error);
			}
		});
	},
	
	iterate: function(array, index, loopVariable, ctx, templates) {
		var that = this;
		return new Promise(function(success, error) {
			if (index >= array.length) {
				success();
				return;
			}
			var pos = ctx.pos;
			ctx.model[loopVariable] = array[index];
			ctx.model[loopVariable + "Index"] = index;
			templates.process(ctx).then(function() {
				if (index == array.length - 1) {
					success();
					return;
				}
				ctx.pos = pos;
				that.iterate(array, index + 1, loopVariable, ctx, templates).then(success, error);
			}, error);
		});
	}
		
};