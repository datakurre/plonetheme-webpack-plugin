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
  var context, response, body, script;
  baseUrl = baseUrl ? baseUrl : 'http://localhost:8080/Plone';
  response = request('GET', baseUrl + '/config.js');
  context = vm.createContext(mockup);

  body = response.getBody('utf-8').replace('PORTAL_URL', "'" + baseUrl + "'");

  script = new vm.Script(body);
  script.runInContext(context);
  return mockup.requirejs.config;
};
