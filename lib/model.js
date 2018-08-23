const resources_utils = require("./resources_utils");

var getElementDefinition = function(elementName, definition) {
	for (var i = 0; i < definition.elements.length; ++i)
		if (definition.elements[i].type == elementName)
			return definition.elements[i];
	return undefined;
};

var getDefinitionIn = function(elementName, array) {
	for (var i = 0; i < array.length; ++i)
		if (array[i].type == elementName)
			return array[i];
	return null;
};

module.exports = {

	getDefinition: function() {
		return this.definition;
	},
		
	loadDefinition: function(file) {
		return this.definition = new Promise(function(success, error) {
			var files = resources_utils.resolvePaths(file);
			if (files.length != 1) {
				error("One model definition file expected, " + files.length + " found: " + files);
				return;
			}
			resources_utils.loadJSON(files[0]).then(success, error);
		});
	},
	
	getContent: function() {
		return this.content;
	},
	
	loadContent: function(paths) {
		var that = this;
		return this.content = new Promise(function(success, error) {
			var model = {
				type: "root",
				fullpath: "",
				children: [],
				content: []
			};
			var files = resources_utils.resolvePaths(paths);
			if (files.length == 0) {
				error("No file matching model source: " + paths);
				return;
			}
			var promises = [];
			for (var i = 0; i < files.length; ++i) {
				var file = files[i];
				if (file.toLowerCase().endsWith(".xml"))
					promises.push(that.loadXMLContent(file, model));
				else {
					error("Unknown model file type: " + file);
					return;
				}
			}
			Promise.all(promises).then(function() {
				success(model);
			}, error);
		});
	},
	
	loadXMLContent: function(file, model) {
		var that = this;
		
		var loadXMLElement = function(element, model, def, edef, isChild) {
			// create child
			var child = {
				type: edef.type,
				children: [],
				content: []
			};
			if (isChild) {
				if (!element.attributes.name)
					throw "Missing name on element " + edef.type;
				child.name = element.attributes.name.toString();
				child.fullpath = model.fullpath;
				if (child.fullpath.length > 0) child.fullpath += ".";
				child.fullpath += child.name;
			}
			if (isChild)
				model.children.push(child);
			else
				model.content.push(child);
			// attributes
			for (var name in element.attributes) {
				if (isChild && name == "name") continue;
				if (!edef.attributes) throw "Element type " + edef.type + " does not expect any attribute";
				var attrType = edef.attributes[name];
				if (!attrType) throw "Unknown attribute " + name + " in element type " + edef.type;
				// TODO check type
				child[name] = element.attributes[name]; // TODO toString...
			}
			// TODO contentAsAttribute
			// TODO ...
			// go through child elements
			if (!edef.contentAsAttribute)
				for (var i = 0; i < element.childNodes.length; ++i) {
					var node = element.childNodes[i];
					if (node.type != "element") continue;
					var isSubChild = false, cdef = null;
					if (edef.children) cdef = getDefinitionIn(node.tagName, edef.children);
					if (cdef) isSubChild = true;
					else if (edef.content) cdef = getDefinitionIn(node.tagName, edef.content);
					if (!cdef) {
						if (edef.attributes && typeof edef.attributes[node.tagName] != 'undefined') {
							child[node.tagName] = node.innerXML.toString();
							continue;
						}
						throw "Unexpected element type " + node.tagName + " in " + edef.type;
					}
					var scdef;
					if (isSubChild) {
						scdef = getElementDefinition(node.tagName, def);
						if (!scdef) throw "Element type not defined: " + node.tagName;
					} else
						scdef = cdef;
					loadXMLElement(node, child, def, scdef, isSubChild);
				}
			// TODO check children multiplicity
			return child;
		};
		
		return new Promise(function(success, error) {
			resources_utils.loadXML(file).then(function(xml) {
				that.definition.then(function(def) {
					for (var i = 0; i < xml.childNodes.length; ++i) {
						var node = xml.childNodes[i];
						if (node.type != "element") continue;
						if (def.rootElements.indexOf(node.tagName) < 0) {
							error("Unexpected root model element " + node.tagName + " in " + file);
							return;
						}
						try {
							// get element definition
							var edef = getElementDefinition(node.tagName, def);
							if (!edef) throw "Element type not defined: " + node.tagName;
							loadXMLElement(node, model, def, edef, true);
						} catch (e) {
							error(e);
							return;
						}
					}
					success();
				});
				//console.log("xml: " + file + "\r\n" + require('util').inspect(xml, false, null));
			}, error);
		});
	}

};