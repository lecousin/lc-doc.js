module.exports = {
		
	name: "filter",

	execute: function(ctx, templates, args) {
		return new Promise(function(success, error) {
			if (ctx.ignore) {
				success(ctx);
				return;
			}
			var sep = args.indexOf(' ');
			if (sep < 0) {
				error("Invalid $filter arguments: <array> <array_element_variable> <target_array_name> <condition_to_selected_element>");
				return;
			}
			var array = args.substring(0, sep).trim();
			args = args.substring(sep + 1).trim();
			sep = args.indexOf(' ');
			if (sep < 0) {
				error("Invalid $filter arguments: <array> <array_element_variable> <target_array_name> <condition_to_selected_element>");
				return;
			}
			var arrayElementVariable = args.substring(0, sep).trim();
			args = args.substring(sep + 1).trim();
			sep = args.indexOf(' ');
			if (sep < 0) {
				error("Invalid $filter arguments: <array> <array_element_variable> <target_array_name> <condition_to_selected_element>");
				return;
			}
			var targetArrayName = args.substring(0, sep).trim();
			var condition = args.substring(sep + 1).trim();
			
			try {
				array = templates.evaluate(array, ctx.model, ctx.context);
			} catch (e) {
				error("Invalid array in $filter " + array + ": " + e);
				return;
			}
			
			var targetArray = [];
			
			for (var i = 0; i < array.length; ++i) {
				var m = {};
				for (var name in ctx.model) m[name] = ctx.model;
				m[arrayElementVariable] = array[i];
				m[arrayElementVariable + 'Index'] = i;
				try {
					if (templates.evaluate(condition, m, ctx.context))
						targetArray.push(array[i]);
				} catch (e) {
					// ignore
				}
			}
			
			var newModel = {};
			for (var name in ctx.model) newModel[name] = ctx.model[name];
			newModel[targetArrayName] = targetArray;
			ctx.model = newModel;
			
			success(ctx);
		});
	}
		
};