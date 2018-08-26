const path = require("path");
const fs = require("fs");

module.exports = {
		
	name: "include",

	execute: function(ctx, templates, args) {
		return new Promise(function(success, error) {
			if (ctx.ignore) {
				success(ctx);
				return;
			}
			var sep = args.indexOf(' ');
			if (sep < 0) {
				error("Invalid $include arguments: <path_to_file_to_include> <model_to_process_it>");
				return;
			}
			var filepath = args.substring(0, sep).trim();
			var expr = args.substring(sep + 1).trim();
			var model;
			try { model = templates.evaluate(expr, ctx.model, ctx.context); }
			catch (e) { error("Invalid $include model expression " + expr + ": " + e); return; }
			//console.log("Include file " + filepath + " from " + ctx.context.template.filename);
			fs.readFile(path.dirname(ctx.context.template.filename) + '/' + filepath, function(err, content) {
				if (err) error("Unable to read included file " + filepath + " from " + ctx.context.template.filename + ": " + err);
				else {
					var context = {};
					for (var name in ctx.context) context[name] = ctx.context[name];
					context.template = {
						filename: path.dirname(ctx.context.template.filename) + '/' + filepath,
						content: content
					};
					var i = filepath.lastIndexOf('.');
					context.template.extension = i < 0 ? "" : filepath.substring(i);
					templates.processTemplate(context, model)
					.then(function(res) {
						ctx.out += res.out;
						success(ctx);
					}, error);
				}
			});
		});
	}
		
};