module.exports = {
		
	name: "id",

	execute: function(ctx, templates, args) {
		return new Promise(function(success, error) {
			var variable = args.trim();
			if (!templates._idCounter)
				templates._idCounter = 1;
			var newModel = {};
			for (var name in ctx.model) newModel[name] = ctx.model[name];
			newModel[variable] = "id" + (templates._idCounter++);
			ctx.model = newModel;
			success(ctx);
		});
	}
		
};