module.exports = {
		
	name: "set",

	execute: function(ctx, templates, args) {
		return new Promise(function(success, error) {
			if (ctx.ignore) {
				success(ctx);
				return;
			}
			var sep = args.indexOf(' ');
			if (sep < 0) {
				error("Invalid $set arguments: <variable_to_set> <expression>");
				return;
			}
			var varName = args.substring(0, sep).trim();
			var expr = args.substring(sep + 1).trim();
			
			try {
				expr = templates.evaluate(expr, ctx.model, ctx.context);
			} catch (e) {
				error("Invalid expression in $set " + expr + ": " + e);
				return;
			}
			
			var newModel = {};
			for (var name in ctx.model) newModel[name] = ctx.model[name];
			newModel[varName] = expr;
			ctx.model = newModel;
			
			success(ctx);
		});
	}
		
};