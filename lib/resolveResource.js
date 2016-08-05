const request = require('request');
const url = require('url');
const VirtualModulePlugin = require('virtual-module-webpack-plugin');
const ctime = VirtualModulePlugin.statsDate();

// Webpack virtual file system path below the CWD
function ns(path) {
  path = path ? path : '';
  return (process.cwd() + '/@/' + path).replace(/\/+/g, '/');
}

function resolve(href, extensions, resolver, callback, debug) {

  // Define virtual file system path
  const path_ = ns(url.parse(href).pathname);

  // Result file from virtual file system
  if (resolver.fileSystem._readFileStorage.data[path_] !== undefined) {
    resolver.doResolve('result', {
      path: path_,
      query: request.query,
      file: true,
      resolved: true
    }, callback);

    // For each possible extension, try to fetch file from Plone
  } else if (extensions.length) {
    request({ url: href + extensions[0], encoding: null },
      function(error, response, body) {
        if (!error && response.statusCode == 200 &&
            !response.request.uri.href.match(
              'acl_users/credentials_cookie_auth/require_login')) {
          if (debug) {
            console.log('Plone: ' + response.request.uri.href);
            console.log('Saved: ' + path_);
          }
          VirtualModulePlugin.populateFilesystem({
            fs: resolver.fileSystem,
            modulePath: path_,
            contents: body,
            ctime: ctime
          });
        }
        resolve(href, extensions.slice(1), resolver, callback, debug);
      });

    // 404 for all extensions; webpack resolve continues as usual
  } else {
    callback();
  }
}

module.exports = resolve;
