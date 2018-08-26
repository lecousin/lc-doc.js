const fs = require("fs");
const glob = require("glob");
const xmlParser = require("./dom-parser.js");
const path = require("path");
const os = require("os");

module.exports = {
	
	resolvePaths: function(paths, onmatch) {
		var that = this;
		return new Promise(function(success, error) {
			if (Array.isArray(paths)) {
				var promises = [];
				for (var i = 0; i < paths.length; ++i)
					promises.push(that.resolvePaths(paths[i], onmatch));
				Promise.all(promises).then(success, error);
				return;
			}
			if (typeof paths != 'string') { success(); return; }
			if (paths.length == 0) { success(); return; }
			if (paths.charAt(0) == '@') paths = __dirname + "/.." + paths.substring(1);
			var g = new glob.Glob(paths);
			g.on('match', onmatch);
			g.on('end', success);
			g.on('error', error);
		});
	},
	
	resolvePathsSync: function(paths) {
		if (Array.isArray(paths)) {
			var result = [];
			for (var i = 0; i < paths.length; ++i)
				result = result.concat(this.resolvePathsSync(paths[i]));
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
					xmlParser.parse(content.toString())
					.then(success, error);
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
			fs.access(src, fs.constants.F_OK, (err) => {
				if (err) {
					// does not exist, copy is done
					success();
					return;
				}
				var dstReady = new Promise(function(dstExists, dstError) {
					fs.access(dst, fs.constants.F_OK, (err) => {
						if (err) {
							fs.mkdir(dst, (err) => {
								if (err) dstError(err);
								else dstExists();
							});
						} else
							dstExists();
					});
				});
				fs.readdir(src, function(err, files) {
					if (err) {
						error(err);
						return;
					}
					dstReady.then(function() {
						var promises = [];
						for (var i = 0; i < files.length; ++i)
							promises.push(that.copyDirectoryEntry(src, dst, files[i]));
						Promise.all(promises).then(success, error);
					}, error);
				});
			});
		});
	},
	
	copyDirectoryEntry: function(src, dst, filename) {
		var that = this;
		return new Promise(function(success, error) {
			fs.stat(src + '/' + filename, (err, stats) => {
				if (err) { error(err); return; }
				if (stats.isFile()) {
					fs.copyFile(src + '/' + filename, dst + "/" + filename, function(err) {
						if (err) error(err);
						else {
							console.log("File " + src + '/' + filename + " copied to " + dst);
							success();
						}
					});
				} else if (stats.isDirectory())
					that.copy(src + '/' + filename, dst + "/" + filename).then(success, error);
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
	
	removeDirectory: function(path, onlyContent) {
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
					if (onlyContent)
						success();
					else
						fs.rmdir(path, function(err) {
							if (err) error(err);
							else success();
						});
				}, error);
			});
		});
	},
	
	removeDirectorySync: function(path, onlyContent) {
		if (!fs.existsSync(path)) return;
		var files = fs.readdirSync(path);
		for (var i = 0; i < files.length; ++i) {
			var filePath = path + "/" + files[i];
			var stats = fs.statSync(filePath);
			if (stats.isFile() || stats.isSymbolicLink())
				fs.unlinkSync(filePath);
			else
				this.removeDirectorySync(filePath);
		}
		if (onlyContent)
			return;
		fs.rmdirSync(path);
	},
	
	createTempDirectory: function(prefix) {
		var that = this;
		return new Promise(function(success, error) {
			fs.mkdtemp(path.join(os.tmpdir(), prefix), function(err, dir) {
				if (err) {
					error(err);
					return;
				}
				process.on('exit', function() {
					console.log("Cleaning temporary directory " + dir);
					that.removeDirectorySync(dir);
				});
				success(dir);
			});
		});
	},
	
	getFiles: function(paths, onfile) {
		var that = this;
		return new Promise(function(success, error) {
			var promises = [];
			var resolve = that.resolvePaths(paths, function(path) {
				promises.push(that.getFilesInDir(path, onfile));
			});
			resolve.then(function() {
				Promise.all(promises).then(function(all) {
					var result = [];
					for (var i = 0; i < all.length; ++i)
						result = result.concat(all[i]);
					success(result);
				}, error);
			}, error);
		});
	},
	
	getFilesInDir: function(dir, onfile) {
		return new Promise(function(success, error) {
			fs.readdir(dir, function(err, files) {
				if (err) {
					error(err);
					return;
				}
				var result = [];
				var promises = [];
				var getFile = function(path) {
					return new Promise(function(s, e) {
						fs.stat(path, (err, stats) => {
							if (err) { e(err); return; }
							if (stats.isFile()) {
								if (onfile) onfile(path);
								result.push(path);
							}
							s();
						});
					});
				}
				for (var i = 0; i < files.length; ++i)
					promises.push(getFile(dir + "/" + files[i]));
				Promise.all(promises).then(function() { success(result); }, error);
			});
		});
	},
	
	
};