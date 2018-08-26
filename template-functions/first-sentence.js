module.exports = {
		
	name: "first-sentence",

	execute: function(ctx, templates, args) {
		return new Promise(function(success, error) {
			if (ctx.ignore) {
				success(ctx);
				return;
			}
			var expr;
			try {
				expr = templates.evaluate(args, ctx.model, ctx.context);
			} catch (e) {
				error("Invalid $first-sentence expression " + args + ": " + e);
				return;
			}
			if (!expr) expr = "";
			var i = expr.indexOf('.');
			if (i >= 0) expr = expr.substring(0, i + 1);
			ctx.out += expr;
			success(ctx);
		});
	}
		
};