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

var searchExternalType = function(type, externals) {
	for (var i = 0; i < externals.length; ++i) {
		var model = externals[i];
		if (typeof model.types[type] !== 'undefined')
			return {
				url: model.baseUrl + model.types[type],
				name: model.name
			};
	}
	return null;
};

module.exports = {
		
	name: "type",

	execute: function(ctx, templates, args) {
		return new Promise(function(success, error) {
			if (ctx.ignore) {
				success(ctx);
				return;
			}
			var typeString;
			try {
				typeString = templates.evaluate(args, ctx.model, ctx.context);
			} catch (e) {
				error("Invalid $type expression " + args + ": " + e);
				return;
			}
			var re = new RegExp("(" + ctx.context.modelDefinition.nameRegExp + "[\\.])*" + ctx.context.modelDefinition.nameRegExp, "g");
			var res;
			var pos = 0;
			
			while ((res = re.exec(typeString)) !== null) {
				var sepIsGeneric = false;
				if (res.index > pos) {
					var sep = typeString.substring(pos, res.index);
					if (sep == ":") {
						sep = "&lt;";
						sepIsGeneric = true;
					}
					ctx.out += sep;
				}
				var elem = searchElement(res[0], ctx.context.modelContent);
				if (elem) {
					ctx.out += "<a href=\"" + res[0] + ctx.context.template.extension + "\">" + res[0] + "</a>";
				} else {
					var ext = searchExternalType(res[0], ctx.context.externalModels);
					if (ext)
						ctx.out += "<a href=\"" + ext.url + "\" target=\"" + ext.name + "\">" + res[0] + "</a>";
					else
						ctx.out += res[0];
				}
				if (sepIsGeneric)
					ctx.out += "&gt;";
				pos = res.index + res[0].length;
				//console.log(res);
			}
			success(ctx);
		});
	}
		
};