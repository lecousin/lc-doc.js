const resources_utils = require("./resources_utils");
const path = require("path");
const fs = require("fs");
const util = require('util');

module.exports = {
	
	_functions: {},
	
	loadFunctions: function(paths) {
		var files = resources_utils.resolvePaths(paths);
		for (var i = 0; i < files.length; ++i) {
			var fct = require(files[i]);
			if (!fct.name || typeof fct.execute != 'function')
				throw files[i] + " is not a valid template function";
			if (typeof this._functions[fct.name] != 'undefined')
				throw "Template function " + fct.name + " is defined multiple times";
			this._functions[fct.name] = fct;
			console.log("Template function loaded: " + fct.name);
		}
	},
	
	generate: function(model, src, theme, dest) {
		var that = this;
		return new Promise(function(success, error) {
			that.prepareDest(dest)
			.then(function() {
				Promise.all([
					that.generatePages(model, src, dest),
					that.generateElements(model, src, dest),
					that.copyTheme(src, theme, dest)
				]).then(success, error);
			}, error);
		});
	},
	
	prepareDest: function(dest) {
		return new Promise(function(success, error) {
			resources_utils.removeDirectory(dest)
			.then(function() {
				resources_utils.createDirectory(dest)
				.then(success, error);
			}, error);
		});
	},
	
	copyTheme: function(src, theme, dest) {
		return new Promise(function(success, error) {
			var paths = resources_utils.resolvePaths(src);
			var promises = [];
			for (var i = 0; i < paths.length; ++i)
				promises.push(resources_utils.copy(paths[i] + '/themes/' + theme, dest));
			Promise.all(promises).then(success, error);
		});

		return ;
	},
	
	generateElements: function(model, src, dest) {
		var that = this;
		return new Promise(function(success, error) {
			resources_utils.getFiles(src + "/elements").then(function(files) {
				var elementTemplates = {};
				var promises = [];
				for (var i = 0; i < files.length; ++i)
					promises.push(that.readElementTemplate(files[i], elementTemplates));
				promises.push(resources_utils.createDirectory(dest + '/model'));
				Promise.all(promises).then(function() {
					that.generateElements2(model, elementTemplates, dest).then(success, error);
				}, error);
			}, error);
		});
	},
	
	readElementTemplate: function(file, elementTemplates) {
		return new Promise(function(success, error) {
			console.log("Loading template: " + file);
			fs.readFile(file, function(err, content) {
				if (err) error(err);
				else {
					var type = path.basename(file);
					var i = type.indexOf(".");
					if (i > 0)
						elementTemplates[type.substring(0, i)] = {
							content: content,
							filename: file,
							extension: type.substring(i)
						};
					success();
				}
			});
		});
	},
	
	generateElements2: function(model, elementTemplates, dest) {
		var that = this;
		return new Promise(function(success, error) {
			var promises = [];
			for (var i = 0; i < model.children.length; ++i) {
				var child = model.children[i];
				if (child.children && child.children.length > 0)
					promises.push(that.generateElements2(child, elementTemplates, dest));
				promises.push(that.generateElement(child, elementTemplates[child.type], dest));
			}
			Promise.all(promises).then(success, error);
		});
	},
	
	generateElement: function(element, template, dest) {
		var that = this;
		return new Promise(function(success, error) {
			that.processTemplate(template.filename, template.content, element)
			.then(function(ctx) {
				var target = dest + '/model/' + element.fullpath + template.extension;
				fs.writeFile(target, ctx.out, function(err) {
					if (err) error(err);
					else {
						console.log("File generated: " + target);
						success();
					}
				});
			}, error);
		});
	},
	
	generatePages: function(model, src, dest) {
		var that = this;
		return new Promise(function(success, error) {
			resources_utils.getFiles(src)
			.then(function(files) {
				var promises = [];
				for (var i = 0; i < files.length; ++i)
					promises.push(that.generatePage(files[i], model, dest));
				Promise.all(promises).then(success, error);
			}, error);
		});
	},
	
	generatePage: function(file, model, dest) {
		var that = this;
		return new Promise(function(success, error) {
			fs.readFile(file, function(err, content) {
				if (err) error(err);
				else that.processTemplate(file, content, model)
					.then(function(ctx) {
						var target = dest + '/' + path.basename(file);
						fs.writeFile(target, ctx.out, function(err) {
							if (err) error(err);
							else {
								console.log("File generated: " + target);
								success();
							}
						});
					}, error);
			});
		});
	},
	
	processTemplate: function(filename, template, model) {
		template = template.toString()
			.replace(/&gt;/g, ">")
			.replace(/&lt;/g, "<")
			.replace(/&amp;/g, "&")
			;
		var ctx = {
			src: template,
			pos: 0,
			out: "",
			expectedEnd: null,
			model: model,
			ignore: false,
			filename: filename
		};
		return this.process(ctx);
	},
	
	process: function(ctx) {
		var that = this;
		return new Promise(function(success, error) {
			try {
				while (ctx.pos < ctx.src.length) {
					var i = ctx.src.indexOf("{{", ctx.pos);
					var j = ctx.src.indexOf("}}", i + 2);
					if (i < 0 || j < 0) {
						if (!ctx.ignore) ctx.out += ctx.src.substring(ctx.pos);
						ctx.pos = ctx.src.length;
						success(ctx);
						return;
					}
					if (!ctx.ignore) ctx.out += ctx.src.substring(ctx.pos, i);
					ctx.pos = j + 2;
					var tag = ctx.src.substring(i + 2, j).trim();
					if (tag.length == 0) {
						if (!ctx.ignore) ctx.out += ctx.src.substring(i, j + 2);
						continue;
					}
					if (tag == ctx.expectedEnd) {
						success(ctx);
						return;
					}
					if (tag.charAt(0) == '$') {
						var sep = tag.indexOf(' ');
						var fctname;
						if (sep < 0) {
							fctname = tag.substring(1);
							tag = "";
						} else {
							fctname = tag.substring(1, sep);
							tag = tag.substring(sep + 1).trim();
						}
						if (typeof that._functions[fctname] === "undefined")
							throw "Unknown function $" + fctname;
						that._functions[fctname].execute(ctx, that, tag)
						.then(function(ctx) {
							that.process(ctx).then(success, error);
						}, error);
						return;
					} else {
						if (!ctx.ignore) {
							var val = that.evaluate(tag, ctx.model);
							if (typeof val === 'object')
								val = util.inspect(val, false, null);
							else if (typeof val === 'undefined' || val === null)
								val = "";
							ctx.out += val;
						}
					}
				}
				success(ctx);
			} catch (e) {
				error("Error processing template " + ctx.filename + ": " + e);
			}
		});
	},
	
	evaluate: function(expr, model) {
		var code = "(function(model";
		for (var name in model) {
			code += ", " + name;
		}
		code += "){return (" + expr + ");})(model";
		for (var name in model) {
			code += ", model." + name;
		}
		code += ")";
		try {
			return new Function("model", "return (" + code + ")")(model);
		} catch (error) {
			throw error + " in " + code + ' at ' + error.stack; // TODO better message and without stack trace
		}
	}
	
};