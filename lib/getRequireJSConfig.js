const request = require('sync-request');
const vm = require('vm');

const mockup = {};

mockup.requirejs = {
  config: function(config) {
    mockup.requirejs.config = config;
  }
};

mockup.window = mockup;

module.exports = function(baseUrl) {
  var context, response, script;
  baseUrl = baseUrl ? baseUrl : 'http://localhost:8080/Plone';
  response = request('GET', baseUrl + '/config.js');
  context = vm.createContext(mockup);
  script = new vm.Script(response.getBody('utf-8'));
  script.runInContext(context);
  return mockup.requirejs.config;
};
