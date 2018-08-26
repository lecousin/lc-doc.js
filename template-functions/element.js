var searchElement = function(fullpath, element) {
	if (typeof element["fullpath"] != "undefined" && element.fullpath == fullpath)
		return element;
	if (typeof element["children"] == "undefined")
		return null;
	for (var i = 0; i < element.children.length; ++i) {
		var e = searchElement(fullpath, element.children[i]);
		if (e != null)
			return e;
	}
	return null;
};

module.exports = {
		
	name: "element",

	execute: function(ctx, templates, args) {
		return new Promise(function(success, error) {
			if (ctx.ignore) {
				success(ctx);
				return;
			}
			var sep = args.indexOf(' ');
			if (sep < 0) {
				error("Invalid $element arguments: <element_name_expression> <variable_name>");
				return;
			}
			var expr = args.substring(0, sep).trim();
			var varName = args.substring(sep + 1).trim();
			
			try {
				expr = templates.evaluate(expr, ctx.model, ctx.context);
			} catch (e) {
				error("Invalid expression in $element " + expr + ": " + e);
				return;
			}
			
			var element = searchElement(expr, ctx.context.modelContent);
			
			var newModel = {};
			for (var name in ctx.model) newModel[name] = ctx.model[name];
			newModel[varName] = element;
			ctx.model = newModel;
			
			success(ctx);
		});
	}
		
};