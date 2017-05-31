Plone Webpack Plugin
====================

**plonetheme-webpack-plugin** provides a Webpack (2.x) plugin and
presets for building completely Webpack managed themes for
[Plone 5](https://plone.com/), using the resources shipped with a Plone
release.

Please, see
[plonethemewwebpacktemplate](https://github.com/collective/plonetheme.webpacktemplate)
for an example of use.

In short, this package makes it possible to build Plone-themes with
Webpack so that all possible frontend resources are managed by Webpack
and are built from the package versions shipped with Plone.

This plugin requires a running Plone site while executing the build (or
webpack-dev-server) and does several things, which can be explained best
with the following minimal `webpack.config.js`.

``` {.sourceCode .javascript}
const webpack = require('webpack');
const path = require('path');
const merge = require('webpack-merge');

const PlonePlugin = require('plonetheme-webpack-plugin');

const SITENAME = process.env.SITENAME || 'Plone';
const THEMENAME = process.env.THEMENAME || 'mytheme';
const PUBLICPATH = process.env.PUBLICPATH || '/' + SITENAME + '/++theme++' + THEMENAME + '/';

const PATHS = {
  src: path.join(__dirname, 'src', THEMENAME),
  build: path.join(__dirname, 'theme', THEMENAME)
};

const PLONE = new PlonePlugin({
  portalUrl: 'http://localhost:8080/' + SITENAME,
  momentLocales: ['fi', 'ca'],
  publicPath: PUBLICPATH,
  sourcePath: PATHS.src,
  debug: false
});

const common = {
  entry: {
   'default': path.join(PATHS.src, 'default'),
   'logged-in': path.join(PATHS.src, 'logged-in')
  },
  output: {
    path: PATHS.build
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        use: [
          {
            loader: 'babel-loader',
            options: { cacheDirectory: true }
          }
        ],
        include: PATHS.src
      }
    ]
  }
};

switch(path.basename(process.argv[1])) {
  case 'webpack':
    module.exports = merge(PLONE.production, common);
    break;

  case 'webpack-dev-server':
    module.exports = merge(PLONE.development, common, {
      entry: [
        path.join(PATHS.src, 'default'),
        path.join(PATHS.src, 'logged-in')
      ]
    });
    break;
}

if (PLONE.config.debug) {
  console.log(module.exports);
}
```

0.  This example expects a Plone theme source at `./src/mytheme` and it
    builds a complete theme into `./theme/mytheme`.
1.  At first, PlonePlugin is initialized with the address for the
    running Plone site and other required information.
2.  While initializing itself, PlonePlugin reads RequireJS and
    LESS configuration from Plone and prepares mergeable Webpack presets
    into the plugin instance. The presets already include the plugin
    itself.
3.  A common Webpack configuration is defined with the bundles to build.
    Please, see
    [plonetheme.webpacktemplate](https://github.com/collective/plonetheme.webpacktemplate)
    for example bundles and example theme mockups (where final bundles
    get injected).
4.  Finally, PlonePlugin-presets for production and development
    are merged with the custom configuration (which may also override
    values in those presets).

See the plugin sources for the preset details.

Note that version 0.14.5 of css-loader is recommended with Plone,
because of [performance
issues](https://github.com/webpack/css-loader/issues/124) with the newer
versions.
