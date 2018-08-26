const fs = require("fs");
const resources_utils = require("./resources_utils.js");
const path = require("path");

module.exports = {
	
	generate: function(src, generatorLib) {
		var tmpDir = resources_utils.createTempDirectory("lcdoc");
		return new Promise(function(success, error) {
			var generator;
			if (generatorLib.startsWith("@")) generator = require("./generators/" + generatorLib.substring(1));
			else generator = require(generatorLib);


			tmpDir.then(function(dest) {
				var promises = [];
				var counter = 1;
				var filesDone = resources_utils.resolvePaths(src, function(file) {
					promises.push(generator.generate(file, dest + '/' + (counter++) + '.xml'));
				});
				filesDone.then(function() {
					Promise.all(promises).then(function() {
						success(dest);
					}, error);
				}, error);
			}, error);
		});
	}
		
};