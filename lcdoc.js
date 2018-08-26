'use strict';

var startTime = new Date().getTime();

let options = require('minimist')(process.argv.slice(2), {  
	default: {
		model: "@/model/javascript/model.json",
		templates: "@/model/javascript/templates",
		theme: "default",
		templateFunctions: "@/template-functions/**/*.js",
		external: "@/model/javascript/external/mdn.json"
	}
});

console.log(options);

var onerror = function(e) {
	console.error(e);
	process.exit(1);
};

if (!options.dest) {
	console.error("Missing dest option");
	process.exit(1);
}

if (!options.src) {
	console.error("Missing src option");
	process.exit(1);
}

var getDelayString = function(ms) {
	var s = "";
	if (ms >= 60 * 60 * 1000) {
		s += Math.floor(ms / (60 * 60 * 1000)) + 'h';
		ms -= ms % (60 * 60 * 1000);
	}
	if (s.length > 0 || ms >= 60000) {
		s += Math.floor(ms / 60000) + 'm';
		ms -= ms % 60000;
	}
	if (s.length > 0 || ms >= 1000) {
		s += Math.floor(ms / 1000) + 's';
		ms -= ms % 1000;
	}
	if (s.length == 0)
		return ms + " ms";
	return s + ms;
};

const model = require('./lib/model.js');

// load model definition
model.loadDefinition(options.model);

// load model (generate it if needed)
var modelLoaded;
if (options.generator)
	modelLoaded = new Promise(function(success, error) {
		require("./lib/generator.js").generate(options.src, options.generator)
		.then(function(generatedPath) {
			model.loadContent(generatedPath + "/*.xml").then(success, error);
		}, onerror);
	});
else
	modelLoaded = model.loadContent(options.src);

// load externals
model.loadExternals(options.external);

// init templates
const templates = require("./lib/templates.js");
var fctLoaded = templates.loadFunctions(options.templateFunctions);

// launch generation
Promise.all([modelLoaded, fctLoaded]).then(function(r) {
	var content = r[0];
	templates.generate(model, options.templates, options.theme, options.dest)
	.then(function() {
		console.log("Done in " + getDelayString(new Date().getTime() - startTime) + ".");
	}, onerror);
}, onerror);
