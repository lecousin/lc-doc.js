const fs = require("fs");
const glob = require("glob");
const xmlParse = require("xml-parse");

module.exports = {
	
	resolvePaths: function(paths) {
		if (Array.isArray(paths)) {
			var result = [];
			for (var i = 0; i < paths.length; ++i)
				result = result.concat(this.resolvePaths(paths[i]));
			return result;
		}
		if (typeof paths != 'string') return [];
		if (paths.length == 0) return [];
		if (paths.charAt(0) == '@') paths = __dirname + "/.." + paths.substring(1);
		return glob.sync(paths);
	},
	
	loadJSON: function(file) {
		return new Promise(function(success, error) {
			console.log("Loading JSON file: " + file);
			fs.readFile(file, function(err, content) {
				if (err) error(err);
				else try {
					success(JSON.parse(content));
				} catch (e) {
					error(e);
				}
			});
		});
	},
	
	loadXML: function(file) {
		return new Promise(function(success, error) {
			console.log("Loading XML file: " + file);
			fs.readFile(file, function(err, content) {
				if (err) error(err);
				else try {
					var doc = new xmlParse.DOM(xmlParse.parse(content.toString())).document;
					for (var i = 0; i < doc.childNodes.length; ++i)
						if (doc.childNodes[i].type === "element" && doc.childNodes[i].childNodes.length > 0) {
							success(doc.childNodes[i]);
							return;
						}
					error("Nothing found in XML file " + file);
				} catch (e) {
					error(e);
				}
			});
		});
	},
	
	copy: function(src, dst) {
		console.log("Copying files from " + src + " to " + dst);
		var that = this;
		return new Promise(function(success, error) {
			if (!fs.existsSync(src)) {
				success();
				return;
			}
			if (!fs.exists(dst))
				try { fs.mkdirSync(dst); } catch (e) {}
			fs.readdir(src, function(err, files) {
				if (err) {
					error(err);
					return;
				}
				var promises = [];
				for (var i = 0; i < files.length; ++i) {
					var filePath = src + "/" + files[i];
					var stats = fs.statSync(filePath);
					if (stats.isFile()) {
						promises.push(new Promise(function(s,e) {
							fs.copyFile(filePath, dst + "/" + files[i], function(err) {
								if (err) e(err);
								else s();
							});
						}));
					} else if (stats.isDirectory())
						promises.push(that.copy(filePath, dst + "/" + files[i]));
				}
				Promise.all(promises).then(success, error);
			});
		});
	},
	
	createDirectory: function(path) {
		return new Promise(function(success, error) {
			fs.mkdir(path, function(err) {
				if (err) error(err);
				else success();
			})
		});
	},
	
	removeDirectory: function(path) {
		var that = this;
		return new Promise(function(success, error) {
			if (!fs.existsSync(path)) {
				success();
				return;
			}
			fs.readdir(path, function(err, files) {
				if (err) {
					error(err);
					return;
				}
				var promises = [];
				for (var i = 0; i < files.length; ++i) {
					var filePath = path + "/" + files[i];
					var stats = fs.statSync(filePath);
					if (stats.isFile() || stats.isSymbolicLink()) {
						promises.push(new Promise(function(s,e) {
							fs.unlink(filePath, function(err) {
								if (err) e(err);
								else s();
							});
						}));
					} else
						promises.push(that.removeDirectory(filePath));
				}
				Promise.all(promises).then(function() {
					fs.rmdir(path, function(err) {
						if (err) error(err);
						else success();
					});
				}, error);
			});
		});
	},
	
	getFiles: function(paths) {
		var that = this;
		return new Promise(function(success, error) {
			paths = that.resolvePaths(paths);
			var promises = [];
			for (var i = 0; i < paths.length; ++i)
				promises.push(that.getFilesInDir(paths[i]));
			Promise.all(promises).then(function(all) {
				var result = [];
				for (var i = 0; i < all.length; ++i)
					result = result.concat(all[i]);
				success(result);
			}, error);
		});
	},
	
	getFilesInDir: function(dir) {
		return new Promise(function(success, error) {
			fs.readdir(dir, function(err, files) {
				if (err) {
					error(err);
					return;
				}
				var result = [];
				for (var i = 0; i < files.length; ++i) {
					var filePath = dir + "/" + files[i];
					var stats = fs.statSync(filePath);
					if (stats.isFile())
						result.push(filePath);
				}
				success(result);
			});
		});
	}
	
};