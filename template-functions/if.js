module.exports = {
		
	name: "if",

	execute: function(ctx, templates, args) {
		return new Promise(function(success, error) {
			var condition;
			try {
				condition = ctx.ignore ? false : templates.evaluate(args, ctx.model);
			} catch (e) {
				error("Invalid $if condition " + args + ": " + e);
				return;
			}
			var pignore = ctx.ignore;
			var pend = ctx.expectedEnd;
			ctx.ignore |= !condition;
			ctx.expectedEnd = "endif";
			templates.process(ctx)
			.then(function(ctx) {
				ctx.ignore = pignore;
				ctx.expectedEnd = pend;
				success(ctx);
			}, error);
		});
	}
		
};