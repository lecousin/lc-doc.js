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
			try { model = templates.evaluate(expr, ctx.model); }
			catch (e) { error("Invalid $include model expression " + expr + ": " + e); return; }
			fs.readFile(path.dirname(ctx.filename) + '/' + filepath, function(err, content) {
				if (err) error(err);
				else templates.processTemplate(path.dirname(ctx.filename) + '/' + filepath, content, model)
					.then(function(res) {
						ctx.out += res.out;
						success(ctx);
					}, error);
			});
		});
	}
		
};