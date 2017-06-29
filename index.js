const assert = require('assert');
const extend = require('extend');
const fetch = require('sync-request');
const fs = require('fs');
const glob = require('glob');
const merge = require('webpack-merge');
const mkdirp = require('mkdirp');
const path = require('path');
const process = require('process');
const url = require('url');
const vm = require('vm');
const webpack = require('webpack');

const CopyWebpackPlugin = require('copy-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const WriteFileWebpackPlugin = require('write-file-webpack-plugin');


/**
 * Webpack context injection plugin to manage dynamic requires
 * http://stackoverflow.com/questions/30065018/dynamically-require-an-aliased-module-using-webpack
 */
class AddToContextPlugin {

  /**
   * @constructor
   * @param condition RegExp condition
   * @param extras List of available modules modules
   */
  constructor(condition, extras) {
    this.condition = condition;
    this.extras = extras || [];
  }

  //noinspection JSUnusedGlobalSymbols
  /**
   * @param compiler Webpack compiler instance
   */
  apply(compiler) {
    const condition = this.condition;
    const extras = this.extras;
    let newContext = false;
    compiler.plugin('context-module-factory', (cmf) => {
      cmf.plugin('after-resolve', (items, callback) => {
        newContext = true;
        return callback(null, items);
      });
      // this method is called for every path in the ctx
      // we just add our extras the first call
      cmf.plugin('alternatives', (items, callback) => {
        if (newContext && items[0].context.match(condition)) {
          newContext = false;
          const alternatives = extras.map((extra) => {
            return {
              context: items[0].context,
              request: extra
            };
          });
          items.push.apply(items, alternatives);
        }
        return callback(null, items);
      });
    });
  }
}


/**
 * const PLONE = new PlonePlugin({
 *     portalUrl: 'http://localhost:8080/' + SITENAME,
 *     publicPath: PUBLICPATH,
 *     sourcePath: PATHS.src,
 *     debug: true
 * });
 */
class PlonePlugin {
  constructor(options) {
    if (options.portalUrl) {
      // Remove trailing slash from portalUrl
      options.portalUrl = options.portalUrl.replace(/[/]+$/, '');
    }

    let config = this.config = extend({}, {
      debug: false,
      portalUrl: 'http://localhost:8080/Plone',
      sourcePath: null
    }, options);

    extend(config, {
      cachePath: path.join(process.cwd(), '.plone'),
      portalPath: url.parse(config.portalUrl).pathname,
      publicPath: '/Plone/++theme++webpack/',
      momentLocales: [
      ],
      resolveExtensions: [
        '',
        '.js'
      ],
      ignore: config.sourcePath
        ? [ path.join(path.basename(config.sourcePath), '?(*.js|*.jsx|*.css|*.less|*.scss)') ]
        : [],
      templates: config.sourcePath
        ? glob.sync(path.join(config.sourcePath, '**', '?(*.html|manifest.cfg)'))
        : []
    }, options, {
      resolveMatches: []  // ensure empty before merge
    });

    config = this.config = merge(config, {
      portalBase: config.portalUrl.substr(
        0, config.portalUrl.length - config.portalPath.length),
      resolveAlias: this.parseRequireJsPaths(),
      resolveMatches: [
        /([+]{2}\w+[+]{2}[^+]*)$/,
        /(collective\.js\.jqueryui\.custom\.min.*)/
      ],
      variables: this.parseLessVariables()
    }, options);

    // Dynamically add templates into ignore globs
    if (config.sourcePath) {
      extend(config, {
        'ignore': config.ignore.concat(
            config.templates.map((filename) => {
              return filename.substring(
                config.sourcePath.length -
                path.basename(config.sourcePath).length);
            })
        )
      });
    }

    // Preload Moment JS locales
    const self = this;
    config.momentLocales.map((locale) => {
      self.get('++plone++static/components/moment/locale/' + locale + '.js');
    });

    if (config.debug) { console.log(config); }

    // Pre-configure loaders
    this.rules = {

      url: {
        test: /\.(png|gif|jpg|otf|eot|svg|ttf|woff|woff2)(\?.*)?$/,
        use: [
          {
            loader: 'url-loader',
            options: { limit: 8192 }
          }
        ]
      },

      extract: {
        css: {
          test: /\.css$/i,
          use: ExtractTextPlugin.extract({
            fallback: 'style-loader',
            use: [
              'css-loader'
            ]
          })
        },
        less: {
          test: /\.less$/i,
          use: ExtractTextPlugin.extract({
            fallback: 'style-loader',
            use: [
              {
                loader: 'css-loader'
              },
              {
                loader: 'less-loader',
                options: {
                  globalVars: config.variables
                }
              }
            ]
          })
        },
        scss: {
          test: /\.scss$/i,
          use: ExtractTextPlugin.extract({
            fallback: 'style-loader',
            use: [
              'css-loader',
              'fast-sass-loader'
            ]
          })
        },
      },

      css: {
        test: /\.css$/i,
        use: [
          'style-loader',
          'css-loader'
        ]
      },

      less: {
        test: /\.less$/i,
        use: [
          {
            loader: 'style-loader'
          },
          {
            loader: 'css-loader',
            options: {
              sourceMap: true
            }
          },
          {
            loader: 'less-loader',
            options: {
              globalVars: config.variables
            }
          },
        ]
      },

      scss: {
        test: /\.scss$/i,
        use: [
          'style-loader',
          'css-loader?sourceMap',
          'fast-sass-loader'
        ]
      },

      shim: {

        ace: {
          test: /mockup\/texteditor\/pattern(.js)?$/,
          use: [
            'imports-loader?ace=ace,_a=ace/mode/javascript,_b=ace/mode/text,_c=ace/mode/css,_d=ace/mode/html,_e=ace/mode/xml,_f=ace/mode/less,_g=ace/mode/python,_h=ace/mode/xml,_i=ace/mode/ini'
          ]
        },

        backbone: {
          test: /backbone\.paginator(.js)?$/,
          use: [
            'imports-loader?jQuery=jquery,_=underscore,Backbone=backbone'
          ]
        },

        bootstraptransition : {
          test: /bootstrap\/js\/transition(.js)?$/,
          use: [
            'imports-loader?jQuery=jquery',
            'exports-loader?window.jQuery.support.transition'
          ]
        },

        bootstrapcollapse: {
          test: /bootstrap\/js\/collapse(.js)?$/,
          use: [
            'imports-loader?jQuery=jquery'
          ]
        },

        bootstraptooltip: {
          test: /bootstrap\/js\/tooltip(.js)?$/,
          use: [
            'imports-loader?jQuery=jquery'
          ]
        },

        bootstrapdropdown : {
          test: /bootstrap\/js\/dropdown(.js)?$/,
          use: [
            'imports-loader?jQuery=jquery'
          ]
        },

        bootstrapalert : {
          test: /bootstrap\/js\/alert(.js)?$/,
          use: [
            'imports-loader?jQuery=jquery'
          ]
        },

        jqtree: {
          test: /jqtree\/(tree\.jquery|node|lib\/.*)(.js)?$/,
          use: [
            'imports-loader?jQuery=jquery,$=jquery,this=>{jQuery:$}'
          ]
        },

        recurrenceinput: {
          test: /jquery\.recurrenceinput(.js)?$/,
          use: [
            'imports-loader?jQuery=jquery,tmpl=jquery.tmpl,_overlay=resource-plone-app-jquerytools-js,_dateinput=resource-plone-app-jquerytools-dateinput-js'
          ]
        },

        tinymce: {
          test: /tinymce(.js)?$/,
          use: [
            'imports-loader?document=>window.document,this=>window',
            'exports-loader?window.tinymce'
          ]
        },

        tinymceplugins: {
          test: /tinymce\/plugins.*(.js)?$/,
          use: [
            'imports-loader?tinymce,this=>{tinymce:tinymce}'
          ]
        },

        jqueryeventdrop: {
          test: /jquery\.event\.drop(.js)?$/,
          use: [
            'imports-loader?jQuery=jquery',
            'exports-loader?jQuery.drop'
          ]
        },

        jqueryeventdrag: {
          test: /jquery\.event\.drag(.js)?$/,
          use: [
            'imports-loader?jQuery=jquery',
            'exports-loader?jQuery.drag'
          ]
        },

        jquerytmpl: {
          test: /jquery\.tmpl(.js)?$/,
          use: [
            'imports-loader?jQuery=jquery,$=jquery',
            'exports-loader?jQuery.tmpl'
          ]
        },

        jquerycookie: {
          test: /jquery\.cookie(.js)?$/,
          use: [
            'imports-loader?jQuery=jquery,$=jquery',
            'exports-loader?jQuery.cookie'
          ]
        },

        mockuputils: {
          test: /mockupjs\/utils/,
          use: [
            'imports-loader?jQuery=jquery,$=jquery'
          ]
        },

        structure: {
          test: /structure\/js\//,
          use: [
            'imports-loader?$=jquery'
          ]
        },

        // Hack to work around webpack confusing fallback jquery define
        plone: {
          test: /\+\+resource\+\+plone(.js)?$/,
          use: [
            'imports-loader?__WEBPACK_LOCAL_MODULE_0__=jquery'
          ]
        },

        jquerytools: {
          test: /jquery\.tools\.overlay(.js)?$/,
          use: [
            'imports-loader?jQuery=jquery,$=jquery',
            'exports-loader?$.tabs'
          ]
        },

        select2: {
          test: /select2\/select2(.min)?(.js)?$/,
          use: [
            'imports-loader?jQuery=jquery'
          ]
        },

        ploneformgen: {
          test: /pfgquickedit\/quickedit(.js)?$/,
          use: [
            'imports-loader?requirejs=>define,_tabs=resource-plone-app-jquerytools-js'
          ]
        },

        patternslib: {
          test: /patternslib\/src\/core\/utils(.js)?$/,
          use: [
            'imports-loader?_=underscore'
          ]
        }
      }
    };

    // Pre-configure plugins
    this.plugins = {

      plone: this,

      hrm: new webpack.HotModuleReplacementPlugin(),

      extract: new ExtractTextPlugin({
        filename: '[name].[chunkhash].css',
        allChunks: true
      }),

      uglify: new webpack.optimize.UglifyJsPlugin(),

      defineproduction: new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify('production')
      }),

      commonschunk: new webpack.optimize.CommonsChunkPlugin(
        'commons.' + (new Date()).getTime() + '.js'
      ),

      // Plone defaults to moment built with locales
      moment: config.momentLocales.length
         ? new webpack.ContextReplacementPlugin(
             /moment[\\\/]locale$/,
             new RegExp('^\\.\\/(' + config.momentLocales.join('|') + ')$'))
         : new webpack.IgnorePlugin(/^\.\/locale$/, /moment$/),

      jqtree: new webpack.NormalModuleReplacementPlugin(
        /^\.\/jqtree-circle\.png$/, (ob) => {
          ob.request = '++plone++static/components/jqtree/jqtree-circle.png';
        }
      ),

      brokenrelativeresource: new webpack.NormalModuleReplacementPlugin(
        new RegExp('^\\.\\./[^+]*\\+\\+resource\\+\\+'), (ob) => {
          ob.request = ob.request.replace(/^[\.\/]+/, '');
        }
      ),

      // Fix dynamic requires in structure pattern
      // https://github.com/plone/mockup/commit/89de866dff89a455bd4102c84a3fa8f9a0bcc34b
      structurecontextreplacement: new webpack.ContextReplacementPlugin(
        /^\.$|mockup\/structure|mockup\/patterns\/structure/, (ob) => {
          ob.regExp = /^\.\/.*$|^mockup-patterns-structure-url\/.*$/;
        }
      ),
      structureaddtocontext: new AddToContextPlugin(
        /mockup\/structure|mockup\/patterns\/structure/, [
          'mockup-patterns-structure-url/js/actions',
          'mockup-patterns-structure-url/js/actionmenu',
          'mockup-patterns-structure-url/js/navigation',
          'mockup-patterns-structure-url/js/collections/result'
        ]
      ),

      // Write templates
      write: new WriteFileWebpackPlugin(),

      copy: config.sourcePath
        ? new CopyWebpackPlugin(
            [ { from: path.join(config.sourcePath, '..'), to: '..' } ],
            { ignore: config.ignore })
        : undefined,

      templates: config.sourcePath
        ? config.templates.map(function(name) {
            return new HtmlWebpackPlugin({
              filename: name.substring(config.sourcePath.replace(/\/*$/, '/').length),
              template: name,
              chunksSortMode: function(a, b) {
                return a.names[0].match(/^commons/) ? -1
                  : b.names[0].match(/^commons/) ? 1
                  : a.names[0] > b.names[0] ? 1 : -1;
              },
              inject: false
            })
          })
        : undefined,

      watchignore: new webpack.WatchIgnorePlugin([ config.cachePath ])
    };

    this.alias = merge(config.resolveAlias, {
      'ace': 'brace',
      'moment': '++plone++static/components/moment/moment'
    });

    this.development = {
      devtool: 'eval',
      resolve: {
        alias: this.alias
      },
      resolveLoader: {
        alias: {
          text: 'text-loader'
        }
      },
      module: {
        rules: [
          this.rules.url,
          this.rules.css,
          this.rules.less,
          this.rules.scss,
          this.rules.shim.ace,
          this.rules.shim.backbone,
          this.rules.shim.bootstrapalert,
          this.rules.shim.bootstrapcollapse,
          this.rules.shim.bootstrapdropdown,
          this.rules.shim.bootstraptooltip,
          this.rules.shim.bootstraptransition,
          this.rules.shim.jqtree,
          this.rules.shim.jquerycookie,
          this.rules.shim.jqueryeventdrag,
          this.rules.shim.jqueryeventdrop,
          this.rules.shim.jquerytmpl,
          this.rules.shim.jquerytools,
          this.rules.shim.mockuputils,
          this.rules.shim.structure,
          this.rules.shim.select2,
          this.rules.shim.patternslib,
          this.rules.shim.plone,
          this.rules.shim.ploneformgen,
          this.rules.shim.recurrenceinput,
          this.rules.shim.tinymce,
          this.rules.shim.tinymceplugins
        ]
      },
      devServer: {
        hot: true,
        inline: true,
        stats: 'errors-only',
        host: 'localhost',
        port: '9000'
      },
      output: {
        pathinfo: true,
        filename: 'bundle.js',
        publicPath: config.publicPath
      },
      plugins: [
        this.plugins.brokenrelativeresource,
        this.plugins.hrm,
        this.plugins.jqtree,
        this.plugins.moment,
        this.plugins.plone,
        this.plugins.structureaddtocontext,
        this.plugins.structurecontextreplacement,
        this.plugins.watchignore
      ]
    };
    if (config.sourcePath) {
      this.development.plugins = this.development.plugins.concat(
        this.plugins.templates.concat([
          this.plugins.copy,
          this.plugins.write
        ])
      );
    }

    this.production = {
      resolve: {
        alias: this.alias
      },
      resolveLoader: {
        alias: {
          text: 'text-loader'
        }
      },
      module: {
        exprContextCritical: false,
        rules: [
          this.rules.url,
          this.rules.extract.css,
          this.rules.extract.less,
          this.rules.extract.scss,
          this.rules.shim.ace,
          this.rules.shim.backbone,
          this.rules.shim.bootstrapalert,
          this.rules.shim.bootstrapcollapse,
          this.rules.shim.bootstrapdropdown,
          this.rules.shim.bootstraptooltip,
          this.rules.shim.bootstraptransition,
          this.rules.shim.jqtree,
          this.rules.shim.jquerycookie,
          this.rules.shim.jqueryeventdrag,
          this.rules.shim.jqueryeventdrop,
          this.rules.shim.jquerytmpl,
          this.rules.shim.jquerytools,
          this.rules.shim.mockuputils,
          this.rules.shim.structure,
          this.rules.shim.select2,
          this.rules.shim.patternslib,
          this.rules.shim.plone,
          this.rules.shim.ploneformgen,
          this.rules.shim.recurrenceinput,
          this.rules.shim.tinymce,
          this.rules.shim.tinymceplugins
        ]
      },
      output: {
        filename: '[name].[chunkhash].js',
        chunkFilename: '[chunkhash].js',
        publicPath: config.publicPath
      },
      plugins: [
        this.plugins.brokenrelativeresource,
        this.plugins.commonschunk,
        this.plugins.defineproduction,
        this.plugins.extract,
        this.plugins.jqtree,
        this.plugins.moment,
        this.plugins.plone,
        this.plugins.structureaddtocontext,
        this.plugins.structurecontextreplacement,
        this.plugins.uglify
      ]
    };
    if (config.sourcePath) {
      this.production.plugins = this.production.plugins.concat(
        this.plugins.templates.concat([
          this.plugins.copy
        ])
      );
    }
  }

  parseRequireJsPaths() {
    const mockup = {};

    mockup.window = mockup;
    mockup.requirejs = {
      config: (config) => {
        mockup.requirejs.config = config;
      }
    };

    let body, context, filename, script;

    filename = this.get('config.js');
    body = fs.readFileSync(filename, { encoding: 'utf-8' });
    body = body.replace('PORTAL_URL', "'" + this.config.portalUrl + "'");

    context = vm.createContext(mockup);
    script = new vm.Script(body);
    script.runInContext(context);

    return mockup.requirejs.config.paths;
  }

  parseLessVariables() {
    const mockup = {};

    mockup.window = mockup;

    let body, context, filename, script;

    filename = this.get('less-variables.js');
    body = fs.readFileSync(filename, { encoding: 'utf-8' });

    // normalize " escaping to ' fix issue where passing LESS variables
    // in less-loader query failed
    body = body.replace(
      /'"/gm,   '"\'').replace(   // '"  => "'
      /"',/gm,  '\'",').replace(  // "', => '",
      /\\"/gm, '\''); //          // \"  => '

    // remove baseUrl from URLs
    body = body.replace(new RegExp(this.config.portalUrl + '/', 'g'), '');

    context = vm.createContext(mockup);
    script = new vm.Script(body);
    script.runInContext(context);

    return mockup.less.globalVars;
  };

  match(path_) {
    if (path_) {
      for (let i = 0; i < this.config.resolveMatches.length; i++) {
        let match = path_.match(this.config.resolveMatches[i]);
        if (match) {
          return match[1];
        }
      }
    }
  }

  get(path_, force=false) {
    const url_ = this.config.portalUrl + '/' + path_.replace(/^[./]+/, '');

    let filename = path.join(
      this.config.cachePath,
      path.join.apply(null, path_.split('/'))
    );

    if (!force) {
      for (let i = 0; i < this.config.resolveExtensions.length; i++) {
        let extension = this.config.resolveExtensions[i];
        if (fs.existsSync(filename + extension)) {
          filename = filename + extension;
          if (this.config.debug) { console.log('Found: ' + filename); }
          return filename;
        }
      }
    }

    for (let i = 0; i < this.config.resolveExtensions.length; i++) {
      let extension = this.config.resolveExtensions[i];
      let response = fetch('GET', url_ + extension);
      if (response.statusCode === 200) {
        let data = response.getBody();
        filename = filename + extension;
        mkdirp.sync(path.dirname(filename));
        fs.writeFileSync(filename, data, { encoding: null });
        if (this.config.debug) { console.log('Plone: ' + url_); }
        if (this.config.debug) { console.log('Saved: ' + filename); }
        return filename;
      }
    }
  }

  apply(compiler) {
    const self = this;
    const seen = [];
    const resolved = {};

    compiler.plugin('compilation', function (compilation) {

      // Resolve files from Plone
      compilation.resolvers.normal.plugin('file', function (data, callback) {
        if (data.__plone) { return callback(); }

        // Match against PlonePlugin resolveMatches
        let match = self.match(data.path) || self.match(data.request);

        // XXX: query.recurrenceinput.css, bundled with CMFPlone, references
        // missing files next.gif, prev.gif and pb_close.png
        if (['next.gif', 'prev.gif', 'pb_close.png']
            .indexOf(path.basename(data.path)) >= 0) {
          match = path.basename(data.path);
          resolved[match] = path.join(__dirname, 'static', match);
        }

        // Download matches from Plone
        if (match && !resolved[match]) {
          if (seen.indexOf(data.path) === -1) {
            seen.push(data.path);
            resolved[match] = self.get(match);
          }
        }

        // Report downloads resolved
        if (match && resolved[match]) {
          return this.doResolve('resolved', extend(data, {
            path: resolved[match],
            __plone: true
          }), 'Plone:' + match, callback, true);
        }

        // Fallback to default resolvers
        return callback();
      });

      // Resolve JS modules from Plone
      compiler.resolvers.normal.plugin('module', function(data, callback) {
        if (data.__plone) { return callback(); }

        // Match against PlonePlugin resolveMatches
        let match = self.match(data.request);

        // Download matches from Plone
        if (match && !resolved[match]) {
          if (seen.indexOf(data.path) === -1) {
            seen.push(data.path);
            resolved[match] = self.get(match);
          }
        }

        // Report downloads resolved
        if (match && resolved[match]) {
          return this.doResolve('resolved', extend(data, {
            path: resolved[match],
            __plone: true
          }), 'Plone:' + match, callback, true);
        }

        // Fallback to default resolvers
        return callback();
      });
    });
  }
}

module.exports = PlonePlugin;
