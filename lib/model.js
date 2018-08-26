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

var modelChildrenComparator = function(element, def) {
	if (element.elementType == "root")
		return function(e1, e2) {
			if (e1.elementType == e2.elementType)
				return e1.name.localeCompare(e2.name);
			var i1 = def.rootElements.indexOf(e1.elementType);
			var i2 = def.rootElements.indexOf(e2.elementType);
			return i1 - i2;
		};
	var edef = getDefinitionIn(element.elementType, def.elements);
	if (!edef) throw "Unknown element type " + element.elementType;
	var childrenOrder = [];
	if (typeof edef.children != 'undefined')
		for (var i = 0; i < edef.children.length; ++i)
			childrenOrder.push(edef.children[i].type);
	return function(e1, e2) {
		if (e1.elementType == e2.elementType)
			return e1.name.localeCompare(e2.name);
		var i1 = childrenOrder.indexOf(e1.elementType);
		var i2 = childrenOrder.indexOf(e2.elementType);
		return i1 - i2;		
	};
};

var sortModel = function(element, def) {
	if (!element.children) return;
	element.children.sort(modelChildrenComparator(element, def));
	for (var i = 0; i < element.children.length; ++i)
		sortModel(element.children[i], def);
};

module.exports = {

	getDefinition: function() {
		return this.definition;
	},
		
	loadDefinition: function(file) {
		return this.definition = new Promise(function(success, error) {
			var files = resources_utils.resolvePathsSync(file);
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
	
	// TODO replace "type" by "elementType" to avoid overlapping with a model attribute "type"
	loadContent: function(paths) {
		var that = this;
		return this.content = new Promise(function(success, error) {
			var model = {
				elementType: "root",
				fullpath: "",
				children: [],
				content: []
			};
			var promises = [];
			var files = resources_utils.resolvePaths(paths, function(file) {
				if (file.toLowerCase().endsWith(".xml"))
					promises.push(that.loadXMLContent(file, model));
				else {
					error("Unknown model file type: " + file);
					return;
				}
			});
			Promise.all([files, that.definition]).then(function(r) {
				Promise.all(promises).then(function() {
					sortModel(model, r[1]);
					console.log("Model content loaded.");
					success(model);
				}, error);
			}, error);
		});
	},
	
	loadXMLContent: function(file, model) {
		var that = this;
		
		var loadXMLElement = function(element, model, def, edef, isChild) {
			// create child
			var child = {
				elementType: edef.type,
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
			if (isChild) {
				// it may already exist
				var found = null;
				for (var i = 0; i < model.children.length; ++i)
					if (model.children[i].name == child.name) {
						found = model.children[i];
						break;
					}
				if (found) child = found;
				else model.children.push(child);
			} else
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
			// go through child elements
			if (!edef.contentAsAttribute)
				for (var i = 0; i < element.childNodes.length; ++i) {
					var node = element.childNodes[i];
					if (node.nodeType != 1) continue;
					var isSubChild = false, cdef = null;
					if (edef.children) cdef = getDefinitionIn(node.nodeName, edef.children);
					if (cdef) isSubChild = true;
					else if (edef.content) cdef = getDefinitionIn(node.nodeName, edef.content);
					if (!cdef) {
						if (edef.attributes && typeof edef.attributes[node.nodeName] != 'undefined') {
							child[node.nodeName] = node.getInnerXML();
							continue;
						}
						throw "Unexpected element type " + node.nodeName + " in " + edef.type;
					}
					var scdef;
					if (isSubChild) {
						scdef = getElementDefinition(node.nodeName, def);
						if (!scdef) throw "Element type not defined: " + node.nodeName;
					} else
						scdef = cdef;
					if (scdef.inherits)
						for (var n in scdef.inherits)
							node.attributes[n] = child[scdef.inherits[n]];
					loadXMLElement(node, child, def, scdef, isSubChild);
				}
			else {
				var attrType = edef.attributes[edef.contentAsAttribute];
				if (!attrType) throw "Unknown attribute " + name + " defined in contentAsAttribute in element type " + edef.type;
				// TODO check type
				child[edef.contentAsAttribute] = element.getInnerXML();
			}
			
			for (var i = 0; i < child.children.length; ++i) {
				var cdef = getDefinitionIn(child.children[i].elementType, edef.children);
				if (cdef.forceAttributes)
					for (var name in cdef.forceAttributes)
						child.children[i][name] = cdef.forceAttributes[name];
				// TODO check children multiplicity
			}
			// TODO check content multiplicity
			return child;
		};
		
		return new Promise(function(success, error) {
			resources_utils.loadXML(file).then(function(xml) {
				that.definition.then(function(def) {
					var root = xml.documentElement;
					for (var i = 0; i < root.childNodes.length; ++i) {
						var node = root.childNodes[i];
						if (node.nodeType != 1) continue;
						if (def.rootElements.indexOf(node.nodeName) < 0) {
							error("Unexpected root model element " + node.nodeName + " in " + file);
							return;
						}
						try {
							// get element definition
							var edef = getElementDefinition(node.nodeName, def);
							if (!edef) throw "Element type not defined: " + node.nodeName;
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
	},
	
	loadExternals: function(paths) {
		var that = this;
		return this.externals = new Promise(function(success, error) {
			var promises = [];
			var files = resources_utils.resolvePaths(paths, function(file) {
				promises.push(resources_utils.loadJSON(file));
			});
			files.then(function() {
				Promise.all(promises).then(success, error);
			}, error);
		});
	},
	
	getExternals: function() {
		return this.externals;
	}

};