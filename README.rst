Plone Webpack Plugin
====================

**plonetheme-webpack-plugin** provides a Webpack (1.x) plugin and presets for
building completely Webpack managed themes for Plone_ 5, using the resources
shipped with a Plone release.

Please, see plonetheme.webpackexample_ for an example of use.

.. _plonetheme.webpackexample: https://github.com/datakurre/plonetheme.webpackexample

In short, this package makes it possible to build Plone_-themes with Webpack so
that all possible frontend resources are managed by Webpack and are built from
the package versionis shipped with Plone.

.. _Plone: https://plone.com/

This plugin is still a work in progress and not all available Plone patterns
supported yet, though, all the default ones are.

This plugin requires a running Plone site while executing the build (or
webpack-dev-server) and does several things, which can be explained best
with the following minimal ``webpack.config.js``:

.. code:: javascript

    const webpack = require('webpack');
    const path = require('path');
    const merge = require('webpack-merge');

    const PlonePlugin = require('plonetheme-webpack-plugin');

    const PATHS = {
      src: path.join(__dirname, 'src', 'mytheme'),
      build: path.join(__dirname, 'theme', 'mytheme')
    };

    const PLONE = new PlonePlugin({
      portalUrl: 'http://localhost:8080/Plone',
      publicPath: '/Plone/++theme++mytheme/',
      sourcePath: PATHS.src
    });

    const common = {
      entry: {
       'anonymous': path.join(PATHS.src, 'anonymous'),
       'authenticated': path.join(PATHS.src, 'authenticated')
      },
      output: {
        path: PATHS.build
      },
      devServer: {
        outputPath: PATHS.build
      }
    };

    switch(path.basename(process.argv[1])) {
      case 'webpack':
        module.exports = merge(PLONE.production, common);
        break;

      case 'webpack-dev-server':
        module.exports = merge(PLONE.development, common, {
          entry: path.join(PATHS.src, 'authenticated')
        });
        break;
    }
    console.log(module.exports);

0. This example expects a Plone theme source at ``-/src/mytheme`` and it
   builds a complete theme into ``./theme/mytheme``.

1. At first, PloneWebpackPlugin is initialized with the address for
   the running Plone site and other required information.

2. While initializing itself, PloneWebpackPlugin reads RequireJS and LESS
   configuration from Plone and prepares mergeable Webpack presets into
   the plugin instance. The presets already include the plugin itself.

3. A common Webpack configuration is defined with the bundles to build.
   Please, see `plonetheme.webpackexample`_ for example bundles and
   example theme mockups (where final bundles get injected).

4. Finally, PloneWebpackPlugin-presets for production and development
   are merged with the custom configuration (which may also override
   values in those presets).

Please, see the plugin sources for the preset details.

The plugin includes all the recommended plugins as its dependencies, but
the required loaders must be added as dependency for own theme, as in the
following ``package.json`` example:

.. code:: json

    {
      "name": "plonetheme.mytheme",
      "version": "0.0.0",
      "devDependencies": {
        "css-loader": "^0.14.5",
        "exports-loader": "^0.6.3",
        "file-loader": "^0.9.0",
        "imports-loader": "^0.6.5",
        "less": "^2.7.1",
        "less-loader": "^2.2.3",
        "plonetheme-webpack-plugin": "^0.0.2",
        "style-loader": "^0.13.1",
        "text-loader": "0.0.1",
        "url-loader": "^0.5.7",
        "webpack": "^1.13.1",
        "webpack-dev-server": "^1.14.1",
        "webpack-merge": "^0.14.0"
      }
    }

Please, note that version 0.14.5 of css-loader is recommended, because
of `performance issues`__ with the newer versions.

__ https://github.com/webpack/css-loader/issues/124
