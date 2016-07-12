const request = require('sync-request');
const vm = require('vm');

const mockup = {};

mockup.window = mockup;

module.exports = function(baseUrl) {
  var context, response, body, script;
  baseUrl = baseUrl ? baseUrl : 'http://localhost:8080/Plone';
  response = request('GET', baseUrl + '/less-variables.js');
  context = vm.createContext(mockup);
  
  // Normalize " escaping to ' and '//' to '\' to fix issue
  // where passing LESS variables in query to less-loader failed
  body = response.getBody('utf-8').replace(
    /'"/gm,   '"\'').replace(   // '"  => "'
    /"',/gm,  '\'",').replace(  // "', => '",
    /\\"/gm, '\''); //          // \\" => '
  
  script = new vm.Script(body);
  script.runInContext(context);
  return mockup.less;
};
