const fs = require("fs");
const resources_utils = require("./resources_utils.js");
const path = require("path");

module.exports = {
	
	generate: function(src, generatorLib) {
		return new Promise(function(success, error) {
			var generator;
			if (generatorLib.startsWith("@")) generator = require("./generators/" + generatorLib.substring(1));
			else generator = requite(generatorLib);
			
			fs.mkdtemp("lcdoc", function(err, dest) {
				if (err) {
					error(err);
					return;
				}
				var files = resources_utils.resolvePaths(src);
				var promises = [];
				for (var i = 0; i < files.length; ++i) {
					promises.push(generator.generate(files[i], dest + '/' + i + '.xml'));
				}
				Promise.all(promises).then(function() {
					success(dest);
				}, error);
			});
		});
	}
		
};